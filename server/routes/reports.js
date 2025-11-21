// server/routes/reports.js

import express from 'express';
import pool from '../db.js';
import { verifySession } from 'supertokens-node/recipe/session/framework/express/index.js';
import { getDashboardReportData } from '../lib/reports.js';
import { sendEmail } from '../lib/emailService.js';

const router = express.Router();

// MODIFIED: This function now also renders the new data sections
const formatDashboardEmailHtml = (data) => {
    let html = `<h1>Joblogger Daily Update (Test)</h1><p>This is a test of your daily update email configuration.</p>`;
    let hasContent = false;

    if (data.myAppointments?.length > 0) {
        hasContent = true;
        html += '<h2>My Upcoming Appointments</h2><ul>';
        data.myAppointments.forEach(item => {
            const startTime = new Date(item.start_time).toLocaleString();
            html += `<li><b>${item.title}</b> at ${startTime}</li>`;
        });
        html += '</ul>';
    }

    if (data.jobsInProgress?.length > 0) {
        hasContent = true;
        html += '<h2>Jobs In Progress</h2><ul>';
        data.jobsInProgress.forEach(item => {
            const startDate = new Date(item.job_start).toLocaleDateString();
            const endDate = new Date(item.job_end).toLocaleDateString();
            html += `<li><b>${item.project_name}</b> (Scheduled: ${startDate} - ${endDate})</li>`;
        });
        html += '</ul>';
    }
    
    if (data.samplesDueToday?.length > 0) {
        hasContent = true;
        html += '<h2>Samples Due Today</h2><ul>';
        data.samplesDueToday.forEach(item => {
            html += `<li><b>${item.sample_name}</b> for ${item.customer_name} (${item.project_name})</li>`;
        });
        html += '</ul>';
    }

    if (data.upcomingJobs?.length > 0) {
        hasContent = true;
        html += '<h2>Upcoming Jobs</h2><ul>';
        data.upcomingJobs.forEach(item => {
            const startDate = new Date(item.start_date).toLocaleDateString();
            html += `<li><b>${item.project_name}</b> starting ${startDate} (Installer: ${item.installer_name || 'N/A'})</li>`;
        });
        html += '</ul>';
    }

    if (data.pendingQuotes?.length > 0) {
        hasContent = true;
        html += '<h2>Pending Quotes Requiring Follow-up</h2><ul>';
        data.pendingQuotes.forEach(item => {
            const sentDate = new Date(item.date_sent).toLocaleDateString();
            html += `<li><b>${item.project_name}</b> for ${item.customer_name} (Sent on ${sentDate})</li>`;
        });
        html += '</ul>';
    }
    
    if (!hasContent) {
        html += "<p><b>No items to report today based on your current settings.</b></p>";
    }

    html += '<p>If you received this, your email service is configured correctly!</p>';
    return html;
};

const DEFAULT_PREFERENCES = {
    includeSamplesDue: true,
    includeUpcomingJobs: true,
    upcomingJobsDays: 7,
    includePendingQuotes: true,
    pendingQuotesDays: 14,
    includePersonalAppointments: true, // Add new defaults
    personalAppointmentsDays: 7,
};

// MODIFIED: This route is now mostly for debugging and not used by the UI directly.
router.get('/dashboard', verifySession(), async (req, res) => {
    const userId = req.session.getUserId();
    try {
        const prefsResult = await pool.query('SELECT preferences FROM user_preferences WHERE user_id = $1', [userId]);
        const userPrefs = prefsResult.rows[0]?.preferences?.dashboardEmail || {};
        const finalPrefs = { ...DEFAULT_PREFERENCES, ...userPrefs };
        // Pass userId to get personal data
        const reportData = await getDashboardReportData(finalPrefs, userId);
        res.json(reportData);
    } catch (err) {
        console.error('Error in /api/reports/dashboard:', err.message);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// MODIFIED: The main fix is in this endpoint.
router.post('/dashboard/send-test', verifySession(), async (req, res) => {
    const userId = req.session.getUserId(); // We already have the userId here.
    try {
        const userResult = await pool.query('SELECT email FROM emailpassword_users WHERE user_id = $1', [userId]);
        if (userResult.rows.length === 0) {
            return res.status(404).json({ error: 'Current user not found in database.' });
        }
        const userEmail = userResult.rows[0].email;
        const currentSettings = req.body.settings;
        if (!currentSettings) {
            return res.status(400).json({ error: 'Settings payload is required.' });
        }
        
        // --- THIS IS THE FIX ---
        // Pass the `userId` to the data-gathering function.
        const reportData = await getDashboardReportData(currentSettings, userId);
        
        const emailHtml = formatDashboardEmailHtml(reportData);
        const success = await sendEmail({
            to: userEmail,
            subject: 'Test: Your Joblogger Daily Update',
            html: emailHtml,
        });

        if (success) {
            res.status(200).json({ message: 'Test email sent successfully!' });
        } else {
            res.status(500).json({ error: 'Failed to send test email. Check server logs for details.' });
        }
    } catch (err) {
        console.error('Error sending test dashboard email:', err.message);
        res.status(500).json({ error: 'Internal server error while sending test email.' });
    }
});

export default router;