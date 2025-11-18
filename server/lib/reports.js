// server/lib/reports.js

import pool from '../db.js';

export async function getDashboardReportData(prefs) {
    const reportData = {
        samplesDueToday: [],
        upcomingJobs: [],
        pendingQuotes: [],
    };

    const client = await pool.connect();
    try {
        if (prefs.includeSamplesDue) {
            const samplesQuery = `
                SELECT 
                    s.style || ' - ' || s.color AS sample_name,
                    c.full_name AS customer_name,
                    p.project_name
                FROM sample_checkouts sc
                JOIN samples s ON sc.sample_id = s.id
                JOIN projects p ON sc.project_id = p.id
                JOIN customers c ON p.customer_id = c.id
                WHERE sc.expected_return_date::date = CURRENT_DATE AND sc.actual_return_date IS NULL;
            `;
            const samplesResult = await client.query(samplesQuery);
            reportData.samplesDueToday = samplesResult.rows;
        }

        if (prefs.includeUpcomingJobs && prefs.upcomingJobsDays > 0) {
            const upcomingJobsQuery = `
                SELECT 
                    p.project_name,
                    MIN(ja.start_date) as start_date,
                    i.installer_name
                FROM jobs j
                JOIN projects p ON j.project_id = p.id
                LEFT JOIN job_appointments ja ON j.id = ja.job_id
                LEFT JOIN installers i ON ja.installer_id = i.id
                WHERE j.is_on_hold = FALSE
                GROUP BY p.project_name, i.installer_name
                HAVING MIN(ja.start_date)::date BETWEEN CURRENT_DATE AND CURRENT_DATE + $1::int
                ORDER BY start_date ASC;
            `;
            const jobsResult = await client.query(upcomingJobsQuery, [prefs.upcomingJobsDays]);
            reportData.upcomingJobs = jobsResult.rows;
        }

        if (prefs.includePendingQuotes && prefs.pendingQuotesDays > 0) {
            const pendingQuotesQuery = `
                SELECT
                    p.project_name,
                    c.full_name as customer_name,
                    q.date_sent
                FROM quotes q
                JOIN projects p ON q.project_id = p.id
                JOIN customers c ON p.customer_id = c.id
                WHERE q.status = 'Sent' 
                AND q.date_sent::date <= CURRENT_DATE - $1::int
                ORDER BY q.date_sent ASC;
            `;
            const quotesResult = await client.query(pendingQuotesQuery, [prefs.pendingQuotesDays]);
            reportData.pendingQuotes = quotesResult.rows;
        }

        return reportData;

    } catch (error) {
        console.error('Error generating dashboard report data:', error);
        throw error;
    } finally {
        client.release();
    }
}