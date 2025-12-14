// server/routes/vendors.js

import express from 'express';
import pool from '../db.js';
import { toCamelCase, logActivity, verifyRole } from '../utils.js';
import { verifySession } from 'supertokens-node/recipe/session/framework/express/index.js';

const router = express.Router();

// --- MODIFIED: GET all vendors with sample counts for manufacturers ---
router.get('/', verifySession(), async (req, res) => {
    try {
        const query = `
            SELECT 
                v.id,
                v.name,
                v.vendor_type,
                v.default_supplier_id,
                v.default_product_type,
                v.website_url,
                v.portal_url,
                v.phone,
                v.address,
                v.ordering_email,
                v.claims_email,
                v.rep_name,
                v.rep_phone,
                v.rep_email,
                v.shipping_method,
                v.dedicated_shipping_day,
                v.notes,
                v.default_markup,
                v.pricing_method,
                COUNT(pv.id) AS sample_count
            FROM 
                vendors v
            LEFT JOIN 
                products p ON v.id = p.manufacturer_id
            LEFT JOIN
                product_variants pv ON p.id = pv.product_id AND pv.has_sample = TRUE
            GROUP BY
                v.id
            ORDER BY 
                v.name ASC;
        `;
        const result = await pool.query(query);
        res.json(result.rows.map(toCamelCase));
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// --- MODIFIED: POST a new vendor using new schema ---
router.post('/', verifySession(), async (req, res) => {
    const userId = req.session.getUserId();
    const { 
        name, vendorType, defaultProductType, defaultSupplierId, websiteUrl, portalUrl, phone, address, orderingEmail, 
        claimsEmail, repName, repPhone, repEmail, shippingMethod, dedicatedShippingDay, notes,
        defaultMarkup, pricingMethod
    } = req.body;

    if (!name) {
        return res.status(400).json({ error: 'Vendor name is required.' });
    }

    try {
        const query = `
            INSERT INTO vendors (
                name, vendor_type, default_product_type, default_supplier_id, website_url, portal_url, phone, address, ordering_email, 
                claims_email, rep_name, rep_phone, rep_email, shipping_method, dedicated_shipping_day, notes,
                default_markup, pricing_method
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
            RETURNING *;
        `;
        const values = [
            name, vendorType, defaultProductType, defaultSupplierId || null, websiteUrl || null, portalUrl || null, phone, address, orderingEmail,
            claimsEmail, repName, repPhone, repEmail, shippingMethod, dedicatedShippingDay, notes,
            defaultMarkup || null, pricingMethod || null
        ];
        const result = await pool.query(query, values);
        // The GET route will add the sample_count, but for a new vendor it's always 0.
        const newVendor = { ...toCamelCase(result.rows[0]), sampleCount: 0 };
        await logActivity(userId, 'CREATE', 'VENDOR', newVendor.id, { createdData: newVendor });
        res.status(201).json(newVendor);
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ error: 'Failed to create vendor.' });
    }
});

// --- MODIFIED: PUT (update) a vendor using new schema ---
router.put('/:id', verifySession(), async (req, res) => {
    const { id } = req.params;
    const userId = req.session.getUserId();
    const { 
        name, vendorType, defaultProductType, defaultSupplierId, websiteUrl, portalUrl, phone, address, orderingEmail, 
        claimsEmail, repName, repPhone, repEmail, shippingMethod, dedicatedShippingDay, notes,
        defaultMarkup, pricingMethod
    } = req.body;

    if (!name) {
        return res.status(400).json({ error: 'Vendor name is required.' });
    }

    try {
        const beforeResult = await pool.query('SELECT * FROM vendors WHERE id = $1', [id]);
        if (beforeResult.rows.length === 0) {
            return res.status(404).json({ error: 'Vendor not found.' });
        }
        const beforeData = toCamelCase(beforeResult.rows[0]);
        const query = `
            UPDATE vendors SET
                name = $1, vendor_type = $2, default_product_type = $3, default_supplier_id = $4, website_url = $5, portal_url = $6, phone = $7, address = $8,
                ordering_email = $9, claims_email = $10, rep_name = $11, rep_phone = $12,
                rep_email = $13, shipping_method = $14, dedicated_shipping_day = $15, notes = $16,
                default_markup = $17, pricing_method = $18
            WHERE id = $19
            RETURNING *;
        `;
        const values = [
            name, vendorType, defaultProductType, defaultSupplierId || null, websiteUrl || null, portalUrl || null, phone, address, orderingEmail,
            claimsEmail, repName, repPhone, repEmail, shippingMethod, dedicatedShippingDay, notes,
            defaultMarkup || null, pricingMethod || null,
            id
        ];
        const result = await pool.query(query, values);
        const updatedVendor = toCamelCase(result.rows[0]);
        await logActivity(userId, 'UPDATE', 'VENDOR', id, { before: beforeData, after: updatedVendor });
        res.json(updatedVendor);
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ error: 'Failed to update vendor.' });
    }
});

// GET /api/vendors/:id/history (Unchanged)
router.get('/:id/history', verifySession(), async (req, res) => {
    const { id } = req.params;
    try {
        const query = `
            SELECT 
                al.*,
                ep.email AS user_email
            FROM activity_log al
            LEFT JOIN emailpassword_users ep ON al.user_id = ep.user_id
            WHERE al.target_entity = 'VENDOR' AND al.target_id = $1
            ORDER BY al.created_at DESC;
        `;
        const result = await pool.query(query, [id]);
        res.json(result.rows.map(toCamelCase));
    } catch (err) {
        console.error("Error retrieving vendor history:", err.message);
        res.status(500).json({ error: "Internal server error retrieving vendor history" });
    }
});

// DELETE /api/vendors/:id (Unchanged)
router.delete('/:id', verifySession(), verifyRole('Admin'), async (req, res) => {
    const { id } = req.params;
    const userId = req.session.getUserId();
    try {
        const vendorToDelete = await pool.query('SELECT * FROM vendors WHERE id = $1', [id]);
        if (vendorToDelete.rows.length === 0) {
            return res.status(404).json({ error: 'Vendor not found.' });
        }
        const deletedData = toCamelCase(vendorToDelete.rows[0]);
        await pool.query('DELETE FROM vendors WHERE id = $1', [id]);
        await logActivity(userId, 'DELETE', 'VENDOR', id, { deletedData });
        res.status(204).send();
    } catch (err) {
        console.error(err.message);
        if (err.code === '23503') { // Foreign key violation
             return res.status(409).json({ error: 'Cannot delete vendor because it is currently in use by a product, sample, or material order.' });
        }
        res.status(500).json({ error: 'Failed to delete vendor.' });
    }
});

export default router;