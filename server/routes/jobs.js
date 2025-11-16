import express from 'express';
import pool from '../db.js';
import { toCamelCase, logActivity } from '../utils.js';
import { verifySession } from 'supertokens-node/recipe/session/framework/express/index.js';

const router = express.Router();

// --- MODIFIED: GET /api/jobs no longer makes sense as it doesn't provide enough detail.
// We will rely on fetching jobs via projects or other specific endpoints.
// You can remove this or leave it, but it's less useful now.
router.get('/', verifySession(), async (req, res) => {
    try {
        // This query is now incomplete as it's missing appointment data.
        const result = await pool.query('SELECT * FROM jobs');
        res.json(result.rows.map(toCamelCase));
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ error: 'Internal server error' });
    }
});


// HISTORY ENDPOINT (Unchanged)
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


// --- MODIFIED: GET /api/jobs/project/:projectId
// NEW Endpoint to get a job and ALL its appointments for a given project.
router.get('/project/:projectId', verifySession(), async (req, res) => {
    const { projectId } = req.params;
    try {
        const jobResult = await pool.query('SELECT * FROM jobs WHERE project_id = $1', [projectId]);

        if (jobResult.rows.length === 0) {
            return res.status(404).json({ error: 'Job not found for this project' });
        }

        const job = toCamelCase(jobResult.rows[0]);

        const appointmentsResult = await pool.query(
            'SELECT * FROM job_appointments WHERE job_id = $1 ORDER BY start_date ASC',
            [job.id]
        );

        job.appointments = appointmentsResult.rows.map(toCamelCase);

        res.json(job);
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ error: 'Internal server error' });
    }
});


// --- REBUILT: POST /api/jobs (Handles create/update for job and its appointments)
router.post('/', verifySession(), async (req, res) => {
    const userId = req.session.getUserId();
    const client = await pool.connect(); // Use a transaction

    try {
        // --- Destructure new expected payload ---
        const {
            projectId,
            poNumber,
            depositAmount,
            depositReceived,
            contractsReceived,
            finalPaymentReceived,
            isOnHold,
            notes,
            appointments // This is now an array of appointment objects
        } = req.body;
        
        const finalDepositAmount = (depositAmount === '' || depositAmount === null || depositAmount === undefined)
            ? null
            : parseFloat(depositAmount);
        
        await client.query('BEGIN'); // Start transaction

        const existingJobResult = await client.query('SELECT * FROM jobs WHERE project_id = $1', [projectId]);
        
        let job;
        let actionType;
        const beforeData = existingJobResult.rows.length > 0 ? toCamelCase(existingJobResult.rows[0]) : {};

        if (existingJobResult.rows.length > 0) {
            // --- UPDATE JOB ---
            actionType = 'UPDATE';
            const result = await client.query(
                `UPDATE jobs SET 
                    po_number = $1, 
                    deposit_amount = $2, 
                    deposit_received = $3, 
                    contracts_received = $4, 
                    final_payment_received = $5, 
                    is_on_hold = $6,
                    notes = $7
                WHERE project_id = $8 RETURNING *`,
                [poNumber, finalDepositAmount, depositReceived, contractsReceived, finalPaymentReceived, isOnHold, notes, projectId]
            );
            job = result.rows[0];
        } else {
            // --- CREATE JOB ---
            actionType = 'CREATE';
            const result = await client.query(
                `INSERT INTO jobs (
                    project_id, po_number, deposit_amount, deposit_received, contracts_received, 
                    final_payment_received, is_on_hold, notes
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
                [projectId, poNumber, finalDepositAmount, depositReceived, contractsReceived, finalPaymentReceived, isOnHold, notes]
            );
            job = result.rows[0];
        }

        // --- APPOINTMENT HANDLING ---
        // First, delete all existing appointments for this job to ensure a clean slate.
        await client.query('DELETE FROM job_appointments WHERE job_id = $1', [job.id]);

        // Then, insert all the appointments passed from the frontend.
        if (appointments && appointments.length > 0) {
            for (const appt of appointments) {
                // Ensure installerId is null if not provided, not 0 or empty string
                // --- THE FIX: Changed 'const' to 'let' ---
                let installerId = appt.installerId ? parseInt(appt.installerId, 10) : null;
                if (isNaN(installerId)) {
                  installerId = null;
                }

                await client.query(
                    `INSERT INTO job_appointments (job_id, installer_id, appointment_name, start_date, end_date)
                     VALUES ($1, $2, $3, $4, $5)`,
                    [job.id, installerId, appt.appointmentName, appt.startDate, appt.endDate]
                );
            }
        }
        
        await client.query('COMMIT'); // Commit transaction

        const finalJob = toCamelCase(job);

        // Fetch the newly created appointments to include in the log and the response
        const newAppointmentsResult = await pool.query('SELECT * FROM job_appointments WHERE job_id = $1', [job.id]);
        finalJob.appointments = newAppointmentsResult.rows.map(toCamelCase);

        // --- Logging ---
        if (actionType === 'CREATE') {
            await logActivity(userId, 'CREATE', 'JOB', finalJob.id, {
                projectId: String(projectId),
                createdData: finalJob
            });
        } else {
            await logActivity(userId, 'UPDATE', 'JOB', finalJob.id, {
                projectId: String(projectId),
                before: beforeData, // Note: beforeData doesn't have old appointments, a known limitation for now.
                after: finalJob
            });
        }

        res.status(actionType === 'CREATE' ? 201 : 200).json(finalJob);

    } catch (err) {
        await client.query('ROLLBACK'); // Rollback on error
        console.error('Error in POST /api/jobs:', err.message);
        res.status(500).json({ error: 'Internal server error' });
    } finally {
        client.release(); // Release the client back to the pool
    }
});

export default router;