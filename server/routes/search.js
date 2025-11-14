import express from 'express';
import pool from '../db.js';
import { verifySession } from 'supertokens-node/recipe/session/framework/express/index.js';

const router = express.Router();

// GET /api/search?q=<search_term>
router.get('/', verifySession(), async (req, res) => {
    const searchTerm = req.query.q;

    if (!searchTerm || typeof searchTerm !== 'string' || searchTerm.length < 2) {
        return res.json([]);
    }

    const searchQuery = `%${searchTerm}%`;

    try {
        const query = `
            -- Search Customers by name
            SELECT 'customer' AS type, id, full_name AS title, email AS subtitle, '/customers/' || id as path
            FROM customers
            WHERE full_name ILIKE $1 OR email ILIKE $1

            UNION ALL

            -- Search Installers by name
            SELECT 'installer' AS type, id, installer_name AS title, contact_email AS subtitle, '/installers/' || id as path
            FROM installers
            WHERE installer_name ILIKE $1

            UNION ALL

            -- Search Projects by name
            SELECT 'project' AS type, p.id, p.project_name AS title, c.full_name AS subtitle, '/projects/' || p.id as path
            FROM projects p
            JOIN customers c ON p.customer_id = c.id
            WHERE p.project_name ILIKE $1

            UNION ALL

            -- Search Projects by PO Number
            SELECT 'project' AS type, p.id, p.project_name AS title, 'PO: ' || j.po_number AS subtitle, '/projects/' || p.id as path
            FROM jobs j
            JOIN projects p ON j.project_id = p.id
            WHERE j.po_number ILIKE $1

            UNION ALL

            -- Search Samples by style/color or manufacturer name
            SELECT 'sample' AS type, s.id, s.style_color AS title, m.name AS subtitle, '/samples' as path
            FROM samples s
            LEFT JOIN vendors m ON s.manufacturer_id = m.id
            WHERE s.style_color ILIKE $1 OR m.name ILIKE $1;
        `;
        
        const result = await pool.query(query, [searchQuery]);
        res.json(result.rows);

    } catch (err) {
        console.error('Search query failed:', err.message);
        res.status(500).json({ error: 'Internal server error' });
    }
});

export default router;