import express from 'express';
import pool from '../db.js';
import { toCamelCase, logActivity, verifyRole } from '../utils.js';
import path from 'path';
import fs from 'fs'; 
import { fileURLToPath } from 'url';
import qrcode from 'qrcode';
import { verifySession } from 'supertokens-node/recipe/session/framework/express/index.js';

const router = express.Router();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.resolve(path.dirname(__filename), '..'); 

// --- Endpoint to get all unique size values for autocomplete ---
router.get('/sizes', verifySession(), async (req, res) => {
    try {
        const query = 'SELECT DISTINCT size_value FROM sample_sizes ORDER BY size_value ASC';
        const result = await pool.query(query);
        res.json(result.rows.map(row => row.size_value));
    } catch (err) {
        console.error('Failed to fetch unique sizes:', err.message);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// --- Endpoint for Admins to rename a size value globally ---
router.put('/sizes', verifySession(), verifyRole('Admin'), async (req, res) => {
    const { oldValue, newValue } = req.body;
    if (!oldValue || !newValue) {
        return res.status(400).json({ error: 'oldValue and newValue are required.' });
    }
    try {
        const query = 'UPDATE sample_sizes SET size_value = $1 WHERE size_value = $2';
        await pool.query(query, [newValue, oldValue]);
        res.status(200).json({ message: `Size '${oldValue}' was successfully updated to '${newValue}'.`});
    } catch (err) {
        console.error('Failed to update size value:', err.message);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// --- Endpoint for Admins to delete a size value globally ---
router.delete('/sizes', verifySession(), verifyRole('Admin'), async (req, res) => {
    const { value } = req.body;
    if (!value) {
        return res.status(400).json({ error: 'A size "value" is required.' });
    }
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const usageCheckQuery = 'SELECT COUNT(*) FROM sample_sizes WHERE size_value = $1';
        const usageResult = await client.query(usageCheckQuery, [value]);
        const usageCount = parseInt(usageResult.rows[0].count, 10);

        if (usageCount > 0) {
            await client.query('ROLLBACK');
            return res.status(409).json({ 
                error: `Cannot delete size '${value}' as it is still in use by ${usageCount} sample(s).` 
            });
        }
        await client.query('COMMIT');
        res.status(200).json({ message: `Size '${value}' is not in use and is considered removed.` });

    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Failed to delete size value:', err.message);
        res.status(500).json({ error: 'Internal server error' });
    } finally {
        client.release();
    }
});


// --- GET /api/samples ---
router.get('/', verifySession(), async (req, res) => {
  try {
    const query = `
      SELECT
        s.id, s.manufacturer_id, s.supplier_id, s.product_type, s.style, s.line,
        s.finish, s.color, s.sample_format, s.board_colors, s.sku, 
        s.is_available, s.product_url,
        s.is_discontinued,
        s.unit_cost,
        s.uom,
        s.carton_size,
        m.name AS manufacturer_name, 
        sup.name AS supplier_name, 
        p.url AS image_url, 
        proj.id AS "checkoutProjectId",
        proj.project_name AS "checkoutProjectName", 
        cust.full_name AS "checkoutCustomerName", 
        sc.id AS "checkoutId",
        sc.expected_return_date AS "checkoutExpectedReturnDate",
        (
          SELECT COALESCE(json_agg(
            json_build_object(
                'size', ss.size_value, 
                'unitCost', ss.unit_cost,
                'cartonSize', ss.carton_size,
                'uom', ss.uom,
                -- Flag to help frontend distinguish old string-only data
                'isVariant', true 
            )
          ), '[]'::json)
          FROM sample_sizes ss
          WHERE ss.sample_id = s.id
        ) AS sizes
      FROM samples s
      LEFT JOIN vendors m ON s.manufacturer_id = m.id
      LEFT JOIN vendors sup ON s.supplier_id = sup.id
      LEFT JOIN photos p ON s.id = p.entity_id AND p.entity_type = 'sample'
      LEFT JOIN sample_checkouts sc ON s.id = sc.sample_id AND sc.actual_return_date IS NULL
      LEFT JOIN projects proj ON sc.project_id = proj.id
      LEFT JOIN customers cust ON proj.customer_id = cust.id
      ORDER BY s.style ASC, s.color ASC;
    `;
    const result = await pool.query(query);
    res.json(result.rows.map(toCamelCase));
  } catch (err) { console.error(err.message); res.status(500).json({ error: 'Internal server error' }); }
});

// --- POST /api/samples ---
router.post('/', verifySession(), async (req, res) => {
  const userId = req.session.getUserId();
  const client = await pool.connect();
  try {
    const { 
      manufacturerId, supplierId, productType, style, line, sizes,
      finish, color, sampleFormat, boardColors, sku, productUrl,
      unitCost, uom, cartonSize 
    } = req.body;
    if (!manufacturerId || !productType || !style) {
        return res.status(400).json({ error: 'Manufacturer, Product Type, and Style are required.'});
    }
    await client.query('BEGIN');
    const sampleInsertResult = await client.query(
        `INSERT INTO samples (
            manufacturer_id, supplier_id, product_type, style, line, 
            finish, color, sample_format, board_colors, sku, product_url,
            unit_cost, uom, carton_size
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14) RETURNING *`, 
        [
            manufacturerId || null, supplierId || null, productType, style, line || null, 
            finish || null, color || null, sampleFormat || null, boardColors || null, sku || null, productUrl || null,
            unitCost || null, uom || null, cartonSize || null
        ]
    );
    const newSample = toCamelCase(sampleInsertResult.rows[0]);
    if (sizes && Array.isArray(sizes) && sizes.length > 0) {
        for (const size of sizes) {
            // Handle both old string format and new object format
            if (typeof size === 'string') {
                 await client.query('INSERT INTO sample_sizes (sample_id, size_value) VALUES ($1, $2)', [newSample.id, size]);
            } else {
                 // FIX: Handle both 'value' (frontend form) and 'size' (potential legacy/database) keys
                 const sizeValue = size.value || size.size; 
                 const { unitCost, cartonSize, uom } = size;
                 await client.query(
                     'INSERT INTO sample_sizes (sample_id, size_value, unit_cost, carton_size, uom) VALUES ($1, $2, $3, $4, $5)', 
                     [newSample.id, sizeValue, unitCost || null, cartonSize || null, uom || null]
                 );
            }
        }
    }
    await client.query('COMMIT');
    newSample.sizes = sizes || [];
    await logActivity(userId, 'CREATE', 'SAMPLE', newSample.id, { createdData: newSample });
    res.status(201).json(newSample);
  } catch (err) { 
      await client.query('ROLLBACK');
      console.error(err.message); 
      res.status(500).json({ error: 'Internal server error' }); 
  } finally {
      client.release();
  }
});

// --- PUT /api/samples/:id ---
router.put('/:id', verifySession(), async (req, res) => {
    const { id } = req.params;
    const userId = req.session.getUserId();
    const client = await pool.connect();
    try {
        const { 
          manufacturerId, supplierId, productType, style, line, sizes,
          finish, color, sampleFormat, boardColors, sku, productUrl,
          unitCost, uom, cartonSize 
        } = req.body;
        if (!manufacturerId || !productType || !style) {
            return res.status(400).json({ error: 'Manufacturer, Product Type, and Style are required fields.' });
        }
        const beforeResult = await client.query('SELECT * FROM samples WHERE id = $1', [id]);
        if (beforeResult.rows.length === 0) { return res.status(404).json({ error: `Sample with ID ${id} not found.` }); }
        const beforeData = toCamelCase(beforeResult.rows[0]);
        await client.query('BEGIN');
        const sampleUpdateQuery = `
            UPDATE samples SET 
                manufacturer_id = $1, supplier_id = $2, product_type = $3, style = $4, line = $5, 
                finish = $6, color = $7, sample_format = $8, board_colors = $9, 
                sku = $10, product_url = $11,
                unit_cost = $12, uom = $13, carton_size = $14
            WHERE id = $15;
        `;
        await client.query(sampleUpdateQuery, [
            manufacturerId || null, supplierId || null, productType, style, line || null,
            finish || null, color || null, sampleFormat || null, boardColors || null, sku || null, productUrl || null,
            unitCost || null, uom || null, cartonSize || null,
            id
        ]);
        await client.query('DELETE FROM sample_sizes WHERE sample_id = $1', [id]);
        if (sizes && Array.isArray(sizes) && sizes.length > 0) {
            for (const size of sizes) {
                // Handle both old string format and new object format
                if (typeof size === 'string') {
                    await client.query('INSERT INTO sample_sizes (sample_id, size_value) VALUES ($1, $2)', [id, size]);
                } else {
                    // FIX: Handle both 'value' and 'size' keys
                    const sizeValue = size.value || size.size;
                    const { unitCost, cartonSize, uom } = size;
                    await client.query(
                        'INSERT INTO sample_sizes (sample_id, size_value, unit_cost, carton_size, uom) VALUES ($1, $2, $3, $4, $5)', 
                        [id, sizeValue, unitCost || null, cartonSize || null, uom || null]
                    );
                }
            }
        }
        await client.query('COMMIT');
        const updatedSampleQuery = `
            SELECT s.*, m.name AS manufacturer_name, sup.name AS supplier_name, p.url AS image_url, s.unit_cost, s.uom, s.carton_size,
            (
              SELECT COALESCE(json_agg(
                json_build_object(
                    'size', ss.size_value, 
                    'unitCost', ss.unit_cost,
                    'cartonSize', ss.carton_size,
                    'uom', ss.uom,
                    'isVariant', true
                )
              ), '[]'::json)
              FROM sample_sizes ss
              WHERE ss.sample_id = s.id
            ) AS sizes
            FROM samples s
            LEFT JOIN vendors m ON s.manufacturer_id = m.id
            LEFT JOIN vendors sup ON s.supplier_id = sup.id
            LEFT JOIN photos p ON s.id = p.entity_id AND p.entity_type = 'sample'
            WHERE s.id = $1;
        `;
        const fullResult = await pool.query(updatedSampleQuery, [id]);
        const updatedSample = toCamelCase(fullResult.rows[0]);
        await logActivity(userId, 'UPDATE', 'SAMPLE', id, { before: beforeData, after: updatedSample });
        res.json(updatedSample);
    } catch (err) {
        await client.query('ROLLBACK');
        console.error(err.message);
        res.status(500).json({ error: 'Internal server error while updating sample.' });
    } finally {
        client.release();
    }
});

// --- PATCH /api/samples/:id/discontinue ---
router.patch('/:id/discontinue', verifySession(), async (req, res) => {
    const { id } = req.params;
    const { isDiscontinued } = req.body;
    const userId = req.session.getUserId();

    if (typeof isDiscontinued !== 'boolean') {
        return res.status(400).json({ error: 'isDiscontinued must be a boolean.' });
    }

    const client = await pool.connect();
    try {
        const beforeResult = await client.query('SELECT * FROM samples WHERE id = $1', [id]);
        if (beforeResult.rows.length === 0) return res.status(404).json({ error: 'Sample not found' });
        
        const beforeData = toCamelCase(beforeResult.rows[0]);

        await client.query('BEGIN');
        const updateQuery = 'UPDATE samples SET is_discontinued = $1 WHERE id = $2 RETURNING *';
        const result = await client.query(updateQuery, [isDiscontinued, id]);
        const updatedSample = toCamelCase(result.rows[0]);

        await logActivity(userId, 'UPDATE', 'SAMPLE', id, { 
            action: 'TOGGLE_DISCONTINUED',
            before: beforeData, 
            after: updatedSample 
        }, client);

        await client.query('COMMIT');
        res.json(updatedSample);
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Error toggling discontinued status:', err.message);
        res.status(500).json({ error: 'Internal server error' });
    } finally {
        client.release();
    }
});

// --- CORRECTED GET /api/samples/:id/history ---
router.get('/:id/history', verifySession(), async (req, res) => {
    const { id } = req.params;
    try {
        const query = `
            SELECT al.*, u.email AS user_email 
            FROM activity_log al
            LEFT JOIN emailpassword_users u ON al.user_id = u.user_id
            WHERE al.target_entity = 'SAMPLE' AND al.target_id = $1
            ORDER BY al.created_at DESC;
        `;
        const result = await pool.query(query, [id]);
        res.json(result.rows.map(toCamelCase));
    } catch (err) {
        console.error(`Failed to fetch history for sample ${id}:`, err.message);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// --- DELETE /api/samples/:id ---
router.delete('/:id', verifySession(), verifyRole('Admin'), async (req, res) => {
    const { id } = req.params;
    const userId = req.session.getUserId();
    const client = await pool.connect();
    let photoUrl = null;
    try {
        await client.query('BEGIN');
        
        const checkoutCheck = await client.query('SELECT id FROM sample_checkouts WHERE sample_id = $1 AND actual_return_date IS NULL', [id]);
        if (checkoutCheck.rows.length > 0) {
            await client.query('ROLLBACK');
            return res.status(409).json({ message: 'Cannot delete sample because it is currently checked out.' });
        }
        
        const orderCheckResult = await client.query('SELECT 1 FROM material_order_items WHERE sample_id = $1 LIMIT 1', [id]);
        if (orderCheckResult.rows.length > 0) {
            await client.query('ROLLBACK');
            return res.status(409).json({ message: 'Cannot delete sample because it is part of a material order.' });
        }

        const sampleDataResult = await client.query('SELECT * FROM samples WHERE id = $1', [id]);
        if (sampleDataResult.rows.length === 0) {
            return res.status(404).json({ message: `Sample with ID ${id} not found.` });
        }
        
        const photoResult = await client.query("SELECT url FROM photos WHERE entity_type = 'sample' AND entity_id = $1", [id]);
        if (photoResult.rows.length > 0) {
            photoUrl = photoResult.rows[0].url;
        }

        await logActivity(userId, 'DELETE', 'SAMPLE', id, { deletedData: toCamelCase(sampleDataResult.rows[0]) }, client);

        await client.query('DELETE FROM photos WHERE entity_type = \'sample\' AND entity_id = $1', [id]);
        await client.query('DELETE FROM sample_checkouts WHERE sample_id = $1', [id]);
        await client.query('DELETE FROM sample_sizes WHERE sample_id = $1', [id]);
        
        const deleteResult = await client.query('DELETE FROM samples WHERE id = $1', [id]);
        if (deleteResult.rowCount === 0) {
            throw new Error(`Sample with ID ${id} not found during delete operation.`);
        }
        
        await client.query('COMMIT');

        if (photoUrl) {
            const filename = path.basename(photoUrl);
            const filePath = path.join(__dirname, 'uploads', filename);
            fs.unlink(filePath, (err) => { 
                if (err) console.error(`Error deleting file ${filePath}:`, err.message); 
            });
        }
        
        res.status(204).send();
    } catch (err) {
        await client.query('ROLLBACK');
        console.error(`Error deleting sample ${id}:`, err.message);
        res.status(500).json({ message: 'Internal server error' });
    } finally {
        client.release();
    }
});

// --- GET /api/samples/:id/qr ---
router.get('/:id/qr', async (req, res) => {
    const { id } = req.params;
    const url = `${process.env.BASE_URL || 'http://localhost:5173'}/scan-result?sampleId=${id}`; 

    try {
        const qrCodeImage = await qrcode.toBuffer(url, {
            errorCorrectionLevel: 'H',
            type: 'image/png',
            margin: 1,
            color: { dark: "#000000", light: "#FFFFFF" }
        });
        res.setHeader('Content-Type', 'image/png');
        res.send(qrCodeImage);
    } catch (err) {
        console.error('Failed to generate QR code for sample ID:', id, err);
        res.status(500).send('Error generating QR code');
    }
});

export default router;