import express from 'express';
import pool from '../db.js';
import { toCamelCase, logActivity, verifyRole } from '../utils.js';
import { verifySession } from 'supertokens-node/recipe/session/framework/express/index.js';

const router = express.Router();

// --- GET /api/events (This will be used by the main calendar view) ---
// Note: We will integrate this into calendar.js later. This is for standalone testing.
router.get('/', verifySession(), async (req, res) => {
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
                e.created_by_user_id,
                json_agg(json_build_object('attendeeId', ea.attendee_id, 'attendeeType', ea.attendee_type)) FILTER (WHERE ea.event_id IS NOT NULL) AS attendees
            FROM events e
            LEFT JOIN event_attendees ea ON e.id = ea.event_id
            GROUP BY e.id
            ORDER BY e.start_time ASC;
        `;
        const result = await pool.query(query);
        res.json(result.rows.map(toCamelCase));
    } catch (err) {
        console.error('Failed to fetch events:', err.message);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// --- POST /api/events (Create a new event) ---
router.post('/', verifySession(), async (req, res) => {
    const userId = req.session.getUserId();
    const { title, notes, startTime, endTime, isAllDay, jobId, attendees } = req.body;

    if (!title || !startTime || !endTime) {
        return res.status(400).json({ error: 'Title, startTime, and endTime are required.' });
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const eventInsertQuery = `
            INSERT INTO events (title, notes, start_time, end_time, is_all_day, job_id, created_by_user_id)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING *;
        `;
        const eventResult = await client.query(eventInsertQuery, [title, notes, startTime, endTime, isAllDay || false, jobId || null, userId]);
        const newEvent = toCamelCase(eventResult.rows[0]);

        if (attendees && Array.isArray(attendees) && attendees.length > 0) {
            for (const attendee of attendees) {
                const { attendeeId, attendeeType } = attendee;
                if (attendeeId && attendeeType) {
                    await client.query(
                        'INSERT INTO event_attendees (event_id, attendee_id, attendee_type) VALUES ($1, $2, $3)',
                        [newEvent.id, String(attendeeId), attendeeType]
                    );
                }
            }
        }
        
        await client.query('COMMIT');
        
        // Refetch the full event with attendees for the response
        const fullEventQuery = `
            SELECT e.*, json_agg(json_build_object('attendeeId', ea.attendee_id, 'attendeeType', ea.attendee_type)) FILTER (WHERE ea.event_id IS NOT NULL) AS attendees
            FROM events e
            LEFT JOIN event_attendees ea ON e.id = ea.event_id
            WHERE e.id = $1
            GROUP BY e.id;
        `;
        const fullEventResult = await client.query(fullEventQuery, [newEvent.id]);
        
        res.status(201).json(toCamelCase(fullEventResult.rows[0]));

    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Failed to create event:', err.message);
        res.status(500).json({ error: 'Internal server error' });
    } finally {
        client.release();
    }
});

// --- PUT /api/events/:id (Update an event) ---
router.put('/:id', verifySession(), async (req, res) => {
    const eventId = parseInt(req.params.id, 10);
    const { title, notes, startTime, endTime, isAllDay, jobId, attendees } = req.body;
    
    if (!title || !startTime || !endTime) {
        return res.status(400).json({ error: 'Title, startTime, and endTime are required.' });
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        
        const eventUpdateQuery = `
            UPDATE events
            SET title = $1, notes = $2, start_time = $3, end_time = $4, is_all_day = $5, job_id = $6
            WHERE id = $7;
        `;
        await client.query(eventUpdateQuery, [title, notes, startTime, endTime, isAllDay, jobId, eventId]);

        // Easiest way to update attendees is to delete and re-insert
        await client.query('DELETE FROM event_attendees WHERE event_id = $1', [eventId]);
        if (attendees && Array.isArray(attendees) && attendees.length > 0) {
            for (const attendee of attendees) {
                const { attendeeId, attendeeType } = attendee;
                if (attendeeId && attendeeType) {
                    await client.query(
                        'INSERT INTO event_attendees (event_id, attendee_id, attendee_type) VALUES ($1, $2, $3)',
                        [eventId, String(attendeeId), attendeeType]
                    );
                }
            }
        }

        await client.query('COMMIT');

        // Refetch the full event with attendees for the response
        const fullEventQuery = `
            SELECT e.*, json_agg(json_build_object('attendeeId', ea.attendee_id, 'attendeeType', ea.attendee_type)) FILTER (WHERE ea.event_id IS NOT NULL) AS attendees
            FROM events e
            LEFT JOIN event_attendees ea ON e.id = ea.event_id
            WHERE e.id = $1
            GROUP BY e.id;
        `;
        const fullEventResult = await client.query(fullEventQuery, [eventId]);
        
        res.status(200).json(toCamelCase(fullEventResult.rows[0]));

    } catch (err) {
        await client.query('ROLLBACK');
        console.error(`Failed to update event ${eventId}:`, err.message);
        res.status(500).json({ error: 'Internal server error' });
    } finally {
        client.release();
    }
});

// --- DELETE /api/events/:id (Delete an event) ---
router.delete('/:id', verifySession(), async (req, res) => {
    const eventId = parseInt(req.params.id, 10);
    
    // Note: The 'ON DELETE CASCADE' in the schema handles deleting attendees automatically.
    try {
        await pool.query('DELETE FROM events WHERE id = $1', [eventId]);
        res.status(204).send(); // Success, no content
    } catch (err) {
        console.error(`Failed to delete event ${eventId}:`, err.message);
        res.status(500).json({ error: 'Internal server error' });
    }
});

export default router;