import express from 'express';
import pool from '../db.js';
import ical from 'ical-generator';

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
        // We set the URL to your generic app domain for now
        const calendar = ical({
            name: 'Subfloor Schedule',
            url: 'https://subfloor.app',
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
                i.installer_name,
                j.project_id
            FROM job_appointments ja
            JOIN jobs j ON ja.job_id = j.id
            JOIN projects p ON j.project_id = p.id
            LEFT JOIN customers c ON p.customer_id = c.id
            LEFT JOIN installers i ON ja.installer_id = i.id
            WHERE ja.start_date > NOW() - INTERVAL '3 months' -- Sync recent history and future
        `;
        
        const jobsResult = await pool.query(jobsQuery);
        
        jobsResult.rows.forEach(job => {
            calendar.createEvent({
                id: `job-${job.id}`,
                start: job.start_date,
                end: job.end_date,
                summary: `👷 ${job.appointment_name} (${job.installer_name || 'Unassigned'})`,
                description: `Project: ${job.project_name}\nCustomer: ${job.customer_name}`,
                location: job.customer_name || '', 
                url: `https://subfloor.app/projects/${job.project_id}`
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
        calendar.serve(res);

    } catch (err) {
        console.error('Calendar Feed Error:', err);
        res.status(500).send('Internal Server Error');
    }
});

export default router;