// server/lib/emailService.js

import nodemailer from 'nodemailer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let transporter;

const initializeEmailService = () => {
    // --- FIX: Check for both old (GMAIL_) and new (EMAIL_) variable names ---
    // Priority is given to EMAIL_USER (Standardized)
    const emailUser = process.env.EMAIL_USER || process.env.GMAIL_USER;
    const emailPass = process.env.EMAIL_PASS || process.env.GMAIL_APP_PASSWORD;

    if (!emailUser || !emailPass) {
        console.warn('🔥 EMAIL_USER or EMAIL_PASS environment variables not set. Email service is disabled.');
        return;
    }

    try {
        transporter = nodemailer.createTransport({
            host: 'smtp.gmail.com',
            port: 465,
            secure: true,
            auth: {
                user: emailUser,
                pass: emailPass,
            },
            connectionTimeout: 10000, 
        });

        transporter.verify((error, success) => {
            if (error) {
                console.error('🔥 Failed to verify Nodemailer transporter config:', error);
                transporter = undefined;
            } else {
                console.log('✅ 📧 Nodemailer transporter configured and verified successfully. Ready to send emails.');
            }
        });

    } catch (error) {
        console.error('🔥 An unexpected error occurred during Nodemailer initialization:', error);
    }
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
    if (!transporter) {
        console.error('🔥 Nodemailer transporter is not available or failed to initialize. Cannot send email.');
        return false;
    }

    // Handle Overloading:
    // 1. Legacy: ({ to, subject, html })
    // 2. New: (to, subject, templateName, data)
    let to, subject, html;
    
    if (typeof arg1 === 'object' && arg1.to) {
        ({ to, subject, html } = arg1);
    } else {
        to = arg1;
        subject = arg2;
        const templateName = arg3;
        const data = arg4 || {};
        html = loadTemplate(templateName, data);
    }

    // Determine the sender address based on what variables are available
    const emailUser = process.env.EMAIL_USER || process.env.GMAIL_USER;
    const mailOptions = { from: `"Joblogger" <${emailUser}>`, to, subject, html };

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