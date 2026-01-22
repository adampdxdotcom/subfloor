import express from 'express';
import pool from '../db.js';
import { verifySession } from 'supertokens-node/recipe/session/framework/express/index.js';
import { verifyRole, toCamelCase, logActivity } from '../utils.js';
import multer from 'multer';
import path from 'path';
import fs from 'fs-extra'; // Using fs-extra for safer directory operations
import { fileURLToPath } from 'url';
import qrcode from 'qrcode';
import { processImage, downloadAndProcessImage } from '../lib/imageProcessor.js';

const router = express.Router();

// --- IMAGE UPLOAD CONFIG ---
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// FIX: In production, align with docker volume and index.js static path
const uploadRoot = process.env.NODE_ENV === 'production' 
    ? '/app/server/uploads' 
    : path.join(__dirname, '../uploads');

// --- DEBUG PATHS ---
console.log("📂 UPLOAD CONFIG:");
console.log("   -> Saving files to:", uploadRoot);
console.log("   -> Directory exists?", fs.existsSync(uploadRoot));
// -------------------

// const productRoot = path.join(uploadRoot, 'products'); // No longer needed here

// Multer saves to root 'uploads' temporarily. We process and move them later.
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadRoot),
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, `temp-${uniqueSuffix}${path.extname(file.originalname)}`);
    }
});
const upload = multer({ storage });


// =================================================================
//  PUBLIC / SHARED ROUTES
// =================================================================

// GET /api/products - Fetch all ACTIVE products
router.get('/', verifySession(), async (req, res) => {
    try {
        const query = `
            SELECT 
                p.id, p.manufacturer_id, p.supplier_id, p.name, p.product_type, 
                p.description, p.product_line_url, 
                p.default_image_url as "defaultImageUrl",
                p.default_thumbnail_url as "defaultThumbnailUrl",
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
                            'wearLayer', pv.wear_layer,
                            'thickness', pv.thickness,
                            'sku', pv.sku,
                            'unitCost', pv.unit_cost,
                            'retailPrice', pv.retail_price,
                            'pricingUnit', pv.pricing_unit,
                            'uom', pv.uom,
                            'cartonSize', pv.carton_size,
                            'imageUrl', pv.image_url,
                            'thumbnailUrl', pv.thumbnail_url,
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
            WHERE p.is_discontinued = FALSE
            GROUP BY p.id, v.name
            ORDER BY p.name ASC;
        `;
        const result = await pool.query(query);
        const products = result.rows.map(row => ({
            ...toCamelCase(row),
            variants: row.variants || [] 
        }));
        res.json(products);
    } catch (err) {
        console.error('Error fetching products:', err.message);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// GET /api/products/discontinued
router.get('/discontinued', verifySession(), async (req, res) => {
    try {
        // This endpoint should return FULL variant data for the ProductDetailModal when viewing an archived product
        const query = `
            SELECT 
                p.id, p.manufacturer_id, p.supplier_id, p.name, p.product_type, 
                p.description, p.product_line_url, 
                p.default_image_url as "defaultImageUrl",
                p.default_thumbnail_url as "defaultThumbnailUrl",
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
                            'wearLayer', pv.wear_layer,
                            'thickness', pv.thickness,
                            'sku', pv.sku,
                            'unitCost', pv.unit_cost,
                            'retailPrice', pv.retail_price,
                            'pricingUnit', pv.pricing_unit,
                            'uom', pv.uom,
                            'cartonSize', pv.carton_size,
                            'imageUrl', pv.image_url,
                            'thumbnailUrl', pv.thumbnail_url,
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
            WHERE p.is_discontinued = TRUE
            GROUP BY p.id, v.name
            ORDER BY p.name ASC;
        `;
        const result = await pool.query(query);
        const products = result.rows.map(row => ({
            ...toCamelCase(row),
            variants: row.variants || [] 
        }));
        res.json(products);
    } catch (err) {
        console.error('Error fetching discontinued products:', err.message);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// =================================================================
//  SIZE MANAGEMENT
// =================================================================
router.get('/sizes', verifySession(), async (req, res) => {
    try {
        const query = `SELECT size_value FROM standard_sizes UNION SELECT size FROM product_variants WHERE size IS NOT NULL ORDER BY size_value ASC`;
        const result = await pool.query(query);
        const uniqueSizes = [...new Set(result.rows.map(row => row.size_value || row.size))].filter(Boolean);
        res.json(uniqueSizes);
    } catch (err) { res.status(500).json({ error: 'Internal server error' }); }
});

router.get('/sizes/stats', verifySession(), verifyRole('Admin'), async (req, res) => {
    try {
        const query = `
            WITH usage AS (SELECT size, COUNT(*) as count FROM product_variants WHERE size IS NOT NULL GROUP BY size)
            SELECT ss.size_value as "value", COALESCE(u.count, 0) as "usageCount", true as "isStandard"
            FROM standard_sizes ss LEFT JOIN usage u ON ss.size_value = u.size ORDER BY ss.size_value ASC
        `;
        const result = await pool.query(query);
        res.json(result.rows);
    } catch (err) { res.status(500).json({ error: 'Internal server error' }); }
});

router.post('/sizes', verifySession(), verifyRole('Admin'), async (req, res) => {
    const { value } = req.body;
    if (!value) return res.status(400).json({ error: 'Size value is required.' });
    try {
        await pool.query('INSERT INTO standard_sizes (size_value) VALUES ($1) ON CONFLICT (size_value) DO NOTHING', [value]);
        res.status(201).json({ message: 'Size created', value });
    } catch (err) { res.status(500).json({ error: 'Internal server error' }); }
});

router.put('/sizes', verifySession(), verifyRole('Admin'), async (req, res) => {
    const { oldValue, newValue } = req.body;
    if (!oldValue || !newValue) return res.status(400).json({ error: 'oldValue and newValue are required.' });
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        await client.query('UPDATE product_variants SET size = $1 WHERE size = $2', [newValue, oldValue]);
        await client.query('DELETE FROM standard_sizes WHERE size_value = $1', [oldValue]);
        await client.query('INSERT INTO standard_sizes (size_value) VALUES ($1) ON CONFLICT (size_value) DO NOTHING', [newValue]);
        await client.query('COMMIT');
        res.status(200).json({ message: `Size updated.` });
    } catch (err) { await client.query('ROLLBACK'); res.status(500).json({ error: 'Internal server error' }); } finally { client.release(); }
});

router.delete('/sizes', verifySession(), verifyRole('Admin'), async (req, res) => {
    const { value } = req.body;
    try {
        await pool.query('DELETE FROM standard_sizes WHERE size_value = $1', [value]);
        res.status(200).json({ message: 'Standard size removed.' });
    } catch (err) { res.status(500).json({ error: 'Internal server error' }); }
});

// --- NEW: Get all product names for the import cleaner ---
router.get('/names', verifySession(), async (req, res) => {
    try {
        const query = `
            SELECT name FROM products WHERE is_discontinued = FALSE
            UNION
            SELECT name FROM product_variants WHERE name IS NOT NULL
        `;
        const result = await pool.query(query);
        // Flatten the array of objects into an array of strings
        const names = result.rows.map(row => row.name);
        res.json([...new Set(names)]); // Return unique names
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch product names' });
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
        console.log("📸 CREATE PRODUCT REQUEST");
        console.log("   -> Has File?", !!req.file);
        if (req.file) console.log("   -> Temp Path:", req.file.path);
        
        await client.query('BEGIN');

        const { 
            name, manufacturerId, supplierId, productType, hasMasterBoard, 
            description, productLineUrl 
        } = req.body;

        // Process Image (Original + Thumbnail)
        let imageResults = { imageUrl: null, thumbnailUrl: null };
        if (req.file) {
            imageResults = await processImage(req.file, 'products', 'prod');
        } else if (req.body.defaultImageUrl && req.body.defaultImageUrl.startsWith('http')) {
            imageResults = await downloadAndProcessImage(req.body.defaultImageUrl, 'products', 'prod');
            if (!imageResults.imageUrl) throw new Error("Failed to download remote image (Blocked). Please upload file manually.");
        }

        const insertQuery = `
            INSERT INTO products (
                name, manufacturer_id, supplier_id, product_type, 
                description, product_line_url, default_image_url, default_thumbnail_url
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            RETURNING *;
        `;

        const result = await client.query(insertQuery, [
            name, manufacturerId || null, supplierId || null, productType, 
            description, productLineUrl, imageResults.imageUrl, imageResults.thumbnailUrl
        ]);

        const newProduct = result.rows[0];
        const vendorRes = await client.query('SELECT name FROM vendors WHERE id = $1', [newProduct.manufacturer_id]);
        const manufacturerName = vendorRes.rows.length > 0 ? vendorRes.rows[0].name : null;

        if (hasMasterBoard === 'true' || hasMasterBoard === true) {
            await client.query(`
                INSERT INTO product_variants (product_id, name, is_master)
                VALUES ($1, 'Full Line Board', TRUE)
            `, [newProduct.id]);
        }

        await logActivity(userId, 'CREATE', 'PRODUCT', newProduct.id, { name: newProduct.name });
        await client.query('COMMIT');
        
        res.status(201).json({ ...toCamelCase(newProduct), manufacturerName, variants: [] });

    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Error creating product:', err.message);
        res.status(500).json({ error: err.message || 'Internal server error' });
    } finally {
        client.release();
    }
});

// POST /api/products/:id/variants - Add a Variant
router.post('/:id/variants', verifySession(), verifyRole(['Admin', 'User']), upload.single('image'), async (req, res) => {
    const { id: productId } = req.params;
    const userId = req.session.getUserId();

    try {
        console.log("📸 CREATE VARIANT REQUEST");
        console.log("   -> Has File?", !!req.file);
        if (req.file) console.log("   -> Temp Path:", req.file.path);

        const { 
            name, size, finish, style, wearLayer, thickness, sku, 
            unitCost, retailPrice, pricingUnit, uom, cartonSize, imageUrl: bodyImageUrl, hasSample 
        } = req.body;

        let finalHasSample = hasSample;
        if (finalHasSample === undefined) {
             const checkMaster = await pool.query('SELECT 1 FROM product_variants WHERE product_id = $1 AND is_master = TRUE', [productId]);
             finalHasSample = checkMaster.rows.length === 0;
        }

        let imageResults = { imageUrl: null, thumbnailUrl: null };
        if (req.file) {
            imageResults = await processImage(req.file, 'products', 'var');
        } else if (bodyImageUrl && bodyImageUrl.startsWith('http')) {
            imageResults = await downloadAndProcessImage(bodyImageUrl, 'products', 'var');
            if (!imageResults.imageUrl) throw new Error("Failed to download remote image (Blocked). Please upload file manually.");
        }

        const safeCartonSize = (cartonSize === '' || cartonSize === 'null' || isNaN(Number(cartonSize))) ? null : cartonSize;

        const query = `
            INSERT INTO product_variants (
                product_id, name, size, finish, style, wear_layer, thickness, sku, 
                unit_cost, retail_price, pricing_unit, uom, carton_size, 
                image_url, thumbnail_url, has_sample
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
            RETURNING *;
        `;

        const result = await pool.query(query, [
            productId, name, size, finish, style, wearLayer || null, thickness || null, sku, 
            unitCost, retailPrice, pricingUnit, uom, safeCartonSize, 
            imageResults.imageUrl, imageResults.thumbnailUrl, finalHasSample
        ]);

        const newVariant = result.rows[0];
        await logActivity(userId, 'CREATE', 'VARIANT', newVariant.id, { productId, variantName: `${name} ${size}`.trim() });
        res.status(201).json(toCamelCase(newVariant));

    } catch (err) {
        console.error('Error creating variant:', err.message);
        res.status(500).json({ error: err.message || 'Internal server error' });
    }
});

// POST /api/products/:id/variants/batch - Batch Generator
router.post('/:id/variants/batch', verifySession(), verifyRole(['Admin', 'User']), async (req, res) => {
    const { id: productId } = req.params;
    const userId = req.session.getUserId();
    const { variants } = req.body;

    if (!variants || !Array.isArray(variants)) return res.status(400).json({ error: 'Array required.' });

    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const createdVariants = [];
        const query = `
            INSERT INTO product_variants (
                product_id, name, size, finish, style, wear_layer, thickness, sku, 
                unit_cost, retail_price, pricing_unit, uom, carton_size, image_url, thumbnail_url, has_sample
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
            RETURNING *;
        `;

        for (const v of variants) {
            const safeCartonSize = (v.cartonSize === '' || isNaN(Number(v.cartonSize))) ? null : v.cartonSize;
            
            // If imageUrl is present, the frontend assumes we handle it later or it's a temp external URL.
            let thumbnailUrl = null;
            if (v.imageUrl) {
                 const processed = await downloadAndProcessImage(v.imageUrl, 'products', 'var');
                 thumbnailUrl = processed.thumbnailUrl; // Fixes the [object Object] bug
            }
 

            const result = await client.query(query, [
                productId, v.name, v.size, v.finish, v.style, v.wearLayer || null, v.thickness || null, v.sku,
                v.unitCost, v.retailPrice, v.pricingUnit, v.uom, safeCartonSize, v.imageUrl || null, thumbnailUrl, 
                v.hasSample !== undefined ? v.hasSample : true 
            ]);
            createdVariants.push(toCamelCase(result.rows[0]));
        }

        await logActivity(userId, 'CREATE', 'PRODUCT', productId, { action: 'BATCH', count: createdVariants.length }, client);
        await client.query('COMMIT');
        res.status(201).json(createdVariants);
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Batch error:', err.message);
        res.status(500).json({ error: err.message || 'Internal server error' });
    } finally {
        client.release();
    }
});

// PATCH /api/products/:id - Update Product
router.patch('/:id', verifySession(), verifyRole(['Admin', 'User']), upload.single('image'), async (req, res) => {
    const { id } = req.params;
    const userId = req.session.getUserId();
    const updates = { ...req.body };

    console.log("📸 UPDATE PRODUCT REQUEST:", id);
    console.log("   -> Has File?", !!req.file);
    if (req.file) console.log("   -> Temp Path:", req.file.path);

    // Handle Master Board
    if (updates.hasMasterBoard !== undefined) {
        const client = await pool.connect();
        try {
            if (updates.hasMasterBoard === 'true' || updates.hasMasterBoard === true) {
                await client.query(`INSERT INTO product_variants (product_id, name, is_master) 
                                    SELECT $1, 'Full Line Board', TRUE 
                                    WHERE NOT EXISTS (SELECT 1 FROM product_variants WHERE product_id = $1 AND is_master = TRUE)`, [id]);
            } else {
                await client.query(`DELETE FROM product_variants WHERE product_id = $1 AND is_master = TRUE`, [id]).catch(() => {});
            }
        } finally { client.release(); }
        delete updates.hasMasterBoard;
    }

    // Process New Image
    if (req.file) {
        const { imageUrl, thumbnailUrl } = await processImage(req.file, 'products', 'prod');
        updates.default_image_url = imageUrl;
        updates.default_thumbnail_url = thumbnailUrl;
    } else if (updates.defaultImageUrl) {
        if (updates.defaultImageUrl.startsWith('http') && !updates.defaultImageUrl.startsWith('/uploads')) {
            const processed = await downloadAndProcessImage(updates.defaultImageUrl, 'products', 'prod');
            if (!processed.imageUrl) throw new Error("Failed to download remote image (Blocked). Please upload file manually.");
            updates.default_image_url = processed.imageUrl;
            updates.default_thumbnail_url = processed.thumbnailUrl;
        } else {
             // It's a local path or explicit set, do nothing special but mapping
             updates.default_image_url = updates.defaultImageUrl;
        }
    }

    delete updates.image;
    delete updates.defaultImageUrl;

    const dbMap = {
        manufacturerId: 'manufacturer_id',
        supplierId: 'supplier_id',
        productType: 'product_type',
        productLineUrl: 'product_line_url',
        defaultImageUrl: 'default_image_url',
        defaultThumbnailUrl: 'default_thumbnail_url', // NEW MAP
        isDiscontinued: 'is_discontinued' // Added isDiscontinued
    };

    const fields = [];
    const values = [];
    let idx = 1;

    for (const [key, value] of Object.entries(updates)) {
        const dbCol = dbMap[key] || key;
        if (['name', 'description', ...Object.values(dbMap)].includes(dbCol)) {
            fields.push(`${dbCol} = $${idx}`);
            values.push(value === 'null' ? null : value);
            idx++;
        }
    }

    if (fields.length === 0) return res.status(400).json({ error: 'No valid fields' });
    values.push(id);

    try {
        const result = await pool.query(`UPDATE products SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`, values);
        if (result.rows.length === 0) return res.status(404).json({ error: 'Product not found' });
        await logActivity(userId, 'UPDATE', 'PRODUCT', id, { updates: Object.keys(updates) });
        res.json(toCamelCase(result.rows[0]));
    } catch (err) {
        console.error('Error updating product:', err.message);
        res.status(500).json({ error: err.message || 'Internal server error' });
    }
});

// PATCH /api/products/variants/batch-update - Batch Update Multiple Variants
router.patch('/variants/batch-update', verifySession(), verifyRole(['Admin', 'User']), async (req, res) => {
    const { ids, updates } = req.body;
    const userId = req.session.getUserId();

    // --- DEBUG LOGGING ---
    console.log("BATCH UPDATE RECEIVED:");
    console.log("IDs:", ids);
    console.log("Updates:", updates);
    // ---------------------

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({ error: 'No IDs provided for batch update.' });
    }
    if (!updates || Object.keys(updates).length === 0) {
        return res.status(400).json({ error: 'No updates provided.' });
    }

    // Safe list of fields that can be batch updated
    const allowedFields = {
        unitCost: 'unit_cost',
        retailPrice: 'retail_price',
        pricingUnit: 'pricing_unit', // Added
        cartonSize: 'carton_size',
        uom: 'uom',
        size: 'size',
        style: 'style',
        finish: 'finish',
        wearLayer: 'wear_layer',
        thickness: 'thickness',
        sku: 'sku', // Usually unique, but technically updateable in batch if needed (e.g. clearing it)
        hasSample: 'has_sample'
    };

    const fields = [];
    const values = [];
    let idx = 1;

    for (const [key, value] of Object.entries(updates)) {
        const dbCol = allowedFields[key];
        if (dbCol) {
            let safeValue = value === 'null' ? null : value;
            if (dbCol === 'carton_size' && safeValue === '') safeValue = null;
            
            fields.push(`${dbCol} = $${idx}`);
            values.push(safeValue);
            idx++;
        }
    }

    if (fields.length === 0) {
        console.error("Batch Update Failed: Fields array is empty.");
        console.error("Updates keys:", Object.keys(updates));
        return res.status(400).json({ error: 'No valid fields to update.' });
    }

    // Add the array of IDs as the last parameter
    values.push(ids);

    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        
        // Execute single efficient query: UPDATE ... WHERE id = ANY($N)
        const query = `UPDATE product_variants SET ${fields.join(', ')} WHERE id = ANY($${idx})`;
        await client.query(query, values);

        await logActivity(userId, 'UPDATE', 'VARIANT_BATCH', ids[0], { count: ids.length, fields: Object.keys(updates) });
        
        await client.query('COMMIT');
        res.json({ message: 'Batch update successful' });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Batch update error:', err.message);
        res.status(500).json({ error: err.message || 'Internal server error' });
    } finally {
        client.release();
    }
});

// PATCH /api/products/variants/:id - Update Variant
router.patch('/variants/:id', verifySession(), verifyRole(['Admin', 'User']), upload.single('image'), async (req, res) => {
    const { id } = req.params;
    const userId = req.session.getUserId();
    const updates = { ...req.body };
    delete updates.image;

    console.log("📸 UPDATE VARIANT REQUEST:", id);
    console.log("   -> Has File?", !!req.file);
    if (req.file) console.log("   -> Temp Path:", req.file.path);

    // Process New Image
    if (req.file) {
        const { imageUrl, thumbnailUrl } = await processImage(req.file, 'products', 'var');
        updates.image_url = imageUrl;
        updates.thumbnail_url = thumbnailUrl;
    } else if (updates.imageUrl) {
        if (updates.imageUrl.startsWith('http') && !updates.imageUrl.startsWith('/uploads')) {
            const processed = await downloadAndProcessImage(updates.imageUrl, 'products', 'var');
            if (!processed.imageUrl) throw new Error("Failed to download remote image (Blocked). Please upload file manually.");
            updates.image_url = processed.imageUrl;
            updates.thumbnail_url = processed.thumbnailUrl;
        } else {
            updates.image_url = updates.imageUrl;
        }
    }

    delete updates.imageUrl;
    delete updates.thumbnailUrl;

    const dbMap = {
        unitCost: 'unit_cost',
        retailPrice: 'retail_price',
        pricingUnit: 'pricing_unit', // Added
        cartonSize: 'carton_size',
        imageUrl: 'image_url',
        thumbnailUrl: 'thumbnail_url', // NEW MAP
        wearLayer: 'wear_layer',
        thickness: 'thickness',
        hasSample: 'has_sample',
        uom: 'uom'
    };

    const fields = [];
    const values = [];
    let idx = 1;

    for (const [key, value] of Object.entries(updates)) {
        const dbCol = dbMap[key] || key;
        if (['name', 'size', 'finish', 'style', 'sku', 'uom', 'has_sample', 'wear_layer', 'thickness', ...Object.values(dbMap)].includes(dbCol)) {
            let safeValue = value === 'null' ? null : value;
            if (dbCol === 'carton_size' && safeValue === '') safeValue = null;
            fields.push(`${dbCol} = $${idx}`);
            values.push(safeValue);
            idx++;
        }
    }

    if (fields.length === 0) return res.status(400).json({ error: 'No valid fields' });
    values.push(id);

    try {
        const result = await pool.query(`UPDATE product_variants SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`, values);
        if (result.rows.length === 0) return res.status(404).json({ error: 'Variant not found' });
        await logActivity(userId, 'UPDATE', 'VARIANT', id, { updates: Object.keys(updates) });
        res.json(toCamelCase(result.rows[0]));
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message || 'Internal server error' });
    }
});

// POST /api/products/:id/duplicate - Duplicate a product line
router.post('/:id/duplicate', verifySession(), verifyRole(['Admin', 'User']), async (req, res) => {
    const { id } = req.params;
    const userId = req.session.getUserId();

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // 1. Fetch Original Product
        const productRes = await client.query('SELECT * FROM products WHERE id = $1', [id]);
        if (productRes.rows.length === 0) return res.status(404).json({ error: 'Product not found' });
        const original = productRes.rows[0];

        // 2. Insert New Product (Append ' (Copy)' to name)
        const newName = `${original.name} (Copy)`;
        const insertProduct = `
            INSERT INTO products (manufacturer_id, supplier_id, name, product_type, description, product_line_url, default_image_url, default_thumbnail_url)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            RETURNING *;
        `;
        const newProductRes = await client.query(insertProduct, [
            original.manufacturer_id, original.supplier_id, newName, original.product_type, 
            original.description, original.product_line_url, original.default_image_url, original.default_thumbnail_url
        ]);
        const newProduct = newProductRes.rows[0];

        // 3. Duplicate Variants
        await client.query(`
            INSERT INTO product_variants (product_id, name, size, finish, style, wear_layer, thickness, sku, unit_cost, retail_price, pricing_unit, uom, carton_size, image_url, thumbnail_url, has_sample, is_master)
            SELECT $1, name, size, finish, style, wear_layer, thickness, sku, unit_cost, retail_price, pricing_unit, uom, carton_size, image_url, thumbnail_url, has_sample, is_master
            FROM product_variants WHERE product_id = $2
        `, [newProduct.id, id]);

        await logActivity(userId, 'CREATE', 'PRODUCT', newProduct.id, { action: 'DUPLICATE', sourceId: id });
        await client.query('COMMIT');
        
        res.status(201).json(toCamelCase(newProduct));
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Duplicate error:', err.message);
        res.status(500).json({ error: 'Internal server error' });
    } finally {
        client.release();
    }
});

// DELETE /api/products/:id - Delete Product (Cascade deletes variants)
router.delete('/:id', verifySession(), verifyRole('Admin'), async (req, res) => {
    const { id } = req.params;
    const userId = req.session.getUserId();

    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const check = await client.query(`SELECT count(*) FROM sample_checkouts sc JOIN product_variants pv ON sc.variant_id = pv.id WHERE pv.product_id = $1 AND sc.actual_return_date IS NULL`, [id]);
        if (parseInt(check.rows[0].count) > 0) throw new Error("Has active sample checkouts.");
        
        // FUTURE TODO: Fetch image URLs here and fs.remove() them from disk to save space
        
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

// DELETE /api/products/variants/:id - Delete a variant
router.delete('/variants/:id', verifySession(), verifyRole('Admin'), async (req, res) => {
    const { id } = req.params;
    const userId = req.session.getUserId();

    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const usageRes = await client.query(`SELECT count(*) FROM sample_checkouts WHERE variant_id = $1 AND actual_return_date IS NULL`, [id]);
        if (parseInt(usageRes.rows[0].count) > 0) throw new Error("Cannot delete variant: It has active checkouts.");

        // Log BEFORE deleting to ensure record context is available for logging logic
        // Also pass client to ensure transactional integrity
        await logActivity(userId, 'DELETE', 'VARIANT', id, {}, client);

        await client.query('UPDATE order_line_items SET variant_id = NULL WHERE variant_id = $1', [id]);
        await client.query('DELETE FROM sample_checkouts WHERE variant_id = $1', [id]);
        await client.query('DELETE FROM product_variants WHERE id = $1', [id]);
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
    const url = `${process.env.BASE_URL || 'http://localhost:5173'}/scan-result?variantId=${id}`; 
    try {
        const qrCodeImage = await qrcode.toBuffer(url, { errorCorrectionLevel: 'H', type: 'image/png', margin: 1, color: { dark: "#000000", light: "#FFFFFF" } });
        res.setHeader('Content-Type', 'image/png');
        res.send(qrCodeImage);
    } catch (err) { res.status(500).json('Error generating QR code'); }
});

// GET /api/products/:id/qr - Generate QR Code for a Parent Product
router.get('/:id/qr', async (req, res) => {
    const { id } = req.params;
    const url = `${process.env.BASE_URL || 'http://localhost:5173'}/scan-result?productId=${id}`; 
    try {
        const qrCodeImage = await qrcode.toBuffer(url, { errorCorrectionLevel: 'H', type: 'image/png', margin: 1, color: { dark: "#000000", light: "#FFFFFF" } });
        res.setHeader('Content-Type', 'image/png');
        res.send(qrCodeImage);
    } catch (err) { res.status(500).json('Error generating QR code'); }
});

export default router;