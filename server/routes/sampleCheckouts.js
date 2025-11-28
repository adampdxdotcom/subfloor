import express from 'express';
import pool from '../db.js';
import { toCamelCase } from '../utils.js';
import { verifySession } from 'supertokens-node/recipe/session/framework/express/index.js';

const router = express.Router();

// GET /api/sample-checkouts
router.get('/', verifySession(), async (req, res) => {
  try {
    const { projectId } = req.query;
    let result;
    if (projectId) { 
      result = await pool.query('SELECT * FROM sample_checkouts WHERE project_id = $1 ORDER BY checkout_date DESC', [projectId]); 
    } else { 
      result = await pool.query('SELECT * FROM sample_checkouts ORDER BY checkout_date DESC'); 
    }
    res.json(result.rows.map(toCamelCase));
  } catch (err) { console.error(err.message); res.status(500).json({ error: 'Internal server error' }); }
});

// POST /api/sample-checkouts
router.post('/', verifySession(), async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { projectId, variantId, sampleType, quantity, expectedReturnDate } = req.body;
    const result = await client.query(
        `INSERT INTO sample_checkouts (project_id, variant_id, sample_type, quantity, expected_return_date) VALUES ($1, $2, $3, $4, $5) RETURNING *`, 
        [projectId, variantId, sampleType, quantity || 1, expectedReturnDate]
    );
    await client.query('COMMIT');
    res.status(201).json(toCamelCase(result.rows[0]));
  } catch (err) { 
    await client.query('ROLLBACK'); 
    console.error(err.message); 
    res.status(500).json({ error: 'Internal server error' }); 
  } finally { 
    client.release(); 
  }
});

// PUT /api/sample-checkouts/:id (Used for returning a sample)
router.put('/:id', verifySession(), async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { id } = req.params;
    const result = await client.query(`UPDATE sample_checkouts SET actual_return_date = CURRENT_TIMESTAMP WHERE id = $1 RETURNING *`, [id]);
    await client.query('COMMIT');
    res.json(toCamelCase(result.rows[0]));
  } catch (err) { 
    await client.query('ROLLBACK'); 
    console.error(err.message); 
    res.status(500).json({ error: 'Internal server error' }); 
  } finally { 
    client.release(); 
  }
});

// PATCH /api/sample-checkouts/:id (Used for updating expected return date OR is_selected status)
router.patch('/:id', verifySession(), async (req, res) => {
  const { id } = req.params;
  const { expectedReturnDate, isSelected } = req.body;

  if (!expectedReturnDate && isSelected === undefined) {
    return res.status(400).json({ error: 'No fields provided to update.' });
  }

  try {
    const result = await pool.query(
      `UPDATE sample_checkouts 
       SET expected_return_date = COALESCE($1, expected_return_date),
           is_selected = COALESCE($2, is_selected)
       WHERE id = $3 RETURNING *`,
      [expectedReturnDate || null, isSelected, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: `Checkout with id ${id} not found.` });
    }

    res.json(toCamelCase(result.rows[0]));
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;