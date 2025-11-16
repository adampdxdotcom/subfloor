import express from 'express';
import pool from '../db.js';
import { toCamelCase } from '../utils.js';
import { verifySession } from 'supertokens-node/recipe/session/framework/express/index.js';

const router = express.Router();

// GET /api/calendar/events
router.get('/events', verifySession(), async (req, res) => {
    try {
        // --- QUERY REBUILT ---
        // This query now fetches data from the new job_appointments table.
        // Each row returned by this query will represent a single, distinct calendar event.
        const query = `
            SELECT 
                p.id AS "id", -- Link event to the project_id
                ja.id AS "appointmentId", -- Unique ID for the appointment itself
                p.project_name AS "title",
                ja.start_date AS "start",
                ja.end_date AS "end",
                c.full_name AS "customerName",
                i.color AS "backgroundColor",
                j.is_on_hold AS "isOnHold" -- NEW: Pass the on-hold status to the frontend
            FROM job_appointments ja
            JOIN jobs j ON ja.job_id = j.id
            JOIN projects p ON j.project_id = p.id
            JOIN customers c ON p.customer_id = c.id
            JOIN installers i ON ja.installer_id = i.id
            WHERE 
                ja.installer_id IS NOT NULL; -- Only show appointments that have an installer
        `;
        
        const result = await pool.query(query);
        
        // No need for toCamelCase if we alias columns correctly in SQL
        res.json(result.rows);

    } catch (err) {
        console.error('Failed to fetch calendar events:', err.message);
        res.status(500).json({ error: 'Internal server error' });
    }
});

export default router;