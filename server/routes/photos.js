import express from 'express';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import pool from '../db.js';
import { toCamelCase } from '../utils.js';
import { verifySession } from 'supertokens-node/recipe/session/framework/express/index.js';
import { processImage, downloadAndProcessImage } from '../lib/imageProcessor.js';

const router = express.Router();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// FIX: Enforce absolute path in production
const uploadRoot = process.env.NODE_ENV === 'production' 
    ? '/app/server/uploads' 
    : path.join(__dirname, '../uploads');

// Multer Config (Temp Storage)
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadRoot),
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, `temp-${uniqueSuffix}${path.extname(file.originalname)}`);
  }
});
const upload = multer({ storage });

// GET /api/photos/:entityType/:entityId - Fetch all photos for an entity
router.get('/:entityType/:entityId', verifySession(), async (req, res) => {
    const { entityType, entityId } = req.params;
    try {
        const result = await pool.query(
            'SELECT * FROM photos WHERE entity_type = $1 AND entity_id = $2 ORDER BY created_at DESC', 
            [entityType, entityId]
        );
        res.json(result.rows.map(toCamelCase));
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to fetch photos' });
    }
});

// POST /api/photos - Upload one or more photos
router.post('/', verifySession(), upload.array('photos', 10), async (req, res) => {
    const { entityType, entityId, category } = req.body;
    
    if (!req.files || req.files.length === 0) {
        return res.status(400).json({ error: 'No files uploaded.' });
    }
    if (!entityType || !entityId) {
        return res.status(400).json({ error: 'entityType and entityId are required.' });
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        
        const savedPhotos = [];
        
        // Loop through all uploaded files
        for (const file of req.files) {
            // Process: Resize & Move
            // We use 'jobs' as the default folder for general project photos
            const folder = entityType === 'PROJECT' ? 'jobs' : 'misc';
            // Use the provided category (e.g. 'DOCUMENT') or default to 'SITE'
            const fileCategory = category || 'SITE';
            
            const { imageUrl, thumbnailUrl, fileName, mimeType } = await processImage(file, folder, 'file');

            if (imageUrl) {
                const result = await client.query(
                    'INSERT INTO photos (url, thumbnail_url, file_name, mime_type, category, entity_type, entity_id) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *',
                    [imageUrl, thumbnailUrl, fileName, mimeType, fileCategory, entityType, entityId]
                );
                savedPhotos.push(toCamelCase(result.rows[0]));
            }
        }
        
        await client.query('COMMIT');
        res.status(201).json(savedPhotos);
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Photo upload error:', err.message);
        res.status(500).json({ error: 'Database error during photo upload.' });
    } finally {
        client.release();
    }
});

// DELETE /api/photos/:id - Delete a photo
router.delete('/:id', verifySession(), async (req, res) => {
    const { id } = req.params;
    try {
        // Optional: Fetch URL here to delete from disk if strict cleanup is required
        await pool.query('DELETE FROM photos WHERE id = $1', [id]);
        res.status(204).send();
    } catch (err) {
        console.error('Delete photo error:', err);
        res.status(500).json({ error: 'Failed to delete photo' });
    }
});

export default router;