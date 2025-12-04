// server/lib/scheduler.js

import cron from 'node-cron';
import pool from '../db.js';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { sendEmail } from './emailService.js';
import { getDashboardReportData } from './reports.js';
import { getSystemConfig } from './setupService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Global variables to hold the running tasks so we can stop them
let dailyEmailTask;
let reminderTask;
let pastDueTask;

// HELPER: Fetch branding for internal email construction
const getBranding = async () => {
    try {
        const res = await pool.query("SELECT settings FROM system_preferences WHERE key = 'branding'");
        const s = res.rows[0]?.settings || {};
        const companyName = s.companyName || 'Subfloor';
        
        let logoHtml = '';
        if (s.logoUrl) {
            // FIX: Get URL from Wizard Config -> Env -> Localhost Fallback
            const sysConfig = getSystemConfig();
            const baseUrl = sysConfig.publicUrl || process.env.APP_DOMAIN || 'http://localhost:3001';
            const logoUrl = s.logoUrl.startsWith('http') ? s.logoUrl : `${baseUrl}${s.logoUrl}`;
            logoHtml = `<img src="${logoUrl}" alt="${companyName}" style="display:block; margin:0 auto 10px; max-height:50px;" />`;
        }
        return { companyName, logoHtml };
    } catch (e) {
        return { companyName: 'Subfloor', logoHtml: '' };
    }
};

const formatDashboardEmailHtml = (data, branding) => {
    // Header Style matching other templates
    const headerStyle = `background-color: #1f2937; color: #ffffff; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;`;
    const containerStyle = `max-width: 600px; margin: 0 auto; font-family: Arial, sans-serif; line-height: 1.6; color: #333;`;
    const contentStyle = `padding: 20px; border: 1px solid #e2e8f0; border-top: none;`;

    let html = `
        <div style="${containerStyle}">
            <div style="${headerStyle}">
                ${branding.logoHtml}
                <h1 style="margin:0; font-size:24px;">${branding.companyName} Daily Update</h1>
            </div>
            <div style="${contentStyle}">
                <p>Here is your summary for today:</p>
    `;
    
    let hasContent = false;

    if (data.myAppointments?.length > 0) {
        hasContent = true;
        html += '<h3>My Upcoming Appointments</h3><ul>';
        data.myAppointments.forEach(item => {
            const startTime = new Date(item.start_time).toLocaleString();
            html += `<li><b>${item.title}</b> at ${startTime}</li>`;
        });
        html += '</ul>';
    }

    if (data.jobsInProgress?.length > 0) {
        hasContent = true;
        html += '<h3>Jobs In Progress</h3><ul>';
        data.jobsInProgress.forEach(item => {
            const startDate = new Date(item.job_start).toLocaleDateString();
            const endDate = new Date(item.job_end).toLocaleDateString();
            html += `<li><b>${item.project_name}</b> (Scheduled: ${startDate} - ${endDate})</li>`;
        });
        html += '</ul>';
    }
    
    if (data.samplesDueToday?.length > 0) {
        hasContent = true;
        html += '<h3>Samples Due Today</h3><ul>';
        data.samplesDueToday.forEach(item => {
            html += `<li><b>${item.sample_name}</b> for ${item.customer_name} (${item.project_name})</li>`;
        });
        html += '</ul>';
    }

    if (data.upcomingJobs?.length > 0) {
        hasContent = true;
        html += '<h3>Upcoming Jobs</h3><ul>';
        data.upcomingJobs.forEach(item => {
            const startDate = new Date(item.start_date).toLocaleDateString();
            html += `<li><b>${item.project_name}</b> starting ${startDate} (Installer: ${item.installer_name || 'N/A'})</li>`;
        });
        html += '</ul>';
    }

    if (data.pendingQuotes?.length > 0) {
        hasContent = true;
        html += '<h3>Pending Quotes Requiring Follow-up</h3><ul>';
        data.pendingQuotes.forEach(item => {
            const sentDate = new Date(item.date_sent).toLocaleDateString();
            html += `<li><b>${item.project_name}</b> for ${item.customer_name} (Sent on ${sentDate})</li>`;
        });
        html += '</ul>';
    }

    if (!hasContent) {
        html += "<p>No new updates to report today.</p>";
    }

    html += '<p>Have a great day!</p></div>';
    
    // Footer
    html += `
        <div style="text-align: center; padding: 20px; font-size: 12px; color: #94a3b8;">
            <p>&copy; ${new Date().getFullYear()} ${branding.companyName}. All rights reserved.</p>
        </div>
    </div>`;
    
    return html;
};

export const initializeScheduler = async () => {
    // 1. STOP existing tasks if they are running (allows for live reloading)
    if (dailyEmailTask) dailyEmailTask.stop();
    if (reminderTask) reminderTask.stop();
    if (pastDueTask) pastDueTask.stop();

    console.log('🕒 Initializing scheduler...');

    // 2. Determine Schedule Time & Timezone from DB
    let cronSchedule = '0 7 * * *'; // Default 7 AM
    let timezone = "America/New_York"; // Default

    try {
        const res = await pool.query("SELECT settings FROM system_preferences WHERE key = 'email'");
        const s = res.rows[0]?.settings;
        if (s?.dailyUpdateTime) {
            const [hour, minute] = s.dailyUpdateTime.split(':');
            cronSchedule = `${parseInt(minute)} ${parseInt(hour)} * * *`;
        }
        if (s?.timezone) timezone = s.timezone;
        console.log(`🕒 Configured Daily Email: ${s?.dailyUpdateTime || '07:00'} in ${timezone}`);
    } catch (e) { console.error("Error fetching schedule settings, using defaults.", e); }

    // --- JOB 1: Daily Dashboard Email (Assignable) ---
    dailyEmailTask = cron.schedule(cronSchedule, async () => {
        console.log('🕒 Cron Job: Running Daily Dashboard Email task...');
        try {
            const usersResult = await pool.query(`SELECT ep.user_id, ep.email, up.preferences->'dashboardEmail' as preferences FROM emailpassword_users ep JOIN user_preferences up ON ep.user_id = up.user_id WHERE (up.preferences->'dashboardEmail'->>'isEnabled')::boolean = true;`);
            const optedInUsers = usersResult.rows;

            if (optedInUsers.length > 0) {
                console.log(`Found ${optedInUsers.length} user(s) opted-in for the daily update.`);
                const branding = await getBranding(); // Fetch branding once for the batch

                for (const user of optedInUsers) {
                    const reportData = await getDashboardReportData(user.preferences, user.user_id);
                    
                    const totalItems = 
                        (reportData.myAppointments?.length || 0) +
                        (reportData.jobsInProgress?.length || 0) +
                        (reportData.samplesDueToday?.length || 0) +
                        (reportData.upcomingJobs?.length || 0) +
                        (reportData.pendingQuotes?.length || 0);

                    const shouldSend = user.preferences.frequency === 'daily' || (user.preferences.frequency === 'on_event' && totalItems > 0);

                    if (shouldSend) {
                        console.log(`Sending daily update to ${user.email}...`);
                        const emailHtml = formatDashboardEmailHtml(reportData, branding);
                        await sendEmail({ 
                            to: user.email, 
                            subject: `${branding.companyName} Daily Update`, 
                            html: emailHtml 
                        });
                    } else {
                        console.log(`Skipping email for ${user.email} due to preference and no new items.`);
                    }
                }
            }
        } catch (error) {
            console.error('🔥 An error occurred during the Daily Dashboard Email task:', error);
        }
        console.log('✅ Cron Job: Daily Dashboard Email task finished.');
    }, { scheduled: true, timezone });

    // --- JOB 2: Customer Sample Due Reminder (Assignable) ---
    reminderTask = cron.schedule('0 8 * * *', async () => {
        console.log('🕒 Cron Job: Running Customer Sample Due Reminder task...');
        try {
            const branding = await getBranding();
            // ... (Query remains same)
            const query = `
                SELECT
                    c.full_name as customer_name,
                    c.email as customer_email,
                    p.project_name,
                    sc.expected_return_date,
                    json_agg(COALESCE(prod.name || ' - ' || pv.name, 'Sample ID: ' || pv.id::text)) as samples
                FROM sample_checkouts sc
                JOIN projects p ON sc.project_id = p.id
                JOIN customers c ON p.customer_id = c.id
                JOIN product_variants pv ON sc.variant_id = pv.id
                JOIN products prod ON pv.product_id = prod.id
                WHERE sc.expected_return_date::date = CURRENT_DATE + INTERVAL '1 day'
                  AND sc.actual_return_date IS NULL
                  AND c.email IS NOT NULL AND c.email != ''
                GROUP BY c.full_name, c.email, p.project_name, sc.expected_return_date;
            `;
            const result = await pool.query(query);
            const checkouts = result.rows;

            if (checkouts.length === 0) { return; }
            console.log(`Found ${checkouts.length} project(s) with samples due tomorrow.`);
            const templatePath = path.join(__dirname, '../email-templates/customerReminder.html');
            const template = await fs.readFile(templatePath, 'utf-8');

            for (const checkout of checkouts) {
                const sampleListHtml = checkout.samples.map(name => `<li>${name}</li>`).join('');
                const dueDate = new Date(checkout.expected_return_date).toLocaleDateString();

                
                await sendEmail({
                    to: checkout.customer_email,
                    subject: "Friendly Reminder: Your Samples are Due Tomorrow",
                    templateName: 'customerReminder',
                    data: {
                        customerName: checkout.customer_name,
                        projectName: checkout.project_name,
                        dueDate: dueDate,
                        sampleList: sampleListHtml
                    }
                });
            }
        } catch (error) {
            console.error('🔥 An error occurred during the Customer Sample Due Reminder task:', error);
        }
        console.log('✅ Cron Job: Customer Sample Due Reminder task finished.');
    }, { scheduled: true, timezone });

    // --- JOB 3: Customer PAST DUE Sample Reminder (Assignable) ---
    pastDueTask = cron.schedule('0 9 * * *', async () => {
        console.log('🕒 Cron Job: Running Customer PAST DUE Sample Reminder task...');
        try {
            // ... (Same query logic as before) ...
            const settingsResult = await pool.query(`SELECT settings FROM system_preferences WHERE key = 'email'`);
            const pastDuePrefs = settingsResult.rows[0]?.settings?.pastDueReminders;
            if (!pastDuePrefs || !pastDuePrefs.isEnabled) return;
            const { frequencyDays } = pastDuePrefs;
            
            const query = `
                SELECT
                    c.full_name as customer_name,
                    c.email as customer_email,
                    p.project_name,
                    sc.expected_return_date,
                    (CURRENT_DATE - sc.expected_return_date::date) as days_overdue,
                    json_agg(COALESCE(prod.name || ' - ' || pv.name, 'Sample ID: ' || pv.id::text)) as samples
                FROM sample_checkouts sc
                JOIN projects p ON sc.project_id = p.id
                JOIN customers c ON p.customer_id = c.id
                JOIN product_variants pv ON sc.variant_id = pv.id
                JOIN products prod ON pv.product_id = prod.id
                WHERE sc.expected_return_date::date < CURRENT_DATE
                  AND sc.actual_return_date IS NULL
                  AND c.email IS NOT NULL AND c.email != ''
                GROUP BY c.full_name, c.email, p.project_name, sc.expected_return_date;
            `;
            const result = await pool.query(query);
            const overdueCheckouts = result.rows;
            if (overdueCheckouts.length === 0) return;

            for (const checkout of overdueCheckouts) {
                if (checkout.days_overdue > 0 && checkout.days_overdue % frequencyDays === 0) {
                    const sampleListHtml = checkout.samples.map(name => `<li>${name}</li>`).join('');
                    const dueDate = new Date(checkout.expected_return_date).toLocaleDateString();

                    // Use the new smart sendEmail call
                    await sendEmail({
                        to: checkout.customer_email,
                        subject: "Action Required: Your Samples are Overdue",
                        templateName: 'pastDueReminder',
                        data: {
                            customerName: checkout.customer_name,
                            projectName: checkout.project_name,
                            dueDate: dueDate,
                            daysOverdue: checkout.days_overdue,
                            sampleList: sampleListHtml
                        }
                    });
                }
            }
        } catch (error) {
            console.error('🔥 An error occurred during the Past Due Reminder task:', error);
        }
        console.log('✅ Cron Job: Customer PAST DUE Sample Reminder task finished.');
    }, { scheduled: true, timezone });

    console.log('✅ 🕒 Scheduler initialized with all jobs.');
};