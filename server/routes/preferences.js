import express from 'express';
import pool from '../db.js';
import { verifySession } from 'supertokens-node/recipe/session/framework/express/index.js';
import { toCamelCase } from '../utils.js';

const router = express.Router();

// GET the preferences for the currently logged-in user
router.get('/', verifySession(), async (req, res) => {
    const userId = req.session.getUserId();

    try {
        const result = await pool.query(
            'SELECT preferences FROM user_preferences WHERE user_id = $1',
            [userId]
        );

        if (result.rows.length === 0) {
            // If no preferences exist for this user yet, return a default empty object.
            // This is good practice and prevents the frontend from having to handle null/undefined.
            return res.status(200).json({});
        }

        // Return the 'preferences' JSONB object directly.
        res.status(200).json(result.rows[0].preferences);

    } catch (err) {
        console.error('Error fetching user preferences:', err.message);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// PUT (create or update) the preferences for the currently logged-in user
router.put('/', verifySession(), async (req, res) => {
    const userId = req.session.getUserId();
    const { projectDetailLayout } = req.body; // Expecting a specific key for now

    if (!projectDetailLayout) {
        return res.status(400).json({ error: 'Missing preferences data in request body' });
    }

    try {
        // This is an "UPSERT" query.
        // It tries to INSERT a new row. If it fails because the user_id already exists (violates UNIQUE constraint),
        // it then performs an UPDATE on the existing row instead.
        const query = `
            INSERT INTO user_preferences (user_id, preferences, updated_at)
            VALUES ($1, $2, NOW())
            ON CONFLICT (user_id) 
            DO UPDATE SET 
                preferences = user_preferences.preferences || $2,
                updated_at = NOW()
            RETURNING preferences;
        `;

        // We wrap our layout in an object to match the expected JSONB structure.
        const preferencesPayload = { projectDetailLayout };

        const result = await pool.query(query, [userId, preferencesPayload]);
        
        res.status(200).json(result.rows[0].preferences);

    } catch (err) {
        console.error('Error saving user preferences:', err.message);
        res.status(500).json({ error: 'Internal server error' });
    }
});

export default router;