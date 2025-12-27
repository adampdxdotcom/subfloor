import express from 'express';
import pool from '../db.js';
import ical from 'ical-generator';
import { getSystemConfig } from '../lib/setupService.js';

// Simple Hex to closest Emoji Matcher
const getEmojiForColor = (hex) => {
    if (!hex) return '👷'; // Default if no color
    
    // Convert hex to RGB
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);

    const colors = [
        { emoji: '🔴', r: 255, g: 0, b: 0 },
        { emoji: '🟠', r: 255, g: 165, b: 0 },
        { emoji: '🟡', r: 255, g: 255, b: 0 },
        { emoji: '🟢', r: 0, g: 128, b: 0 },
        { emoji: '🔵', r: 0, g: 0, b: 255 },
        { emoji: '🟣', r: 128, g: 0, b: 128 },
        { emoji: '🟤', r: 165, g: 42, b: 42 },
        { emoji: '⚫', r: 0, g: 0, b: 0 },
        { emoji: '⚪', r: 255, g: 255, b: 255 },
    ];

    // Find closest (Euclidean distance)
    let closest = colors[0];
    let minDist = Infinity;

    colors.forEach(c => {
        const dist = Math.sqrt(Math.pow(c.r - r, 2) + Math.pow(c.g - g, 2) + Math.pow(c.b - b, 2));
        if (dist < minDist) {
            minDist = dist;
            closest = c;
        }
    });

    return closest.emoji;
};

const router = express.Router();

// GET /api/calendar/feed/:userId/:token
// Public endpoint (no session required, protected by token validation)
router.get('/:userId/:token', async (req, res) => {
    const { userId, token } = req.params;

    try {
        // 1. Verify User & Token
        const authCheck = await pool.query(
            `SELECT user_id FROM user_preferences WHERE user_id = $1 AND calendar_token = $2`,
            [userId, token]
        );

        if (authCheck.rowCount === 0) {
            return res.status(401).send('Invalid Calendar Token');
        }

        // 2. Initialize iCal Feed
        // Fetch the actual Public URL from system config
        const config = getSystemConfig();
        const baseUrl = (config.publicUrl || 'https://subfloor.app').replace(/\/$/, '');

        const calendar = ical({
            name: 'Subfloor Schedule',
            url: baseUrl,
            ttl: 60 * 60, // 1 hour cache hint
        });

        // 3. Fetch Job Appointments (Installations)
        const jobsQuery = `
            SELECT 
                ja.id, 
                ja.appointment_name, 
                ja.start_date, 
                ja.end_date, 
                p.project_name, 
                c.full_name as customer_name,
                c.address as customer_address,
                i.installer_name,
                i.color as installer_color,
                j.project_id,
                jn.pinned_notes
            FROM job_appointments ja
            JOIN jobs j ON ja.job_id = j.id
            JOIN projects p ON j.project_id = p.id
            LEFT JOIN customers c ON p.customer_id = c.id
            LEFT JOIN installers i ON ja.installer_id = i.id
            LEFT JOIN (
                SELECT job_id, STRING_AGG('📌 ' || content, E'\n') as pinned_notes 
                FROM job_notes 
                WHERE is_pinned = true 
                GROUP BY job_id
            ) jn ON j.id = jn.job_id
            WHERE ja.start_date > NOW() - INTERVAL '3 months'
        `;
        
        const jobsResult = await pool.query(jobsQuery);
        
        jobsResult.rows.forEach(job => {
            const emoji = getEmojiForColor(job.installer_color);

            // Build Description
            let description = `Project: ${job.project_name}\nCustomer: ${job.customer_name}`;
            if (job.pinned_notes) {
                description += `\n\n📝 NOTES:\n${job.pinned_notes}`;
            }
            description += `\n\nLink: ${baseUrl}/projects/${job.project_id}`;

            calendar.createEvent({
                id: `job-${job.id}`,
                start: job.start_date,
                end: job.end_date,
                summary: `${emoji} ${job.appointment_name} - ${job.installer_name || 'Unassigned'}`,
                description: description,
                location: job.customer_address || job.customer_name || '', 
                url: `${baseUrl}/projects/${job.project_id}`
            });
        });

        // 3.5 Fetch Material Orders (Deliveries)
        const moQuery = `
            SELECT 
                mo.id,
                mo.eta_date,
                p.project_name,
                v.name as supplier_name,
                mo.project_id
            FROM material_orders mo
            JOIN projects p ON mo.project_id = p.id
            LEFT JOIN vendors v ON mo.supplier_id = v.id
            WHERE mo.eta_date IS NOT NULL 
              AND mo.eta_date > CURRENT_DATE - INTERVAL '1 month'
              AND mo.status != 'Received'
        `;
        
        const moResult = await pool.query(moQuery);
        
        moResult.rows.forEach(mo => {
            // Material Orders are usually All Day
            calendar.createEvent({
                id: `mo-${mo.id}`,
                start: mo.eta_date,
                allDay: true,
                summary: `📦 Delivery: ${mo.supplier_name}`,
                description: `Project: ${mo.project_name}\nSupplier: ${mo.supplier_name}`,
                url: `${baseUrl}/projects/${mo.project_id}`
            });
        });

        // 4. Fetch General Events (Meetings/Reminders)
        const eventsQuery = `
            SELECT DISTINCT e.*
            FROM events e
            LEFT JOIN event_attendees ea ON e.id = ea.event_id
            WHERE 
                e.start_time > NOW() - INTERVAL '3 months' AND (
                    e.is_public = TRUE OR
                    e.created_by_user_id = $1 OR
                    (ea.attendee_id = $1 AND ea.attendee_type = 'user' AND ea.status != 'declined')
                )
        `;

        const eventsResult = await pool.query(eventsQuery, [userId]);

        eventsResult.rows.forEach(event => {
            calendar.createEvent({
                id: `event-${event.id}`,
                start: event.start_time,
                end: event.end_time,
                allDay: event.is_all_day,
                summary: `📅 ${event.title}`,
                description: event.notes || '',
            });
        });

        // 5. Serve the file
        res.writeHead(200, {
            'Content-Type': 'text/calendar; charset=utf-8',
            'Content-Disposition': 'attachment; filename="calendar.ics"'
        });
        res.end(calendar.toString());

    } catch (err) {
        console.error('Calendar Feed Error:', err);
        res.status(500).send('Internal Server Error');
    }
});

export default router;