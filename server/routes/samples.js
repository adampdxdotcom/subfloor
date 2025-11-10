// server/routes/samples.js
import express from 'express';
import pool from '../db.js';
import { toCamelCase } from '../utils.js';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
// --- NEW: Import the qrcode library ---
import qrcode from 'qrcode';

const router = express.Router();

// This is a more robust way to get the parent directory (/server) from a file within /server/routes
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.resolve(path.dirname(__filename), '..');

// GET /api/samples
router.get('/', async (req, res) => {
  try {
    const query = `
      SELECT
        s.*,
        p.url AS image_url,
        proj.id AS "checkoutProjectId",
        proj.project_name AS "checkoutProjectName",
        cust.full_name AS "checkoutCustomerName"
      FROM
        samples s
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
router.post('/', async (req, res) => {
  try {
    const { manufacturer, styleColor, sku, type, productUrl } = req.body;
    const finalSku = (sku === '' || sku === undefined || sku === null) ? null : sku;
    const finalUrl = (productUrl === '' || productUrl === undefined || productUrl === null) ? null : productUrl;
    const result = await pool.query(
        `INSERT INTO samples (manufacturer, style_color, sku, type, product_url) VALUES ($1, $2, $3, $4, $5) RETURNING *`, 
        [manufacturer, styleColor, finalSku, type, finalUrl]
    );
    res.status(201).json(toCamelCase(result.rows[0]));
  } catch (err) { console.error(err.message); res.status(500).json({ error: 'Internal server error' }); }
});

// PUT /api/samples/:id
router.put('/:id', async (req, res) => {
    const { id } = req.params;
    const { manufacturer, styleColor, sku, type, productUrl } = req.body;

    if (!styleColor || !type) {
        return res.status(400).json({ error: 'Style/Color and Type are required fields.' });
    }

    try {
        const query = `
            UPDATE samples
            SET manufacturer = $1, style_color = $2, sku = $3, type = $4, product_url = $5
            WHERE id = $6
            RETURNING *;
        `;
        const finalManufacturer = (manufacturer === '' || manufacturer === undefined) ? null : manufacturer;
        const finalSku = (sku === '' || sku === undefined) ? null : sku;
        const finalUrl = (productUrl === '' || productUrl === undefined) ? null : productUrl;

        const result = await pool.query(query, [finalManufacturer, styleColor, finalSku, type, finalUrl, id]);
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: `Sample with ID ${id} not found.` });
        }
        
        res.json(toCamelCase(result.rows[0]));
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ error: 'Internal server error while updating sample.' });
    }
});

// DELETE /api/samples/:id
router.delete('/:id', async (req, res) => {
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

// --- NEW CODE START ---
// GET /api/samples/:id/qr
router.get('/:id/qr', async (req, res) => {
    const { id } = req.params;

    try {
        // Define the data to be encoded in the QR code.
        // A custom scheme like this is robust and prevents conflicts.
        const dataToEncode = `joblogger:sample:${id}`;

        // Generate the QR code as a PNG data buffer
        const qrCodeBuffer = await qrcode.toBuffer(dataToEncode, {
            errorCorrectionLevel: 'H', // High error correction for durability
            type: 'png',
            margin: 2,
            scale: 8,
        });

        // Set the response headers to tell the browser it's an image
        res.setHeader('Content-Type', 'image/png');
        res.send(qrCodeBuffer);

    } catch (err) {
        console.error(`Failed to generate QR code for sample ${id}:`, err.message);
        res.status(500).json({ error: 'Failed to generate QR code' });
    }
});
// --- NEW CODE END ---

export default router;