import express from 'express';
import pool from '../db.js';
import { toCamelCase } from '../utils.js';
import { verifySession } from 'supertokens-node/recipe/session/framework/express/index.js';

const router = express.Router();

// GET /api/sample-checkouts
router.get('/', verifySession(), async (req, res) => {
  try {
    const { projectId, customerId, installerId } = req.query;

    // Base Query with Joins to get Product details
    const baseQuery = `
        SELECT
            sc.*,
            -- Join Physical Item (What they took)
            pv_phys.name as "variantName",
            p.name as "productName",
            p.default_thumbnail_url as "productThumbnail",
            -- Join Interest (What they want)
            pv_int.name as "interestVariantName",
            pv_int.thumbnail_url as "interestVariantThumbnail"
        FROM sample_checkouts sc
        LEFT JOIN product_variants pv_phys ON sc.variant_id = pv_phys.id
        LEFT JOIN products p ON pv_phys.product_id = p.id
        LEFT JOIN product_variants pv_int ON sc.interest_variant_id = pv_int.id
    `;

    let result;
    if (projectId) {
      result = await pool.query(`${baseQuery} WHERE sc.project_id = $1 ORDER BY sc.checkout_date DESC`, [projectId]);
    } else if (customerId) {
      result = await pool.query(`${baseQuery} WHERE sc.customer_id = $1 ORDER BY sc.checkout_date DESC`, [customerId]);
    } else if (installerId) {
      result = await pool.query(`${baseQuery} WHERE sc.installer_id = $1 ORDER BY sc.checkout_date DESC`, [installerId]);
    } else {
      result = await pool.query(`${baseQuery} ORDER BY sc.checkout_date DESC`);
    }
    res.json(result.rows.map(toCamelCase));
  } catch (err) { console.error(err.message); res.status(500).json({ error: 'Internal server error' }); }
});

// POST /api/sample-checkouts
router.post('/', verifySession(), async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const {
        projectId,
        customerId,
        installerId,
        variantId,
        interestVariantId,
        sampleType,
        quantity,
        expectedReturnDate
    } = req.body;

    // Ensure that at least one of projectId, customerId, or installerId is provided,
    // though the frontend logic should enforce this.

    const result = await client.query(
        `INSERT INTO sample_checkouts (project_id, customer_id, installer_id, variant_id, interest_variant_id, sample_type, quantity, expected_return_date)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
        [
            projectId || null,
            customerId || null,
            installerId || null,
            variantId,
            interestVariantId || null,
            sampleType,
            quantity || 1,
            expectedReturnDate
        ]
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

// NEW: POST /api/sample-checkouts/transfer
// Moves specific checkout records to a new project
router.post('/transfer', verifySession(), async (req, res) => {
  const { checkoutIds, projectId } = req.body;
  // Ensure checkoutIds is an array of IDs and projectId is valid
  if (!checkoutIds || !projectId || !Array.isArray(checkoutIds) || checkoutIds.length === 0) {
      return res.status(400).json({ error: 'Missing or invalid checkoutIds or projectId' });
  }

  try {
    // Note: $2::int[] casts the array of IDs from JS/JSON to a PostgreSQL integer array type.
    await pool.query(
      `UPDATE sample_checkouts SET project_id = $1, customer_id = NULL, installer_id = NULL WHERE id = ANY($2::int[])`,
      [projectId, checkoutIds]
    );
    res.json({ success: true });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;