// server/routes/vendors.js

import express from 'express';
import pool from '../db.js';
// vvvvvvvvvvvv MODIFIED: Imported the new verifyRole middleware vvvvvvvvvvvv
import { toCamelCase, logActivity, verifyRole } from '../utils.js';
// ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
import { verifySession } from 'supertokens-node/recipe/session/framework/express/index.js';

const router = express.Router();

// GET all vendors
router.get('/', verifySession(), async (req, res) => {
    try {
        const query = `
            SELECT 
                id, name, is_manufacturer, is_supplier, phone, address, 
                ordering_email, claims_email, rep_name, rep_phone, rep_email, 
                shipping_method, dedicated_shipping_day, notes
            FROM vendors 
            ORDER BY name ASC
        `;
        const result = await pool.query(query);
        res.json(result.rows.map(toCamelCase));
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// POST a new vendor
router.post('/', verifySession(), async (req, res) => {
    const userId = req.session.getUserId();
    const { 
        name, isManufacturer, isSupplier, phone, address, orderingEmail, 
        claimsEmail, repName, repPhone, repEmail, shippingMethod, dedicatedShippingDay, notes 
    } = req.body;

    if (!name) {
        return res.status(400).json({ error: 'Vendor name is required.' });
    }

    try {
        const query = `
            INSERT INTO vendors (
                name, is_manufacturer, is_supplier, phone, address, ordering_email, 
                claims_email, rep_name, rep_phone, rep_email, shipping_method, dedicated_shipping_day, notes
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
            RETURNING *;
        `;
        const values = [
            name, isManufacturer || false, isSupplier || false, phone, address, orderingEmail,
            claimsEmail, repName, repPhone, repEmail, shippingMethod, dedicatedShippingDay, notes
        ];
        const result = await pool.query(query, values);
        const newVendor = toCamelCase(result.rows[0]);
        await logActivity(userId, 'CREATE', 'VENDOR', newVendor.id, { createdData: newVendor });
        res.status(201).json(newVendor);
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ error: 'Failed to create vendor.' });
    }
});

// PUT (update) a vendor
router.put('/:id', verifySession(), async (req, res) => {
    const { id } = req.params;
    const userId = req.session.getUserId();
    const { 
        name, isManufacturer, isSupplier, phone, address, orderingEmail, 
        claimsEmail, repName, repPhone, repEmail, shippingMethod, dedicatedShippingDay, notes 
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
                name = $1, is_manufacturer = $2, is_supplier = $3, phone = $4, address = $5,
                ordering_email = $6, claims_email = $7, rep_name = $8, rep_phone = $9,
                rep_email = $10, shipping_method = $11, dedicated_shipping_day = $12, notes = $13
            WHERE id = $14
            RETURNING *;
        `;
        const values = [
            name, isManufacturer, isSupplier, phone, address, orderingEmail,
            claimsEmail, repName, repPhone, repEmail, shippingMethod, dedicatedShippingDay, notes,
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

// GET /api/vendors/:id/history
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

// =================================================================
//  SECURED DELETE ROUTE
// =================================================================
// vvvvvvvvvvvv MODIFIED: Added verifyRole('Admin') middleware vvvvvvvvvvvv
router.delete('/:id', verifySession(), verifyRole('Admin'), async (req, res) => {
// ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
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
             return res.status(409).json({ error: 'Cannot delete vendor because it is currently in use by a sample or material order.' });
        }
        res.status(500).json({ error: 'Failed to delete vendor.' });
    }
});

export default router;