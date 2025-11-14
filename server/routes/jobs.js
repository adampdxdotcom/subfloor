import express from 'express';
import pool from '../db.js';
import { toCamelCase } from '../utils.js';
import { verifySession } from 'supertokens-node/recipe/session/framework/express/index.js';

const router = express.Router();

// GET /api/jobs
router.get('/', verifySession(), async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM jobs');
        res.json(result.rows.map(toCamelCase));
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// POST /api/jobs (Handles both create and update)
router.post('/', verifySession(), async (req, res) => {
    try {
        const { 
            projectId, poNumber, depositAmount, depositReceived, 
            contractsReceived, finalPaymentReceived, scheduledStartDate, 
            scheduledEndDate, notes 
        } = req.body;

        // <<< START OF FIX: Sanitize date inputs >>>
        // Convert empty strings or other falsy values for dates to null,
        // which the database can handle correctly for DATE/TIMESTAMP columns.
        const finalStartDate = scheduledStartDate || null;
        const finalEndDate = scheduledEndDate || null;
        // <<< END OF FIX >>>
        
        const existingJob = await pool.query('SELECT id FROM jobs WHERE project_id = $1', [projectId]);
        let result;

        if (existingJob.rows.length > 0) {
            // Update existing job
            const jobId = existingJob.rows[0].id;
            result = await pool.query(
                `UPDATE jobs SET 
                    po_number = $1, deposit_amount = $2, deposit_received = $3, 
                    contracts_received = $4, final_payment_received = $5, scheduled_start_date = $6, 
                    scheduled_end_date = $7, notes = $8
                WHERE id = $9 RETURNING *`,
                // <<< FIX: Use the sanitized date values >>>
                [poNumber, depositAmount, depositReceived, contractsReceived, finalPaymentReceived, finalStartDate, finalEndDate, notes, jobId]
            );
        } else {
            // Create new job
            result = await pool.query(
                `INSERT INTO jobs (
                    project_id, po_number, deposit_amount, deposit_received, contracts_received, 
                    final_payment_received, scheduled_start_date, scheduled_end_date, notes
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
                [
                    projectId, poNumber, depositAmount, depositReceived, contractsReceived, 
                    // <<< FIX: Use the sanitized date values >>>
                    finalPaymentReceived, finalStartDate, finalEndDate, notes
                ]
            );
        }
        res.status(existingJob.rows.length > 0 ? 200 : 201).json(toCamelCase(result.rows[0]));
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ error: 'Internal server error' });
    }
});

export default router;