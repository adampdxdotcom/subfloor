import express from 'express';
import pool from '../db.js';
import { verifySession } from 'supertokens-node/recipe/session/framework/express/index.js';
import { toCamelCase } from '../utils.js';

const router = express.Router();

// HELPER: Get Participant Info
// Returns a formatted name list (e.g., "Bob & Charlie") and avatar for a conversation
const getConversationMeta = async (conversationId, currentUserId) => {
    const res = await pool.query(`
        SELECT 
            u.user_id, u.email, up.first_name, up.last_name, up.avatar_url
        FROM conversation_participants cp
        JOIN emailpassword_users u ON cp.user_id = u.user_id
        LEFT JOIN user_profiles up ON u.user_id = up.user_id
        WHERE cp.conversation_id = $1 AND cp.user_id != $2
    `, [conversationId, currentUserId]);
    
    return res.rows.map(toCamelCase);
};

// GET /api/messages/conversations - List MY conversations (for sidebar)
router.get('/conversations', verifySession(), async (req, res) => {
    const userId = req.session.getUserId();
    const { archived } = req.query; // ?archived=true to see archive list

    try {
        // Fetch conversations I am in
        // Join with the latest message to sort by activity
        const query = `
            SELECT 
                c.id as conversation_id,
                c.type,
                c.title,
                cp.is_archived,
                cp.last_read_at,
                -- Get details of the latest message
                (
                    SELECT content FROM messages 
                    WHERE conversation_id = c.id 
                    ORDER BY created_at DESC LIMIT 1
                ) as last_message,
                (
                    SELECT created_at FROM messages 
                    WHERE conversation_id = c.id 
                    ORDER BY created_at DESC LIMIT 1
                ) as last_activity,
                -- Count unread messages (messages newer than my last_read_at)
                (
                    SELECT COUNT(*) FROM messages m
                    WHERE m.conversation_id = c.id 
                    AND m.created_at > cp.last_read_at
                    AND m.sender_id != $1
                ) as unread_count
            FROM conversations c
            JOIN conversation_participants cp ON c.id = cp.conversation_id
            WHERE cp.user_id = $1
            AND cp.is_archived = $2
            ORDER BY last_activity DESC NULLS LAST
        `;
        
        const result = await pool.query(query, [userId, archived === 'true']);
        const conversations = result.rows.map(toCamelCase);

        // Populate participants names/avatars for each conversation
        for (const conv of conversations) {
            const participants = await getConversationMeta(conv.conversationId, userId);
            conv.participants = participants;
            
            // If it's a Direct Message or unnamed group, generate a title
            if (!conv.title) {
                if (participants.length === 0) conv.title = "Just You";
                else if (participants.length === 1) {
                    const p = participants[0];
                    conv.title = p.firstName ? `${p.firstName} ${p.lastName || ''}` : p.email;
                    conv.avatarUrl = p.avatarUrl; // Use partner's avatar
                } else {
                    // Group: "Adam, Bob & Charlie"
                    const names = participants.map(p => p.firstName || p.email.split('@')[0]);
                    conv.title = names.join(', ');
                }
            }
        }

        res.json(conversations);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// GET /api/messages/search-users - Search global user list (For "New Chat")
router.get('/search-users', verifySession(), async (req, res) => {
    const userId = req.session.getUserId();
    const { query } = req.query;
    
    if (!query || query.length < 2) return res.json([]);

    try {
        const sql = `
            SELECT 
                u.user_id, 
                u.email, 
                up.first_name, 
                up.last_name, 
                up.avatar_url
            FROM emailpassword_users u
            LEFT JOIN user_profiles up ON u.user_id = up.user_id
            WHERE u.user_id != $1
            AND (
                LOWER(u.email) LIKE LOWER($2) OR 
                LOWER(up.first_name) LIKE LOWER($2) OR 
                LOWER(up.last_name) LIKE LOWER($2)
            )
            LIMIT 10
        `;
        const result = await pool.query(sql, [userId, `%${query}%`]);
        res.json(result.rows.map(toCamelCase));
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Search failed' });
    }
});

// POST /api/messages/start/:userId - Find or Create 1-on-1 Chat
// Used when clicking "Message User" from a profile or list
router.post('/start/:targetUserId', verifySession(), async (req, res) => {
    const userId = req.session.getUserId();
    const { targetUserId } = req.params;

    const client = await pool.connect();
    try {
        // 1. Check if a DIRECT conversation already exists
        const checkQuery = `
            SELECT c.id 
            FROM conversations c
            JOIN conversation_participants cp1 ON c.id = cp1.conversation_id
            JOIN conversation_participants cp2 ON c.id = cp2.conversation_id
            WHERE c.type = 'DIRECT'
            AND cp1.user_id = $1 
            AND cp2.user_id = $2
        `;
        const existing = await client.query(checkQuery, [userId, targetUserId]);
        
        if (existing.rows.length > 0) {
            // Found it! Return the ID
            return res.json({ conversationId: existing.rows[0].id });
        }

        // 2. Create new one
        await client.query('BEGIN');
        
        const convRes = await client.query(
            `INSERT INTO conversations (type) VALUES ('DIRECT') RETURNING id`
        );
        const convId = convRes.rows[0].id;

        await client.query(
            `INSERT INTO conversation_participants (conversation_id, user_id) VALUES ($1, $2), ($1, $3)`,
            [convId, userId, targetUserId]
        );

        await client.query('COMMIT');
        res.json({ conversationId: convId });

    } catch (err) {
        await client.query('ROLLBACK');
        console.error(err);
        res.status(500).json({ error: 'Failed to start conversation' });
    } finally {
        client.release();
    }
});

// GET /api/messages/:conversationId - Get History
router.get('/:conversationId', verifySession(), async (req, res) => {
    const userId = req.session.getUserId();
    const { conversationId } = req.params;

    try {
        // 1. Security Check: Am I a participant?
        const check = await pool.query(
            `SELECT 1 FROM conversation_participants WHERE conversation_id = $1 AND user_id = $2`,
            [conversationId, userId]
        );
        if (check.rows.length === 0) return res.status(403).json({ error: 'Not authorized' });

        // 2. Fetch Messages
        const msgs = await pool.query(`
            SELECT m.*, 
                   COALESCE(up.first_name, u.email) as sender_name,
                   up.avatar_url as sender_avatar
            FROM messages m
            JOIN emailpassword_users u ON m.sender_id = u.user_id
            LEFT JOIN user_profiles up ON u.user_id = up.user_id
            WHERE m.conversation_id = $1
            ORDER BY m.created_at ASC
        `, [conversationId]);

        // 3. Mark as Read (Update my last_read_at timestamp)
        await pool.query(
            `UPDATE conversation_participants SET last_read_at = NOW() WHERE conversation_id = $1 AND user_id = $2`,
            [conversationId, userId]
        );
        
        res.json(msgs.rows.map(toCamelCase));
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// POST /api/messages/:conversationId - Send Message & Handle Mentions
router.post('/:conversationId', verifySession(), async (req, res) => {
    const userId = req.session.getUserId();
    const { conversationId } = req.params;
    const { content } = req.body;

    if (!content?.trim()) return res.status(400).json({ error: 'Empty message' });

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // 1. Insert the Message
        const msgRes = await client.query(`
            INSERT INTO messages (conversation_id, sender_id, content)
            VALUES ($1, $2, $3)
            RETURNING *
        `, [conversationId, userId, content]);

        // 2. MENTION LOGIC: Scan for @[user:ID|Name]
        const mentionRegex = /@\[user:([^|]+)\|([^\]]+)\]/g;
        let match;
        const mentionedUserIds = new Set();
        
        while ((match = mentionRegex.exec(content)) !== null) {
            mentionedUserIds.add(match[1]); // The ID part
        }

        // 3. Process Mentions (Invite Users)
        if (mentionedUserIds.size > 0) {
            // Get current participants
            const partsRes = await client.query(
                `SELECT user_id FROM conversation_participants WHERE conversation_id = $1`,
                [conversationId]
            );
            const currentParticipantIds = new Set(partsRes.rows.map(r => r.user_id));

            for (const targetId of mentionedUserIds) {
                // If user is NOT in the chat, ADD them
                if (!currentParticipantIds.has(targetId)) {
                    // A. Add to table
                    await client.query(
                        `INSERT INTO conversation_participants (conversation_id, user_id) VALUES ($1, $2)`,
                        [conversationId, targetId]
                    );
                    
                    // B. Upgrade conversation to GROUP type
                    await client.query(
                        `UPDATE conversations SET type = 'GROUP' WHERE id = $1`,
                        [conversationId]
                    );

                    // C. Get Sender AND Target Names
                    const senderInfo = await client.query(
                        `SELECT COALESCE(up.first_name, u.email) as name FROM emailpassword_users u LEFT JOIN user_profiles up ON u.user_id = up.user_id WHERE u.user_id = $1`, 
                        [userId]
                    );
                    const senderName = senderInfo.rows[0]?.name || 'Someone';

                    const targetInfo = await client.query(
                        `SELECT COALESCE(up.first_name, u.email) as name FROM emailpassword_users u LEFT JOIN user_profiles up ON u.user_id = up.user_id WHERE u.user_id = $1`, 
                        [targetId]
                    );
                    const targetName = targetInfo.rows[0]?.name || 'User';

                    // D. Insert "System" Message (Uses Target Name now!)
                    await client.query(`
                        INSERT INTO messages (conversation_id, sender_id, content)
                        VALUES ($1, $2, $3)
                    `, [conversationId, userId, `added @[user:${targetId}|${targetName}] to the conversation.`]);

                    // E. Send Notification to the NEW user
                    await client.query(`
                        INSERT INTO notifications (recipient_id, sender_id, type, reference_id, message, link_url)
                        VALUES ($1, $2, 'DIRECT_MSG', $3, $4, $5)
                    `, [
                        targetId, 
                        userId, 
                        conversationId, 
                        `${senderName} added you to a conversation`,
                        `/messages/${conversationId}`
                    ]);
                }
            }
        }

        // 4. Send Notifications to EXISTING participants (excluding sender)
        const recipientsRes = await client.query(
            `SELECT user_id FROM conversation_participants WHERE conversation_id = $1 AND user_id != $2`,
            [conversationId, userId]
        );
        
        const senderNameRes = await client.query(
            `SELECT COALESCE(up.first_name, u.email) as name FROM emailpassword_users u LEFT JOIN user_profiles up ON u.user_id = up.user_id WHERE u.user_id = $1`, 
            [userId]
        );
        const senderName = senderNameRes.rows[0]?.name;

        for (const r of recipientsRes.rows) {
            await client.query(`
                INSERT INTO notifications (recipient_id, sender_id, type, reference_id, message, link_url)
                VALUES ($1, $2, 'DIRECT_MSG', $3, $4, $5)
            `, [
                r.user_id, 
                userId, 
                conversationId,
                `New message from ${senderName}`,
                `/messages/${conversationId}`
            ]);
        }

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

// PATCH /api/messages/:conversationId/archive - Toggle Archive
router.patch('/:conversationId/archive', verifySession(), async (req, res) => {
    const userId = req.session.getUserId();
    const { conversationId } = req.params;
    const { isArchived } = req.body; // Boolean

    try {
        await pool.query(
            `UPDATE conversation_participants SET is_archived = $1 WHERE conversation_id = $2 AND user_id = $3`,
            [isArchived, conversationId, userId]
        );
        res.json({ success: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to update archive status' });
    }
});

export default router;