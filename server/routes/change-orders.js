import express from 'express';
import pool from '../db.js';
import { toCamelCase } from '../utils.js';
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
        const { projectId, description, amount, type } = req.body;
        if (!projectId || !description || amount === undefined || !type) {
            return res.status(400).json({ error: 'projectId, description, amount, and type are required.' });
        }
        const result = await pool.query(
            'INSERT INTO change_orders (project_id, description, amount, type) VALUES ($1, $2, $3, $4) RETURNING *',
            [projectId, description, amount, type]
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
        const { description, amount, type } = req.body;

        if (!description || amount === undefined || !type) {
            return res.status(400).json({ error: 'Description, amount, and type are required.' });
        }

        const result = await pool.query(
            'UPDATE change_orders SET description = $1, amount = $2, type = $3 WHERE id = $4 RETURNING *',
            [description, amount, type, id]
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

export default router;