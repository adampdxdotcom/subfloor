import express from 'express';
import pool from '../db.js';
import { toCamelCase, logActivity, verifyRole } from '../utils.js';
import { verifySession } from 'supertokens-node/recipe/session/framework/express/index.js';

const router = express.Router();

// Helper to send notifications
const sendEventNotifications = async (client, eventId, title, attendees, currentUserId, action) => {
    if (!attendees || !Array.isArray(attendees)) return;

    // Filter for Users (not installers) who are NOT the current user
    const userAttendees = attendees.filter(a => a.attendeeType === 'user' && a.attendeeId !== currentUserId);
    
    if (userAttendees.length === 0) return;

    const notificationTitle = action === 'CREATE' ? 'New Appointment Invite' : 'Appointment Updated';
    const message = action === 'CREATE' 
        ? `You have been invited to: ${title}`
        : `Updates made to appointment: ${title}`;

    for (const user of userAttendees) {
        await client.query(
            `INSERT INTO notifications (recipient_id, type, title, message, reference_id, reference_type, is_read)
             VALUES ($1, 'APPOINTMENT', $2, $3, $4, 'EVENT', false)`,
            [user.attendeeId, notificationTitle, message, String(eventId)]
        );
    }
};

// GET /api/events (Scoped by Visibility)
router.get('/', verifySession(), async (req, res) => {
    const userId = req.session.getUserId();
    try {
        const query = `
            SELECT
                e.id,
                e.title,
                e.notes,
                e.start_time,
                e.end_time,
                e.is_all_day,
                e.job_id,
                e.is_public,
                e.created_by_user_id,
                json_agg(
                    json_build_object(
                        'attendeeId', ea.attendee_id, 
                        'attendeeType', ea.attendee_type,
                        'status', ea.status
                    )
                ) FILTER (WHERE ea.event_id IS NOT NULL) AS attendees
            FROM events e
            LEFT JOIN event_attendees ea ON e.id = ea.event_id
            WHERE 
                e.created_by_user_id = $1 
                OR e.is_public = TRUE
                OR EXISTS (
                    SELECT 1 FROM event_attendees sub_ea 
                    WHERE sub_ea.event_id = e.id 
                    AND sub_ea.attendee_id = $1 
                    AND sub_ea.attendee_type = 'user'
                )
            GROUP BY e.id
            ORDER BY e.start_time ASC;
        `;
        const result = await pool.query(query, [userId]);
        res.json(result.rows.map(toCamelCase));
    } catch (err) {
        console.error('Failed to fetch events:', err.message);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// POST /api/events (Create)
router.post('/', verifySession(), async (req, res) => {
    const userId = req.session.getUserId();
    const { title, notes, startTime, endTime, isAllDay, jobId, attendees, isPublic } = req.body;

    if (!title || !startTime || !endTime) {
        return res.status(400).json({ error: 'Title, startTime, and endTime are required.' });
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const eventInsertQuery = `
            INSERT INTO events (title, notes, start_time, end_time, is_all_day, job_id, created_by_user_id, is_public)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            RETURNING *;
        `;
        const eventResult = await client.query(eventInsertQuery, [title, notes, startTime, endTime, isAllDay || false, jobId || null, userId, isPublic || false]);
        const newEvent = toCamelCase(eventResult.rows[0]);

        if (attendees && Array.isArray(attendees) && attendees.length > 0) {
            for (const attendee of attendees) {
                const { attendeeId, attendeeType } = attendee;
                if (attendeeId && attendeeType) {
                    const status = (attendeeType === 'user' && attendeeId === userId) ? 'accepted' : 'pending';
                    
                    await client.query(
                        'INSERT INTO event_attendees (event_id, attendee_id, attendee_type, status) VALUES ($1, $2, $3, $4)',
                        [newEvent.id, String(attendeeId), attendeeType, status]
                    );
                }
            }
            // For CREATE, everyone (except creator) is 'pending', so notify all of them
            await sendEventNotifications(client, newEvent.id, title, attendees, userId, 'CREATE');
        }
        
        await client.query('COMMIT');
        
        const fullEventQuery = `
            SELECT e.*, json_agg(json_build_object('attendeeId', ea.attendee_id, 'attendeeType', ea.attendee_type, 'status', ea.status)) FILTER (WHERE ea.event_id IS NOT NULL) AS attendees
            FROM events e
            LEFT JOIN event_attendees ea ON e.id = ea.event_id
            WHERE e.id = $1
            GROUP BY e.id;
        `;
        const result = await pool.query(fullEventQuery, [newEvent.id]);
        res.status(201).json(toCamelCase(result.rows[0]));

    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Failed to create event:', err.message);
        res.status(500).json({ error: 'Internal server error' });
    } finally {
        client.release();
    }
});

// PUT /api/events/:id (Update - Owner Only)
router.put('/:id', verifySession(), async (req, res) => {
    const userId = req.session.getUserId();
    const eventId = parseInt(req.params.id, 10);
    const { title, notes, startTime, endTime, isAllDay, jobId, attendees, isPublic } = req.body;
    
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        
        const checkOwner = await client.query('SELECT created_by_user_id FROM events WHERE id = $1', [eventId]);
        if (checkOwner.rows.length === 0) return res.status(404).json({ error: 'Event not found' });
        
        if (checkOwner.rows[0].created_by_user_id !== userId) {
            await client.query('ROLLBACK');
            return res.status(403).json({ error: 'Only the event owner can edit details.' });
        }

        const eventUpdateQuery = `
            UPDATE events
            SET title = $1, notes = $2, start_time = $3, end_time = $4, is_all_day = $5, job_id = $6, is_public = $7
            WHERE id = $8;
        `;
        await client.query(eventUpdateQuery, [title, notes, startTime, endTime, isAllDay, jobId, isPublic, eventId]);

        // Smart Sync Attendees
        const currentAttendeesResult = await client.query('SELECT attendee_id, status FROM event_attendees WHERE event_id = $1', [eventId]);
        const statusMap = new Map();
        currentAttendeesResult.rows.forEach(row => statusMap.set(row.attendee_id, row.status));

        await client.query('DELETE FROM event_attendees WHERE event_id = $1', [eventId]);
        
        // --- UPDATED LOGIC: Collect only active attendees for notification ---
        const activeAttendeesToNotify = [];

        if (attendees && Array.isArray(attendees)) {
            for (const attendee of attendees) {
                const { attendeeId, attendeeType } = attendee;
                if (attendeeId && attendeeType) {
                    let status = statusMap.get(String(attendeeId)) || 'pending';
                    if (attendeeType === 'user' && attendeeId === userId) status = 'accepted';
                    
                    await client.query(
                        'INSERT INTO event_attendees (event_id, attendee_id, attendee_type, status) VALUES ($1, $2, $3, $4)',
                        [eventId, String(attendeeId), attendeeType, status]
                    );

                    // Only notify if they have NOT declined
                    if (status !== 'declined') {
                        activeAttendeesToNotify.push(attendee);
                    }
                }
            }
            // Send notifications only to the filtered list
            await sendEventNotifications(client, eventId, title, activeAttendeesToNotify, userId, 'UPDATE');
        }

        await client.query('COMMIT');
        
        const fullEventQuery = `
            SELECT e.*, json_agg(json_build_object('attendeeId', ea.attendee_id, 'attendeeType', ea.attendee_type, 'status', ea.status)) FILTER (WHERE ea.event_id IS NOT NULL) AS attendees
            FROM events e
            LEFT JOIN event_attendees ea ON e.id = ea.event_id
            WHERE e.id = $1
            GROUP BY e.id;
        `;
        const result = await pool.query(fullEventQuery, [eventId]);
        res.status(200).json(toCamelCase(result.rows[0]));

    } catch (err) {
        await client.query('ROLLBACK');
        console.error(`Failed to update event ${eventId}:`, err.message);
        res.status(500).json({ error: 'Internal server error' });
    } finally {
        client.release();
    }
});

// PATCH /api/events/:id/respond (Respond to Invite)
router.patch('/:id/respond', verifySession(), async (req, res) => {
    const userId = req.session.getUserId();
    const eventId = parseInt(req.params.id, 10);
    const { status } = req.body; 

    if (!['accepted', 'declined'].includes(status)) {
        return res.status(400).json({ error: "Status must be 'accepted' or 'declined'" });
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const result = await client.query(
            `UPDATE event_attendees 
             SET status = $1 
             WHERE event_id = $2 AND attendee_id = $3 AND attendee_type = 'user'
             RETURNING *`,
            [status, eventId, userId]
        );

        if (result.rowCount === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: "Invitation not found or you are not an attendee." });
        }

        const eventResult = await client.query('SELECT title, created_by_user_id FROM events WHERE id = $1', [eventId]);
        if (eventResult.rows.length > 0) {
            const { title, created_by_user_id: ownerId } = eventResult.rows[0];
            
            if (ownerId !== userId) {
                const message = `An attendee has ${status} your invitation to: ${title}`;
                await client.query(
                    `INSERT INTO notifications (recipient_id, type, title, message, reference_id, reference_type, is_read)
                     VALUES ($1, 'APPOINTMENT', 'Invitation Response', $2, $3, 'EVENT', false)`,
                    [ownerId, message, String(eventId)]
                );
            }
        }

        await client.query('COMMIT');
        res.json(toCamelCase(result.rows[0]));

    } catch (err) {
        await client.query('ROLLBACK');
        console.error(`Failed to respond to event ${eventId}:`, err.message);
        res.status(500).json({ error: 'Internal server error' });
    } finally {
        client.release();
    }
});

router.delete('/:id', verifySession(), async (req, res) => {
    const eventId = parseInt(req.params.id, 10);
    const userId = req.session.getUserId();

    try {
        const check = await pool.query('SELECT created_by_user_id FROM events WHERE id = $1', [eventId]);
        if (check.rows.length > 0 && check.rows[0].created_by_user_id !== userId) {
            return res.status(403).json({ error: 'Only the event owner can delete this event.' });
        }

        await pool.query('DELETE FROM events WHERE id = $1', [eventId]);
        res.status(204).send(); 
    } catch (err) {
        console.error(`Failed to delete event ${eventId}:`, err.message);
        res.status(500).json({ error: 'Internal server error' });
    }
});

export default router;