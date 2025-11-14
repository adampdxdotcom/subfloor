// server/routes/samples.js
import express from 'express';
import pool from '../db.js';
import { toCamelCase } from '../utils.js';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import qrcode from 'qrcode';
import { verifySession } from 'supertokens-node/recipe/session/framework/express/index.js';

const router = express.Router();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.resolve(path.dirname(__filename), '..');

// GET /api/samples
router.get('/', verifySession(), async (req, res) => {
  try {
    const query = `
      SELECT
        s.id,
        s.manufacturer_id,
        s.supplier_id,
        s.style_color,
        s.sku,
        s.type,
        s.is_available,
        s.product_url,
        m.name AS manufacturer_name,
        sup.name AS supplier_name,
        p.url AS image_url,
        proj.id AS "checkoutProjectId",
        proj.project_name AS "checkoutProjectName",
        cust.full_name AS "checkoutCustomerName",
        sc.id AS "checkoutId"
      FROM
        samples s
      LEFT JOIN
        vendors m ON s.manufacturer_id = m.id
      LEFT JOIN
        vendors sup ON s.supplier_id = sup.id
      LEFT JOIN
        photos p ON s.id = p.entity_id AND p.entity_type = 'sample'
      LEFT JOIN
        sample_checkouts sc ON s.id = sc.sample_id AND sc.actual_return_date IS NULL
      LEFT JOIN
        projects proj ON sc.project_id = proj.id
      LEFT JOIN
        customers cust ON proj.customer_id = cust.id
      ORDER BY
        s.style_color ASC;
    `;
    const result = await pool.query(query);
    res.json(result.rows.map(toCamelCase));
  } catch (err) { console.error(err.message); res.status(500).json({ error: 'Internal server error' }); }
});

// POST /api/samples
router.post('/', verifySession(), async (req, res) => {
  try {
    const { manufacturerId, supplierId, styleColor, sku, type, productUrl } = req.body;
    const finalSku = (sku === '' || sku === undefined || sku === null) ? null : sku;
    const finalUrl = (productUrl === '' || productUrl === undefined || productUrl === null) ? null : productUrl;
    
    const result = await pool.query(
        `INSERT INTO samples (manufacturer_id, supplier_id, style_color, sku, type, product_url) 
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`, 
        [manufacturerId || null, supplierId || null, styleColor, finalSku, type, finalUrl]
    );
    res.status(201).json(toCamelCase(result.rows[0]));
  } catch (err) { console.error(err.message); res.status(500).json({ error: 'Internal server error' }); }
});

// PUT /api/samples/:id
router.put('/:id', verifySession(), async (req, res) => {
    const { id } = req.params;
    const { manufacturerId, supplierId, styleColor, sku, type, productUrl } = req.body;

    if (!styleColor || !type) {
        return res.status(400).json({ error: 'Style/Color and Type are required fields.' });
    }

    try {
        const query = `
            UPDATE samples
            SET manufacturer_id = $1, supplier_id = $2, style_color = $3, sku = $4, type = $5, product_url = $6
            WHERE id = $7
            RETURNING *;
        `;
        const finalSku = (sku === '' || sku === undefined) ? null : sku;
        const finalUrl = (productUrl === '' || productUrl === undefined) ? null : productUrl;

        const result = await pool.query(query, [manufacturerId || null, supplierId || null, styleColor, finalSku, type, finalUrl, id]);
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: `Sample with ID ${id} not found.` });
        }
        
        // <<< FIX IS HERE >>>
        // This query now includes the LEFT JOIN to the photos table to ensure the image_url is returned.
        const updatedSampleQuery = `
            SELECT
              s.*,
              m.name AS manufacturer_name,
              sup.name AS supplier_name,
              p.url AS image_url
            FROM
              samples s
            LEFT JOIN
              vendors m ON s.manufacturer_id = m.id
            LEFT JOIN
              vendors sup ON s.supplier_id = sup.id
            LEFT JOIN
              photos p ON s.id = p.entity_id AND p.entity_type = 'sample'
            WHERE
              s.id = $1;
        `;
        const fullResult = await pool.query(updatedSampleQuery, [id]);

        res.json(toCamelCase(fullResult.rows[0]));
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ error: 'Internal server error while updating sample.' });
    }
});

// DELETE /api/samples/:id
router.delete('/:id', verifySession(), async (req, res) => {
    const { id } = req.params;
    const client = await pool.connect();

    try {
        const orderCheckResult = await client.query('SELECT 1 FROM order_line_items WHERE sample_id = $1 LIMIT 1', [id]);
        if (orderCheckResult.rows.length > 0) {
            return res.status(409).json({ error: 'Cannot delete sample because it is part of a material order.' });
        }
        
        await client.query('BEGIN');

        const photoResult = await client.query(
            "SELECT url FROM photos WHERE entity_type = 'sample' AND entity_id = $1",
            [id]
        );
        const photoUrl = photoResult.rows.length > 0 ? photoResult.rows[0].url : null;

        await client.query("DELETE FROM photos WHERE entity_type = 'sample' AND entity_id = $1", [id]);
        await client.query("DELETE FROM sample_checkouts WHERE sample_id = $1", [id]);
        const deleteSampleResult = await client.query("DELETE FROM samples WHERE id = $1 RETURNING id", [id]);

        if (deleteSampleResult.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Sample not found' });
        }

        await client.query('COMMIT');

        if (photoUrl) {
            const filename = path.basename(photoUrl);
            const filePath = path.join(__dirname, 'uploads', filename);

            fs.unlink(filePath, (err) => {
                if (err) {
                    console.error(`Error deleting file ${filePath}:`, err.message);
                } else {
                    console.log(`Deleted file: ${filePath}`);
                }
            });
        }
        
        res.status(204).send();

    } catch (err) {
        if (client) await client.query('ROLLBACK').catch(rbErr => console.error('Rollback failed:', rbErr));
        console.error('Sample deletion transaction failed:', err.message);
        res.status(500).json({ error: 'Internal server error' });
    } finally {
        if (client) client.release();
    }
});

// GET /api/samples/:id/qr - This is a public route, no session required.
router.get('/:id/qr', async (req, res) => {
    const { id } = req.params;

    try {
        const dataToEncode = `joblogger:sample:${id}`;
        const qrCodeBuffer = await qrcode.toBuffer(dataToEncode, {
            errorCorrectionLevel: 'H',
            type: 'png',
            margin: 2,
            scale: 8,
        });
        res.setHeader('Content-Type', 'image/png');
        res.send(qrCodeBuffer);

    } catch (err) {
        console.error(`Failed to generate QR code for sample ${id}:`, err.message);
        res.status(500).json({ error: 'Failed to generate QR code' });
    }
});

export default router;