import express from 'express';
import pool from '../db.js';
import { verifySession } from 'supertokens-node/recipe/session/framework/express/index.js';

const router = express.Router();

// GET /api/search?q=<search_term>
router.get('/', verifySession(), async (req, res) => {
    const searchTerm = req.query.q;

    if (!searchTerm || typeof searchTerm !== 'string' || searchTerm.length < 2) {
        return res.json({ customers: [], installers: [], projects: [], samples: [] });
    }

    const searchQuery = `%${searchTerm.toLowerCase()}%`;

    try {
        // --- MODIFIED: The Sample search query is updated to include searching by size ---
        const samplesQuery = `
            -- First, find samples where style, color, manufacturer, or product type match
            SELECT 
                'sample' AS type, 
                s.id, 
                CONCAT_WS(' - ', NULLIF(s.style, ''), NULLIF(s.color, '')) AS title, 
                m.name AS subtitle, 
                '/samples' as path
            FROM samples s
            LEFT JOIN vendors m ON s.manufacturer_id = m.id
            WHERE 
                (LOWER(s.style) LIKE $1 OR 
                 LOWER(s.color) LIKE $1 OR 
                 LOWER(m.name) LIKE $1 OR
                 LOWER(s.product_type) LIKE $1)
                AND s.is_discontinued = FALSE
            
            UNION
            
            -- Second, find samples where a size matches the search term
            SELECT 
                'sample' AS type, 
                s.id,
                CONCAT_WS(' - ', NULLIF(s.style, ''), NULLIF(s.color, '')) AS title,
                -- Use the matched size as the subtitle for better context
                'Size: ' || ss.size_value AS subtitle, 
                '/samples' as path
            FROM sample_sizes ss
            JOIN samples s ON ss.sample_id = s.id
            WHERE LOWER(ss.size_value) LIKE $1
            AND s.is_discontinued = FALSE;
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
            samplesResult,
            customersResult,
            installersResult,
            projectsResult
        ] = await Promise.all([
            pool.query(samplesQuery, [searchQuery]),
            pool.query(customersQuery, [searchQuery]),
            pool.query(installersQuery, [searchQuery]),
            pool.query(projectsQuery, [searchQuery])
        ]);

        const results = {
            samples: samplesResult.rows,
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