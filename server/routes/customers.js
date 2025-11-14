// server/routes/customers.js
import express from 'express';
import pool from '../db.js';
import { toCamelCase } from '../utils.js';
import { verifySession } from 'supertokens-node/recipe/session/framework/express/index.js';

const router = express.Router();

// ALL routes in this file will now require a valid session.
// The `verifySession()` middleware is added to each route handler.

router.get('/', verifySession(), async (req, res) => {
  try {
    const query = `
      SELECT
          c.*,
          COALESCE(
              (
                  SELECT json_agg(job_details)
                  FROM (
                      SELECT
                          p.id AS "projectId",
                          p.project_name AS "projectName",
                          i.installer_name AS "installerName",
                          j.scheduled_start_date AS "scheduledStartDate",
                          j.scheduled_end_date AS "scheduledEndDate"
                      FROM projects p
                      JOIN jobs j ON p.id = j.project_id
                      LEFT JOIN quotes q ON p.id = q.project_id AND q.status = 'Accepted'
                      LEFT JOIN installers i ON q.installer_id = i.id
                      WHERE p.customer_id = c.id AND j.scheduled_start_date IS NOT NULL
                      ORDER BY j.scheduled_start_date DESC
                  ) AS job_details
              ),
              '[]'::json
          ) AS jobs
      FROM customers c
      ORDER BY c.created_at DESC;
    `;
    const result = await pool.query(query);
    res.json(result.rows.map(toCamelCase));
  } catch (err) { console.error(err.message); res.status(500).json({ error: 'Internal server error' }); }
});

router.post('/', verifySession(), async (req, res) => {
  try {
    const { fullName, email, phoneNumber, address } = req.body;
    const result = await pool.query("INSERT INTO customers (full_name, email, phone_number, address) VALUES ($1, $2, $3, $4) RETURNING *", [fullName, email, phoneNumber, address]);
    res.status(201).json(toCamelCase(result.rows[0]));
  } catch (err) { console.error(err.message); res.status(500).json({ error: 'Internal server error' }); }
});

router.put('/:id', verifySession(), async (req, res) => {
  try {
    const { id } = req.params;
    const { fullName, email, phoneNumber, address } = req.body;

    if (!fullName || !email) {
      return res.status(400).json({ error: 'Full name and email are required.' });
    }

    const result = await pool.query(
      "UPDATE customers SET full_name = $1, email = $2, phone_number = $3, address = $4 WHERE id = $5 RETURNING *",
      [fullName, email, phoneNumber, address, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    res.json(toCamelCase(result.rows[0]));
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.delete('/:id', verifySession(), async (req, res) => {
  const { id } = req.params;
  const client = await pool.connect();

  try {
    const projectCheckResult = await client.query('SELECT 1 FROM projects WHERE customer_id = $1 LIMIT 1', [id]);
    if (projectCheckResult.rows.length > 0) {
      return res.status(409).json({ error: 'Cannot delete customer. Please re-assign or delete their projects first.' });
    }

    const deleteResult = await client.query('DELETE FROM customers WHERE id = $1 RETURNING *', [id]);
    
    if (deleteResult.rows.length === 0) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    res.status(204).send();
  } catch (err) {
    console.error(`Failed to delete customer ${id}:`, err.message);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    client.release();
  }
});

export default router;