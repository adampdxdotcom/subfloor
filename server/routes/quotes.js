import express from 'express';
import pool from '../db.js';
import { toCamelCase, logActivity } from '../utils.js';
import { verifySession } from 'supertokens-node/recipe/session/framework/express/index.js';

const router = express.Router();

// ... (GET /, GET /:id, and POST / remain unchanged) ...

router.get('/', verifySession(), async (req, res) => {
    try {
        const result = await pool.query('SELECT *, installation_type FROM quotes ORDER BY date_sent DESC');
        res.json(result.rows.map(toCamelCase));
    } catch (err) { console.error(err.message); res.status(500).json({ error: 'Internal server error' }); }
});

router.get('/:id', verifySession(), async (req, res) => {
    try {
        const { id } = req.params;
        const result = await pool.query('SELECT *, installation_type FROM quotes WHERE id = $1', [id]);
        if (result.rows.length === 0) { return res.status(404).json({ error: 'Quote not found' }); }
        res.json(toCamelCase(result.rows[0]));
    } catch (err) { console.error(err.message); res.status(500).json({ error: 'Internal server error' }); }
});

router.post('/', verifySession(), async (req, res) => {
    const userId = req.session.getUserId();
    try {
        let { projectId, installerId, installationType, quoteDetails, materialsAmount, laborAmount, installerMarkup, laborDepositPercentage, status, poNumber } = req.body;

        if (installationType === 'Materials Only Sale') {
            installerId = null;
            laborAmount = null;
            laborDepositPercentage = null;
        }

        const result = await pool.query(
            `INSERT INTO quotes (project_id, installer_id, installation_type, quote_details, materials_amount, labor_amount, installer_markup, labor_deposit_percentage, date_sent, status, po_number) 
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, CURRENT_TIMESTAMP, $9, $10) RETURNING *`, 
            [projectId, installerId, installationType, quoteDetails, materialsAmount, laborAmount, installerMarkup, laborDepositPercentage, status, poNumber]
        );
        const newQuote = toCamelCase(result.rows[0]);

        // --- AUDIT LOG ---
        await logActivity(userId, 'CREATE', 'QUOTE', newQuote.id, { 
            projectId: String(projectId), 
            createdData: newQuote 
        });
        // --- END AUDIT LOG ---

        res.status(201).json(newQuote);
    } catch (err) { 
        console.error(err.message); 
        res.status(500).json({ error: 'Internal server error' }); 
    }
});


// PUT /api/quotes/:id/accept - New dedicated endpoint for accepting a quote
router.put('/:id/accept', verifySession(), async (req, res) => {
    const { id } = req.params;
    const userId = req.session.getUserId();
    const client = await pool.connect();
    
    try {
        await client.query('BEGIN');

        // Step 1: Update the quote's status to 'Accepted'
        const quoteUpdateResult = await client.query(
            `UPDATE quotes SET status = 'Accepted' WHERE id = $1 RETURNING *`,
            [id]
        );
        if (quoteUpdateResult.rows.length === 0) throw new Error('Quote not found');
        const updatedQuote = quoteUpdateResult.rows[0];
        const projectId = updatedQuote.project_id;

        // Step 2: Update the project's status to 'Accepted'
        const projectUpdateResult = await client.query(
            `UPDATE projects SET status = 'Accepted' WHERE id = $1 RETURNING *`,
            [projectId]
        );
        if (projectUpdateResult.rows.length === 0) throw new Error('Project not found');
        const updatedProject = projectUpdateResult.rows[0];

        // vvvvvvvvvvvv THE FIX IS HERE vvvvvvvvvvvv
        // Step 3: Create a placeholder job entry ONLY IF one doesn't already exist
        const jobCheck = await client.query('SELECT id FROM jobs WHERE project_id = $1', [projectId]);
        if (jobCheck.rows.length === 0) {
            let depositAmount = parseFloat(updatedQuote.materials_amount) || 0;
            // Only add labor deposit if it's a managed install
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
        // ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^

        // --- AUDIT LOG for this specific action ---
        await logActivity(userId, 'ACCEPT', 'QUOTE', id, { projectId: String(projectId) });
        // --- END AUDIT LOG ---

        await client.query('COMMIT');
        
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


// ... (PUT /:id and GET /project/:projectId/history remain unchanged) ...

router.put('/:id', verifySession(), async (req, res) => {
    const { id } = req.params;
    const userId = req.session.getUserId();

    try {
        // --- AUDIT LOG: Capture state *before* the update ---
        const beforeResult = await pool.query('SELECT * FROM quotes WHERE id = $1', [id]);
        if (beforeResult.rows.length === 0) {
            return res.status(404).json({ error: 'Quote not found' });
        }
        const beforeData = toCamelCase(beforeResult.rows[0]);
        // --- END AUDIT LOG ---

        let { installerId, installationType, quoteDetails, materialsAmount, laborAmount, installerMarkup, laborDepositPercentage, status, poNumber } = req.body;
        
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
        if (poNumber !== undefined) { fields.push(`po_number = $${fields.length + 1}`); values.push(poNumber); }

        if (fields.length === 0) return res.status(400).json({ error: 'No fields to update provided.' });

        query += fields.join(', ');
        query += ` WHERE id = $${fields.length + 1} RETURNING *`;
        values.push(id);
        
        const result = await pool.query(query, values);
        const updatedQuote = toCamelCase(result.rows[0]);

        // --- AUDIT LOG ---
        await logActivity(userId, 'UPDATE', 'QUOTE', id, { 
            projectId: String(updatedQuote.projectId),
            before: beforeData, 
            after: updatedQuote 
        });
        // --- END AUDIT LOG ---

        res.json(updatedQuote);
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.get('/project/:projectId/history', verifySession(), async (req, res) => {
    const { projectId } = req.params;
    try {
        const query = `
            SELECT 
                al.*,
                ep.email AS user_email
            FROM activity_log al
            LEFT JOIN emailpassword_users ep ON al.user_id = ep.user_id
            WHERE 
                al.target_entity = 'QUOTE' 
                AND al.details->>'projectId' = $1
            ORDER BY al.created_at DESC;
        `;
        const result = await pool.query(query, [projectId]);
        res.json(result.rows.map(toCamelCase));
    } catch (err) {
        console.error("Error retrieving quote history:", err.message);
        res.status(500).json({ error: "Internal server error retrieving quote history" });
    }
});


export default router;