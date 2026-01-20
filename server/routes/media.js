import express from 'express';
import pool from '../db.js';
import { verifySession } from 'supertokens-node/recipe/session/framework/express/index.js';
import { verifyRole, toCamelCase, logActivity } from '../utils.js';
import multer from 'multer';
import path from 'path';
import fs from 'fs-extra';
import { fileURLToPath } from 'url';
import { processImage } from '../lib/imageProcessor.js';

const router = express.Router();

// --- MULTER UPLOAD CONFIG ---
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const uploadRoot = process.env.NODE_ENV === 'production' 
    ? '/app/server/uploads' 
    : path.join(__dirname, '../uploads');
const tempUploadsDir = path.join(uploadRoot, '../temp-uploads');
fs.ensureDirSync(tempUploadsDir);

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, tempUploadsDir),
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, `temp-${uniqueSuffix}${path.extname(file.originalname)}`);
    }
});
const upload = multer({ storage });


// GET /api/media - Fetch all media assets with usage counts
router.get('/', verifySession(), verifyRole('Admin'), async (req, res) => {
    try {
        const query = `
            WITH all_paths AS (
                SELECT default_image_url AS path FROM products WHERE default_image_url IS NOT NULL
                UNION ALL
                SELECT default_thumbnail_url AS path FROM products WHERE default_thumbnail_url IS NOT NULL
                UNION ALL
                SELECT image_url AS path FROM product_variants WHERE image_url IS NOT NULL
                UNION ALL
                SELECT thumbnail_url AS path FROM product_variants WHERE thumbnail_url IS NOT NULL
                UNION ALL
                SELECT url AS path FROM photos WHERE url IS NOT NULL
                UNION ALL
                SELECT avatar_url AS path FROM user_profiles WHERE avatar_url IS NOT NULL
                UNION ALL
                SELECT settings->>'logoUrl' AS path FROM system_preferences WHERE key = 'branding' AND settings->>'logoUrl' IS NOT NULL
                UNION ALL
                SELECT settings->>'faviconUrl' AS path FROM system_preferences WHERE key = 'branding' AND settings->>'faviconUrl' IS NOT NULL
            ),
            path_counts AS (
                SELECT path, COUNT(*) as count FROM all_paths GROUP BY path
            )
            SELECT 
                ma.id,
                ma.file_path,
                ma.thumbnail_path,
                ma.file_type,
                ma.category,
                ma.created_at,
                COALESCE(pc.count, 0)::int as "usageCount"
            FROM 
                media_assets ma
            LEFT JOIN 
                path_counts pc ON ma.file_path = pc.path
            ORDER BY 
                ma.created_at DESC;
        `;
        const result = await pool.query(query);
        res.json(result.rows.map(toCamelCase));
    } catch (err) {
        console.error('Error fetching media assets:', err.message);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// POST /api/media - Upload a new media asset
router.post('/', verifySession(), verifyRole('Admin'), upload.single('file'), async (req, res) => {
    const userId = req.session.getUserId();
    const { category } = req.body;
    const file = req.file;

    if (!file || !category) {
        return res.status(400).json({ error: 'File and category are required.' });
    }

    try {
        let imageResults = { 
            imageUrl: `/uploads/${category}/${path.basename(file.path)}`, // Default for non-images
            thumbnailUrl: null 
        };

        // If it's an image, process it to generate a thumbnail
        if (file.mimetype.startsWith('image/')) {
            imageResults = await processImage(file, category, 'media');
        } else {
            // For non-images (PDFs, etc.), just move the file to its final destination
            const finalPath = path.join(uploadRoot, category, path.basename(file.path));
            await fs.move(file.path, finalPath);
        }

        const query = `
            INSERT INTO media_assets (file_path, thumbnail_path, file_type, category, uploaded_by)
            VALUES ($1, $2, $3, $4, $5)
            RETURNING *;
        `;
        const result = await pool.query(query, [
            imageResults.imageUrl,
            imageResults.thumbnailUrl,
            file.mimetype,
            category,
            userId
        ]);
        
        const newAsset = result.rows[0];
        await logActivity(userId, 'CREATE', 'MEDIA_ASSET', newAsset.id, { category, path: newAsset.file_path });

        // Return the newly created asset with a usage count of 0
        res.status(201).json({ ...toCamelCase(newAsset), usageCount: 0 });

    } catch (err) {
        console.error('Error uploading media asset:', err.message);
        // Ensure temp file is cleaned up on error
        if (file) await fs.remove(file.path).catch(console.error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// DELETE /api/media/:id - Delete a media asset
router.delete('/:id', verifySession(), verifyRole('Admin'), async (req, res) => {
    const userId = req.session.getUserId();
    const { id } = req.params;

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // Step 1: Get the asset details
        const assetRes = await client.query('SELECT * FROM media_assets WHERE id = $1', [id]);
        if (assetRes.rows.length === 0) {
            return res.status(404).json({ error: 'Asset not found.' });
        }
        const asset = assetRes.rows[0];

        // Step 2: Check usage count
        const usageQuery = `
            SELECT COUNT(*)::int FROM (
                SELECT default_image_url AS path FROM products WHERE default_image_url = $1
                UNION ALL
                SELECT image_url AS path FROM product_variants WHERE image_url = $1
                UNION ALL
                SELECT url AS path FROM photos WHERE url = $1
                UNION ALL
                SELECT avatar_url AS path FROM user_profiles WHERE avatar_url = $1
                UNION ALL
                SELECT settings->>'logoUrl' AS path FROM system_preferences WHERE key = 'branding' AND settings->>'logoUrl' = $1
                UNION ALL
                SELECT settings->>'faviconUrl' AS path FROM system_preferences WHERE key = 'branding' AND settings->>'faviconUrl' = $1
            ) as usages;
        `;
        const usageRes = await client.query(usageQuery, [asset.file_path]);
        const usageCount = usageRes.rows[0].count;

        if (usageCount > 0) {
            return res.status(409).json({ error: `Cannot delete: Asset is currently in use by ${usageCount} record(s).` });
        }

        // Step 3: Delete from database
        await client.query('DELETE FROM media_assets WHERE id = $1', [id]);
        
        // Step 4: Log the deletion
        await logActivity(userId, 'DELETE', 'MEDIA_ASSET', id, { path: asset.file_path }, client);
        
        // Step 5: Commit the transaction
        await client.query('COMMIT');

        // Step 6: After successful commit, delete files from disk
        if (asset.file_path) {
            const fullPath = path.join(uploadRoot, '..', asset.file_path); // Navigate up from /routes
            await fs.remove(fullPath).catch(err => console.error(`Failed to delete main file: ${fullPath}`, err));
        }
        if (asset.thumbnail_path) {
            const fullThumbPath = path.join(uploadRoot, '..', asset.thumbnail_path);
            await fs.remove(fullThumbPath).catch(err => console.error(`Failed to delete thumbnail: ${fullThumbPath}`, err));
        }

        res.status(204).send();

    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Error deleting media asset:', err.message);
        res.status(500).json({ error: 'Internal server error' });
    } finally {
        client.release();
    }
});

export default router;