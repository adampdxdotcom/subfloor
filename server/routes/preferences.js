import express from 'express';
import pool from '../db.js';
import { verifySession } from 'supertokens-node/recipe/session/framework/express/index.js';
import { verifyRole, encrypt } from '../utils.js';
import { sendEmail } from '../lib/emailService.js';
import { initializeScheduler } from '../lib/scheduler.js'; // Import scheduler
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const router = express.Router();

// =================================================================
// USER PREFERENCES (Logged-in User)
// =================================================================

router.get('/', verifySession(), async (req, res) => {
    const userId = req.session.getUserId();
    try {
        const result = await pool.query('SELECT preferences FROM user_preferences WHERE user_id = $1', [userId]);
        if (result.rows.length === 0) return res.status(200).json({});
        res.status(200).json(result.rows[0].preferences);
    } catch (err) {
        console.error('Error fetching user preferences:', err.message);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// POST /api/preferences/calendar-token - Generate or Reset iCal Token
router.post('/calendar-token', verifySession(), async (req, res) => {
    const userId = req.session.getUserId();
    
    // Generate a simple random token (UUID-like)
    const crypto = await import('crypto');
    const token = crypto.randomBytes(16).toString('hex');

    try {
        await pool.query(
            `UPDATE user_preferences 
             SET calendar_token = $1 
             WHERE user_id = $2`,
            [token, userId]
        );
        res.json({ token });
    } catch (err) {
        console.error('Error generating calendar token:', err.message);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// GET /api/preferences/calendar-token - Get current token
router.get('/calendar-token', verifySession(), async (req, res) => {
    const userId = req.session.getUserId();
    try {
        const result = await pool.query(
            `SELECT calendar_token FROM user_preferences WHERE user_id = $1`,
            [userId]
        );
        res.json({ token: result.rows[0]?.calendar_token || null });
    } catch (err) {
        console.error('Error fetching calendar token:', err.message);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.put('/', verifySession(), async (req, res) => {
    const userId = req.session.getUserId();
    const preferencesPayload = req.body;
    if (!preferencesPayload || typeof preferencesPayload !== 'object') {
        return res.status(400).json({ error: 'Missing preferences data' });
    }
    try {
        const query = `
            INSERT INTO user_preferences (user_id, preferences, updated_at)
            VALUES ($1, $2, NOW())
            ON CONFLICT (user_id) 
            DO UPDATE SET preferences = user_preferences.preferences || $2, updated_at = NOW()
            RETURNING preferences;
        `;
        const result = await pool.query(query, [userId, preferencesPayload]);
        res.status(200).json(result.rows[0].preferences);
    } catch (err) {
        console.error('Error saving user preferences:', err.message);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// =================================================================
// SYSTEM PREFERENCES (Admin Only)
// =================================================================

// =================================================================
// EMAIL SETTINGS (Specific Handler for Encryption)
// =================================================================

// GET /system/email_settings (Redacts password)
router.get('/system/email_settings', verifySession(), verifyRole('Admin'), async (req, res) => {
    try {
        const result = await pool.query("SELECT settings FROM system_preferences WHERE key = 'email_settings'");
        if (result.rows.length === 0) return res.json({});
        
        const settings = result.rows[0].settings;
        
        // SECURITY: Never send the encrypted OR decrypted password to the frontend.
        if (settings.emailPass) {
            settings.emailPass = '********'; 
        }
        
        res.json(settings);
    } catch (err) {
        console.error('Error fetching email settings:', err.message);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// PUT /system/email_settings (Handles Encryption)
router.put('/system/email_settings', verifySession(), verifyRole('Admin'), async (req, res) => {
    const { emailUser, emailPass } = req.body;
    
    try {
        let finalSettings = { emailUser };

        // 1. Fetch existing settings to get the currently encrypted password
        const existingResult = await pool.query("SELECT settings FROM system_preferences WHERE key = 'email_settings'");
        const existingSettings = existingResult.rows.length > 0 ? existingResult.rows[0].settings : {};

        // 2. Handle Password Logic
        if (emailPass === '********') {
            // User didn't change the password, keep the old encrypted one
            finalSettings.emailPass = existingSettings.emailPass;
        } else if (emailPass && emailPass.trim() !== '') {
            // User entered a new password, encrypt it
            finalSettings.emailPass = encrypt(emailPass);
        } else {
            // User cleared the password
            finalSettings.emailPass = null;
        }

        const query = `
            INSERT INTO system_preferences (key, settings, updated_at) VALUES ('email_settings', $1, NOW())
            ON CONFLICT (key) DO UPDATE SET settings = $1, updated_at = NOW();
        `;
        await pool.query(query, [finalSettings]);
        
        res.json({ message: 'Email settings saved.' });
    } catch (err) {
        console.error('Error saving email settings:', err.message);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// POST /system/email_test (Trigger a test email)
router.post('/system/email_test', verifySession(), verifyRole('Admin'), async (req, res) => {
    const userId = req.session.getUserId();
    try {
        // 1. Get the current admin's email address
        const userResult = await pool.query("SELECT email FROM emailpassword_users WHERE user_id = $1", [userId]);
        if (userResult.rows.length === 0) return res.status(404).json({ error: 'User not found' });
        const adminEmail = userResult.rows[0].email;

        // 2. Send a raw HTML test email
        const success = await sendEmail({
            to: adminEmail,
            subject: 'Joblogger SMTP Test',
            html: '<h1>Success!</h1><p>Your email settings are configured correctly.</p>'
        });

        if (success) {
            res.json({ message: 'Test email sent successfully.' });
        } else {
            res.status(500).json({ error: 'Failed to send test email. Check server logs.' });
        }
    } catch (err) {
        console.error('Error sending test email:', err.message);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// GET /system/branding (Public/User Accessible)
router.get('/system/branding', verifySession(), async (req, res) => {
    try {
        const result = await pool.query("SELECT settings FROM system_preferences WHERE key = 'branding'");
        if (result.rows.length === 0) return res.json({});
        res.json(result.rows[0].settings);
    } catch (err) {
        console.error('Error fetching branding:', err.message);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// GET /system/:key (Admin Only)
router.get('/system/:key', verifySession(), verifyRole('Admin'), async (req, res) => {
    const { key } = req.params;
    try {
        const result = await pool.query('SELECT settings FROM system_preferences WHERE key = $1', [key]);
        if (result.rows.length === 0) return res.json({});
        res.json(result.rows[0].settings);
    } catch (err) {
        console.error(`Error fetching system preference '${key}':`, err.message);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// PUT /system/:key (Admin Only)
router.put('/system/:key', verifySession(), verifyRole('Admin'), async (req, res) => {
    const { key } = req.params;
    try {
        const query = `
            INSERT INTO system_preferences (key, settings, updated_at) VALUES ($1, $2, NOW())
            ON CONFLICT (key) DO UPDATE SET settings = $2, updated_at = NOW();
        `;
        await pool.query(query, [key, req.body]);
        
        // RELOAD SCHEDULER if email settings changed
        if (key === 'email') {
            await initializeScheduler();
        }

        res.json({ message: 'System preferences saved.' });
    } catch (err) {
        console.error(`Error saving system preference '${key}':`, err.message);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// POST /system/scheduler_debug (Check who is opted in)
router.post('/system/scheduler_debug', verifySession(), verifyRole('Admin'), async (req, res) => {
    try {
        // Run the EXACT query the scheduler uses
        const query = `
            SELECT ep.email, up.preferences->'dashboardEmail' as prefs 
            FROM emailpassword_users ep 
            JOIN user_preferences up ON ep.user_id = up.user_id 
            WHERE (up.preferences->'dashboardEmail'->>'isEnabled')::boolean = true;
        `;
        const result = await pool.query(query);
        res.json({ 
            count: result.rowCount, 
            users: result.rows.map(r => ({ email: r.email, frequency: r.prefs.frequency })) 
        });
    } catch (err) {
        console.error('Scheduler debug error:', err);
        res.status(500).json({ error: err.message });
    }
});

// =================================================================
//  BRANDING UPLOAD (Admin Only)
// =================================================================

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        // FIX: Enforce absolute path in production, use relative path in development
        const dir = process.env.NODE_ENV === 'production' 
            ? '/app/server/uploads/branding'
            : path.join(__dirname, '../uploads/branding');
            
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        cb(null, dir);
    },
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname);
        cb(null, `${file.fieldname}-${Date.now()}${ext}`);
    }
});

const upload = multer({ storage });

router.post('/system/branding', verifySession(), verifyRole('Admin'), upload.fields([
    { name: 'logo', maxCount: 1 },
    { name: 'favicon', maxCount: 1 }
]), async (req, res) => {
    try {
        const updates = {};
        
        // 1. Handle Files
        if (req.files['logo']) updates.logoUrl = `/uploads/branding/${req.files['logo'][0].filename}`;
        if (req.files['favicon']) updates.faviconUrl = `/uploads/branding/${req.files['favicon'][0].filename}`;

        // 2. Handle Text Fields (Colors)
        if (req.body.primaryColor) updates.primaryColor = req.body.primaryColor;
        if (req.body.secondaryColor) updates.secondaryColor = req.body.secondaryColor;
        if (req.body.accentColor) updates.accentColor = req.body.accentColor;
        
        // Handle Company Name
        if (req.body.companyName) updates.companyName = req.body.companyName;

        if (req.body.backgroundColor) updates.backgroundColor = req.body.backgroundColor;
        if (req.body.surfaceColor) updates.surfaceColor = req.body.surfaceColor;
        if (req.body.textPrimaryColor) updates.textPrimaryColor = req.body.textPrimaryColor;
        
        // FIX: Add missing textSecondaryColor
        if (req.body.textSecondaryColor) updates.textSecondaryColor = req.body.textSecondaryColor;

        console.log("Saving Branding Updates:", updates);

        const query = `
            UPDATE system_preferences 
            SET settings = settings || $1::jsonb, updated_at = NOW()
            WHERE key = 'branding'
            RETURNING settings;
        `;
        
        const result = await pool.query(query, [JSON.stringify(updates)]);
        res.json(result.rows[0].settings);
    } catch (err) {
        console.error('Error uploading branding:', err.message);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.delete('/system/branding/:type', verifySession(), verifyRole('Admin'), async (req, res) => {
    const { type } = req.params;
    const keyMap = { 'logo': 'logoUrl', 'favicon': 'faviconUrl' };
    const jsonKey = keyMap[type];

    if (!jsonKey) return res.status(400).json({ error: 'Invalid branding type' });

    try {
        const query = `UPDATE system_preferences SET settings = settings - $1 WHERE key = 'branding' RETURNING settings`;
        const result = await pool.query(query, [jsonKey]);
        res.json(result.rows[0].settings);
    } catch (err) {
        console.error(`Error removing branding ${type}:`, err.message);
        res.status(500).json({ error: 'Internal server error' });
    }
});

export default router;