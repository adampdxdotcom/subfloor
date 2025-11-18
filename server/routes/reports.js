// server/routes/reports.js

import express from 'express';
import pool from '../db.js';
import { verifySession } from 'supertokens-node/recipe/session/framework/express/index.js';
import { getDashboardReportData } from '../lib/reports.js';
import { sendEmail } from '../lib/emailService.js';

const router = express.Router();

const formatDashboardEmailHtml = (data) => {
    let html = `<h1>Joblogger Daily Dashboard (Test)</h1><p>This is a test of your daily summary email configuration.</p>`;
    const totalItems = (data.samplesDueToday?.length || 0) + (data.upcomingJobs?.length || 0) + (data.pendingQuotes?.length || 0);

    if (totalItems === 0) {
        html += "<p><b>No items to report today based on your current settings.</b></p>";
    } else {
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
                const sentDate = new Date(item.sent_date).toLocaleDateString();
                html += `<li><b>${item.project_name}</b> for ${item.customer_name} (Sent on ${sentDate})</li>`;
            });
            html += '</ul>';
        }
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
};

router.get('/dashboard', verifySession(), async (req, res) => {
    const userId = req.session.getUserId();
    try {
        const prefsResult = await pool.query('SELECT settings FROM user_preferences WHERE user_id = $1', [userId]);
        const userPrefs = prefsResult.rows[0]?.settings?.dashboardEmail || {};
        const finalPrefs = { ...DEFAULT_PREFERENCES, ...userPrefs };
        const reportData = await getDashboardReportData(finalPrefs);
        res.json(reportData);
    } catch (err) {
        console.error('Error in /api/reports/dashboard:', err.message);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.post('/dashboard/send-test', verifySession(), async (req, res) => {
    const userId = req.session.getUserId();
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
        const reportData = await getDashboardReportData(currentSettings);
        const emailHtml = formatDashboardEmailHtml(reportData);
        const success = await sendEmail({
            to: userEmail,
            subject: 'Test: Your Joblogger Daily Dashboard',
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