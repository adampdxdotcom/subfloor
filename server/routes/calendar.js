import express from 'express';
import pool from '../db.js';
import { toCamelCase } from '../utils.js';
import { verifySession } from 'supertokens-node/recipe/session/framework/express/index.js';

const router = express.Router();

// GET /api/calendar/events
router.get('/events', verifySession(), async (req, res) => {
    try {
        const query = `
            SELECT 
                j.project_id AS "id",
                p.project_name AS "title",
                j.scheduled_start_date AS "start",
                j.scheduled_end_date AS "end",
                i.installer_name,
                c.full_name AS customer_name,
                i.color AS "backgroundColor"
            FROM jobs j
            JOIN projects p ON j.project_id = p.id
            JOIN customers c ON p.customer_id = c.id
            -- Find the accepted quote for this project to get the installer and installation type
            JOIN quotes q ON p.id = q.project_id AND q.status = 'Accepted'
            JOIN installers i ON q.installer_id = i.id
            WHERE 
                j.scheduled_start_date IS NOT NULL
                -- THIS IS THE CRUCIAL NEW FILTER --
                AND q.installation_type = 'Managed Installation';
        `;
        
        const result = await pool.query(query);
        res.json(result.rows.map(toCamelCase));

    } catch (err) {
        console.error('Failed to fetch calendar events:', err.message);
        res.status(500).json({ error: 'Internal server error' });
    }
});

export default router;