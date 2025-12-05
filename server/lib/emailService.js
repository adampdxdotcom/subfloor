// server/lib/emailService.js

import nodemailer from 'nodemailer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pool from '../db.js';
import { decrypt } from '../utils.js';
import { getSystemConfig } from './setupService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Helper to get credentials (DB -> Env Fallback)
const getTransporterConfig = async () => {
    let emailUser, emailPass;

    try {
        const res = await pool.query("SELECT settings FROM system_preferences WHERE key = 'email_settings'");
        if (res.rows.length > 0 && res.rows[0].settings) {
            const s = res.rows[0].settings;
            if (s.emailUser && s.emailPass) {
                emailUser = s.emailUser;
                emailPass = decrypt(s.emailPass); 
            }
        }
    } catch (e) {
        console.warn("Failed to fetch email settings from DB, falling back to ENV", e.message);
    }

    if (!emailUser || !emailPass) {
        emailUser = process.env.EMAIL_USER || process.env.GMAIL_USER;
        emailPass = process.env.EMAIL_PASS || process.env.GMAIL_APP_PASSWORD;
    }

    if (!emailUser || !emailPass) {
        return null;
    }

    return { user: emailUser, pass: emailPass };
};

// Helper to get Branding Info
const getBrandingConfig = async () => {
    try {
        const res = await pool.query("SELECT settings FROM system_preferences WHERE key = 'branding'");
        if (res.rows.length > 0 && res.rows[0].settings) {
            return res.rows[0].settings;
        }
    } catch (e) {
        console.error("Failed to fetch branding for email:", e.message);
    }
    return { companyName: 'Subfloor' }; // Default
};

// Kept for backward compatibility
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
    // 1. Get Credentials & Branding
    const config = await getTransporterConfig();
    const branding = await getBrandingConfig();
    
    if (!config) {
        console.error('🔥 Email credentials missing. Cannot send email.');
        return false;
    }

    const transporter = nodemailer.createTransport({
        host: 'smtp.gmail.com',
        port: 465,
        secure: true,
        auth: { user: config.user, pass: config.pass },
        connectionTimeout: 10000, 
    });

    // Parse Arguments
    let to, subject, html;
    let templateData = {};

    if (typeof arg1 === 'object' && arg1.to) {
        to = arg1.to;
        subject = arg1.subject;
        templateData = arg1.data || {};
        
        // Inject Branding into Data
        templateData.companyName = branding.companyName || 'Subfloor';
        // Handle Logo URL (ensure absolute path if relative)
        if (branding.logoUrl) {
            // FIX: Get URL from Wizard Config -> Env -> Localhost Fallback
            const sysConfig = getSystemConfig();
            const baseUrl = sysConfig.publicUrl || process.env.APP_DOMAIN || 'http://localhost:3001';
            templateData.logoUrl = branding.logoUrl.startsWith('http') ? branding.logoUrl : `${baseUrl}${branding.logoUrl}`;
            // FIX: Create the full HTML tag expected by templates
            templateData.logoHtml = `<img src="${templateData.logoUrl}" alt="${templateData.companyName}" style="max-height: 50px; display: block; margin: 0 auto 10px;" />`;
        } else {
            templateData.logoUrl = ''; // Or a default hosted image
            templateData.logoHtml = '';
        }

        html = arg1.html || (arg1.templateName ? loadTemplate(arg1.templateName, templateData) : '');
    } else {
        // Legacy Support
        to = arg1;
        subject = arg2;
        const templateName = arg3;
        templateData = arg4 || {};
        templateData.companyName = branding.companyName || 'Subfloor';
        html = loadTemplate(templateName, templateData);
    }

    // Dynamic Sender Name
    const senderName = branding.companyName || "Subfloor Notifications";
    const mailOptions = { from: `"${senderName}" <${config.user}>`, to, subject, html };

    try {
        await transporter.sendMail(mailOptions);
        console.log(`✉️  Email sent successfully to ${to}`);
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