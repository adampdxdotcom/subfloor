import express from 'express';
import pool from '../db.js';
// --- MODIFIED: Imported logActivity and verifyRole for the new delete route ---
import { toCamelCase, logActivity, verifyRole } from '../utils.js';
import { verifySession } from 'supertokens-node/recipe/session/framework/express/index.js';

const router = express.Router();

// GET /api/change-orders
router.get('/', verifySession(), async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM change_orders ORDER BY created_at ASC');
        res.json(result.rows.map(toCamelCase));
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// POST /api/change-orders
router.post('/', verifySession(), async (req, res) => {
    try {
        const { projectId, quoteId, description, amount, type } = req.body;
        if (!projectId || !description || amount === undefined || !type) {
            return res.status(400).json({ error: 'projectId, description, amount, and type are required.' });
        }
        const result = await pool.query(
            'INSERT INTO change_orders (project_id, quote_id, description, amount, type) VALUES ($1, $2, $3, $4, $5) RETURNING *',
            [projectId, quoteId, description, amount, type]
        );
        res.status(201).json(toCamelCase(result.rows[0]));
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// PUT /api/change-orders/:id
router.put('/:id', verifySession(), async (req, res) => {
    try {
        const { id } = req.params;
        const { description, amount, type, quoteId } = req.body;

        if (!description || amount === undefined || !type) {
            return res.status(400).json({ error: 'Description, amount, and type are required.' });
        }

        const result = await pool.query(
            'UPDATE change_orders SET description = $1, amount = $2, type = $3, quote_id = $4 WHERE id = $5 RETURNING *',
            [description, amount, type, quoteId, id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Change order not found' });
        }

        res.json(toCamelCase(result.rows[0]));
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// --- ADDED: A new secure DELETE endpoint for change orders ---
router.delete('/:id', verifySession(), verifyRole('Admin'), async (req, res) => {
    const { id } = req.params;
    const client = await pool.connect();
    const userId = req.session.getUserId();

    try {
        await client.query('BEGIN');

        // --- AUDIT LOG: Get the data *before* deleting it ---
        const beforeResult = await client.query('SELECT * FROM change_orders WHERE id = $1', [id]);
        if (beforeResult.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Change order not found' });
        }
        const deletedData = toCamelCase(beforeResult.rows[0]);

        // Perform the deletion
        await client.query('DELETE FROM change_orders WHERE id = $1', [id]);

        // --- AUDIT LOG: Log the deletion action ---
        await logActivity(userId, 'DELETE', 'CHANGE_ORDER', id, { deletedData });

        await client.query('COMMIT');
        res.status(204).send(); // Success, no content
    } catch (err) {
        await client.query('ROLLBACK');
        console.error(`Failed to delete change order ${id}:`, err.message);
        res.status(500).json({ error: 'Internal server error' });
    } finally {
        client.release();
    }
});

export default router;