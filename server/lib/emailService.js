// server/lib/emailService.js

import nodemailer from 'nodemailer';

let transporter;

const initializeEmailService = () => {
    if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) {
        console.warn('🔥 GMAIL_USER or GMAIL_APP_PASSWORD environment variables not set. Email service is disabled.');
        return;
    }

    try {
        transporter = nodemailer.createTransport({
            host: 'smtp.gmail.com',
            port: 465,
            secure: true,
            auth: {
                user: process.env.GMAIL_USER,
                pass: process.env.GMAIL_APP_PASSWORD,
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

const sendEmail = async ({ to, subject, html }) => {
    if (!transporter) {
        console.error('🔥 Nodemailer transporter is not available or failed to initialize. Cannot send email.');
        return false;
    }

    const mailOptions = {
        from: `"Joblogger" <${process.env.GMAIL_USER}>`,
        to,
        subject,
        html,
    };

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