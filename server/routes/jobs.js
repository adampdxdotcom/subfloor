import express from 'express';
import pool from '../db.js';
import { toCamelCase, logActivity } from '../utils.js';
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


// HISTORY ENDPOINT WITH CORRECTED QUERY
router.get('/project/:projectId/history', verifySession(), async (req, res) => {
    const { projectId } = req.params;
    try {
        const query = `
            SELECT 
                al.*,
                ep.email AS user_email
            FROM activity_log al
            LEFT JOIN emailpassword_users ep ON al.user_id = ep.user_id
            WHERE 
                al.target_entity = 'JOB' 
                AND al.details->>'projectId' = $1
            ORDER BY al.created_at DESC;
        `;
        const result = await pool.query(query, [projectId]);
        res.json(result.rows.map(toCamelCase));
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ error: "Internal server error retrieving job history" });
    }
});


// POST /api/jobs (Handles both create and update)
router.post('/', verifySession(), async (req, res) => {
    const userId = req.session.getUserId(); // Get user ID for logging

    try {
        const { 
            projectId, poNumber, depositAmount, depositReceived, 
            contractsReceived, finalPaymentReceived, scheduledStartDate, 
            scheduledEndDate, notes 
        } = req.body;

        // vvvvvvvvvvvv THE FIX IS HERE vvvvvvvvvvvv
        // Sanitize all optional inputs to ensure they are null if empty/undefined
        const finalStartDate = scheduledStartDate || null;
        const finalEndDate = scheduledEndDate || null;
        // Handle empty strings for numeric fields
        const finalDepositAmount = (depositAmount === '' || depositAmount === null || depositAmount === undefined) 
            ? null 
            : parseFloat(depositAmount);
        // ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
        
        const existingJobResult = await pool.query('SELECT * FROM jobs WHERE project_id = $1', [projectId]);
        
        let result;
        let actionType;

        if (existingJobResult.rows.length > 0) {
            // --- UPDATE PATH ---
            actionType = 'UPDATE';
            const existingJob = existingJobResult.rows[0];
            const beforeData = toCamelCase(existingJob);

            result = await pool.query(
                `UPDATE jobs SET 
                    po_number = $1, deposit_amount = $2, deposit_received = $3, 
                    contracts_received = $4, final_payment_received = $5, scheduled_start_date = $6, 
                    scheduled_end_date = $7, notes = $8
                WHERE id = $9 RETURNING *`,
                [poNumber, finalDepositAmount, depositReceived, contractsReceived, finalPaymentReceived, finalStartDate, finalEndDate, notes, existingJob.id]
            );

            const updatedJob = toCamelCase(result.rows[0]);

            // --- AUDIT LOG ---
            await logActivity(userId, actionType, 'JOB', updatedJob.id, { 
                projectId: String(projectId), 
                before: beforeData, 
                after: updatedJob 
            });
            // --- END AUDIT LOG ---

        } else {
            // --- CREATE PATH ---
            actionType = 'CREATE';
            result = await pool.query(
                `INSERT INTO jobs (
                    project_id, po_number, deposit_amount, deposit_received, contracts_received, 
                    final_payment_received, scheduled_start_date, scheduled_end_date, notes
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
                [
                    projectId, poNumber, finalDepositAmount, depositReceived, contractsReceived, 
                    finalPaymentReceived, finalStartDate, finalEndDate, notes
                ]
            );
            const newJob = toCamelCase(result.rows[0]);

            // --- AUDIT LOG ---
            await logActivity(userId, actionType, 'JOB', newJob.id, {
                 projectId: String(projectId),
                 createdData: newJob 
            });
            // --- END AUDIT LOG ---
        }

        res.status(actionType === 'CREATE' ? 201 : 200).json(toCamelCase(result.rows[0]));
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ error: 'Internal server error' });
    }
});

export default router;