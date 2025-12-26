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
        // We order by match quality so if a variant matches specifically, that variant's image/subtitle is used.
        const productsQuery = `
            SELECT DISTINCT ON (p.id)
                'product' AS type,
                p.id, -- UUID
                p.name AS title,
                CASE 
                    WHEN (LOWER(pv.name) LIKE $1 OR LOWER(pv.sku) LIKE $1) THEN pv.name 
                    ELSE v.name 
                END AS subtitle,
                CASE 
                    WHEN (LOWER(pv.name) LIKE $1 OR LOWER(pv.sku) LIKE $1) 
                    THEN COALESCE(pv.thumbnail_url, pv.image_url)
                    ELSE COALESCE(p.default_thumbnail_url, p.default_image_url)
                END AS image,
                '/samples' AS path
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
            ORDER BY p.id, (CASE WHEN (LOWER(pv.name) LIKE $1 OR LOWER(pv.sku) LIKE $1) THEN 0 ELSE 1 END)
            LIMIT 6;
        `;
        
        const customersQuery = `
            SELECT 'customer' AS type, id, full_name AS title, email AS subtitle, '/customers/' || id as path
            FROM customers
            WHERE LOWER(full_name) LIKE $1 OR LOWER(email) LIKE $1
            LIMIT 6;
        `;

        const installersQuery = `
            SELECT 'installer' AS type, id, installer_name AS title, contact_email AS subtitle, '/installers/' || id as path
            FROM installers
            WHERE LOWER(installer_name) LIKE $1
            LIMIT 6;
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
            WHERE LOWER(j.po_number) LIKE $1
            LIMIT 6;
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
            samples: productsResult.rows, // Mapped to 'samples' to match frontend icon logic
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