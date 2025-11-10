import express from 'express';
import pool from '../db.js';
import { toCamelCase } from '../utils.js';

const router = express.Router();

// GET /api/sample-checkouts
router.get('/', async (req, res) => {
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
router.post('/', async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { projectId, sampleId, expectedReturnDate } = req.body;
    const result = await client.query(`INSERT INTO sample_checkouts (project_id, sample_id, expected_return_date) VALUES ($1, $2, $3) RETURNING *`, [projectId, sampleId, expectedReturnDate]);
    await client.query('UPDATE samples SET is_available = FALSE WHERE id = $1', [sampleId]);
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

// PUT /api/sample-checkouts/:id
router.put('/:id', async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { id } = req.params;
    const checkoutToReturn = await client.query('SELECT sample_id FROM sample_checkouts WHERE id = $1', [id]);
    if (checkoutToReturn.rows.length === 0) { 
      await client.query('ROLLBACK'); 
      return res.status(404).json({ error: `Checkout with id ${id} not found.` }); 
    }
    const { sample_id: sampleId } = checkoutToReturn.rows[0];
    const result = await client.query(`UPDATE sample_checkouts SET actual_return_date = CURRENT_TIMESTAMP WHERE id = $1 RETURNING *`, [id]);
    await client.query('UPDATE samples SET is_available = TRUE WHERE id = $1', [sampleId]);
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

// --- NEW ROUTE HANDLER FOR EXTENDING CHECKOUTS ---
// PATCH /api/sample-checkouts/:id
router.patch('/:id', async (req, res) => {
  const { id } = req.params;
  const { expectedReturnDate } = req.body;

  if (!expectedReturnDate) {
    return res.status(400).json({ error: 'expectedReturnDate is required.' });
  }

  try {
    const result = await pool.query(
      `UPDATE sample_checkouts SET expected_return_date = $1 WHERE id = $2 RETURNING *`,
      [expectedReturnDate, id]
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
// --- END NEW ROUTE ---

export default router;