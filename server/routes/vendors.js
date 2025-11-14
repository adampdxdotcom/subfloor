import express from 'express';
import pool from '../db.js';
import { toCamelCase } from '../utils.js';
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
        res.status(201).json(toCamelCase(result.rows[0]));
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ error: 'Failed to create vendor.' });
    }
});

// PUT (update) a vendor
router.put('/:id', verifySession(), async (req, res) => {
    const { id } = req.params;
    const { 
        name, isManufacturer, isSupplier, phone, address, orderingEmail, 
        claimsEmail, repName, repPhone, repEmail, shippingMethod, dedicatedShippingDay, notes 
    } = req.body;

    if (!name) {
        return res.status(400).json({ error: 'Vendor name is required.' });
    }

    try {
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
        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'Vendor not found.' });
        }
        res.json(toCamelCase(result.rows[0]));
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ error: 'Failed to update vendor.' });
    }
});

// DELETE a vendor
router.delete('/:id', verifySession(), async (req, res) => {
    const { id } = req.params;
    try {
        const result = await pool.query('DELETE FROM vendors WHERE id = $1', [id]);
        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'Vendor not found.' });
        }
        res.status(204).send();
    } catch (err) {
        console.error(err.message);
        if (err.code === '23503') {
             return res.status(409).json({ error: 'Cannot delete vendor because it is currently in use by a sample or material order.' });
        }
        res.status(500).json({ error: 'Failed to delete vendor.' });
    }
});

export default router;