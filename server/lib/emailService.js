// server/lib/emailService.js

import nodemailer from 'nodemailer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pool from '../db.js';
import { decrypt } from '../utils.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Helper to get credentials (DB -> Env Fallback)
const getTransporterConfig = async () => {
    let emailUser, emailPass;

    try {
        // 1. Check Database
        const res = await pool.query("SELECT settings FROM system_preferences WHERE key = 'email_settings'");
        if (res.rows.length > 0 && res.rows[0].settings) {
            const s = res.rows[0].settings;
            if (s.emailUser && s.emailPass) {
                emailUser = s.emailUser;
                // decrypt function handles corrupted/null data gracefully
                emailPass = decrypt(s.emailPass); 
            }
        }
    } catch (e) {
        console.warn("Failed to fetch email settings from DB, falling back to ENV", e.message);
    }

    // 2. Fallback to ENV
    if (!emailUser || !emailPass) {
        emailUser = process.env.EMAIL_USER || process.env.GMAIL_USER;
        emailPass = process.env.EMAIL_PASS || process.env.GMAIL_APP_PASSWORD;
    }

    if (!emailUser || !emailPass) {
        return null;
    }

    return { user: emailUser, pass: emailPass };
};

// Kept for backward compatibility, but effectively empty now
const initializeEmailService = () => {
    console.log("📧 Email Service initialized (Lazy loading credentials enabled).");
};

const loadTemplate = (templateName, data) => {
    try {
        const templatePath = path.join(__dirname, '../email-templates', `${templateName}.html`);
        let html = fs.readFileSync(templatePath, 'utf-8');

        // Special handling for line items (Order Receipt)
        if (data.lineItems && Array.isArray(data.lineItems)) {
            const rows = data.lineItems.map(item => 
                `<tr style="border-bottom: 1px solid #eee;">
                    <td style="padding: 8px;">${item.quantity} ${item.unit || ''}</td>
                    <td style="padding: 8px;">${item.style} ${item.color ? '- ' + item.color : ''}</td>
                </tr>`
            ).join('');
            html = html.replace('{{lineItemsRows}}', rows);
        }

        // General Replacement
        Object.keys(data).forEach(key => {
            const regex = new RegExp(`{{${key}}}`, 'g');
            // If the data is an object/array (like lineItems), don't print [object Object]
            const val = (typeof data[key] === 'object') ? '' : data[key];
            html = html.replace(regex, val || '');
        });

        return html;
    } catch (error) {
        console.error(`🔥 Error loading template ${templateName}:`, error);
        return `<p>Error loading email template.</p>`;
    }
};

const sendEmail = async (arg1, arg2, arg3, arg4) => {
    // 1. Get Credentials
    const config = await getTransporterConfig();
    
    if (!config) {
        console.error('🔥 Email credentials missing (Check Settings or ENV). Cannot send email.');
        return false;
    }

    // 2. Create Transporter (On demand)
    const transporter = nodemailer.createTransport({
        host: 'smtp.gmail.com',
        port: 465,
        secure: true,
        auth: { user: config.user, pass: config.pass },
        connectionTimeout: 10000, 
    });

    // Handle Overloading:
    // 1. Legacy: ({ to, subject, html })
    // 2. New: (to, subject, templateName, data)
    let to, subject, html;
    
    if (typeof arg1 === 'object' && arg1.to) {
        to = arg1.to;
        subject = arg1.subject;
        // Fix: If html is missing but templateName exists, load the template
        html = arg1.html || (arg1.templateName ? loadTemplate(arg1.templateName, arg1.data) : '');
    } else {
        to = arg1;
        subject = arg2;
        const templateName = arg3;
        const data = arg4 || {};
        html = loadTemplate(templateName, data);
    }

    // Determine the sender address based on what variables are available
    const mailOptions = { from: `"Joblogger" <${config.user}>`, to, subject, html };

    try {
        await transporter.sendMail(mailOptions);
        console.log(`✉️  Email sent successfully to ${to} with subject "${subject}"`);
        return true;
    } catch (error) {
        console.error(`🔥 Error sending email to ${to}:`, error);
        return false;
    }
};

export {
    initializeEmailService,
    sendEmail,
};