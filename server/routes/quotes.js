import express from 'express';
import pool from '../db.js';
import { toCamelCase } from '../utils.js';

const router = express.Router();

// GET /api/quotes
router.get('/', async (req, res) => {
    try {
        // --- MODIFICATION: Added installation_type to the SELECT statement ---
        const result = await pool.query('SELECT *, installation_type FROM quotes ORDER BY date_sent DESC');
        res.json(result.rows.map(toCamelCase));
    } catch (err) { console.error(err.message); res.status(500).json({ error: 'Internal server error' }); }
});

// GET /api/quotes/:id
router.get('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        // --- MODIFICATION: Added installation_type to the SELECT statement ---
        const result = await pool.query('SELECT *, installation_type FROM quotes WHERE id = $1', [id]);
        if (result.rows.length === 0) { return res.status(404).json({ error: 'Quote not found' }); }
        res.json(toCamelCase(result.rows[0]));
    } catch (err) { console.error(err.message); res.status(500).json({ error: 'Internal server error' }); }
});

// POST /api/quotes
router.post('/', async (req, res) => {
    try {
        // --- MODIFICATION: Destructure the new installationType field ---
        let { projectId, installerId, installationType, quoteDetails, materialsAmount, laborAmount, installerMarkup, laborDepositPercentage, status } = req.body;

        // --- MODIFICATION: Enforce business rules based on installationType ---
        if (installationType === 'Materials Only Sale') {
            installerId = null;
            laborAmount = null;
            laborDepositPercentage = null;
        }

        const result = await pool.query(
            `INSERT INTO quotes (project_id, installer_id, installation_type, quote_details, materials_amount, labor_amount, installer_markup, labor_deposit_percentage, date_sent, status) 
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, CURRENT_TIMESTAMP, $9) RETURNING *`, 
            [projectId, installerId, installationType, quoteDetails, materialsAmount, laborAmount, installerMarkup, laborDepositPercentage, status]
        );
        res.status(201).json(toCamelCase(result.rows[0]));
    } catch (err) { 
        console.error(err.message); 
        res.status(500).json({ error: 'Internal server error' }); 
    }
});

// PUT /api/quotes/:id
router.put('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        // --- MODIFICATION: Destructure the new installationType field ---
        let { installerId, installationType, quoteDetails, materialsAmount, laborAmount, installerMarkup, laborDepositPercentage, status } = req.body;
        
        const fields = [];
        const values = [];
        let query = 'UPDATE quotes SET ';

        // --- MODIFICATION: Enforce business rules before building the query ---
        if (installationType === 'Materials Only Sale') {
            installerId = null;
            laborAmount = null;
            laborDepositPercentage = null;
        }

        if (installerId !== undefined) { fields.push(`installer_id = $${fields.length + 1}`); values.push(installerId); }
        if (installationType !== undefined) { fields.push(`installation_type = $${fields.length + 1}`); values.push(installationType); }
        if (quoteDetails !== undefined) { fields.push(`quote_details = $${fields.length + 1}`); values.push(quoteDetails); }
        if (materialsAmount !== undefined) { fields.push(`materials_amount = $${fields.length + 1}`); values.push(materialsAmount); }
        if (laborAmount !== undefined) { fields.push(`labor_amount = $${fields.length + 1}`); values.push(laborAmount); }
        if (installerMarkup !== undefined) { fields.push(`installer_markup = $${fields.length + 1}`); values.push(installerMarkup); }
        if (laborDepositPercentage !== undefined) { fields.push(`labor_deposit_percentage = $${fields.length + 1}`); values.push(laborDepositPercentage); }
        if (status !== undefined) { fields.push(`status = $${fields.length + 1}`); values.push(status); }

        if (fields.length === 0) {
            return res.status(400).json({ error: 'No fields to update provided.' });
        }

        query += fields.join(', ');
        query += ` WHERE id = $${fields.length + 1} RETURNING *`;
        values.push(id);
        
        const result = await pool.query(query, values);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Quote not found' });
        }
        res.json(toCamelCase(result.rows[0]));
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ error: 'Internal server error' });
    }
});

export default router;