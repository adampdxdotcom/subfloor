import express from 'express';
import pool from '../db.js';
import { verifySession } from 'supertokens-node/recipe/session/framework/express/index.js';
import { logActivity } from '../utils.js';

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
                up.avatar_url as author_avatar
            FROM job_notes jn
            LEFT JOIN user_profiles up ON jn.user_id = up.user_id
            LEFT JOIN emailpassword_users u ON jn.user_id = u.user_id
            WHERE jn.job_id = $1
            ORDER BY jn.created_at ASC
        `;
        const result = await pool.query(query, [id]);
        res.json(result.rows);
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
        // NOTE: We rely on user_profiles here and handle the 'Unknown User' fallback in the client/GET query if needed.
        const authorRes = await pool.query(`
            SELECT 
                COALESCE(NULLIF(TRIM(up.first_name || ' ' || up.last_name), ''), u.email, 'You') as name, 
                up.avatar_url 
            FROM user_profiles up
            FULL OUTER JOIN emailpassword_users u ON up.user_id = u.user_id
            WHERE up.user_id = $1
        `, [userId]);
        
        const author = authorRes.rows[0] || { name: 'You', avatar_url: null };

        res.status(201).json({
            ...newNote,
            author_name: author.name,
            author_avatar: author.avatar_url
        });

    } catch (err) {
        console.error('Error adding job note:', err.message);
        res.status(500).json({ error: 'Internal server error' });
    }
});

export default router;