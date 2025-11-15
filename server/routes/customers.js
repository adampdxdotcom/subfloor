// server/routes/customers.js
import express from 'express';
import pool from '../db.js';
// vvvvvvvvvvvv MODIFIED: Imported the new verifyRole middleware vvvvvvvvvvvv
import { toCamelCase, logActivity, verifyRole } from '../utils.js';
// ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
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
    const newCustomer = toCamelCase(result.rows[0]);

    // --- AUDIT LOG ---
    const userId = req.session.getUserId();
    await logActivity(userId, 'CREATE', 'CUSTOMER', newCustomer.id, { createdData: newCustomer });
    // --- END AUDIT LOG ---

    res.status(201).json(newCustomer);
  } catch (err) { console.error(err.message); res.status(500).json({ error: 'Internal server error' }); }
});

router.put('/:id', verifySession(), async (req, res) => {
  try {
    const { id } = req.params;
    const { fullName, email, phoneNumber, address } = req.body;

    // vvvvvvvvvvvv MODIFIED: Removed email from required fields check vvvvvvvvvvvv
    if (!fullName) {
      return res.status(400).json({ error: 'Full name is required.' });
    }
    // ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
    
    // --- AUDIT LOG: Capture state *before* the update ---
    const beforeResult = await pool.query('SELECT * FROM customers WHERE id = $1', [id]);
    const beforeData = beforeResult.rows.length > 0 ? toCamelCase(beforeResult.rows[0]) : null;
    // --- END AUDIT LOG ---

    const result = await pool.query(
      "UPDATE customers SET full_name = $1, email = $2, phone_number = $3, address = $4 WHERE id = $5 RETURNING *",
      [fullName, email, phoneNumber, address, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    const updatedCustomer = toCamelCase(result.rows[0]);

    // --- AUDIT LOG: Log the change with before and after data ---
    const userId = req.session.getUserId();
    await logActivity(userId, 'UPDATE', 'CUSTOMER', id, { before: beforeData, after: updatedCustomer });
    // --- END AUDIT LOG ---

    res.json(updatedCustomer);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/:id/history', verifySession(), async (req, res) => {
    const { id } = req.params;
    try {
        const query = `
            SELECT 
                al.*,
                ep.email AS user_email
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

// =================================================================
//  SECURED DELETE ROUTE
// =================================================================
// vvvvvvvvvvvv MODIFIED: Added verifyRole('Admin') middleware vvvvvvvvvvvv
router.delete('/:id', verifySession(), verifyRole('Admin'), async (req, res) => {
// ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
  const { id } = req.params;
  const client = await pool.connect();
  const userId = req.session.getUserId(); // Get user ID early

  try {
    await client.query('BEGIN'); // Start transaction

    const projectCheckResult = await client.query('SELECT 1 FROM projects WHERE customer_id = $1 LIMIT 1', [id]);
    if (projectCheckResult.rows.length > 0) {
      await client.query('ROLLBACK'); // Abort transaction
      return res.status(409).json({ error: 'Cannot delete customer. Please re-assign or delete their projects first.' });
    }
    
    // --- AUDIT LOG: Get customer data *before* deleting ---
    const customerToDelete = await client.query('SELECT * FROM customers WHERE id = $1', [id]);
    if (customerToDelete.rows.length === 0) {
      await client.query('ROLLBACK'); // Abort transaction
      return res.status(404).json({ error: 'Customer not found' });
    }
    const deletedData = toCamelCase(customerToDelete.rows[0]);
    // --- END AUDIT LOG ---

    await client.query('DELETE FROM customers WHERE id = $1', [id]);

    // --- AUDIT LOG: Log the deletion after it succeeds ---
    await logActivity(userId, 'DELETE', 'CUSTOMER', id, { deletedData });
    // --- END AUDIT LOG ---

    await client.query('COMMIT'); // Commit transaction
    res.status(204).send();
  } catch (err) {
    await client.query('ROLLBACK'); // Rollback on any error
    console.error(`Failed to delete customer ${id}:`, err.message);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    client.release();
  }
});

export default router;