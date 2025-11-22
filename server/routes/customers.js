import express from 'express';
import pool from '../db.js';
import { toCamelCase, logActivity, verifyRole } from '../utils.js';
import { verifySession } from 'supertokens-node/recipe/session/framework/express/index.js';

const router = express.Router();

/* ============================================================
   GET /api/customers
   Aggregates appointments via job_appointments
   ============================================================ */
router.get('/', verifySession(), async (req, res) => {
  try {
    const query = `
      SELECT
          c.*,
          COALESCE(
              (
                  SELECT json_agg(job_details ORDER BY "scheduledStartDate" DESC)
                  FROM (
                      SELECT DISTINCT ON (p.id)
                          p.id AS "projectId",
                          p.project_name AS "projectName",
                          i.installer_name AS "installerName",
                          ja.start_date AS "scheduledStartDate",
                          ja.end_date AS "scheduledEndDate"
                      FROM projects p
                      JOIN jobs j ON p.id = j.project_id
                      JOIN job_appointments ja ON j.id = ja.job_id
                      LEFT JOIN installers i ON ja.installer_id = i.id
                      WHERE p.customer_id = c.id
                      ORDER BY p.id, ja.start_date ASC
                  ) AS job_details
              ),
              '[]'::json
          ) AS jobs
      FROM customers c
      ORDER BY c.created_at DESC;
    `;
    const result = await pool.query(query);
    res.json(result.rows.map(toCamelCase));
  } catch (err) {
    console.error('Error fetching customers:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/* ============================================================
   ✔ NEW ROUTE — FIXES YOUR CUSTOMER PAGE
   GET /api/customers/:id/projects
   Same structure as installers/:id/projects
   ============================================================ */
router.get('/:id/projects', verifySession(), async (req, res) => {
  const { id: customerId } = req.params;

  try {
    const query = `
      SELECT
          p.id AS "projectId",
          p.project_name AS "projectName",
          i.installer_name AS "installerName",
          ja.start_date AS "scheduledStartDate",
          ja.end_date AS "scheduledEndDate"
      FROM projects p
      JOIN jobs j ON p.id = j.project_id
      JOIN job_appointments ja ON j.id = ja.job_id
      LEFT JOIN installers i ON ja.installer_id = i.id
      WHERE p.customer_id = $1
      ORDER BY ja.start_date DESC;
    `;

    const result = await pool.query(query, [customerId]);
    res.json(result.rows.map(toCamelCase));

  } catch (err) {
    console.error('Error fetching customer projects:', err.message);
    res.status(500).json({ error: 'Failed to fetch projects' });
  }
});

/* ============================================================
   POST /api/customers
   ============================================================ */
router.post('/', verifySession(), async (req, res) => {
  try {
    const { fullName, email, phoneNumber, address } = req.body;
    const result = await pool.query(
      "INSERT INTO customers (full_name, email, phone_number, address) VALUES ($1, $2, $3, $4) RETURNING *",
      [fullName, email, phoneNumber, address]
    );
    const newCustomer = toCamelCase(result.rows[0]);
    const userId = req.session.getUserId();
    await logActivity(userId, 'CREATE', 'CUSTOMER', newCustomer.id, { createdData: newCustomer });
    res.status(201).json(newCustomer);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/* ============================================================
   PUT /api/customers/:id
   ============================================================ */
router.put('/:id', verifySession(), async (req, res) => {
  try {
    const { id } = req.params;
    const { fullName, email, phoneNumber, address } = req.body;

    if (!fullName) return res.status(400).json({ error: 'Full name is required.' });

    const beforeResult = await pool.query('SELECT * FROM customers WHERE id = $1', [id]);
    const beforeData = beforeResult.rows.length > 0 ? toCamelCase(beforeResult.rows[0]) : null;

    const result = await pool.query(
      "UPDATE customers SET full_name = $1, email = $2, phone_number = $3, address = $4 WHERE id = $5 RETURNING *",
      [fullName, email, phoneNumber, address, id]
    );

    if (result.rows.length === 0) return res.status(404).json({ error: 'Customer not found' });

    const updatedCustomer = toCamelCase(result.rows[0]);
    const userId = req.session.getUserId();
    await logActivity(userId, 'UPDATE', 'CUSTOMER', id, { before: beforeData, after: updatedCustomer });

    res.json(updatedCustomer);

  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/* ============================================================
   GET /api/customers/:id/history
   ============================================================ */
router.get('/:id/history', verifySession(), async (req, res) => {
  const { id } = req.params;
  try {
      const query = `
          SELECT al.*, ep.email AS user_email
          FROM activity_log al
          LEFT JOIN emailpassword_users ep ON al.user_id = ep.user_id
          WHERE al.target_entity = 'CUSTOMER' AND al.target_id = $1
          ORDER BY al.created_at DESC;
      `;
      const result = await pool.query(query, [id]);
      res.json(result.rows.map(toCamelCase));
  } catch (err) {
      console.error(err.message);
      res.status(500).json({ error: "Internal server error retrieving customer history" });
  }
});

/* ============================================================
   DELETE /api/customers/:id
   ============================================================ */
router.delete('/:id', verifySession(), verifyRole('Admin'), async (req, res) => {
  const { id } = req.params;
  const client = await pool.connect();
  const userId = req.session.getUserId();

  try {
    await client.query('BEGIN');

    const projectCheck = await client.query(
      'SELECT 1 FROM projects WHERE customer_id = $1 LIMIT 1',
      [id]
    );

    if (projectCheck.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'Cannot delete customer. Please re-assign or delete their projects first.' });
    }

    const customerToDelete = await client.query('SELECT * FROM customers WHERE id = $1', [id]);
    if (customerToDelete.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Customer not found' });
    }

    const deletedData = toCamelCase(customerToDelete.rows[0]);
    await client.query('DELETE FROM customers WHERE id = $1', [id]);
    await logActivity(userId, 'DELETE', 'CUSTOMER', id, { deletedData });

    await client.query('COMMIT');
    res.status(204).send();

  } catch (err) {
    await client.query('ROLLBACK');
    console.error(`Failed to delete customer ${id}:`, err.message);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    client.release();
  }
});

export default router;