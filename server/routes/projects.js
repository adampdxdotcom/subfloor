import express from 'express';
import pool from '../db.js';
import { toCamelCase } from '../utils.js';

const router = express.Router();

// GET /api/projects
router.get('/', async (req, res) => {
  try {
    const { installerId } = req.query;
    if (installerId) {
        const query = `
            SELECT
                p.id AS project_id,
                p.project_name,
                c.full_name AS customer_name,
                q.labor_amount AS installer_labor_amount,
                j.scheduled_start_date
            FROM
                quotes q
            JOIN
                projects p ON q.project_id = p.id
            JOIN
                customers c ON p.customer_id = c.id
            LEFT JOIN
                jobs j ON p.id = j.project_id
            WHERE
                q.installer_id = $1 AND q.status = 'Accepted'
            ORDER BY
                j.scheduled_start_date DESC NULLS LAST, p.created_at DESC;
        `;
        const result = await pool.query(query, [installerId]);
        res.json(result.rows.map(toCamelCase));
    } else {
        const result = await pool.query('SELECT * FROM projects ORDER BY created_at DESC');
        res.json(result.rows.map(toCamelCase));
    }
  } catch (err) { console.error(err.message); res.status(500).json({ error: 'Internal server error' }); }
});

// GET /api/projects/:id
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('SELECT * FROM projects WHERE id = $1', [id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Project not found' });
    res.json(toCamelCase(result.rows[0]));
  } catch (err) { console.error(err.message); res.status(500).json({ error: 'Internal server error' }); }
});

// POST /api/projects
router.post('/', async (req, res) => {
  const { customerId, projectName, projectType, status, finalChoice, installerId } = req.body;
  
  if (!customerId || !projectName || !projectType) {
    return res.status(400).json({ error: 'customerId, projectName, and projectType are required.' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const projectResult = await client.query(
      `INSERT INTO projects (customer_id, project_name, project_type, status, final_choice) 
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [customerId, projectName, projectType, status || 'New', finalChoice]
    );
    const newProject = projectResult.rows[0];

    if (installerId) {
      await client.query(
        `INSERT INTO quotes (project_id, installer_id, status, materials_amount, labor_amount, labor_deposit_percentage, date_sent) 
         VALUES ($1, $2, 'Sent', 0, 0, 50, CURRENT_TIMESTAMP)`,
        [newProject.id, installerId]
      );
    }
    
    await client.query('COMMIT');
    res.status(201).json(toCamelCase(newProject));
  } catch (err) {
    await client.query('ROLLBACK');
    console.error("Project creation transaction failed:", err.message);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    client.release();
  }
});

// PUT /api/projects/:id
router.put('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { projectName, projectType, status, finalChoice } = req.body;

        const result = await pool.query(
            `UPDATE projects 
             SET 
                project_name = COALESCE($1, project_name),
                project_type = COALESCE($2, project_type),
                status = COALESCE($3, status),
                final_choice = COALESCE($4, final_choice)
             WHERE id = $5 
             RETURNING *`,
            [projectName, projectType, status, finalChoice, id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Project not found' });
        }

        res.json(toCamelCase(result.rows[0]));
    } catch (err) {
        console.error("Project update failed:", err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// --- NEW CODE START ---
// DELETE /api/projects/:id
router.delete('/:id', async (req, res) => {
  const { id: projectId } = req.params;
  const client = await pool.connect();

  try {
    await client.query('BEGIN'); // Start a transaction

    // 1. Delete associated data from child tables. The order matters to respect foreign key constraints.
    // NOTE: `order_line_items` are deleted automatically when their `material_orders` parent is deleted,
    // if you have set up `ON DELETE CASCADE` in your database schema. If not, they must be deleted first.
    // Assuming `ON DELETE CASCADE` is set for `order_line_items`.

    await client.query('DELETE FROM sample_checkouts WHERE project_id = $1', [projectId]);
    await client.query('DELETE FROM change_orders WHERE project_id = $1', [projectId]);
    await client.query('DELETE FROM jobs WHERE project_id = $1', [projectId]);
    
    // Find all material orders for this project to delete their line items first
    const ordersResult = await client.query('SELECT id FROM material_orders WHERE project_id = $1', [projectId]);
    for (const order of ordersResult.rows) {
      await client.query('DELETE FROM order_line_items WHERE order_id = $1', [order.id]);
    }
    await client.query('DELETE FROM material_orders WHERE project_id = $1', [projectId]);

    await client.query('DELETE FROM quotes WHERE project_id = $1', [projectId]);

    // 2. Finally, delete the project itself.
    const deleteProjectResult = await client.query('DELETE FROM projects WHERE id = $1 RETURNING *', [projectId]);

    if (deleteProjectResult.rows.length === 0) {
      // This will trigger a rollback
      throw new Error('Project not found, rollback initiated.');
    }

    await client.query('COMMIT'); // Commit the transaction
    res.status(204).send(); // Success

  } catch (err) {
    await client.query('ROLLBACK'); // Rollback on any error
    console.error(`Failed to delete project ${projectId}:`, err.message);
    res.status(500).json({ error: 'Internal server error during project deletion.' });
  } finally {
    client.release();
  }
});
// --- NEW CODE END ---

export default router;