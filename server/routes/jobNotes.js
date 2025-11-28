import express from 'express';
import pool from '../db.js';
import { verifySession } from 'supertokens-node/recipe/session/framework/express/index.js';
import { logActivity, toCamelCase } from '../utils.js'; // Import toCamelCase

const router = express.Router({ mergeParams: true }); // Allow access to :jobId from parent router if nested

// GET /api/jobs/:id/notes
router.get('/:id/notes', verifySession(), async (req, res) => {
    const { id } = req.params;
    try {
        const query = `
            SELECT 
                jn.id, jn.content, 
                -- Ensure a valid date is always returned
                COALESCE(jn.created_at, NOW()) as "createdAt", 
                jn.user_id,
                -- Fix: Handle legacy migration user specifically
                CASE 
                    WHEN jn.user_id = 'legacy_migration' THEN 'System Migration'
                    ELSE COALESCE(NULLIF(TRIM(up.first_name || ' ' || up.last_name), ''), u.email, 'Unknown User')
                END as author_name,
                up.avatar_url as author_avatar,
                u.email as author_email -- NEW
            FROM job_notes jn
            LEFT JOIN user_profiles up ON jn.user_id = up.user_id
            LEFT JOIN emailpassword_users u ON jn.user_id = u.user_id
            WHERE jn.job_id = $1
            ORDER BY jn.created_at ASC
        `;
        const result = await pool.query(query, [id]);
        res.json(result.rows.map(toCamelCase)); // Convert snake_case to camelCase
    } catch (err) {
        console.error('Error fetching job notes:', err.message);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// POST /api/jobs/:id/notes
router.post('/:id/notes', verifySession(), async (req, res) => {
    const { id } = req.params;
    const { content } = req.body;
    const userId = req.session.getUserId();

    if (!content || !content.trim()) {
        return res.status(400).json({ error: 'Note content cannot be empty.' });
    }

    try {
        const insertQuery = `
            INSERT INTO job_notes (job_id, user_id, content)
            VALUES ($1, $2, $3)
            RETURNING *;
        `;
        const result = await pool.query(insertQuery, [id, userId, content]);
        const newNote = result.rows[0];

        // Fetch author details immediately to return a complete object
        const authorRes = await pool.query(`
            SELECT 
                COALESCE(NULLIF(TRIM(up.first_name || ' ' || up.last_name), ''), u.email, 'You') as name, 
                up.avatar_url,
                u.email
            FROM emailpassword_users u
            LEFT JOIN user_profiles up ON u.user_id = up.user_id
            WHERE u.user_id = $1
        `, [userId]);
        
        const author = authorRes.rows[0] || { name: 'You', avatar_url: null, email: null };

        // --- NOTIFICATION LOGIC ---
        console.log(`🔍 Checking notification for Job ID: ${id}`);

        // 1. Find project/manager info
        const projectRes = await pool.query(`
            SELECT p.manager_id, p.id as project_id, p.project_name
            FROM jobs j
            JOIN projects p ON j.project_id = p.id
            WHERE j.id = $1
        `, [id]); // id here is job_id
        
        if (projectRes.rows.length > 0) {
            const { manager_id, project_id, project_name } = projectRes.rows[0];
            console.log(`   -> Found Project: ${project_name} (Mgr: ${manager_id}) vs Author: ${userId}`);
            
            // 2. Find ALL participants in this thread
            const participantRes = await pool.query(`
                SELECT DISTINCT user_id FROM job_notes WHERE job_id = $1
            `, [id]);
            
            // Start with Manager, add participants
            const recipients = new Set();
            if (manager_id) recipients.add(manager_id);
            participantRes.rows.forEach(row => recipients.add(row.user_id));
            
            // Remove the current author (don't notify self)
            recipients.delete(userId);
            
            console.log(`   -> 🔔 Notifying ${recipients.size} users:`, [...recipients]);

            // 3. Batch Insert Notifications
            for (const recipientId of recipients) {
                await pool.query(`
                    INSERT INTO notifications (recipient_id, sender_id, type, reference_id, message, link_url)
                    VALUES ($1, $2, 'JOB_NOTE', $3, $4, $5)
                `, [
                    recipientId, 
                    userId, 
                    project_id,
                    `New note on ${project_name} from ${author.name}`,
                    `/projects/${project_id}` // Link URL
                ]);
            }
            
            if (recipients.size === 0) {
                console.log(`   -> ❌ Skipped: No unique recipients found.`);
            }

        } else {
            console.log(`   -> ❌ No Project found for Job ID ${id}`);
        }
        // --- END NOTIFICATION LOGIC ---

        res.status(201).json(toCamelCase({
            ...newNote,
            author_name: author.name,
            author_avatar: author.avatar_url,
            author_email: author.email
        })); // Convert response too

    } catch (err) {
        console.error('Error adding job note:', err.message);
        res.status(500).json({ error: 'Internal server error' });
    }
});

export default router;