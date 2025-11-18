// server/lib/scheduler.js

import cron from 'node-cron';
import pool from '../db.js';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { sendEmail } from './emailService.js';
import { getDashboardReportData } from './reports.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const formatDashboardEmailHtml = (data) => {
    let html = `<h1>Joblogger Daily Dashboard</h1><p>Here is your summary for today:</p>`;
    if (data.samplesDueToday?.length > 0) {
        html += '<h2>Samples Due Today</h2><ul>';
        data.samplesDueToday.forEach(item => {
            html += `<li><b>${item.sample_name}</b> for ${item.customer_name} (${item.project_name})</li>`;
        });
        html += '</ul>';
    }
    if (data.upcomingJobs?.length > 0) {
        html += '<h2>Upcoming Jobs</h2><ul>';
        data.upcomingJobs.forEach(item => {
            const startDate = new Date(item.start_date).toLocaleDateString();
            html += `<li><b>${item.project_name}</b> starting ${startDate} (Installer: ${item.installer_name || 'N/A'})</li>`;
        });
        html += '</ul>';
    }
    if (data.pendingQuotes?.length > 0) {
        html += '<h2>Pending Quotes Requiring Follow-up</h2><ul>';
        data.pendingQuotes.forEach(item => {
            const sentDate = new Date(item.date_sent).toLocaleDateString();
            html += `<li><b>${item.project_name}</b> for ${item.customer_name} (Sent on ${sentDate})</li>`;
        });
        html += '</ul>';
    }
    html += '<p>Have a great day!</p>';
    return html;
};

const initializeScheduler = () => {
    console.log('🕒 Initializing scheduler...');

    // --- JOB 1: Daily Dashboard Email (Unchanged) ---
    cron.schedule('0 7 * * *', async () => {
        console.log('🕒 Cron Job: Running Daily Dashboard Email task...');
        try {
            const usersResult = await pool.query(`SELECT ep.email, up.settings->'dashboardEmail' as preferences FROM emailpassword_users ep JOIN user_preferences up ON ep.user_id = up.user_id WHERE (up.settings->'dashboardEmail'->>'isEnabled')::boolean = true;`);
            const optedInUsers = usersResult.rows;
            if (optedInUsers.length > 0) console.log(`Found ${optedInUsers.length} user(s) opted-in for the dashboard email.`);
            for (const user of optedInUsers) {
                const reportData = await getDashboardReportData(user.preferences);
                const totalItems = (reportData.samplesDueToday?.length || 0) + (reportData.upcomingJobs?.length || 0) + (reportData.pendingQuotes?.length || 0);
                const shouldSend = user.preferences.frequency === 'daily' || (user.preferences.frequency === 'on_event' && totalItems > 0);
                if (shouldSend) {
                    console.log(`Sending dashboard email to ${user.email}...`);
                    const emailHtml = formatDashboardEmailHtml(reportData);
                    await sendEmail({ to: user.email, subject: 'Your Joblogger Daily Dashboard Summary', html: emailHtml });
                } else {
                    console.log(`Skipping email for ${user.email} due to 'on_event' preference and no new items.`);
                }
            }
        } catch (error) {
            console.error('🔥 An error occurred during the Daily Dashboard Email task:', error);
        }
        console.log('✅ Cron Job: Daily Dashboard Email task finished.');
    }, { scheduled: true, timezone: "America/New_York" });

    // --- JOB 2: Customer Sample Due Reminder (Unchanged) ---
    cron.schedule('0 8 * * *', async () => {
        console.log('🕒 Cron Job: Running Customer Sample Due Reminder task...');
        try {
            const query = `
                SELECT
                    c.full_name as customer_name,
                    c.email as customer_email,
                    p.project_name,
                    sc.expected_return_date,
                    json_agg(
                        COALESCE(
                            NULLIF(TRIM(CONCAT_WS(' - ', s.product_type, s.style, s.line, s.color)), ''),
                            'Sample ID: ' || s.id::text
                        )
                    ) as samples
                FROM sample_checkouts sc
                JOIN projects p ON sc.project_id = p.id
                JOIN customers c ON p.customer_id = c.id
                JOIN samples s ON sc.sample_id = s.id
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

                let emailHtml = template.replace('{{customerName}}', checkout.customer_name);
                emailHtml = emailHtml.replace('{{projectName}}', checkout.project_name);
                emailHtml = emailHtml.replace('{{dueDate}}', dueDate);
                emailHtml = emailHtml.replace('{{sampleList}}', sampleListHtml);

                await sendEmail({
                    to: checkout.customer_email,
                    subject: `Friendly Reminder: Your Samples are Due Tomorrow`,
                    html: emailHtml,
                });
            }
        } catch (error) {
            console.error('🔥 An error occurred during the Customer Sample Due Reminder task:', error);
        }
        console.log('✅ Cron Job: Customer Sample Due Reminder task finished.');
    }, { scheduled: true, timezone: "America/New_York" });

    // --- NEW JOB 3: Customer PAST DUE Sample Reminder ---
    cron.schedule('0 9 * * *', async () => {
        console.log('🕒 Cron Job: Running Customer PAST DUE Sample Reminder task...');
        try {
            // 1. Get the admin's setting for this feature. We assume one admin sets this for the whole system.
            const settingsResult = await pool.query(
                `SELECT settings->'dashboardEmail'->'pastDueReminders' as prefs 
                 FROM user_preferences 
                 WHERE settings->'dashboardEmail'->'pastDueReminders'->>'isEnabled' = 'true' 
                 LIMIT 1;`
            );

            if (settingsResult.rows.length === 0) {
                console.log('Past due reminders are disabled. Task complete.');
                return;
            }
            const { frequencyDays } = settingsResult.rows[0].prefs;
            
            // 2. Find all overdue checkouts and calculate days overdue
            const query = `
                SELECT
                    c.full_name as customer_name,
                    c.email as customer_email,
                    p.project_name,
                    sc.expected_return_date,
                    (CURRENT_DATE - sc.expected_return_date::date) as days_overdue,
                    json_agg(
                        COALESCE(
                            NULLIF(TRIM(CONCAT_WS(' - ', s.product_type, s.style, s.line, s.color)), ''),
                            'Sample ID: ' || s.id::text
                        )
                    ) as samples
                FROM sample_checkouts sc
                JOIN projects p ON sc.project_id = p.id
                JOIN customers c ON p.customer_id = c.id
                JOIN samples s ON sc.sample_id = s.id
                WHERE sc.expected_return_date::date < CURRENT_DATE
                  AND sc.actual_return_date IS NULL
                  AND c.email IS NOT NULL AND c.email != ''
                GROUP BY c.full_name, c.email, p.project_name, sc.expected_return_date;
            `;
            const result = await pool.query(query);
            const overdueCheckouts = result.rows;

            if (overdueCheckouts.length === 0) {
                console.log('No samples are currently past due. Task complete.');
                return;
            }
            
            // 3. Load the template
            const templatePath = path.join(__dirname, '../email-templates/pastDueReminder.html');
            const template = await fs.readFile(templatePath, 'utf-8');

            // 4. Loop, check frequency, and send email
            for (const checkout of overdueCheckouts) {
                // The core logic: only send if the days overdue is a multiple of the frequency
                if (checkout.days_overdue % frequencyDays === 0) {
                    console.log(`Sending past due reminder to ${checkout.customer_email} (${checkout.days_overdue} days overdue)`);
                    const sampleListHtml = checkout.samples.map(name => `<li>${name}</li>`).join('');
                    const dueDate = new Date(checkout.expected_return_date).toLocaleDateString();

                    let emailHtml = template.replace('{{customerName}}', checkout.customer_name);
                    emailHtml = emailHtml.replace('{{projectName}}', checkout.project_name);
                    emailHtml = emailHtml.replace('{{dueDate}}', dueDate);
                    emailHtml = emailHtml.replace('{{daysOverdue}}', checkout.days_overdue);
                    emailHtml = emailHtml.replace('{{sampleList}}', sampleListHtml);

                    await sendEmail({
                        to: checkout.customer_email,
                        subject: `Action Required: Your Samples are Overdue`,
                        html: emailHtml,
                    });
                }
            }
        } catch (error) {
            console.error('🔥 An error occurred during the Past Due Reminder task:', error);
        }
        console.log('✅ Cron Job: Customer PAST DUE Sample Reminder task finished.');
    }, { scheduled: true, timezone: "America/New_York" });

    console.log('✅ 🕒 Scheduler initialized with all jobs.');
};

export { initializeScheduler };