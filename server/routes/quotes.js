import express from 'express';
import pool from '../db.js';
import { toCamelCase } from '../utils.js';
import { verifySession } from 'supertokens-node/recipe/session/framework/express/index.js';

const router = express.Router();

// GET /api/quotes
router.get('/', verifySession(), async (req, res) => {
    try {
        const result = await pool.query('SELECT *, installation_type FROM quotes ORDER BY date_sent DESC');
        res.json(result.rows.map(toCamelCase));
    } catch (err) { console.error(err.message); res.status(500).json({ error: 'Internal server error' }); }
});

// GET /api/quotes/:id
router.get('/:id', verifySession(), async (req, res) => {
    try {
        const { id } = req.params;
        const result = await pool.query('SELECT *, installation_type FROM quotes WHERE id = $1', [id]);
        if (result.rows.length === 0) { return res.status(404).json({ error: 'Quote not found' }); }
        res.json(toCamelCase(result.rows[0]));
    } catch (err) { console.error(err.message); res.status(500).json({ error: 'Internal server error' }); }
});

// POST /api/quotes
router.post('/', verifySession(), async (req, res) => {
    try {
        let { projectId, installerId, installationType, quoteDetails, materialsAmount, laborAmount, installerMarkup, laborDepositPercentage, status } = req.body;

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

// <<< START OF MODIFICATION >>>

// PUT /api/quotes/:id/accept - New dedicated endpoint for accepting a quote
router.put('/:id/accept', verifySession(), async (req, res) => {
    const { id } = req.params;
    const client = await pool.connect();
    
    try {
        await client.query('BEGIN');

        // Step 1: Update the quote's status to 'Accepted'
        const quoteUpdateResult = await client.query(
            `UPDATE quotes SET status = 'Accepted' WHERE id = $1 RETURNING *`,
            [id]
        );

        if (quoteUpdateResult.rows.length === 0) {
            throw new Error('Quote not found');
        }

        const updatedQuote = quoteUpdateResult.rows[0];
        const projectId = updatedQuote.project_id;

        // Step 2: Update the project's status to 'Accepted'
        const projectUpdateResult = await client.query(
            `UPDATE projects SET status = 'Accepted' WHERE id = $1 RETURNING *`,
            [projectId]
        );

        if (projectUpdateResult.rows.length === 0) {
            throw new Error('Project not found');
        }

        const updatedProject = projectUpdateResult.rows[0];

        // Step 3: Create a placeholder job entry for this project if one doesn't exist
        const jobCheck = await client.query('SELECT id FROM jobs WHERE project_id = $1', [projectId]);
        if (jobCheck.rows.length === 0) {
            let depositAmount = parseFloat(updatedQuote.materials_amount) || 0;
            if (updatedQuote.installation_type === 'Managed Installation') {
                const labor = parseFloat(updatedQuote.labor_amount) || 0;
                const percent = parseFloat(updatedQuote.labor_deposit_percentage) || 0;
                depositAmount += (labor * (percent / 100));
            }
            await client.query(
                'INSERT INTO jobs (project_id, deposit_amount) VALUES ($1, $2)',
                [projectId, depositAmount]
            );
        }

        await client.query('COMMIT');
        
        // Step 4: Send back both updated objects
        res.json({ 
            updatedQuote: toCamelCase(updatedQuote), 
            updatedProject: toCamelCase(updatedProject) 
        });

    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Error in accept quote transaction:', err.message);
        res.status(500).json({ error: 'Internal server error while accepting quote.' });
    } finally {
        client.release();
    }
});

// <<< END OF MODIFICATION >>>

// PUT /api/quotes/:id
router.put('/:id', verifySession(), async (req, res) => {
    try {
        const { id } = req.params;
        let { installerId, installationType, quoteDetails, materialsAmount, laborAmount, installerMarkup, laborDepositPercentage, status } = req.body;
        
        const fields = [];
        const values = [];
        let query = 'UPDATE quotes SET ';

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