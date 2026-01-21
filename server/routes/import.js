import express from 'express';
import pool from '../db.js';
import { verifySession } from 'supertokens-node/recipe/session/framework/express/index.js';
import { verifyRole, toCamelCase, logActivity } from '../utils.js';

const router = express.Router();

// Helpers to handle types and ensure "Empty" becomes NULL for COALESCE
const cleanText = (str) => {
    if (str === null || str === undefined) return null;
    const s = String(str).replace(/\0/g, '').trim();
    return s === '' ? null : s;
};

const cleanNumber = (val) => {
    if (val === null || val === undefined || val === '') return null;
    const num = Number(val);
    return isNaN(num) ? null : num;
};

// =================================================================
//  PROFILE MANAGEMENT (Saving your mappings)
// =================================================================

// GET /api/import/profiles - List all saved profiles
router.get('/profiles', verifySession(), async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM import_profiles ORDER BY profile_name ASC');
        res.json(toCamelCase(result.rows));
    } catch (err) {
        console.error('Error fetching import profiles:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// POST /api/import/profiles - Save a new profile
router.post('/profiles', verifySession(), verifyRole(['Admin', 'User']), async (req, res) => {
    const { profileName, mappingRules } = req.body;
    
    if (!profileName || !mappingRules) {
        return res.status(400).json({ error: 'Profile name and mapping rules are required.' });
    }

    try {
        const query = `
            INSERT INTO import_profiles (profile_name, mapping_rules)
            VALUES ($1, $2)
            ON CONFLICT (profile_name) 
            DO UPDATE SET mapping_rules = $2, created_at = NOW()
            RETURNING *
        `;
        const result = await pool.query(query, [profileName, mappingRules]);
        res.json(toCamelCase(result.rows[0]));
    } catch (err) {
        console.error('Error saving import profile:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// DELETE /api/import/profiles/:id
router.delete('/profiles/:id', verifySession(), verifyRole('Admin'), async (req, res) => {
    try {
        await pool.query('DELETE FROM import_profiles WHERE id = $1', [req.params.id]);
        res.json({ success: true });
    } catch (err) {
        console.error('Error deleting profile:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// =================================================================
//  ALIAS MEMORY (Learning from your edits)
// =================================================================

// GET /api/import/aliases - Fetch all saved rules
router.get('/aliases', verifySession(), async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM size_aliases');
        res.json(toCamelCase(result.rows));
    } catch (err) {
        console.error('Error fetching aliases:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// POST /api/import/aliases - Learn a new rule
router.post('/aliases', verifySession(), async (req, res) => {
    const { aliasText, mappedSize } = req.body;
    
    // Basic validation
    if (!aliasText || !mappedSize) {
        return res.status(400).json({ error: 'Alias text and mapped size are required.' });
    }

    try {
        // Upsert: If we already know this alias, update its mapping
        const query = `
            INSERT INTO size_aliases (alias_text, mapped_size)
            VALUES ($1, $2)
            ON CONFLICT (alias_text) 
            DO UPDATE SET mapped_size = $2
            RETURNING *
        `;
        const result = await pool.query(query, [cleanText(aliasText), cleanText(mappedSize)]);
        res.json(toCamelCase(result.rows[0]));
    } catch (err) {
        console.error('Error saving alias:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// =================================================================
//  IMPORT LOGIC (The Heavy Lifting)
// =================================================================

// POST /api/import/preview
// Takes mapped data, checks database for matches, returns "Diff" report
router.post('/preview', verifySession(), async (req, res) => {
    const { mappedRows, strategy } = req.body; 
    const client = await pool.connect();
    
    try {
        const results = [];

        // Optimize: In a huge system, we'd bulk fetch. For <5000 rows, looping is fine and safer logic-wise.
        for (const row of mappedRows) {
            const { productName, variantName, sku, unitCost, retailPrice } = row;
            let action = 'new'; 
            let details = {};
            let affectedVariants = []; // Stores the specific DB rows to update

            // --- STRATEGY 1: PRODUCT LINE MATCH ---
            // "Update the whole family based on the parent name"
            if (strategy === 'product_line_match') {
                if (!productName) {
                    results.push({ ...row, status: 'error', message: 'Missing Product Name' });
                    continue;
                }

                // 1. Find Parent Product
                const parentRes = await client.query(
                    `SELECT id, name FROM products WHERE LOWER(name) = LOWER($1) AND is_discontinued = FALSE`, 
                    [cleanText(productName)]
                );

                if (parentRes.rows.length > 0) {
                    const parent = parentRes.rows[0];
                    action = 'update';
                    
                    // 2. Fetch ALL children to show the user what will change
                    const variantsRes = await client.query(
                        `SELECT id, name, unit_cost, retail_price FROM product_variants WHERE product_id = $1`,
                        [parent.id]
                    );
                    
                    affectedVariants = variantsRes.rows.map(v => ({
                        id: v.id,
                        name: v.name,
                        oldCost: v.unit_cost,
                        newCost: unitCost,
                        oldRetail: v.retail_price,
                        newRetail: retailPrice,
                        newSize: row.size,
                        newCartonSize: row.cartonSize,
                        newWearLayer: row.wearLayer,
                        newThickness: row.thickness
                    }));
                    
                    details = {
                        matchType: 'Parent Product',
                        matchName: parent.name,
                        childCount: variantsRes.rows.length
                    };
                }
            } 
            
            // --- STRATEGY 2: VARIANT MATCH ---
            // "Update specific items by SKU or Exact Name"
            else if (strategy === 'variant_match') {
                let matchFound = false;

                // A. Try SKU Match (High Confidence)
                if (sku) {
                    const skuRes = await client.query(
                        `SELECT v.id, v.name, v.unit_cost, v.retail_price, p.name as product_name 
                         FROM product_variants v 
                         JOIN products p ON v.product_id = p.id 
                         WHERE v.sku = $1`,
                        [cleanText(sku ? sku.toString() : '')]
                    );
                    
                    if (skuRes.rows.length > 0) {
                        const v = skuRes.rows[0];
                        matchFound = true;
                        action = 'update';
                        affectedVariants.push({
                            id: v.id,
                            name: `${v.product_name} - ${v.name}`,
                            oldCost: v.unit_cost,
                            newCost: unitCost,
                            oldRetail: v.retail_price,
                            newRetail: retailPrice,
                            newSize: row.size,
                            newCartonSize: row.cartonSize,
                            newWearLayer: row.wearLayer,
                            newThickness: row.thickness
                        });
                        details = { matchType: 'SKU', matchValue: sku };
                    }
                }
                
                // B. Try Name Match (Lower Confidence)
                if (!matchFound && productName && variantName) {
                    const nameRes = await client.query(
                        `SELECT v.id, v.name, v.unit_cost, v.retail_price 
                         FROM product_variants v 
                         JOIN products p ON v.product_id = p.id 
                         WHERE LOWER(p.name) = LOWER($1) AND LOWER(v.name) = LOWER($2)`,
                        [cleanText(productName), cleanText(variantName)]
                    );
                    
                    if (nameRes.rows.length > 0) {
                        const v = nameRes.rows[0];
                        matchFound = true;
                        action = 'update';
                        affectedVariants.push({
                            id: v.id,
                            name: v.name,
                            oldCost: v.unit_cost,
                            newCost: unitCost,
                            oldRetail: v.retail_price,
                            newRetail: retailPrice,
                            newSize: row.size,
                            newCartonSize: row.cartonSize,
                            newWearLayer: row.wearLayer,
                            newThickness: row.thickness
                        });
                        details = { matchType: 'Exact Name Match' };
                    }
                }
            }

            results.push({
                ...row,
                status: action,
                details,
                affectedVariants
            });
        }
        
        res.json(results);
    } catch (err) {
        console.error('Error generating import preview:', err);
        res.status(500).json({ error: err.message });
    } finally {
        client.release();
    }
});

// --- HELPER: Pricing Engine Logic ---
const calculateRetailPrice = (cost, markup, method = 'Markup') => {
    const costNum = Number(cost);
    const markupNum = Number(markup);

    if (isNaN(costNum) || costNum <= 0) return 0;
    if (isNaN(markupNum) || markupNum <= 0) return costNum;

    if (method === 'Margin') {
        if (markupNum >= 100) return costNum; // Avoid division by zero/negative
        return costNum / (1 - markupNum / 100);
    }
    // Default to Markup
    return costNum * (1 + markupNum / 100);
};


// POST /api/import/execute
// Commit changes to the database
router.post('/execute', verifySession(), async (req, res) => {
    const { previewResults, strategy, defaults } = req.body;
    const userId = req.session.getUserId();
    const client = await pool.connect();

    try {
        await client.query('BEGIN');
        
        let updates = 0;
        let created = 0;

        // --- PRE-FETCH SYSTEM SETTINGS ---
        const settingsRes = await client.query(`SELECT settings FROM system_preferences WHERE key = 'pricing_settings'`);
        let globalPricing = { retailMarkup: 0, calculationMethod: 'Markup' }; // Default values
        
        if (settingsRes.rows.length > 0 && settingsRes.rows[0].settings) {
            // Since it's a jsonb column, it should already be an object
            const dbSettings = settingsRes.rows[0].settings;
            
            // Merge with defaults to ensure keys always exist, even if DB object is incomplete
            globalPricing = { ...globalPricing, ...dbSettings };
        }

        const vendorCache = {}; // Cache to avoid re-querying vendors

        for (const row of previewResults) {
            // Skip errors/ignored
            if (row.status === 'error' || row.status === 'ignored') continue;

            // 1. UPDATE EXISTING
            if (row.status === 'update' && row.affectedVariants) {
                for (const v of row.affectedVariants) {
                    // Here we blindly update cost/retail based on the preview data
                    // We also safely update specs (Size, Layer, Thickness) if provided
                    await client.query(`
                        UPDATE product_variants 
                        SET 
                            unit_cost = $1, 
                            retail_price = $2,
                            size = COALESCE($4, size),
                            carton_size = COALESCE($5, carton_size),
                            wear_layer = COALESCE($6, wear_layer),
                            thickness = COALESCE($7, thickness),
                            updated_at = NOW()
                        WHERE id = $3
                    `, [
                        v.newCost, 
                        v.newRetail || v.oldRetail, 
                        v.id,
                        cleanText(v.newSize),
                        cleanNumber(v.newCartonSize), // Explicitly cast to Number or Null
                        cleanText(v.newWearLayer),
                        cleanText(v.newThickness)
                    ]); 
                    updates++;
                }
            }

            // 2. CREATE NEW
            if (row.status === 'new') {
                // Clean inputs
                const pName = cleanText(row.productName);
                const vName = cleanText(row.variantName) || 'Standard'; // Default if missing
                const manufName = cleanText(row.manufacturer);

                // Resolve Manufacturer ID 
                let manufId = null;
                
                // Priority 1: CSV Name
                if (manufName) {
                    const manufRes = await client.query(`SELECT id FROM vendors WHERE LOWER(name) = LOWER($1)`, [manufName.toLowerCase()]);
                    if (manufRes.rows.length > 0) manufId = manufRes.rows[0].id;
                } 
                // Priority 2: Global Default
                else if (defaults?.manufacturerId) {
                    manufId = defaults.manufacturerId;
                }

                // Find or Create Parent
                let productId;
                const parentRes = await client.query(`SELECT id FROM products WHERE LOWER(name) = LOWER($1)`, [pName.toLowerCase()]);
                
                if (parentRes.rows.length > 0) {
                    productId = parentRes.rows[0].id;
                } else {
                    // Determine Type: CSV -> Default -> 'Material'
                    const pType = cleanText(row.productType) || defaults?.productType || 'Material';
                    
                    // Create Parent
                    const newParent = await client.query(`
                        INSERT INTO products (name, manufacturer_id, product_type)
                        VALUES ($1, $2, $3)
                        RETURNING id
                    `, [pName, manufId, pType]);
                    productId = newParent.rows[0].id;
                }

                // --- PRICING LOGIC ---
                let finalRetailPrice = row.retailPrice || 0;
                
                // If no retail price is provided, calculate it
                if (!finalRetailPrice && row.unitCost > 0) {
                    let vendorPricing = null;
                    if (manufId) {
                        if (!vendorCache[manufId]) {
                             const vendorRes = await client.query(`SELECT default_markup, pricing_method FROM vendors WHERE id = $1`, [manufId]);
                             vendorCache[manufId] = vendorRes.rows.length > 0 ? vendorRes.rows[0] : null;
                        }
                        vendorPricing = vendorCache[manufId];
                    }

                    // Waterfall: Vendor > Global
                    const markup = vendorPricing?.default_markup || globalPricing.retailMarkup;
                    const method = vendorPricing?.pricing_method || globalPricing.calculationMethod;
                    
                    finalRetailPrice = calculateRetailPrice(row.unitCost, markup, method);
                }

                // Create Variant
                await client.query(`
                    INSERT INTO product_variants (product_id, name, sku, size, unit_cost, retail_price, carton_size, has_sample, wear_layer, thickness)
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
                `, [
                    productId, 
                    vName, 
                    cleanText(row.sku), 
                    cleanText(row.size), 
                    row.unitCost || 0, 
                    finalRetailPrice, // Use the calculated price
                    row.cartonSize || null,
                    row.hasSample || false, // Read the checkbox value from the review step
                    cleanText(row.wearLayer),
                    cleanText(row.thickness)
                ]);

                // SYNC SIZES: Ensure this size is added to the global "Known Sizes" list
                if (row.size) {
                    const cleanSize = cleanText(row.size);
                    if (cleanSize) {
                        // Corrected table and column name
                        await client.query(`
                            INSERT INTO standard_sizes (size_value) 
                            VALUES ($1) 
                            ON CONFLICT (size_value) DO NOTHING
                        `, [cleanSize]);
                    }
                }

                created++;
            }
        }

        // Log the batch activity
        try {
             await logActivity(userId, 'IMPORT', 'BATCH', 'Multiple', { updates, created, strategy });
        } catch (e) { console.warn("Failed to log import activity", e); }
        
        await client.query('COMMIT');
        
        res.json({ success: true, updates, created });

    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Error executing import:', err);
        res.status(500).json({ error: err.message });
    } finally {
        client.release();
    }
});

export default router;