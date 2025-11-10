import express from 'express';
import pool from '../db.js';
import { toCamelCase } from '../utils.js';

const router = express.Router();

// GET /api/installers
router.get('/', async (req, res) => {
    try {
        const query = `
            SELECT
                i.*,
                COALESCE(
                    (
                        SELECT json_agg(job_details)
                        FROM (
                            SELECT
                                p.id AS "projectId",
                                p.project_name AS "projectName",
                                c.full_name AS "customerName",
                                j.scheduled_start_date AS "scheduledStartDate",
                                j.scheduled_end_date AS "scheduledEndDate"
                            FROM quotes q
                            JOIN projects p ON q.project_id = p.id
                            JOIN customers c ON p.customer_id = c.id
                            JOIN jobs j ON p.id = j.project_id
                            WHERE q.installer_id = i.id AND q.status = 'Accepted' AND j.scheduled_start_date IS NOT NULL
                            ORDER BY j.scheduled_start_date DESC
                        ) AS job_details
                    ),
                    '[]'::json
                ) AS jobs
            FROM installers i
            ORDER BY i.installer_name ASC;
        `;
        const result = await pool.query(query);
        res.json(result.rows.map(toCamelCase));
    } catch (err) { console.error(err.message); res.status(500).json({ error: 'Internal server error' }); }
});

// GET /api/installers/:id
router.get('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const result = await pool.query('SELECT * FROM installers WHERE id = $1', [id]);
        if (result.rows.length === 0) { return res.status(404).json({ error: 'Installer not found' }); }
        res.json(toCamelCase(result.rows[0]));
    } catch (err) { console.error(err.message); res.status(500).json({ error: 'Internal server error' }); }
});

// GET /api/installers/:id/schedule
router.get('/:id/schedule', async (req, res) => {
    const { id: installerId } = req.params;
    const { excludeProjectId } = req.query;

    try {
        const query = `
            SELECT
                j.project_id,
                j.scheduled_start_date,
                j.scheduled_end_date
            FROM jobs j
            JOIN quotes q ON j.project_id = q.project_id
            WHERE
                q.installer_id = $1
                AND q.status = 'Accepted'
                AND j.scheduled_start_date IS NOT NULL
                AND j.project_id != $2;
        `;
        const result = await pool.query(query, [installerId, excludeProjectId || 0]);
        res.json(result.rows.map(toCamelCase));
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// POST /api/installers
router.post('/', async (req, res) => {
    try {
        const { installerName, contactEmail, contactPhone, color } = req.body;
        const result = await pool.query(
            `INSERT INTO installers (installer_name, contact_email, contact_phone, color) VALUES ($1, $2, $3, $4) RETURNING *`, 
            [installerName, contactEmail, contactPhone, color]
        );
        res.status(201).json(toCamelCase(result.rows[0]));
    } catch (err) { console.error(err.message); res.status(500).json({ error: 'Internal server error' }); }
});

// PUT /api/installers/:id
router.put('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { installerName, contactEmail, contactPhone, color } = req.body;
        const result = await pool.query(
            `UPDATE installers SET installer_name = $1, contact_email = $2, contact_phone = $3, color = $4 WHERE id = $5 RETURNING *`, 
            [installerName, contactEmail, contactPhone, color, id]
        );
        if (result.rows.length === 0) { return res.status(404).json({ error: 'Installer not found' }); }
        res.json(toCamelCase(result.rows[0]));
    } catch (err) { console.error(err.message); res.status(500).json({ error: 'Internal server error' }); }
});

// --- NEW CODE START ---
// DELETE /api/installers/:id
router.delete('/:id', async (req, res) => {
    const { id } = req.params;
    
    try {
        // 1. Pre-flight check: Ensure the installer is not assigned to any quotes.
        const quoteCheckResult = await pool.query('SELECT 1 FROM quotes WHERE installer_id = $1 LIMIT 1', [id]);
        if (quoteCheckResult.rows.length > 0) {
            return res.status(409).json({ error: 'Cannot delete installer. They are assigned to one or more quotes.' });
        }

        // 2. If check passes, proceed with deletion.
        const deleteResult = await pool.query('DELETE FROM installers WHERE id = $1 RETURNING *', [id]);
        
        if (deleteResult.rows.length === 0) {
            return res.status(404).json({ error: 'Installer not found' });
        }

        res.status(204).send(); // Success, no content to return.
    } catch (err) {
        console.error(`Failed to delete installer ${id}:`, err.message);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// --- NEW CODE END ---

export default router;