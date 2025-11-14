// server/routes/roles.js

import express from 'express';
import pool from '../db.js';
import { toCamelCase, verifyRole } from '../utils.js';
import { verifySession } from 'supertokens-node/recipe/session/framework/express/index.js';

const router = express.Router();

// GET /api/roles - Fetch all available roles (Admin only)
// Only admins should need to know about the list of roles they can assign.
router.get('/', verifySession(), verifyRole('Admin'), async (req, res) => {
    try {
        const result = await pool.query('SELECT id, name, description FROM app_roles ORDER BY name ASC');
        res.json(result.rows.map(toCamelCase));
    } catch (err) {
        console.error("Error fetching roles:", err.message);
        res.status(500).json({ error: 'Internal server error' });
    }
});

export default router;