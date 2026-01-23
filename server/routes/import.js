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
    const num = Number(String(val).replace(/[^0-9.-]+/g, ""));
    return isNaN(num) ? null : num;
};

const cleanString = (str) => {
    if (str === null || str === undefined) return '';
    const s = String(str);
    return s.replace(/\0/g, '').trim();
};

const normalizeForCompare = (val) => {
    if (val === null || val === undefined) return '';
    // Lowercase, remove quotes, remove all whitespace
    return String(val).toLowerCase().replace(/["']/g, '').replace(/\s+/g, '');
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
    
    if (!aliasText || !mappedSize) {
        return res.status(400).json({ error: 'Alias text and mapped size are required.' });
    }

    try {
        const query = `
            INSERT INTO size_aliases (alias_text, mapped_size)
            VALUES ($1, $2)
            ON CONFLICT (alias_text) 
            DO UPDATE SET mapped_size = $2
            RETURNING *
        `;
        const result = await pool.query(query, [cleanString(aliasText), cleanString(mappedSize)]);
        res.json(toCamelCase(result.rows[0]));
    } catch (err) {
        console.error('Error saving alias:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// =================================================================
//  PRODUCT NAME ALIASES (The "Name Cleaner" Memory)
// =================================================================

// GET /api/import/aliases/products - Fetch all naming rules
router.get('/aliases/products', verifySession(), async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM product_aliases');
        res.json(toCamelCase(result.rows));
    } catch (err) {
        console.error('Error fetching product aliases:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// POST /api/import/aliases/products - Learn a new naming rule
router.post('/aliases/products', verifySession(), async (req, res) => {
    const { aliasText, mappedProductName } = req.body;
    
    if (!aliasText || !mappedProductName) {
        return res.status(400).json({ error: 'Alias text and mapped name are required.' });
    }

    try {
        const query = `
            INSERT INTO product_aliases (alias_text, mapped_product_name)
            VALUES ($1, $2)
            ON CONFLICT (alias_text) 
            DO UPDATE SET mapped_product_name = $2
            RETURNING *
        `;
        const result = await pool.query(query, [cleanString(aliasText), cleanString(mappedProductName)]);
        res.json(toCamelCase(result.rows[0]));
    } catch (err) {
        console.error('Error saving product alias:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// --- PRICING HELPERS ---
const calculateRetail = (cost, markup, method) => {
    const c = Number(cost);
    const m = Number(markup);
    if (isNaN(c) || c <= 0) return 0;
    if (isNaN(m)) return c;

    let price = 0;
    if (method === 'Margin') {
        const decimalMargin = m / 100;
        if (decimalMargin >= 1) return 0; 
        price = c / (1 - decimalMargin);
    } else { // Markup
        price = c * (1 + m / 100);
    }
    return Number(price.toFixed(2));
};

// =================================================================
//  IMPORT LOGIC (The Heavy Lifting)
// =================================================================

// POST /api/import/preview
// Takes mapped data, checks database for matches, returns "Diff" report
router.post('/preview', verifySession(), async (req, res) => {
    const { mappedRows, strategy } = req.body; 
    const client = await pool.connect();
    console.log(`🔍 IMPORT PREVIEW: Starting preview for ${mappedRows?.length} rows. Strategy: ${strategy}`);
    
    try {
        const results = [];

        // 1. Fetch Product Aliases (System Memory)
        const aliasRes = await client.query('SELECT alias_text, mapped_product_name FROM product_aliases');
        const aliasMap = new Map();
        aliasRes.rows.forEach(r => aliasMap.set(r.alias_text.toLowerCase(), r.mapped_product_name));

        // 2. Fetch Pricing Rules (Global & Vendors)
        const settingsRes = await client.query(`SELECT settings FROM system_preferences WHERE key = 'pricing_settings'`);
        let globalPricing = { retailMarkup: 0, calculationMethod: 'Markup' };
        if (settingsRes.rows.length > 0 && settingsRes.rows[0].settings) {
            globalPricing = { ...globalPricing, ...settingsRes.rows[0].settings };
        }
        
        // Cache vendor rules: { vendorId: { markup, method } }
        const vendorRules = {};
        const vendorRes = await client.query('SELECT id, default_markup, pricing_method FROM vendors');
        vendorRes.rows.forEach(v => {
            vendorRules[v.id] = { markup: v.default_markup, method: v.pricing_method };
        });

        console.log("\n💰 PRICING RULES LOADED:");
        console.log("   -> Global:", globalPricing);

        // Define generic diff helpers
        const isNumDiff = (dbVal, csvVal) => Math.abs(Number(dbVal) - Number(csvVal)) > 0.01;
        const isTextDiff = (dbVal, csvVal) => normalizeForCompare(dbVal) !== normalizeForCompare(csvVal);

        // Optimize: In a huge system, we'd bulk fetch. For <5000 rows, looping is fine and safer logic-wise.
        for (const [index, row] of mappedRows.entries()) {
            let { productName, variantName, sku, unitCost: rawCost, retailPrice: rawRetail } = row;
            
            // CLEAN NUMBERS before doing math to prevent NaN errors
            const unitCost = cleanNumber(rawCost) || 0;
            const retailPrice = cleanNumber(rawRetail) || 0;
            
            // AUTO-CLEAN: Check if this productName is a known alias
            if (productName && aliasMap.has(productName.toLowerCase())) {
                const cleanName = aliasMap.get(productName.toLowerCase());
                // Update the local variable so the lookup works
                productName = cleanName;
                // Update the row object so the Frontend sees the clean name
                row.productName = cleanName;
            }

            console.log(`\n--- 🕵️ Row ${index + 1}: [Product: "${productName}", Variant: "${variantName}", SKU: "${sku || 'N/A'}"] ---`);

            let action = 'new'; 
            let details = {};
            let affectedVariants = []; // Stores the specific DB rows to update

            // --- STRATEGY 1: PRODUCT LINE MATCH ---
            if (strategy === 'product_line_match') {
                if (!productName) {
                    results.push({ ...row, status: 'error', message: 'Missing Product Name' });
                    continue;
                }

                const parentRes = await client.query(
                    `SELECT id, name FROM products WHERE LOWER(name) = LOWER($1) AND is_discontinued = FALSE`, 
                    [cleanText(productName)]
                );

                if (parentRes.rows.length > 0) {
                    const parent = parentRes.rows[0];

                    // Pricing Rules for this Product Line
                    const vendorRes = await client.query('SELECT manufacturer_id FROM products WHERE id = $1', [parent.id]);
                    const manufId = vendorRes.rows[0]?.manufacturer_id;
                    const rules = (manufId && vendorRules[manufId]) 
                        ? { markup: vendorRules[manufId].markup || globalPricing.retailMarkup, method: vendorRules[manufId].method || globalPricing.calculationMethod }
                        : { markup: globalPricing.retailMarkup, method: globalPricing.calculationMethod };
                    
                    console.log(`   MATCHING: Product Line "${parent.name}" found. Applying rules:`, rules);

                    const variantsRes = await client.query(
                        `SELECT id, name, unit_cost, retail_price, size, carton_size, wear_layer, thickness 
                         FROM product_variants WHERE product_id = $1`,
                        [parent.id]
                    );
                    
                    affectedVariants = variantsRes.rows.map(v => {
                        const changes = [];

                        // Calculate Target Retail
                        const targetCost = unitCost > 0 ? unitCost : v.unit_cost;
                        const calculatedRetail = calculateRetail(targetCost, rules.markup, rules.method);
                        const finalNewRetail = retailPrice > 0 ? retailPrice : calculatedRetail;
                        
                        console.log(`     -> Variant "${v.name}": Cost $${targetCost} -> Retail $${finalNewRetail}. (DB price is $${v.retail_price})`);
                        
                        if (isNumDiff(v.unit_cost, unitCost)) changes.push('Cost');
                        if (isNumDiff(v.retail_price, finalNewRetail)) changes.push(`Price: $${v.retail_price} -> $${finalNewRetail}${retailPrice > 0 ? '' : ' (Auto)'}`);
                        if (isTextDiff(v.name, row.variantName)) changes.push(`Name: ${v.name} -> ${row.variantName}`);
                        if (isTextDiff(v.size, row.size)) changes.push(`Size: ${v.size || '-'} -> ${row.size}`);
                        if (isNumDiff(v.carton_size, row.cartonSize)) changes.push(`Carton: ${v.carton_size || '-'} -> ${row.cartonSize}`);
                        if (isTextDiff(v.wear_layer, row.wearLayer)) changes.push(`Layer: ${v.wear_layer || '-'} -> ${row.wearLayer}`);
                        if (isTextDiff(v.thickness, row.thickness)) changes.push(`Thick: ${v.thickness || '-'} -> ${row.thickness}`);

                        return {
                            id: v.id,
                            name: v.name,
                            oldCost: v.unit_cost,
                            newCost: unitCost,
                            oldRetail: v.retail_price,
                            newRetail: finalNewRetail,
                            newSize: row.size,
                            newCartonSize: row.cartonSize,
                            newWearLayer: row.wearLayer,
                            newThickness: row.thickness,
                            changes 
                        };
                    });
                    
                    const hasChanges = affectedVariants.some(v => v.changes.length > 0);
                    action = hasChanges ? 'update' : 'match';
                    
                    details = {
                        matchType: 'Parent Product',
                        matchName: parent.name,
                        childCount: variantsRes.rows.length
                    };
                }
            } 
            
            // --- STRATEGY 2: VARIANT MATCH ---
            else if (strategy === 'variant_match') {
                let matchFound = false;
                console.log("   MATCHING: Attempting Variant Match...");

                if (sku) {
                    const skuRes = await client.query(
                        `SELECT v.id, v.name, v.unit_cost, v.retail_price, v.size, v.carton_size, v.wear_layer, v.thickness, 
                                p.name as product_name, p.manufacturer_id, v.product_id
                         FROM product_variants v 
                         JOIN products p ON v.product_id = p.id 
                         WHERE v.sku = $1`,
                        [cleanString(sku ? sku.toString() : '')]
                    );
                    
                    // SKIPPING AMBIGUOUS SKUS
                    if (skuRes.rows.length > 1) {
                        console.log(`     -> SKU Match: ⚠️ Ambiguous! Found ${skuRes.rows.length} variants for SKU "${sku}". Skipping.`);
                    }
                    else if (skuRes.rows.length === 1) {
                        const v = skuRes.rows[0];
                        console.log(`     -> SKU Match: ✅ Found unique variant "${v.name}" via SKU "${sku}".`);
                        matchFound = true;
                        const changes = [];

                        // Pricing Rules
                        const manufId = v.manufacturer_id;
                        const rules = (manufId && vendorRules[manufId]) 
                            ? { markup: vendorRules[manufId].markup || globalPricing.retailMarkup, method: vendorRules[manufId].method || globalPricing.calculationMethod }
                            : { markup: globalPricing.retailMarkup, method: globalPricing.calculationMethod };

                        const targetCost = unitCost > 0 ? unitCost : v.unit_cost;
                        const calculatedRetail = calculateRetail(targetCost, rules.markup, rules.method);
                        const finalNewRetail = retailPrice > 0 ? retailPrice : calculatedRetail;

                        console.log(`       🧮 CALC: Cost $${targetCost} -> Retail $${finalNewRetail}. (DB price is $${v.retail_price})`);

                        if (isNumDiff(v.unit_cost, unitCost)) changes.push('Cost');
                        if (isNumDiff(v.retail_price, finalNewRetail)) changes.push(`Price: $${v.retail_price} -> $${finalNewRetail}${retailPrice > 0 ? '' : ' (Auto)'}`);
                        if (isTextDiff(v.name, row.variantName)) changes.push(`Name: ${v.name} -> ${row.variantName}`);
                        if (isTextDiff(v.size, row.size)) changes.push(`Size: ${v.size || '-'} -> ${row.size}`);
                        if (isNumDiff(v.carton_size, row.cartonSize)) changes.push(`Carton: ${v.carton_size || '-'} -> ${row.cartonSize}`);
                        if (isTextDiff(v.wear_layer, row.wearLayer)) changes.push(`Layer: ${v.wear_layer || '-'} -> ${row.wearLayer}`);
                        if (isTextDiff(v.thickness, row.thickness)) changes.push(`Thick: ${v.thickness || '-'} -> ${row.thickness}`);

                        action = changes.length > 0 ? 'update' : 'match';
                        
                        affectedVariants.push({
                            id: v.id,
                            name: `${v.product_name} - ${v.name}`,
                            oldCost: v.unit_cost,
                            newCost: unitCost,
                            oldRetail: v.retail_price,
                            newRetail: finalNewRetail,
                            newSize: row.size,
                            newCartonSize: row.cartonSize,
                            newWearLayer: row.wearLayer,
                            newThickness: row.thickness,
                            changes
                        });
                        details = { matchType: 'SKU', matchValue: sku };
                    }
                }
                
                if (!matchFound && productName && variantName) {
                    console.log(`     -> Name Match: Searching for Product "${productName}" + Variant "${variantName}"...`);
                    const nameRes = await client.query(
                        `SELECT v.id, v.name, v.unit_cost, v.retail_price, v.size, v.carton_size, v.wear_layer, v.thickness, 
                                p.manufacturer_id, v.size as db_size
                         FROM product_variants v 
                         JOIN products p ON v.product_id = p.id 
                         WHERE LOWER(p.name) = LOWER($1) AND LOWER(v.name) = LOWER($2)`,
                        [cleanText(productName), cleanText(variantName)]
                    );
                    
                    // TRIANGULATION: Name Match + Size Disambiguation
                    let v = null;
                    if (nameRes.rows.length === 1) {
                        v = nameRes.rows[0];
                    } else if (nameRes.rows.length > 1) {
                        console.log(`       -> Name Match: ⚠️ Ambiguous! Found ${nameRes.rows.length} variants with that name. Trying size tie-breaker...`);
                        // If spreadsheet has size, use it to break tie
                        if (row.size) {
                             const normalizedTarget = normalizeForCompare(row.size);
                             const exactSizeMatches = nameRes.rows.filter(r => normalizeForCompare(r.db_size) === normalizedTarget);
                             if (exactSizeMatches.length === 1) {
                                v = exactSizeMatches[0];
                                console.log(`       -> Size Tie-breaker: ✅ Success! Matched on size "${row.size}".`);
                             }
                        }
                    }

                    if (v) {
                        console.log(`       -> Name Match: ✅ Found unique variant "${v.name}".`);
                        matchFound = true;
                        const changes = [];
                        
                        // Pricing Rules
                        const manufId = v.manufacturer_id;
                        const rules = (manufId && vendorRules[manufId]) 
                            ? { markup: vendorRules[manufId].markup || globalPricing.retailMarkup, method: vendorRules[manufId].method || globalPricing.calculationMethod }
                            : { markup: globalPricing.retailMarkup, method: globalPricing.calculationMethod };

                        const targetCost = unitCost > 0 ? unitCost : v.unit_cost;
                        const calculatedRetail = calculateRetail(targetCost, rules.markup, rules.method);
                        const finalNewRetail = retailPrice > 0 ? retailPrice : calculatedRetail;

                        console.log(`         🧮 CALC: Cost $${targetCost} -> Retail $${finalNewRetail}. (DB price is $${v.retail_price})`);

                        if (isNumDiff(v.unit_cost, unitCost)) changes.push('Cost');
                        if (isNumDiff(v.retail_price, finalNewRetail)) changes.push(`Price: $${v.retail_price} -> $${finalNewRetail}${retailPrice > 0 ? '' : ' (Auto)'}`);
                        if (isTextDiff(v.name, row.variantName)) changes.push(`Name: ${v.name} -> ${row.variantName}`);
                        if (isTextDiff(v.size, row.size)) changes.push(`Size: ${v.size || '-'} -> ${row.size}`);
                        if (isNumDiff(v.carton_size, row.cartonSize)) changes.push(`Carton: ${v.carton_size || '-'} -> ${row.cartonSize}`);
                        if (isTextDiff(v.wear_layer, row.wearLayer)) changes.push(`Layer: ${v.wear_layer || '-'} -> ${row.wearLayer}`);
                        if (isTextDiff(v.thickness, row.thickness)) changes.push(`Thick: ${v.thickness || '-'} -> ${row.thickness}`);

                        action = changes.length > 0 ? 'update' : 'match';

                        affectedVariants.push({
                            id: v.id,
                            name: v.name,
                            oldCost: v.unit_cost,
                            newCost: unitCost,
                            oldRetail: v.retail_price,
                            newRetail: finalNewRetail,
                            newSize: row.size,
                            newCartonSize: row.cartonSize,
                            newWearLayer: row.wearLayer,
                            newThickness: row.thickness,
                            changes
                        });
                        details = { matchType: 'Exact Name Match' };
                    } else {
                        console.log(`     -> Name Match: ❌ No unique match found.`);
                    }
                }

                // --- FALLBACK STRATEGY ---
                if (!matchFound && productName) {
                    console.log(`     -> No direct match. Falling back to broad Product Line search for "${productName}"...`);
                    const parentRes = await client.query(
                        `SELECT id, name, manufacturer_id FROM products WHERE LOWER(name) = LOWER($1)`, 
                        [cleanText(productName)]
                    );

                    if (parentRes.rows.length > 0) {
                        const parent = parentRes.rows[0];
                        const rules = (parent.manufacturer_id && vendorRules[parent.manufacturer_id]) 
                            ? { markup: vendorRules[parent.manufacturer_id].markup || globalPricing.retailMarkup, method: vendorRules[parent.manufacturer_id].method || globalPricing.calculationMethod }
                            : { markup: globalPricing.retailMarkup, method: globalPricing.calculationMethod };
                        
                        const dbVariantsRes = await client.query(`SELECT id, name, size, unit_cost, retail_price FROM product_variants WHERE product_id = $1`, [parent.id]);
                        
                        const targetVariantName = normalizeForCompare(variantName);
                        const targetSize = normalizeForCompare(row.size);
                        
                        let bestMatch = null;
                        for (const dbVar of dbVariantsRes.rows) {
                            if (normalizeForCompare(dbVar.name) === targetVariantName && normalizeForCompare(dbVar.size) === targetSize) {
                                bestMatch = dbVar;
                                break;
                            }
                        }
                        
                        if (bestMatch) {
                            console.log(`       -> Fallback Success: Matched variant "${bestMatch.name}" by Name+Size.`);
                            const changes = [];
                            const targetCost = unitCost > 0 ? unitCost : bestMatch.unit_cost;
                            const calculatedRetail = calculateRetail(targetCost, rules.markup, rules.method);
                            const finalNewRetail = retailPrice > 0 ? retailPrice : calculatedRetail;

                            if (isNumDiff(bestMatch.unit_cost, unitCost)) changes.push('Cost');
                            if (isNumDiff(bestMatch.retail_price, finalNewRetail)) changes.push(`Price: $${bestMatch.retail_price} -> $${finalNewRetail}${retailPrice > 0 ? '' : ' (Auto)'}`);

                            if (changes.length > 0) {
                                action = 'update';
                                affectedVariants.push({ 
                                    id: bestMatch.id, 
                                    name: bestMatch.name, 
                                    newCost: unitCost, 
                                    newRetail: finalNewRetail, 
                                    changes 
                                });
                                details = { matchType: 'Fallback Name+Size' };
                            } else {
                                action = 'match';
                            }
                            matchFound = true;
                        }
                    }
                }
            }

            results.push({
                ...row,
                status: action,
                details,
                affectedVariants
            });

            console.log(`   FINAL ACTION: ${action.toUpperCase()}`);
        }
        
        console.log(`\n✅ IMPORT PREVIEW: Completed. ${results.filter(r => r.status === 'update').length} updates found.`);
        res.json(results);
    } catch (err) {
        console.error('Error generating import preview:', err);
        res.status(500).json({ error: err.message });
    } finally {
        client.release();
    }
});

// POST /api/import/execute
router.post('/execute', verifySession(), async (req, res) => {
    const { previewResults, strategy, defaults } = req.body;
    const userId = req.session.getUserId();
    const client = await pool.connect();

    console.log("🚀 IMPORT EXECUTE: Starting transaction for batch processing...");
    try {
        await client.query('BEGIN');
        
        let updates = 0;
        let created = 0;
        let skipped = 0;

        const settingsRes = await client.query(`SELECT settings FROM system_preferences WHERE key = 'pricing_settings'`);
        let globalPricing = { retailMarkup: 0, calculationMethod: 'Markup' };
        
        if (settingsRes.rows.length > 0 && settingsRes.rows[0].settings) {
            const dbSettings = settingsRes.rows[0].settings;
            globalPricing = { ...globalPricing, ...dbSettings };
        }

        const vendorCache = {}; 

        for (const row of previewResults) {
            if (row.status === 'error' || row.status === 'ignored' || row.status === 'match') {
                skipped++;
                continue;
            }

            console.log(`   -> Processing row: ${row.productName} [Status: ${row.status}]`);

            if (row.status === 'update' && row.affectedVariants) {
                for (const v of row.affectedVariants) {
                    const variantRes = await client.query(`
                        UPDATE product_variants 
                        SET 
                            name = COALESCE($8, name),
                            unit_cost = $1, 
                            retail_price = COALESCE($2, retail_price),
                            size = COALESCE($4, size),
                            carton_size = COALESCE($5, carton_size),
                            wear_layer = COALESCE($6, wear_layer),
                            thickness = COALESCE($7, thickness),
                            updated_at = NOW()
                        WHERE id = $3
                    `, [
                        cleanNumber(v.newCost), 
                        cleanNumber(v.newRetail),
                        v.id,
                        cleanText(v.newSize),
                        cleanNumber(v.newCartonSize),
                        cleanText(v.newWearLayer),
                        cleanText(v.newThickness),
                        cleanText(row.variantName)
                    ]); 
                    console.log(`      * EXECUTE UPDATE for variant ${v.id}. Rows affected: ${variantRes.rowCount}`);

                    await client.query(`
                        UPDATE products SET is_discontinued = FALSE, name = $2 WHERE id = $1
                    `, [row.productId || v.productId, cleanText(row.productName)]);

                    updates++;
                }
            }

            if (row.status === 'new') {
                const pName = cleanText(row.productName);
                const vName = cleanText(row.variantName) || 'Standard';
                const manufName = cleanText(row.manufacturer);

                let manufId = null;
                if (manufName) {
                    const manufRes = await client.query(`SELECT id FROM vendors WHERE LOWER(name) = LOWER($1)`, [manufName.toLowerCase()]);
                    if (manufRes.rows.length > 0) manufId = manufRes.rows[0].id;
                } 
                else if (defaults?.manufacturerId) {
                    manufId = defaults.manufacturerId;
                }

                let productId;
                const parentRes = await client.query(`SELECT id FROM products WHERE LOWER(name) = LOWER($1)`, [pName.toLowerCase()]);
                
                if (parentRes.rows.length > 0) {
                    productId = parentRes.rows[0].id;
                    await client.query(`
                        UPDATE products SET is_discontinued = FALSE, name = $2 WHERE id = $1
                    `, [productId, pName]);
                } else {
                    const pType = cleanText(row.productType) || defaults?.productType || 'Material';
                    const newParent = await client.query(`
                        INSERT INTO products (name, manufacturer_id, product_type)
                        VALUES ($1, $2, $3)
                        RETURNING id
                    `, [pName, manufId, pType]);
                    productId = newParent.rows[0].id;
                }

                // --- UNIFIED PRICING LOGIC ---
                let finalRetailPrice = cleanNumber(row.retailPrice) || 0;
                const unitCost = cleanNumber(row.unitCost) || 0;

                if (finalRetailPrice <= 0 && unitCost > 0) {
                    if (manufId && !vendorCache[manufId]) {
                        const vendorRes = await client.query(`SELECT default_markup, pricing_method FROM vendors WHERE id = $1`, [manufId]);
                        vendorCache[manufId] = vendorRes.rows.length > 0 ? vendorRes.rows[0] : null;
                    }

                    const rules = (manufId && vendorCache[manufId])
                        ? { markup: vendorCache[manufId].default_markup || globalPricing.retailMarkup, method: vendorCache[manufId].pricing_method || globalPricing.calculationMethod }
                        : { markup: globalPricing.retailMarkup, method: globalPricing.calculationMethod };
                    
                    finalRetailPrice = calculateRetail(unitCost, rules.markup, rules.method);
                }

                await client.query(`
                    INSERT INTO product_variants (product_id, name, sku, size, unit_cost, retail_price, carton_size, has_sample, wear_layer, thickness)
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
                `, [
                    productId, 
                    vName, 
                    cleanText(row.sku), 
                    cleanText(row.size), 
                    unitCost, 
                    finalRetailPrice, 
                    row.cartonSize || null,
                    row.hasSample || false,
                    cleanText(row.wearLayer),
                    cleanText(row.thickness)
                ]);

                if (row.size) {
                    const cleanSize = cleanText(row.size);
                    if (cleanSize) {
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

        try {
             await logActivity(userId, 'IMPORT', 'BATCH', 'Multiple', { updates, created, strategy });
        } catch (e) { console.warn("Failed to log import activity", e); }
        
        await client.query('COMMIT');
        console.log(`🏁 IMPORT EXECUTE COMPLETE: ${updates} updates, ${created} created, ${skipped} skipped.`);
        res.json({ success: true, updates, created });

    } catch (err) {
        await client.query('ROLLBACK');
        console.error('❌ IMPORT EXECUTE FAILED:', err);
        res.status(500).json({ error: err.message });
    } finally {
        client.release();
    }
});

export default router;