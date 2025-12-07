// server/routes/kb.js

import express from 'express';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import pool from '../db.js';
import { verifySession } from 'supertokens-node/recipe/session/framework/express/index.js';
import { verifyRole, toCamelCase } from '../utils.js';
import { processImage } from '../lib/imageProcessor.js';

const router = express.Router();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const uploadRoot = path.join(__dirname, '../uploads');

// Multer for Temp Storage
const upload = multer({ 
    storage: multer.diskStorage({
        destination: (req, file, cb) => cb(null, uploadRoot),
        filename: (req, file, cb) => cb(null, `temp-${Date.now()}-${file.originalname}`)
    }) 
});

// --- HELPER: Index Headers for Deep Search ---
const indexArticleSections = async (client, articleId, htmlContent) => {
    // Regex to find headers with IDs: <h[1-3] id="slug">Title</h...>
    const regex = /<h[1-3][^>]*id="([^"]*)"[^>]*>(.*?)<\/h[1-3]>/g;
    let match;
    
    // 1. Clear old sections
    await client.query('DELETE FROM kb_article_sections WHERE article_id = $1', [articleId]);

    // 2. Scan and Insert new ones
    while ((match = regex.exec(htmlContent)) !== null) {
        const anchorId = match[1];
        // Strip any inner HTML tags from the title text (clean text)
        const headerText = match[2].replace(/<[^>]*>?/gm, '');
        
        if (anchorId && headerText) {
            await client.query('INSERT INTO kb_article_sections (article_id, header_text, anchor_id) VALUES ($1, $2, $3)', [articleId, headerText, anchorId]);
        }
    }
};

// --- CATEGORIES ---

// GET /api/kb/categories - Get all categories
router.get('/categories', verifySession(), async (req, res, next) => {
    try {
        // Fetch all and sort by sort_order
        const result = await pool.query('SELECT * FROM kb_categories ORDER BY sort_order ASC, name ASC');
        res.json(result.rows);
    } catch (err) { next(err); }
});

// POST /api/kb/categories - Create a category (Admin only)
router.post('/categories', verifySession(), verifyRole('Admin'), async (req, res, next) => {
    const { name, parentId } = req.body;
    try {
        const result = await pool.query(
            'INSERT INTO kb_categories (name, parent_id) VALUES ($1, $2) RETURNING *',
            [name, parentId || null]
        );
        res.json(result.rows[0]);
    } catch (err) { next(err); }
});

// --- ARTICLES ---

// GET /api/kb/search - Search articles
router.get('/search', verifySession(), async (req, res, next) => {
    const { q, cat } = req.query;
    
    try {
        let query, params;

        if (q) {
            // ADVANCED SEARCH: Combine Articles + Sections
            // Note: In V1 we just search Titles. To add Sections, we UNION the results.
            query = `
                SELECT id, title as label, 'article' as type, NULL as anchor FROM kb_articles WHERE title ILIKE $1
                UNION ALL
                SELECT article_id as id, header_text as label, 'section' as type, anchor_id as anchor FROM kb_article_sections WHERE header_text ILIKE $1
                LIMIT 20`;
            params = [`%${q}%`];
        } else if (cat) {
            // Category List
            query = `SELECT id, title, category_id, updated_at, tags FROM kb_articles WHERE category_id = $1 ORDER BY updated_at DESC`;
            params = [cat];
        } else {
            return res.json([]);
        }
        
        const result = await pool.query(query, params);
        res.json(result.rows);
    } catch (err) { next(err); }
});

// GET /api/kb/articles/:id - Get single article
router.get('/articles/:id', verifySession(), async (req, res, next) => {
    try {
        const { id } = req.params;
        const result = await pool.query(`
            SELECT a.*, 
                   u.first_name || ' ' || u.last_name as author_name,
                   c.name as category_name
            FROM kb_articles a
            LEFT JOIN user_profiles u ON a.author_id = u.user_id
            LEFT JOIN kb_categories c ON a.category_id = c.id
            WHERE a.id = $1
        `, [id]);
        
        if (result.rows.length === 0) return res.status(404).json({ message: "Article not found" });
        
        // Increment view count async (don't wait)
        pool.query('UPDATE kb_articles SET view_count = view_count + 1 WHERE id = $1', [id]);
        
        res.json(result.rows[0]);
    } catch (err) { next(err); }
});

// POST /api/kb/articles - Create Article (Admin Only)
router.post('/articles', verifySession(), verifyRole('Admin'), async (req, res, next) => {
    const { title, content, categoryId, tags, isPublished } = req.body;
    const authorId = req.session.getUserId();
    
    try {
        const result = await pool.query(
            `INSERT INTO kb_articles 
            (title, content, category_id, tags, is_published, author_id) 
            VALUES ($1, $2, $3, $4, $5, $6) 
            RETURNING *`,
            [title, content, categoryId || null, tags || [], isPublished ?? false, authorId]
        );
        
        // Index the headers
        // Note: For simplicity using the pool directly here (no transaction for indexing is okay, it's non-critical)
        // but ideally should be atomic.
        const client = await pool.connect();
        try {
            await indexArticleSections(client, result.rows[0].id, content);
        } finally {
            client.release();
        }
        
        res.json(result.rows[0]);
    } catch (err) { next(err); }
});

// PUT /api/kb/articles/:id - Update Article
router.put('/articles/:id', verifySession(), verifyRole('Admin'), async (req, res, next) => {
    const { id } = req.params;
    const { title, content, categoryId, tags, isPublished } = req.body;
    const userId = req.session.getUserId();

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // 1. Get current state for history
        const oldRes = await client.query('SELECT * FROM kb_articles WHERE id = $1', [id]);
        if (oldRes.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ message: "Article not found" });
        }
        const oldArticle = oldRes.rows[0];

        // 2. Log History
        await client.query(
            `INSERT INTO kb_history (article_id, user_id, change_summary, previous_content)
             VALUES ($1, $2, 'Updated article', $3)`,
            [id, userId, oldArticle.content]
        );

        // 3. Update
        const result = await client.query(
            `UPDATE kb_articles 
             SET title = $1, content = $2, category_id = $3, tags = $4, is_published = $5, updated_at = NOW()
             WHERE id = $6 RETURNING *`,
            [title, content, categoryId, tags, isPublished, id]
        );

        // Re-Index Headers
        await indexArticleSections(client, id, content);

        await client.query('COMMIT');
        res.json(result.rows[0]);
    } catch (err) {
        await client.query('ROLLBACK');
        next(err);
    } finally {
        client.release();
    }
});

// GET /api/kb/articles/:id/history - Get version history
router.get('/articles/:id/history', verifySession(), async (req, res, next) => {
    try {
        const { id } = req.params;
        const result = await pool.query(`
            SELECT h.id, h.created_at, h.change_summary, h.previous_content,
                   u.first_name || ' ' || u.last_name as author_name
            FROM kb_history h
            LEFT JOIN user_profiles u ON h.user_id = u.user_id
            WHERE h.article_id = $1
            ORDER BY h.created_at DESC
        `, [id]);
        res.json(result.rows.map(toCamelCase));
    } catch (err) { next(err); }
});

// --- ASSET MANAGEMENT (IMAGES) ---

// GET /api/kb/images - Get Global KB Asset Library
router.get('/images', verifySession(), async (req, res, next) => {
    const { source } = req.query; // 'KB' | 'PROJECT' | 'ALL'
    try {
        let query = `SELECT * FROM photos`;
        const params = [];
        
        if (source === 'KB') query += ` WHERE entity_type = 'KB'`;
        else if (source === 'PROJECT') query += ` WHERE entity_type = 'PROJECT'`;
        
        query += ` ORDER BY created_at DESC LIMIT 100`; // Safety limit
        
        const result = await pool.query(query, params);
        res.json(result.rows.map(toCamelCase));
    } catch (err) { next(err); }
});

// POST /api/kb/images - Upload New Asset
router.post('/images', verifySession(), verifyRole('Admin'), upload.single('file'), async (req, res, next) => {
    if (!req.file) return res.status(400).json({ message: "No file uploaded" });
    
    try {
        let assetData;
        if (req.file.mimetype.startsWith('image/')) {
            assetData = await processImage(req.file, 'misc', 'file');
        } else {
            // For non-images, we still run processImage assuming it handles them gracefully
            // or returns basic file metadata without image manipulation.
            assetData = await processImage(req.file, 'misc', 'file'); 
        }

        const { imageUrl, thumbnailUrl, fileName, mimeType } = assetData;
        if (!imageUrl) throw new Error("File processing failed");
        
        // We treat KB images as Global System Assets (entity_id = 0)
        const result = await pool.query(
            `INSERT INTO photos 
            (url, thumbnail_url, file_name, mime_type, category, entity_type, entity_id) 
            VALUES ($1, $2, $3, $4, 'ARTICLE_ASSET', 'KB', 0) 
            RETURNING *`,
            [imageUrl, thumbnailUrl, fileName, mimeType]
        );

        res.json(toCamelCase(result.rows[0]));
    } catch (err) { 
        next(err); 
    }
});

export default router;