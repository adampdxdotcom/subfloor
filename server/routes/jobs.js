import express from 'express';
import pool from '../db.js';
import { toCamelCase, logActivity } from '../utils.js';
import { verifySession } from 'supertokens-node/recipe/session/framework/express/index.js';

const router = express.Router();

// GET /api/jobs (Updated to include appointments to prevent data loss on save)
router.get('/', verifySession(), async (req, res) => {
    try {
        const query = `
            SELECT 
                j.*,
                COALESCE(
                    json_agg(
                        json_build_object(
                            'id', ja.id,
                            'job_id', ja.job_id,
                            'installer_id', ja.installer_id,
                            'appointment_name', ja.appointment_name,
                            'start_date', ja.start_date,
                            'end_date', ja.end_date
                        )
                    ) FILTER (WHERE ja.id IS NOT NULL), 
                    '[]'
                ) as appointments
            FROM jobs j
            LEFT JOIN job_appointments ja ON j.id = ja.job_id
            GROUP BY j.id
            ORDER BY j.created_at DESC
        `;
        const result = await pool.query(query);
        // We map toCamelCase, but we need to ensure the nested JSON keys inside 'appointments' 
        // are also handled or accessed correctly. toCamelCase usually handles top-level.
        // The json_build_object above uses snake_case keys (job_id, etc).
        // Let's rely on the frontend or a deeper map if needed, but usually toCamelCase is shallow.
        // To be safe and consistent with the project's camelCase convention, let's map the result.
        
        const camelCaseRows = result.rows.map(row => {
            const ccRow = toCamelCase(row);
            // Manually map the appointments array to camelCase if it exists
            if (Array.isArray(ccRow.appointments)) {
                ccRow.appointments = ccRow.appointments.map(toCamelCase);
            }
            return ccRow;
        });

        res.json(camelCaseRows);
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// GET /api/jobs/project/:projectId/history
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

// GET /api/jobs/project/:projectId (Gets job with its appointments)
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

// REBUILT POST /api/jobs (Handles create/update for job and its appointments)
router.post('/', verifySession(), async (req, res) => {
    const userId = req.session.getUserId();
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        // Destructure all possible fields, separating what belongs to the job
        const { id, projectId, appointments, ...jobDetails } = req.body;
        
        let job;
        let actionType;
        let beforeData = null;

        const existingJobResult = await client.query('SELECT * FROM jobs WHERE project_id = $1', [projectId]);

        if (existingJobResult.rows.length > 0) {
            // --- UPDATE JOB (DYNAMICALLY) ---
            actionType = 'UPDATE';
            const existingJobId = existingJobResult.rows[0].id;
            beforeData = toCamelCase(existingJobResult.rows[0]);
            
            // Filter out any undefined values to avoid setting columns to NULL accidentally
            const definedJobDetails = Object.entries(jobDetails)
                .filter(([key, value]) => value !== undefined)
                .reduce((obj, [key, value]) => ({ ...obj, [key]: value }), {});

            const fields = Object.keys(definedJobDetails);

            if (fields.length > 0) {
                const setClause = fields.map((field, index) => {
                    const dbField = field.replace(/([A-Z])/g, '_$1').toLowerCase();
                    return `${dbField} = $${index + 1}`;
                }).join(', ');

                const values = Object.values(definedJobDetails);
                const query = `UPDATE jobs SET ${setClause} WHERE id = $${fields.length + 1} RETURNING *`;
                
                const result = await client.query(query, [...values, existingJobId]);
                job = result.rows[0];

                // --- AUTOMATION: Mark Project as 'Completed' if Final Payment is Received ---
                if (definedJobDetails.finalPaymentReceived === true) {
                    await client.query(
                        `UPDATE projects SET status = 'Completed' WHERE id = $1`,
                        [projectId]
                    );
                }
                
            } else {
                // If no jobDetails are provided (e.g., only updating appointments)
                job = existingJobResult.rows[0];
            }

        } else {
            // --- CREATE JOB ---
            actionType = 'CREATE';
            const jobColumns = ['project_id', ...Object.keys(jobDetails).map(k => k.replace(/([A-Z])/g, '_$1').toLowerCase())];
            const jobValues = [projectId, ...Object.values(jobDetails)];
            const jobPlaceholders = jobColumns.map((_, i) => `$${i + 1}`).join(', ');
            
            const createJobQuery = `INSERT INTO jobs (${jobColumns.join(', ')}) VALUES (${jobPlaceholders}) RETURNING *`;
            const result = await client.query(createJobQuery, jobValues);
            job = result.rows[0];
        }

        // --- APPOINTMENT HANDLING (Only if appointments array is explicitly passed) ---
        if (Array.isArray(appointments)) {
            // First, delete all existing appointments for this job to ensure a clean slate.
            await client.query('DELETE FROM job_appointments WHERE job_id = $1', [job.id]);

            // Then, insert all the appointments passed from the frontend.
            for (const appt of appointments) {
                let installerId = appt.installerId ? parseInt(appt.installerId, 10) : null;
                if (isNaN(installerId)) {
                  installerId = null;
                }

                await client.query(
                    `INSERT INTO job_appointments (job_id, installer_id, appointment_name, start_date, end_date)
                     VALUES ($1, $2, $3, $4, $5)`,
                    [job.id, installerId, appt.appointmentName, appt.startDate || null, appt.endDate || null]
                );
            }
        }
        
        await client.query('COMMIT');

        // Fetch the full final state to return to the client and for logging
        const finalJobResult = await pool.query('SELECT * FROM jobs WHERE id = $1', [job.id]);
        const finalJob = toCamelCase(finalJobResult.rows[0]);
        const newAppointmentsResult = await pool.query('SELECT * FROM job_appointments WHERE job_id = $1', [job.id]);
        finalJob.appointments = newAppointmentsResult.rows.map(toCamelCase);
        
        // --- Logging ---
        await logActivity(userId, actionType, 'JOB', finalJob.id, {
            projectId: String(finalJob.projectId),
            before: beforeData,
            after: finalJob,
        });

        res.status(actionType === 'CREATE' ? 201 : 200).json(finalJob);

    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Error in POST /api/jobs:', err.message);
        res.status(500).json({ error: 'Internal server error' });
    } finally {
        client.release();
    }
});

export default router;