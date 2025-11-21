import express from 'express';
import pool from '../db.js';
import { toCamelCase } from '../utils.js';
import { verifySession } from 'supertokens-node/recipe/session/framework/express/index.js';

const router = express.Router();

// GET /api/calendar/events
router.get('/events', verifySession(), async (req, res) => {
    let installerWhereClause = '';
    let userWhereClause = '';
    const params = [];
    let paramIndex = 1;

    if (req.query.hasOwnProperty('installers')) {
        const installerIdsQueryParam = req.query.installers;
        const installerIds = installerIdsQueryParam
            ? String(installerIdsQueryParam).split(',').map(Number).filter(id => !isNaN(id) && id > 0)
            : [];

        if (installerIds.length > 0) {
            installerWhereClause = `AND ja.installer_id = ANY($${paramIndex}::int[])`;
            params.push(installerIds);
            paramIndex++;
        } else {
            installerWhereClause = `AND 1 = 0`; 
        }
    }

    if (req.query.hasOwnProperty('users')) {
        const userIdsQueryParam = req.query.users;
        const userIds = userIdsQueryParam ? String(userIdsQueryParam).split(',').filter(id => id) : [];
        if (userIds.length > 0) {
            userWhereClause = `WHERE e.created_by_user_id = ANY($${paramIndex}::text[])`;
            params.push(userIds);
            paramIndex++;
        } else {
            userWhereClause = `WHERE 1 = 0`;
        }
    }
        
    try {
        const query = `
            SELECT 
                p.id AS "id",
                ja.id AS "appointmentId",
                ja.appointment_name AS "title", 
                ja.start_date AS "start",
                ja.end_date AS "end",
                c.full_name AS "customerName",
                i.color AS "backgroundColor",
                j.is_on_hold AS "isOnHold",
                'appointment' AS "type",
                '{}'::jsonb AS "fullEvent"
            FROM job_appointments ja
            JOIN jobs j ON ja.job_id = j.id
            JOIN projects p ON j.project_id = p.id
            JOIN customers c ON p.customer_id = c.id
            JOIN installers i ON ja.installer_id = i.id
            WHERE 
                ja.installer_id IS NOT NULL
                ${installerWhereClause}
            
            UNION ALL

            SELECT
                p.id AS "id",
                (-mo.id) AS "appointmentId",
                'Materials ETA for ' || p.project_name AS "title",
                mo.eta_date AS "start",
                mo.eta_date AS "end",
                c.full_name AS "customerName",
                '#8B5CF6' AS "backgroundColor",
                false AS "isOnHold",
                'material_order_eta' AS "type",
                jsonb_build_object('status', mo.status) AS "fullEvent"
            FROM material_orders mo
            JOIN projects p ON mo.project_id = p.id
            JOIN customers c ON p.customer_id = c.id
            WHERE
                mo.eta_date IS NOT NULL
            
            UNION ALL

            SELECT
                e.id AS "id",
                -- --- CORRECTED: Add a large offset to guarantee a unique key ---
                (e.id + 1000000) AS "appointmentId", 
                e.title AS "title",
                e.start_time AS "start",
                e.end_time AS "end",
                '' AS "customerName", 
                '#3B82F6' AS "backgroundColor",
                false AS "isOnHold",
                'user_appointment' AS "type",
                jsonb_build_object(
                    'id', e.id,
                    'title', e.title,
                    'notes', e.notes,
                    'startTime', e.start_time,
                    'endTime', e.end_time,
                    'isAllDay', e.is_all_day,
                    'createdByUserId', e.created_by_user_id,
                    'createdAt', e.created_at,
                    'attendees', COALESCE(att.attendees_agg, '[]'::jsonb)
                ) AS "fullEvent"
            FROM events e
            LEFT JOIN (
                SELECT 
                    ea.event_id, 
                    jsonb_agg(
                        jsonb_build_object(
                            'attendeeId', ea.attendee_id, 
                            'attendeeType', ea.attendee_type,
                            'color', (
                                CASE 
                                    WHEN ea.attendee_type = 'user' THEN (SELECT preferences->>'calendarColor' FROM user_preferences WHERE user_id = ea.attendee_id)
                                    WHEN ea.attendee_type = 'installer' THEN (SELECT color FROM installers WHERE id::text = ea.attendee_id)
                                    ELSE NULL
                                END
                            )
                        )
                    ) as attendees_agg
                FROM event_attendees ea
                GROUP BY ea.event_id
            ) att ON e.id = att.event_id
            ${userWhereClause} -- This WHERE clause applies ONLY to the 'events' part of the UNION
            GROUP BY e.id, att.attendees_agg
        `;
        
        const result = await pool.query(query, params);
        
        res.json(result.rows);

    } catch (err) {
        console.error('Failed to fetch calendar events:', err.message);
        res.status(500).json({ error: 'Internal server error' });
    }
});

export default router;