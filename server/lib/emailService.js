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

// --- NEW: ASYNC TEMPLATE LOADER ---
const getMergedTemplate = async (templateName, data) => {
    let rawHtml = '';
    let customSubject = null;
    let usedDbTemplate = false;

    // 1. Try DB
    try {
        const res = await pool.query(
            "SELECT subject, body_content FROM email_templates WHERE key = $1", 
            [templateName]
        );
        if (res.rows.length > 0 && res.rows[0].body_content) {
            rawHtml = res.rows[0].body_content;
            customSubject = res.rows[0].subject;
            usedDbTemplate = true;
        }
    } catch (err) {
        console.error(`Warning: Failed to query email_templates for ${templateName}`, err.message);
    }

    // 2. Fallback to File System
    if (!rawHtml) {
        try {
            const templatePath = path.join(__dirname, '../email-templates', `${templateName}.html`);
            if (fs.existsSync(templatePath)) {
                rawHtml = fs.readFileSync(templatePath, 'utf-8');
            } else {
                // Fail gracefully if neither exist
                rawHtml = `<p>System Message: ${data.notes || ''}</p>`;
            }
        } catch (error) {
            console.error(`🔥 Error loading file template ${templateName}:`, error);
            rawHtml = `<p>Error loading email template.</p>`;
        }
    }

    // 3. Prepare Master Layout (Only for DB templates)
    if (usedDbTemplate) {
        // Simple responsive wrapper for the DB content
        const baseLayout = `
<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<style>body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;line-height:1.6;color:#333;margin:0;padding:0;background-color:#f9fafb}.container{max-width:600px;margin:0 auto;background-color:#fff}.header{text-align:center;padding:20px 0;border-bottom:1px solid #eee}.content{padding:30px 20px}.footer{padding:20px;text-align:center;font-size:12px;color:#888;background-color:#f9fafb;border-top:1px solid #eee}a{color:#2563eb;text-decoration:none}</style>
</head><body>
<div class="container"><div class="header">{{logoHtml}}</div><div class="content">${rawHtml}</div>
<div class="footer">&copy; {{year}} {{companyName}}. All rights reserved.<br>Automated message from Subfloor.</div>
</div></body></html>`;
        rawHtml = baseLayout;
    }

    // 4. Shared Logic: Variable Replacement
    
    // Line Items (Special handling for tables)
    if (data.lineItems && Array.isArray(data.lineItems)) {
        const rows = data.lineItems.map(item => 
            `<tr style="border-bottom: 1px solid #eee;">
                <td style="padding: 8px;">${item.quantity} ${item.unit || ''}</td>
                <td style="padding: 8px;">${item.style} ${item.color ? '- ' + item.color : ''}</td>
            </tr>`
        ).join('');
        rawHtml = rawHtml.replace('{{lineItemsRows}}', rows);
        // Fallback for list view
        const listStr = data.lineItems.map(i => `• ${i.quantity}${i.unit || ''} ${i.style} ${i.color || ''}`).join('<br>');
        data.items_list = listStr; 
    }

    data.year = new Date().getFullYear();

    let finalHtml = rawHtml;
    Object.keys(data).forEach(key => {
        const regex = new RegExp(`{{${key}}}`, 'g');
        const val = (typeof data[key] === 'object') ? '' : data[key];
        finalHtml = finalHtml.replace(regex, val || '');
    });

    return { html: finalHtml, subject: customSubject };
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
    let templateName = null;

    if (typeof arg1 === 'object' && arg1.to) {
        to = arg1.to;
        subject = arg1.subject;
        templateData = arg1.data || {};
        templateName = arg1.templateName;
        html = arg1.html; // Allow direct HTML override
        
        // Inject Branding into Data
        templateData.companyName = branding.companyName || 'Subfloor';
        // Handle Logo URL (ensure absolute path if relative)
        if (branding.logoUrl) {
            const sysConfig = getSystemConfig();
            const baseUrl = sysConfig.publicUrl || process.env.APP_DOMAIN || 'http://localhost:3001';
            templateData.logoUrl = branding.logoUrl.startsWith('http') ? branding.logoUrl : `${baseUrl}${branding.logoUrl}`;
            templateData.logoHtml = `<img src="${templateData.logoUrl}" alt="${templateData.companyName}" style="max-height: 50px; display: block; margin: 0 auto 10px;" />`;
        } else {
            templateData.logoUrl = ''; 
            templateData.logoHtml = '';
        }

    } else {
        // Legacy Support
        to = arg1;
        subject = arg2;
        templateName = arg3;
        templateData = arg4 || {};
        templateData.companyName = branding.companyName || 'Subfloor';
    }

    // Resolve Template if needed
    if (!html && templateName) {
        const result = await getMergedTemplate(templateName, templateData);
        html = result.html;
        // If DB had a custom subject, override the passed subject
        if (result.subject) {
            subject = result.subject;
        }
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