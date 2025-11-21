import express from 'express';
import pool from '../db.js';
import { verifySession } from 'supertokens-node/recipe/session/framework/express/index.js';
import { verifyRole } from '../utils.js';
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
        res.json({ message: 'System preferences saved.' });
    } catch (err) {
        console.error(`Error saving system preference '${key}':`, err.message);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// =================================================================
//  BRANDING UPLOAD (Admin Only)
// =================================================================

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const dir = path.join(__dirname, '../uploads/branding');
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
        
        if (req.body.backgroundColor) updates.backgroundColor = req.body.backgroundColor;
        if (req.body.surfaceColor) updates.surfaceColor = req.body.surfaceColor;
        if (req.body.textPrimaryColor) updates.textPrimaryColor = req.body.textPrimaryColor;
        // THIS IS THE MISSING LINE:
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