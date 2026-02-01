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

// POST /api/sample-checkouts/:id/extend (Extend due date by 2 days from NOW)
router.post('/:id/extend', verifySession(), async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query(
      `UPDATE sample_checkouts 
       SET expected_return_date = CURRENT_TIMESTAMP + INTERVAL '2 days' 
       WHERE id = $1 RETURNING *`,
      [id]
    );
    res.json(toCamelCase(result.rows[0]));
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: 'Internal server error' });
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

// GET /api/sample-checkouts/group/:id - Find and return all items from a single checkout transaction
router.get('/group/:id', verifySession(), async (req, res) => {
    const { id } = req.params;
    try {
        const client = await pool.connect();
        // 1. Get the reference checkout to find its timestamp and recipient
        const referenceResult = await client.query('SELECT checkout_date, project_id, customer_id, installer_id, expected_return_date FROM sample_checkouts WHERE id = $1', [id]);
        if (referenceResult.rows.length === 0) {
            client.release();
            return res.status(404).json({ error: 'Checkout not found' });
        }
        const ref = referenceResult.rows[0];

        // 2. Build the query to find all checkouts in the same group
        const findGroupQuery = `
            SELECT
                sc.id, sc.variant_id, sc.interest_variant_id, sc.sample_type, sc.quantity, sc.expected_return_date,
                p.id as product_id,
                p.name as product_name,
                p.product_type,
                p.product_line_url,
                p_man.id as manufacturer_id,
                p_man.name as manufacturer_name,
                pv_int.name as interest_name,
                pv_int.size,
                pv_int.unit_cost,
                pv_int.carton_size,
                pv_int.uom,
                pv_int.pricing_unit
            FROM sample_checkouts sc
            JOIN product_variants pv_phys ON sc.variant_id = pv_phys.id
            JOIN products p ON pv_phys.product_id = p.id
            JOIN product_variants pv_int ON sc.interest_variant_id = pv_int.id
            LEFT JOIN vendors p_man ON p.manufacturer_id = p_man.id
            WHERE
                sc.checkout_date BETWEEN ($1::timestamp - INTERVAL '5 seconds') AND ($1::timestamp + INTERVAL '5 seconds')
                AND (sc.project_id = $2 OR ($2 IS NULL AND sc.project_id IS NULL))
                AND (sc.customer_id = $3 OR ($3 IS NULL AND sc.customer_id IS NULL))
                AND (sc.installer_id = $4 OR ($4 IS NULL AND sc.installer_id IS NULL))
            ORDER BY product_name ASC, interest_name ASC;
        `;
        const groupResult = await client.query(findGroupQuery, [ref.checkout_date, ref.project_id, ref.customer_id, ref.installer_id]);
        
        // 3. Find the recipient's details
        let recipient = null;
        if (ref.project_id) {
            const projRes = await client.query(`SELECT p.*, c.full_name as "customerName" FROM projects p JOIN customers c ON p.customer_id = c.id WHERE p.id = $1`, [ref.project_id]);
            if (projRes.rows.length > 0) {
                 recipient = { type: 'project', data: toCamelCase(projRes.rows[0]) };
            }
        } else if (ref.customer_id) {
            const custRes = await client.query('SELECT * FROM customers WHERE id = $1', [ref.customer_id]);
             if (custRes.rows.length > 0) {
                 recipient = { type: 'customer', data: toCamelCase(custRes.rows[0]) };
            }
        } else if (ref.installer_id) {
            const instRes = await client.query('SELECT * FROM installers WHERE id = $1', [ref.installer_id]);
             if (instRes.rows.length > 0) {
                 recipient = { type: 'installer', data: toCamelCase(instRes.rows[0]) };
            }
        }
        
        client.release();
        res.json({
            recipient,
            items: groupResult.rows.map(toCamelCase),
            returnDate: ref.expected_return_date // Assuming all items in group have same return date
        });

    } catch (err) {
        console.error("Error fetching checkout group:", err.message);
        res.status(500).json({ error: 'Internal server error' });
    }
});

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