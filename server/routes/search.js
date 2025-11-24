import express from 'express';
import pool from '../db.js';
import { verifySession } from 'supertokens-node/recipe/session/framework/express/index.js';

const router = express.Router();

// GET /api/search?q=<search_term>
router.get('/', verifySession(), async (req, res) => {
    const searchTerm = req.query.q;

    if (!searchTerm || typeof searchTerm !== 'string' || searchTerm.length < 2) {
        return res.json({ customers: [], installers: [], projects: [], products: [] });
    }

    const searchQuery = `%${searchTerm.toLowerCase()}%`;

    try {
        // --- NEW: Product Search (Inventory 2.0) ---
        // We use DISTINCT ON to avoid returning the same product 10 times if 10 variants match
        const productsQuery = `
            SELECT DISTINCT ON (p.id)
                'product' AS type,
                p.id, -- UUID
                p.name AS title,
                v.name AS subtitle,
                -- If the search matched a specific variant SKU or name, we could try to highlight that,
                -- but for a simple search, pointing to the parent Product is correct.
                '/samples' AS path -- Logic on frontend will open the modal
            FROM products p
            LEFT JOIN vendors v ON p.manufacturer_id = v.id
            LEFT JOIN product_variants pv ON p.id = pv.product_id
            WHERE 
                p.is_discontinued = FALSE AND (
                    LOWER(p.name) LIKE $1 OR 
                    LOWER(v.name) LIKE $1 OR
                    LOWER(pv.name) LIKE $1 OR
                    LOWER(pv.sku) LIKE $1
                )
            LIMIT 10;
        `;
        
        const customersQuery = `
            SELECT 'customer' AS type, id, full_name AS title, email AS subtitle, '/customers/' || id as path
            FROM customers
            WHERE LOWER(full_name) LIKE $1 OR LOWER(email) LIKE $1;
        `;

        const installersQuery = `
            SELECT 'installer' AS type, id, installer_name AS title, contact_email AS subtitle, '/installers/' || id as path
            FROM installers
            WHERE LOWER(installer_name) LIKE $1;
        `;

        const projectsQuery = `
            SELECT 'project' AS type, p.id, p.project_name AS title, c.full_name AS subtitle, '/projects/' || p.id as path
            FROM projects p
            JOIN customers c ON p.customer_id = c.id
            WHERE LOWER(p.project_name) LIKE $1
            UNION
            SELECT 'project' AS type, p.id, p.project_name AS title, 'PO: ' || j.po_number AS subtitle, '/projects/' || p.id as path
            FROM jobs j
            JOIN projects p ON j.project_id = p.id
            WHERE LOWER(j.po_number) LIKE $1;
        `;

        const [
            productsResult,
            customersResult,
            installersResult,
            projectsResult
        ] = await Promise.all([
            pool.query(productsQuery, [searchQuery]),
            pool.query(customersQuery, [searchQuery]),
            pool.query(installersQuery, [searchQuery]),
            pool.query(projectsQuery, [searchQuery])
        ]);

        const results = {
            products: productsResult.rows, // Renamed from samples
            customers: customersResult.rows,
            installers: installersResult.rows,
            projects: projectsResult.rows,
        };

        res.json(results);

    } catch (err) {
        console.error('Search query failed:', err.message);
        res.status(500).json({ error: 'Internal server error' });
    }
});

export default router;