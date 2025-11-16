// server/routes/samples.js

import express from 'express';
import pool from '../db.js';
import { toCamelCase, logActivity } from '../utils.js';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import qrcode from 'qrcode';
import { verifySession } from 'supertokens-node/recipe/session/framework/express/index.js';

const router = express.Router();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.resolve(path.dirname(__filename), '..');

// --- MODIFIED: GET /api/samples with new schema fields ---
router.get('/', verifySession(), async (req, res) => {
  try {
    const query = `
      SELECT
        s.id, s.manufacturer_id, s.supplier_id, s.product_type, s.style, s.line,
        s.size, s.finish, s.color, s.sample_format, s.board_colors, s.sku, 
        s.is_available, s.product_url,
        m.name AS manufacturer_name, 
        sup.name AS supplier_name, 
        p.url AS image_url, 
        proj.id AS "checkoutProjectId",
        proj.project_name AS "checkoutProjectName", 
        cust.full_name AS "checkoutCustomerName", 
        sc.id AS "checkoutId",
        sc.expected_return_date AS "checkoutExpectedReturnDate"
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

// --- MODIFIED: POST /api/samples with new schema fields ---
router.post('/', verifySession(), async (req, res) => {
  const userId = req.session.getUserId();
  try {
    const { 
      manufacturerId, supplierId, productType, style, line, size, 
      finish, color, sampleFormat, boardColors, sku, productUrl 
    } = req.body;

    if (!manufacturerId || !productType || !style) {
        return res.status(400).json({ error: 'Manufacturer, Product Type, and Style are required.'});
    }

    const result = await pool.query(
        `INSERT INTO samples (
            manufacturer_id, supplier_id, product_type, style, line, size, 
            finish, color, sample_format, board_colors, sku, product_url
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING *`, 
        [
            manufacturerId || null, supplierId || null, productType, style, line || null, size || null, 
            finish || null, color || null, sampleFormat || null, boardColors || null, sku || null, productUrl || null
        ]
    );
    const newSample = toCamelCase(result.rows[0]);

    await logActivity(userId, 'CREATE', 'SAMPLE', newSample.id, { createdData: newSample });
    res.status(201).json(newSample);
  } catch (err) { console.error(err.message); res.status(500).json({ error: 'Internal server error' }); }
});

// --- MODIFIED: PUT /api/samples/:id with new schema fields ---
router.put('/:id', verifySession(), async (req, res) => {
    const { id } = req.params;
    const userId = req.session.getUserId();
    const { 
      manufacturerId, supplierId, productType, style, line, size, 
      finish, color, sampleFormat, boardColors, sku, productUrl 
    } = req.body;

    if (!manufacturerId || !productType || !style) {
        return res.status(400).json({ error: 'Manufacturer, Product Type, and Style are required fields.' });
    }

    try {
        const beforeResult = await pool.query('SELECT * FROM samples WHERE id = $1', [id]);
        if (beforeResult.rows.length === 0) {
            return res.status(404).json({ error: `Sample with ID ${id} not found.` });
        }
        const beforeData = toCamelCase(beforeResult.rows[0]);

        const query = `
            UPDATE samples SET 
                manufacturer_id = $1, supplier_id = $2, product_type = $3, style = $4, line = $5, 
                size = $6, finish = $7, color = $8, sample_format = $9, board_colors = $10, 
                sku = $11, product_url = $12
            WHERE id = $13 RETURNING *;
        `;
        await pool.query(query, [
            manufacturerId || null, supplierId || null, productType, style, line || null, size || null,
            finish || null, color || null, sampleFormat || null, boardColors || null, sku || null, productUrl || null,
            id
        ]);
        
        // Query again with joins to get full data for response and logging
        const updatedSampleQuery = `
            SELECT s.*, m.name AS manufacturer_name, sup.name AS supplier_name, p.url AS image_url
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
        console.error(err.message);
        res.status(500).json({ error: 'Internal server error while updating sample.' });
    }
});

// GET /api/samples/:id/history (Unchanged)
router.get('/:id/history', verifySession(), async (req, res) => {
    const { id } = req.params;
    try {
        const query = `
            SELECT al.*, ep.email AS user_email FROM activity_log al
            LEFT JOIN emailpassword_users ep ON al.user_id = ep.user_id
            WHERE al.target_entity = 'SAMPLE' AND al.target_id = $1
            ORDER BY al.created_at DESC;
        `;
        const result = await pool.query(query, [id]);
        res.json(result.rows.map(toCamelCase));
    } catch (err) {
        console.error("Error retrieving sample history:", err.message);
        res.status(500).json({ error: "Internal server error retrieving sample history" });
    }
});

// DELETE /api/samples/:id (Unchanged)
router.delete('/:id', verifySession(), async (req, res) => {
    const { id } = req.params;
    const userId = req.session.getUserId();
    const client = await pool.connect();

    try {
        const orderCheckResult = await client.query('SELECT 1 FROM order_line_items WHERE sample_id = $1 LIMIT 1', [id]);
        if (orderCheckResult.rows.length > 0) {
            return res.status(409).json({ error: 'Cannot delete sample because it is part of a material order.' });
        }
        
        await client.query('BEGIN');
        const sampleToDeleteResult = await client.query("SELECT * FROM samples WHERE id = $1", [id]);
        if (sampleToDeleteResult.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Sample not found' });
        }
        const deletedData = toCamelCase(sampleToDeleteResult.rows[0]);

        const photoResult = await client.query("SELECT url FROM photos WHERE entity_type = 'sample' AND entity_id = $1", [id]);
        const photoUrl = photoResult.rows.length > 0 ? photoResult.rows[0].url : null;
        await client.query("DELETE FROM photos WHERE entity_type = 'sample' AND entity_id = $1", [id]);
        await client.query("DELETE FROM sample_checkouts WHERE sample_id = $1", [id]);
        await client.query("DELETE FROM samples WHERE id = $1", [id]);

        await logActivity(userId, 'DELETE', 'SAMPLE', id, { deletedData });
        await client.query('COMMIT');

        if (photoUrl) {
            const filename = path.basename(photoUrl);
            const filePath = path.join(__dirname, 'uploads', filename);
            fs.unlink(filePath, (err) => { if (err) console.error(`Error deleting file ${filePath}:`, err.message); });
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

// GET /api/samples/:id/qr (Unchanged)
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