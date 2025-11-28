import express from 'express';
import pool from '../db.js';
import { verifySession } from 'supertokens-node/recipe/session/framework/express/index.js';
import { verifyRole, toCamelCase, logActivity } from '../utils.js';

const router = express.Router();

// --- HELPER: Sanitize String for Postgres ---
// Removes NULL bytes (0x00) which crash PG
const cleanString = (str) => {
    if (str === null || str === undefined) return '';
    const s = String(str); // Force to string
    return s.replace(/\0/g, '').trim();
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
                    [cleanString(productName)]
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
                        newRetail: retailPrice
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
                        [cleanString(sku ? sku.toString() : '')]
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
                            newRetail: retailPrice
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
                        [cleanString(productName), cleanString(variantName)]
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
                            newRetail: retailPrice
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

        for (const row of previewResults) {
            // Skip errors/ignored
            if (row.status === 'error' || row.status === 'ignored') continue;

            // 1. UPDATE EXISTING
            if (row.status === 'update' && row.affectedVariants) {
                for (const v of row.affectedVariants) {
                    // Here we blindly update cost/retail based on the preview data
                    await client.query(`
                        UPDATE product_variants 
                        SET unit_cost = $1, retail_price = $2, updated_at = NOW()
                        WHERE id = $3
                    `, [v.newCost, v.newRetail || v.oldRetail, v.id]); 
                    updates++;
                }
            }

            // 2. CREATE NEW
            if (row.status === 'new') {
                // Clean inputs
                const pName = cleanString(row.productName);
                const vName = cleanString(row.variantName) || 'Standard'; // Default if missing
                const manufName = cleanString(row.manufacturer);

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
                    const pType = cleanString(row.productType) || defaults?.productType || 'Material';
                    
                    // Create Parent
                    const newParent = await client.query(`
                        INSERT INTO products (name, manufacturer_id, product_type)
                        VALUES ($1, $2, $3)
                        RETURNING id
                    `, [pName, manufId, pType]);
                    productId = newParent.rows[0].id;
                }

                // Create Variant
                await client.query(`
                    INSERT INTO product_variants (product_id, name, sku, size, unit_cost, retail_price, carton_size)
                    VALUES ($1, $2, $3, $4, $5, $6, $7)
                `, [
                    productId, 
                    vName, 
                    cleanString(row.sku), 
                    cleanString(row.size), 
                    row.unitCost || 0, 
                    row.retailPrice || 0,
                    row.cartonSize || null
                ]);
                created++;
            }
        }

        // Log the batch activity
        // Note: We intentionally don't await this or pass 'client' if your utils.js isn't updated yet
        // to avoid breaking the transaction. We log outside the transaction or just use pool (safe enough for logs).
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