import express from 'express';
import pool from '../db.js';
import { verifySession } from 'supertokens-node/recipe/session/framework/express/index.js';
import { toCamelCase } from '../utils.js';

const router = express.Router();

// GET /api/notifications - Get recent notifications for current user
router.get('/', verifySession(), async (req, res) => {
    const userId = req.session.getUserId();
    try {
        const query = `
            SELECT n.*, 
                   UPPER(LEFT(COALESCE(up.first_name, u.email), 1)) as sender_initial
            FROM notifications n
            LEFT JOIN user_profiles up ON n.sender_id = up.user_id
            LEFT JOIN emailpassword_users u ON n.sender_id = u.user_id
            WHERE n.recipient_id = $1
            ORDER BY n.is_read ASC, n.created_at DESC
            LIMIT 50
        `;
        const result = await pool.query(query, [userId]);
        res.json(result.rows.map(toCamelCase));
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// GET /api/notifications/unread-count - Lightweight poller
router.get('/unread-count', verifySession(), async (req, res) => {
    const userId = req.session.getUserId();
    try {
        const result = await pool.query(
            `SELECT count(*) FROM notifications WHERE recipient_id = $1 AND is_read = FALSE`, 
            [userId]
        );
        res.json({ count: parseInt(result.rows[0].count) });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// PATCH /api/notifications/:id/read - Mark as read
router.patch('/:id/read', verifySession(), async (req, res) => {
    const userId = req.session.getUserId();
    const { id } = req.params;
    try {
        await pool.query(
            `UPDATE notifications SET is_read = TRUE WHERE id = $1 AND recipient_id = $2`, 
            [id, userId]
        );
        res.json({ success: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// PATCH /api/notifications/read-all - Mark ALL as read
router.patch('/read-all', verifySession(), async (req, res) => {
    const userId = req.session.getUserId();
    try {
        await pool.query(
            `UPDATE notifications SET is_read = TRUE WHERE recipient_id = $1`, 
            [userId]
        );
        res.json({ success: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// PATCH /api/notifications/mark-reference/:id - Mark all for specific project/reference as read
router.patch('/mark-reference/:id', verifySession(), async (req, res) => {
    const userId = req.session.getUserId();
    const { id } = req.params; // The Project ID
    try {
        await pool.query(
            `UPDATE notifications SET is_read = TRUE WHERE recipient_id = $1 AND reference_id = $2`, 
            [userId, id]
        );
        res.json({ success: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

export default router;