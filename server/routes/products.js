// server/routes/products.js

import express from 'express';
import pool from '../db.js';
import { verifySession } from 'supertokens-node/recipe/session/framework/express/index.js';
import { verifyRole, toCamelCase, logActivity } from '../utils.js';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import qrcode from 'qrcode';

const router = express.Router();

// --- IMAGE UPLOAD CONFIG ---
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const uploadDir = path.join(__dirname, '../uploads');

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir),
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, `product-${uniqueSuffix}${path.extname(file.originalname)}`);
    }
});
const upload = multer({ storage });

// --- HELPER: Download External Image ---
const downloadExternalImage = async (url) => {
    try {
        const res = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.9',
                'Referer': 'https://www.google.com/', // Tricks the server into thinking you clicked from Google
                'Cache-Control': 'no-cache'
            }
        });
        if (!res.ok) throw new Error(`Failed to fetch external image: ${res.statusText}`);
        const arrayBuffer = await res.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const filename = `import-${Date.now()}-${Math.round(Math.random() * 1E9)}.jpg`;
        fs.writeFileSync(path.join(uploadDir, filename), buffer);
        return `/uploads/${filename}`;
    } catch (error) {
        console.error("Failed to download external image:", error);
        return null; // Return null on failure so we don't save a broken/CORS-blocked URL
    }
};

// =================================================================
//  PUBLIC / SHARED ROUTES
// =================================================================

// GET /api/products - Fetch all products with their variants nested
router.get('/', verifySession(), async (req, res) => {
    try {
        // We use a LEFT JOIN and JSON aggregation to get everything in one efficient query
        const query = `
            SELECT 
                p.id, p.manufacturer_id, p.supplier_id, p.name, p.product_type, 
                p.description, p.product_line_url, 
                p.default_image_url as "defaultImageUrl",
                p.is_discontinued as "isDiscontinued",
                v.name as manufacturer_name,
                COALESCE(
                    json_agg(
                        json_build_object(
                            'id', pv.id,
                            'productId', pv.product_id,
                            'name', pv.name,
                            'size', pv.size,
                            'finish', pv.finish,
                            'style', pv.style,
                            'sku', pv.sku,
                            'unitCost', pv.unit_cost,
                            'retailPrice', pv.retail_price,
                            'uom', pv.uom,
                            'cartonSize', pv.carton_size,
                            'imageUrl', pv.image_url,
                            'activeCheckouts', (SELECT count(*) FROM sample_checkouts sc WHERE sc.variant_id = pv.id AND sc.actual_return_date IS NULL)::int,
                            'isMaster', pv.is_master,
                            'hasSample', pv.has_sample
                        ) ORDER BY pv.name, pv.size
                    ) FILTER (WHERE pv.id IS NOT NULL), 
                    '[]'
                ) as variants
            FROM products p
            LEFT JOIN vendors v ON p.manufacturer_id = v.id
            LEFT JOIN product_variants pv ON p.id = pv.product_id
            WHERE p.is_discontinued = FALSE -- By default, hide discontinued
            GROUP BY p.id, v.name
            ORDER BY p.name ASC;
        `;
        const result = await pool.query(query);
        const products = result.rows.map(row => ({
            ...toCamelCase(row),
            // Ensure variants is always an array, even if empty
            variants: row.variants || [] 
        }));
        res.json(products);
    } catch (err) {
        console.error('Error fetching products:', err.message);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// GET /api/products/discontinued - Fetch discontinued products
router.get('/discontinued', verifySession(), async (req, res) => {
    try {
        const query = `
            SELECT p.id, p.name, p.product_type, v.name as manufacturer_name
            FROM products p
            LEFT JOIN vendors v ON p.manufacturer_id = v.id
            WHERE p.is_discontinued = TRUE
            ORDER BY p.name ASC;
        `;
        const result = await pool.query(query);
        res.json(toCamelCase(result.rows));
    } catch (err) {
        console.error('Error fetching discontinued products:', err.message);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// =================================================================
//  SIZE MANAGEMENT ROUTES (New Feature)
// =================================================================

// GET /api/products/sizes - Autocomplete List
router.get('/sizes', verifySession(), async (req, res) => {
    try {
        const query = `
            SELECT size_value FROM standard_sizes
            UNION
            SELECT size FROM product_variants WHERE size IS NOT NULL
            ORDER BY size_value ASC
        `;
        const result = await pool.query(query);
        // Filter out nulls/duplicates in JS if UNION missed anything, usually just mapping is fine
        const uniqueSizes = [...new Set(result.rows.map(row => row.size_value || row.size))].filter(Boolean);
        res.json(uniqueSizes);
    } catch (err) {
        console.error('Failed to fetch sizes:', err.message);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// GET /api/products/sizes/stats - Usage Statistics
router.get('/sizes/stats', verifySession(), verifyRole('Admin'), async (req, res) => {
    try {
        const query = `
            WITH usage AS (
                SELECT size, COUNT(*) as count 
                FROM product_variants 
                WHERE size IS NOT NULL 
                GROUP BY size
            )
            SELECT 
                ss.size_value as "value",
                COALESCE(u.count, 0) as "usageCount",
                true as "isStandard"
            FROM standard_sizes ss
            LEFT JOIN usage u ON ss.size_value = u.size
            ORDER BY ss.size_value ASC
        `;
        const result = await pool.query(query);
        res.json(result.rows);
    } catch (err) {
        console.error('Failed to fetch size stats:', err.message);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// POST /api/products/sizes - Create New Standard Size
router.post('/sizes', verifySession(), verifyRole('Admin'), async (req, res) => {
    const { value } = req.body;
    if (!value) return res.status(400).json({ error: 'Size value is required.' });
    try {
        await pool.query('INSERT INTO standard_sizes (size_value) VALUES ($1) ON CONFLICT (size_value) DO NOTHING', [value]);
        res.status(201).json({ message: 'Size created', value });
    } catch (err) {
        console.error('Failed to create size:', err.message);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// PUT /api/products/sizes - Rename Size
router.put('/sizes', verifySession(), verifyRole('Admin'), async (req, res) => {
    const { oldValue, newValue } = req.body;
    if (!oldValue || !newValue) {
        return res.status(400).json({ error: 'oldValue and newValue are required.' });
    }
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        
        // 1. Update actual usage in product variants
        await client.query('UPDATE product_variants SET size = $1 WHERE size = $2', [newValue, oldValue]);
        
        // 2. Update standard list (Delete old, Insert new to handle Primary Key change)
        await client.query('DELETE FROM standard_sizes WHERE size_value = $1', [oldValue]);
        await client.query('INSERT INTO standard_sizes (size_value) VALUES ($1) ON CONFLICT (size_value) DO NOTHING', [newValue]);
        
        await client.query('COMMIT');
        res.status(200).json({ message: `Size updated.` });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Failed to update size:', err.message);
        res.status(500).json({ error: 'Internal server error' });
    } finally {
        client.release();
    }
});

// DELETE /api/products/sizes - Delete Standard Size
router.delete('/sizes', verifySession(), verifyRole('Admin'), async (req, res) => {
    const { value } = req.body;
    // Note: We only delete from standard_sizes. 
    // If it's used in variants, it just becomes a "custom" size again (no longer in standard list).
    // This is safer than blocking deletion.
    try {
        await pool.query('DELETE FROM standard_sizes WHERE size_value = $1', [value]);
        res.status(200).json({ message: 'Standard size removed.' });
    } catch (err) {
        console.error('Failed to delete size:', err.message);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// =================================================================
//  ADMIN / MANAGER ROUTES (Create & Update)
// =================================================================

// POST /api/products - Create a new Parent Product
router.post('/', verifySession(), verifyRole(['Admin', 'User']), upload.single('image'), async (req, res) => {
    const client = await pool.connect();
    const userId = req.session.getUserId();
    
    try {
        await client.query('BEGIN');

        const { 
            name, manufacturerId, supplierId, productType, hasMasterBoard, 
            description, productLineUrl 
        } = req.body;

        let defaultImageUrl = null;
        if (req.file) {
            defaultImageUrl = `/uploads/${req.file.filename}`;
        } else if (req.body.defaultImageUrl && req.body.defaultImageUrl.startsWith('http')) {
            defaultImageUrl = await downloadExternalImage(req.body.defaultImageUrl);
        }

        const insertQuery = `
            INSERT INTO products (
                name, manufacturer_id, supplier_id, product_type, 
                description, product_line_url, default_image_url
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING *;
        `;

        const result = await client.query(insertQuery, [
            name, manufacturerId || null, supplierId || null, productType, 
            description, productLineUrl, defaultImageUrl
        ]);

        const newProduct = result.rows[0];
        
        // Fetch the manufacturer name for the response so the UI can display it immediately
        const vendorRes = await client.query('SELECT name FROM vendors WHERE id = $1', [newProduct.manufacturer_id]);
        const manufacturerName = vendorRes.rows.length > 0 ? vendorRes.rows[0].name : null;

        // --- LOGIC: Create Master Board Variant if requested ---
        if (hasMasterBoard === 'true' || hasMasterBoard === true) {
            await client.query(`
                INSERT INTO product_variants (product_id, name, is_master)
                VALUES ($1, 'Full Line Board', TRUE)
            `, [newProduct.id]);
        }
        // -----------------------------------------------------

        await logActivity(userId, 'CREATE', 'PRODUCT', newProduct.id, { name: newProduct.name });

        await client.query('COMMIT');
        
        // Return the complete shape expected by the frontend
        const response = { ...toCamelCase(newProduct), manufacturerName, variants: [] };
        res.status(201).json(response);

    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Error creating product:', err.message);
        res.status(500).json({ error: 'Internal server error' });
    } finally {
        client.release();
    }
});

// POST /api/products/:id/variants - Add a Variant to a Product
router.post('/:id/variants', verifySession(), verifyRole(['Admin', 'User']), upload.single('image'), async (req, res) => {
    const { id: productId } = req.params;
    const userId = req.session.getUserId();

    try {
        const { 
            name, size, finish, style, sku, 
            unitCost, retailPrice, uom, cartonSize, imageUrl: bodyImageUrl, hasSample 
        } = req.body;

        // --- SMART DEFAULT LOGIC ---
        // If hasSample is not provided, check if a Master Board exists.
        // If Master Board exists, assume this new variant does NOT have a sample (default false).
        // Otherwise, assume it DOES (default true).
        let finalHasSample = hasSample;
        if (finalHasSample === undefined) {
             const checkMaster = await pool.query('SELECT 1 FROM product_variants WHERE product_id = $1 AND is_master = TRUE', [productId]);
             finalHasSample = checkMaster.rows.length === 0; // True if no master, False if master exists
        }

        let imageUrl = null;
        if (req.file) {
            imageUrl = `/uploads/${req.file.filename}`;
        } else if (bodyImageUrl && bodyImageUrl.startsWith('http')) {
            imageUrl = await downloadExternalImage(bodyImageUrl);
        }

        const query = `
            INSERT INTO product_variants (
                product_id, name, size, finish, style, sku, 
                unit_cost, retail_price, uom, carton_size, image_url, has_sample
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
            RETURNING *;
        `;

        const result = await pool.query(query, [
            productId, name, size, finish, style, sku, 
            unitCost, retailPrice, uom, cartonSize, imageUrl, finalHasSample
        ]);

        const newVariant = result.rows[0];
        await logActivity(userId, 'CREATE', 'VARIANT', newVariant.id, { 
            productId, 
            variantName: `${name || ''} ${size || ''}`.trim() 
        });

        res.status(201).json(toCamelCase(newVariant));

    } catch (err) {
        console.error('Error creating variant:', err.message);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// PATCH /api/products/:id - Update Parent Product
router.patch('/:id', verifySession(), verifyRole(['Admin', 'User']), upload.single('image'), async (req, res) => {
    const { id } = req.params;
    const userId = req.session.getUserId();
    
    // Construct dynamic update query
    const updates = { ...req.body };
    
    // --- LOGIC: Handle Master Board Toggle ---
    const hasMasterBoard = updates.hasMasterBoard;
    if (hasMasterBoard !== undefined) {
        const client = await pool.connect();
        try {
            if (hasMasterBoard === 'true' || hasMasterBoard === true) {
                // Ensure it exists (idempotent)
                await client.query(`INSERT INTO product_variants (product_id, name, is_master) 
                                    SELECT $1, 'Full Line Board', TRUE 
                                    WHERE NOT EXISTS (SELECT 1 FROM product_variants WHERE product_id = $1 AND is_master = TRUE)`, [id]);
            } else {
                // Remove it (will fail if checked out due to FK constraints, which is good safety)
                // We try/catch this silently or let it fail? Let's ignore errors for now to keep update safe.
                await client.query(`DELETE FROM product_variants WHERE product_id = $1 AND is_master = TRUE`, [id]).catch(() => {});
            }
        } catch (error) {
            console.error("Error updating master board variant:", error);
            // Optionally handle this error more explicitly if needed, but for PATCH we continue DB update below.
        } finally {
            client.release();
        }
        delete updates.hasMasterBoard; // Don't try to update product table with this
    }
    
    // Remove File Object from body if present (handled separately)
    delete updates.image; 

    if (req.file) {
        updates.default_image_url = `/uploads/${req.file.filename}`;
    } else if (updates.defaultImageUrl) {
        if (updates.defaultImageUrl.startsWith('http')) {
            updates.default_image_url = await downloadExternalImage(updates.defaultImageUrl);
        } else {
            // It's a local path (e.g. promoting a variant image), just save it directly
            updates.default_image_url = updates.defaultImageUrl;
        }
    }
    
    // FIX: Delete source fields so they don't duplicate in the SQL generation loop
    delete updates.image;
    delete updates.defaultImageUrl;

    // Map camelCase to snake_case for DB
    const dbMap = {
        manufacturerId: 'manufacturer_id',
        supplierId: 'supplier_id',
        productType: 'product_type',
        productLineUrl: 'product_line_url',
        defaultImageUrl: 'default_image_url',
        isDiscontinued: 'is_discontinued'
    };

    const fields = [];
    const values = [];
    let idx = 1;

    for (const [key, value] of Object.entries(updates)) {
        const dbCol = dbMap[key] || key; // Use map or key itself
        // Simple sanity check to prevent SQL injection via column names (only allow known keys)
        if (['name', 'description', ...Object.values(dbMap)].includes(dbCol)) {
            fields.push(`${dbCol} = $${idx}`);
            values.push(value === 'null' ? null : value);
            idx++;
        }
    }

    if (fields.length === 0) {
        return res.status(400).json({ error: 'No valid fields to update' });
    }

    values.push(id); // Add ID as the last parameter

    try {
        const query = `UPDATE products SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`;
        const result = await pool.query(query, values);
        
        if (result.rows.length === 0) return res.status(404).json({ error: 'Product not found' });
        
        await logActivity(userId, 'UPDATE', 'PRODUCT', id, { updates: Object.keys(updates) });
        res.json(toCamelCase(result.rows[0]));

    } catch (err) {
        console.error('Error updating product:', err.message);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// DELETE /api/products/:id - Delete Product (Cascade deletes variants)
router.delete('/:id', verifySession(), verifyRole('Admin'), async (req, res) => {
    const { id } = req.params;
    const userId = req.session.getUserId();

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // Check for active checkouts first
        const checkResult = await client.query(`
            SELECT count(*) FROM sample_checkouts sc
            JOIN product_variants pv ON sc.variant_id = pv.id
            WHERE pv.product_id = $1 AND sc.actual_return_date IS NULL
        `, [id]);

        if (parseInt(checkResult.rows[0].count) > 0) {
            throw new Error("Cannot delete product: It has active sample checkouts.");
        }

        // Delete (Cascade will handle variants)
        await client.query('DELETE FROM products WHERE id = $1', [id]);
        await logActivity(userId, 'DELETE', 'PRODUCT', id, {});

        await client.query('COMMIT');
        res.status(204).send();

    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Error deleting product:', err.message);
        res.status(400).json({ error: err.message });
    } finally {
        client.release();
    }
});

// =================================================================
//  VARIANT SPECIFIC ROUTES
// =================================================================

// PATCH /api/products/variants/:id - Update a specific variant
router.patch('/variants/:id', verifySession(), verifyRole(['Admin', 'User']), upload.single('image'), async (req, res) => {
    const { id } = req.params;
    const userId = req.session.getUserId();
    
    const updates = { ...req.body };
    delete updates.image;
    
    if (req.file) {
        updates.image_url = `/uploads/${req.file.filename}`;
    } else if (updates.imageUrl) {
        if (updates.imageUrl.startsWith('http')) {
            updates.image_url = await downloadExternalImage(updates.imageUrl);
        } else {
            updates.image_url = updates.imageUrl;
        }
    }

    // FIX: Delete source fields so they don't duplicate in the SQL generation loop
    delete updates.image;
    delete updates.imageUrl;

    // Map camelCase to snake_case
    const dbMap = {
        unitCost: 'unit_cost',
        retailPrice: 'retail_price',
        cartonSize: 'carton_size',
        imageUrl: 'image_url',
        hasSample: 'has_sample'
    };

    const fields = [];
    const values = [];
    let idx = 1;

    for (const [key, value] of Object.entries(updates)) {
        const dbCol = dbMap[key] || key;
        // Safety check
        if (['name', 'size', 'finish', 'style', 'sku', 'uom', 'has_sample', ...Object.values(dbMap)].includes(dbCol)) {
            fields.push(`${dbCol} = $${idx}`);
            values.push(value === 'null' ? null : value);
            idx++;
        }
    }

    if (fields.length === 0) return res.status(400).json({ error: 'No valid fields' });
    
    values.push(id);

    try {
        const query = `UPDATE product_variants SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`;
        const result = await pool.query(query, values);
        if (result.rows.length === 0) return res.status(404).json({ error: 'Variant not found' });
        
        await logActivity(userId, 'UPDATE', 'VARIANT', id, { updates: Object.keys(updates) });
        res.json(toCamelCase(result.rows[0]));
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// DELETE /api/products/variants/:id - Delete a variant
router.delete('/variants/:id', verifySession(), verifyRole('Admin'), async (req, res) => {
    const { id } = req.params;
    const userId = req.session.getUserId();

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // Check usage
        const usageRes = await client.query(`SELECT count(*) FROM sample_checkouts WHERE variant_id = $1 AND actual_return_date IS NULL`, [id]);
        if (parseInt(usageRes.rows[0].count) > 0) throw new Error("Cannot delete variant: It has active checkouts.");

        // 1. Unlink from Material Orders (Preserves financial history, removes constraint)
        await client.query('UPDATE order_line_items SET variant_id = NULL WHERE variant_id = $1', [id]);

        // 2. Delete historical (returned) checkouts
        await client.query('DELETE FROM sample_checkouts WHERE variant_id = $1', [id]);

        await client.query('DELETE FROM product_variants WHERE id = $1', [id]);
        await logActivity(userId, 'DELETE', 'VARIANT', id, {});

        await client.query('COMMIT');
        res.status(204).send();
    } catch (err) {
        await client.query('ROLLBACK');
        console.error(err);
        res.status(400).json({ error: err.message });
    } finally {
        client.release();
    }
});

// GET /api/products/variants/:id/qr - Generate QR Code for a Variant
router.get('/variants/:id/qr', async (req, res) => {
    const { id } = req.params;
    // Point to the client-side scanner result page with the new variantId parameter
    const url = `${process.env.BASE_URL || 'http://localhost:5173'}/scan-result?variantId=${id}`; 

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
        console.error('Failed to generate QR code for variant ID:', id, err);
        res.status(500).send('Error generating QR code');
    }
});

// GET /api/products/:id/qr - Generate QR Code for a Parent Product
router.get('/:id/qr', async (req, res) => {
    const { id } = req.params;
    // Point to scanner result with productId parameter
    const url = `${process.env.BASE_URL || 'http://localhost:5173'}/scan-result?productId=${id}`; 

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
        console.error('Failed to generate QR code for product ID:', id, err);
        res.status(500).send('Error generating QR code');
    }
});

export default router;