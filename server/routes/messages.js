import express from 'express';
import pool from '../db.js';
import { verifySession } from 'supertokens-node/recipe/session/framework/express/index.js';
import { toCamelCase } from '../utils.js';

const router = express.Router();

// GET /api/messages/users - List users I have chatted with (for sidebar)
// (Also returns all users so you can start a new chat)
router.get('/users', verifySession(), async (req, res) => {
    const userId = req.session.getUserId();
    try {
        // 1. Get list of all users
        const usersRes = await pool.query(`
            SELECT 
                u.user_id, 
                u.email, 
                up.first_name, 
                up.last_name, 
                up.avatar_url,
                -- Check for unread messages from this user
                (SELECT COUNT(*) FROM direct_messages WHERE sender_id = u.user_id AND recipient_id = $1 AND is_read = FALSE) as unread_count,
                -- Get timestamp of last message (sent or received) for sorting
                (SELECT MAX(created_at) FROM direct_messages WHERE (sender_id = $1 AND recipient_id = u.user_id) OR (sender_id = u.user_id AND recipient_id = $1)) as last_activity
            FROM emailpassword_users u
            LEFT JOIN user_profiles up ON u.user_id = up.user_id
            WHERE u.user_id != $1
            ORDER BY last_activity DESC NULLS LAST, up.first_name ASC
        `, [userId]);

        res.json(usersRes.rows.map(toCamelCase));
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// GET /api/messages/:partnerId - Get chat history
router.get('/:partnerId', verifySession(), async (req, res) => {
    const userId = req.session.getUserId();
    const { partnerId } = req.params;
    try {
        const query = `
            SELECT * FROM direct_messages 
            WHERE (sender_id = $1 AND recipient_id = $2) 
               OR (sender_id = $2 AND recipient_id = $1)
            ORDER BY created_at ASC
        `;
        const result = await pool.query(query, [userId, partnerId]);
        
        // Mark as read immediately when fetched
        await pool.query(`
            UPDATE direct_messages SET is_read = TRUE 
            WHERE sender_id = $2 AND recipient_id = $1 AND is_read = FALSE
        `, [userId, partnerId]);

        // --- FIX: Also mark the NOTIFICATION as read so the Red Dot clears ---
        await pool.query(`
            UPDATE notifications 
            SET is_read = TRUE 
            WHERE recipient_id = $1 AND sender_id = $2 AND type = 'DIRECT_MSG' AND is_read = FALSE
        `, [userId, partnerId]);

        res.json(result.rows.map(toCamelCase));
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// POST /api/messages/:partnerId - Send message
router.post('/:partnerId', verifySession(), async (req, res) => {
    const userId = req.session.getUserId();
    const { partnerId } = req.params;
    const { content } = req.body;

    if (!content || !content.trim()) return res.status(400).json({ error: 'Message empty' });

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // 1. Insert Message
        const msgRes = await client.query(`
            INSERT INTO direct_messages (sender_id, recipient_id, content)
            VALUES ($1, $2, $3)
            RETURNING *
        `, [userId, partnerId, content]);

        // 2. Get Sender Name for Notification
        const senderRes = await client.query(`
            SELECT COALESCE(up.first_name, u.email) as name 
            FROM emailpassword_users u 
            LEFT JOIN user_profiles up ON u.user_id = up.user_id 
            WHERE u.user_id = $1
        `, [userId]);
        const senderName = senderRes.rows[0]?.name || 'Someone';

        // 3. Create Notification
        await client.query(`
            INSERT INTO notifications (recipient_id, sender_id, type, reference_id, message, link_url)
            VALUES ($1, $2, 'DIRECT_MSG', $3, $4, $5)
        `, [
            partnerId, 
            userId, 
            msgRes.rows[0].id, // Reference the message ID
            `New message from ${senderName}`,
            `/messages/${userId}` // Link to the chat with this sender
        ]);

        await client.query('COMMIT');
        res.status(201).json(toCamelCase(msgRes.rows[0]));

    } catch (err) {
        await client.query('ROLLBACK');
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    } finally {
        client.release();
    }
});

export default router;