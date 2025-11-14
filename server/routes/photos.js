import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import axios from 'axios';
import pool from '../db.js';
import { toCamelCase } from '../utils.js';
import { verifySession } from 'supertokens-node/recipe/session/framework/express/index.js';

const router = express.Router();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.resolve(path.dirname(__filename), '..');

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, path.join(__dirname, 'uploads')); 
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ storage: storage });

// POST /api/photos (Handles file upload from user's computer)
router.post('/', verifySession(), upload.single('photo'), async (req, res) => {
    const { entityType, entityId } = req.body;
    
    if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded.' });
    }
    if (!entityType || !entityId) {
        return res.status(400).json({ error: 'entityType and entityId are required.' });
    }

    const url = `/uploads/${req.file.filename}`;
    const client = await pool.connect();
    
    try {
        await client.query('BEGIN');
        
        await client.query('DELETE FROM photos WHERE entity_type = $1 AND entity_id = $2', [entityType, entityId]);
        
        const result = await client.query(
            'INSERT INTO photos (url, entity_type, entity_id) VALUES ($1, $2, $3) RETURNING *',
            [url, entityType, entityId]
        );
        
        await client.query('COMMIT');
        res.status(201).json(toCamelCase(result.rows[0]));
    } catch (err) {
        await client.query('ROLLBACK');
        console.error(err.message);
        res.status(500).json({ error: 'Database error during photo upload.' });
    } finally {
        client.release();
    }
});

// POST /api/photos/from-url (Handles importing an image from a URL)
router.post('/from-url', verifySession(), async (req, res) => {
    const { imageUrl, entityType, entityId } = req.body;

    if (!imageUrl || !entityType || !entityId) {
        return res.status(400).json({ error: 'imageUrl, entityType, and entityId are required.' });
    }

    try {
        const response = await axios({
            url: imageUrl,
            method: 'GET',
            responseType: 'stream'
        });

        const extension = path.extname(new URL(imageUrl).pathname) || '.jpg';
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const filename = `photo-${uniqueSuffix}${extension}`;
        const localPath = path.join(__dirname, 'uploads', filename);
        const localUrl = `/uploads/${filename}`;

        const writer = fs.createWriteStream(localPath);
        response.data.pipe(writer);

        await new Promise((resolve, reject) => {
            writer.on('finish', resolve);
            writer.on('error', reject);
        });

        const client = await pool.connect();
        try {
            await client.query('BEGIN');
            await client.query('DELETE FROM photos WHERE entity_type = $1 AND entity_id = $2', [entityType, entityId]);
            const result = await client.query(
                'INSERT INTO photos (url, entity_type, entity_id) VALUES ($1, $2, $3) RETURNING *',
                [localUrl, entityType, entityId]
            );
            await client.query('COMMIT');
            res.status(201).json(toCamelCase(result.rows[0]));
        } catch (dbErr) {
            await client.query('ROLLBACK');
            throw dbErr;
        } finally {
            client.release();
        }

    } catch (err) {
        console.error('Failed to import photo from URL:', err.message);
        res.status(500).json({ error: 'Failed to download or save the image.' });
    }
});


export default router;