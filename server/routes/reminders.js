// server/routes/reminders.js

import express from 'express';
import pool from '../db.js';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { verifySession } from 'supertokens-node/recipe/session/framework/express/index.js';
import { sendEmail } from '../lib/emailService.js';
import { verifyRole } from '../utils.js';

const router = express.Router();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

router.post('/customer-samples/send-all-due-tomorrow', verifySession(), verifyRole('Admin'), async (req, res) => {
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

        if (checkouts.length === 0) {
            return res.status(200).json({ message: 'No samples are due tomorrow. No emails were sent.' });
        }

        const templatePath = path.join(__dirname, '../email-templates/customerReminder.html');
        const template = await fs.readFile(templatePath, 'utf-8');
        let emailsSent = 0;

        for (const checkout of checkouts) {
            const sampleListHtml = checkout.samples.map(name => `<li>${name}</li>`).join('');
            const dueDate = new Date(checkout.expected_return_date).toLocaleDateString();

            let emailHtml = template.replace('{{customerName}}', checkout.customer_name);
            emailHtml = emailHtml.replace('{{projectName}}', checkout.project_name);
            emailHtml = emailHtml.replace('{{dueDate}}', dueDate);
            emailHtml = emailHtml.replace('{{sampleList}}', sampleListHtml);

            const success = await sendEmail({
                to: checkout.customer_email,
                subject: `Friendly Reminder: Your Samples are Due Tomorrow`,
                html: emailHtml,
            });
            if (success) {
                emailsSent++;
            }
        }
        
        res.status(200).json({ message: `Process complete. Successfully sent ${emailsSent} reminder email(s).` });

    } catch (error) {
        console.error('Error manually sending customer sample reminders:', error);
        res.status(500).json({ error: 'An internal server error occurred.' });
    }
});

// --- NEW ENDPOINT for PAST DUE reminders ---
router.post('/customer-samples/send-all-past-due', verifySession(), verifyRole('Admin'), async (req, res) => {
    try {
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
            return res.status(200).json({ message: 'No samples are currently past due. No emails were sent.' });
        }

        const templatePath = path.join(__dirname, '../email-templates/pastDueReminder.html');
        const template = await fs.readFile(templatePath, 'utf-8');
        let emailsSent = 0;

        for (const checkout of overdueCheckouts) {
            const sampleListHtml = checkout.samples.map(name => `<li>${name}</li>`).join('');
            const dueDate = new Date(checkout.expected_return_date).toLocaleDateString();

            let emailHtml = template.replace('{{customerName}}', checkout.customer_name);
            emailHtml = emailHtml.replace('{{projectName}}', checkout.project_name);
            emailHtml = emailHtml.replace('{{dueDate}}', dueDate);
            emailHtml = emailHtml.replace('{{daysOverdue}}', checkout.days_overdue);
            emailHtml = emailHtml.replace('{{sampleList}}', sampleListHtml);

            const success = await sendEmail({
                to: checkout.customer_email,
                subject: `Action Required: Your Samples are Overdue`,
                html: emailHtml,
            });
            if (success) {
                emailsSent++;
            }
        }

        res.status(200).json({ message: `Process complete. Successfully sent ${emailsSent} past due reminder email(s).` });

    } catch (error) {
        console.error('Error manually sending past due reminders:', error);
        res.status(500).json({ error: 'An internal server error occurred.' });
    }
});

export default router;