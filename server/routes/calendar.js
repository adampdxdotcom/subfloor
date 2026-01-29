import express from 'express';
import pool from '../db.js';
import { toCamelCase } from '../utils.js';
import { verifySession } from 'supertokens-node/recipe/session/framework/express/index.js';

const router = express.Router();

// GET /api/calendar/events
router.get('/events', verifySession(), async (req, res) => {
    const currentUserId = req.session.getUserId(); 

    let installerWhereClause = '';
    let userFilterClause = ''; 
    
    const params = [];
    let paramIndex = 1;

    // --- 1. FILTER BY INSTALLER ---
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

    // --- 2. FILTER BY USER CREATOR ---
    if (req.query.hasOwnProperty('users')) {
        const userIdsQueryParam = req.query.users;
        const userIds = userIdsQueryParam ? String(userIdsQueryParam).split(',').filter(id => id) : [];
        if (userIds.length > 0) {
            userFilterClause = `AND e.created_by_user_id = ANY($${paramIndex}::text[])`;
            params.push(userIds);
            paramIndex++;
        } else {
            userFilterClause = `AND 1 = 0`;
        }
    }
        
    try {
        const userParamIdx = paramIndex;
        params.push(currentUserId);

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
                p.status AS "projectStatus",
                q.po_number AS "poNumber",
                'appointment' AS "type",
                jsonb_build_object(
                    'isJobComplete', j.final_payment_received,
                    'address', c.address,
                    'projectName', p.project_name,
                    'installerName', i.installer_name,
                    'pinnedNotes', jn.pinned_notes
                ) AS "fullEvent"
            FROM job_appointments ja
            JOIN jobs j ON ja.job_id = j.id
            JOIN projects p ON j.project_id = p.id
            JOIN customers c ON p.customer_id = c.id
            JOIN installers i ON ja.installer_id = i.id
            LEFT JOIN quotes q ON ja.quote_id = q.id
            LEFT JOIN (
                SELECT job_id, STRING_AGG(content, E'\n') as pinned_notes 
                FROM job_notes 
                WHERE is_pinned = true 
                GROUP BY job_id
            ) jn ON j.id = jn.job_id
            WHERE 
                ja.installer_id IS NOT NULL
                AND p.status != 'Cancelled' -- FIX: Hide cancelled jobs
                ${installerWhereClause}
            
            UNION ALL

            SELECT
                p.id AS "id",
                (-mo.id) AS "appointmentId",
                'Materials ETA for ' || p.project_name AS "title",
                mo.eta_date AS "start",
                mo.eta_date AS "end",
                COALESCE(c.full_name, i_client.installer_name) AS "customerName",
                '#8B5CF6' AS "backgroundColor",
                false AS "isOnHold",
                NULL AS "projectStatus",
                NULL AS "poNumber",
                'material_order_eta' AS "type",
                jsonb_build_object(
                    'status', mo.status,
                    'supplierName', v.name,
                    'items', items.list
                ) AS "fullEvent"
            FROM material_orders mo
            JOIN projects p ON mo.project_id = p.id
            LEFT JOIN customers c ON p.customer_id = c.id
            LEFT JOIN installers i_client ON p.client_installer_id = i_client.id
            LEFT JOIN vendors v ON mo.supplier_id = v.id
            LEFT JOIN LATERAL (
                SELECT jsonb_agg(jsonb_build_object(
                    'name', p_prod.name || ' ' || pv.name,
                    'quantity', oli.quantity,
                    'unit', oli.unit,
                    'image', COALESCE(pv.thumbnail_url, pv.image_url, p_prod.default_thumbnail_url, p_prod.default_image_url)
                )) as list
                FROM order_line_items oli
                JOIN product_variants pv ON oli.variant_id = pv.id
                JOIN products p_prod ON pv.product_id = p_prod.id
                WHERE oli.order_id = mo.id
            ) items ON true
            WHERE
                mo.eta_date IS NOT NULL
                AND p.status != 'Cancelled'
            
            UNION ALL

            SELECT
                e.id AS "id",
                (e.id + 1000000) AS "appointmentId", 
                e.title AS "title",
                e.start_time AS "start",
                e.end_time AS "end",
                '' AS "customerName", 
                '#3B82F6' AS "backgroundColor",
                false AS "isOnHold",
                NULL AS "projectStatus",
                NULL AS "poNumber",
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
                    'isPublic', e.is_public,
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
                            'status', ea.status,
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
            WHERE 
                (
                    e.created_by_user_id = $${userParamIdx} 
                    OR (
                        (
                            e.is_public = TRUE 
                            OR EXISTS (
                                SELECT 1 FROM event_attendees sub_ea 
                                WHERE sub_ea.event_id = e.id 
                                AND sub_ea.attendee_id = $${userParamIdx} 
                                AND sub_ea.attendee_type = 'user'
                            )
                        )
                        AND NOT EXISTS (
                            SELECT 1 FROM event_attendees decline_check
                            WHERE decline_check.event_id = e.id
                            AND decline_check.attendee_id = $${userParamIdx}
                            AND decline_check.attendee_type = 'user'
                            AND decline_check.status = 'declined'
                        )
                    )
                )
                ${userFilterClause}
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