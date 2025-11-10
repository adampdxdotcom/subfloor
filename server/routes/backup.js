import express from 'express';
import { exec } from 'child_process';
import archiver from 'archiver';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const router = express.Router();

// Helper to get the correct directory path
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.resolve(path.dirname(__filename), '..');

// Ensure a temporary directory for our operations exists
const tempDir = path.join(__dirname, 'temp-uploads');
fs.mkdirSync(tempDir, { recursive: true });

/**
 * GET /api/backup/database
 * This endpoint generates a database dump, zips it, and streams it to the user.
 */
router.get('/database', (req, res) => {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const dumpFilename = `database-backup-${timestamp}.dump`;
    const tempDumpPath = path.join(tempDir, dumpFilename);
    const zipFilename = `joblogger-database-backup-${timestamp}.zip`;

    // --- FIX: Parse DATABASE_URL to get correct credentials ---
    if (!process.env.DATABASE_URL) {
        console.error('DATABASE_URL environment variable is not set!');
        return res.status(500).json({ error: 'Server configuration error: DATABASE_URL not set.' });
    }

    const dbUrl = new URL(process.env.DATABASE_URL);
    const dbUser = dbUrl.username;
    const dbPassword = dbUrl.password;
    const dbHost = dbUrl.hostname;
    const dbName = dbUrl.pathname.slice(1);

    const dumpCommand = `pg_dump -U "${dbUser}" -h "${dbHost}" -Fc "${dbName}" > "${tempDumpPath}"`;

    console.log('--- Creating database backup file on server ---');
    
    // Execute the command, passing PGPASSWORD in the environment
    exec(dumpCommand, { env: { ...process.env, PGPASSWORD: dbPassword } }, (error, stdout, stderr) => {
        if (error) {
            console.error('pg_dump execution error:', stderr);
            if (fs.existsSync(tempDumpPath)) {
                fs.unlinkSync(tempDumpPath);
            }
            return res.status(500).json({ error: 'Database backup failed during file creation.', details: stderr });
        }

        console.log('Temporary backup file created successfully. Now zipping and sending...');
        
        res.setHeader('Content-Type', 'application/zip');
        res.setHeader('Content-Disposition', `attachment; filename=${zipFilename}`);

        const archive = archiver('zip', { zlib: { level: 9 } });

        res.on('close', () => {
            console.log('Download stream closed. Cleaning up temporary file.');
            if (fs.existsSync(tempDumpPath)) {
                fs.unlinkSync(tempDumpPath);
            }
        });
        
        archive.on('error', (err) => {
            console.error('Archiver error:', err);
            if (fs.existsSync(tempDumpPath)) {
                fs.unlinkSync(tempDumpPath);
            }
        });

        archive.pipe(res);
        archive.file(tempDumpPath, { name: dumpFilename });
        archive.finalize();
    });
});


/**
 * GET /api/backup/images
 * This endpoint zips the entire /server/uploads directory and streams it to the user.
 */
router.get('/images', (req, res) => {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const zipFilename = `joblogger-images-backup-${timestamp}.zip`;
    const sourceDir = path.join(__dirname, 'uploads');

    if (!fs.existsSync(sourceDir)) {
        return res.status(404).send('Uploads directory not found.');
    }

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename=${zipFilename}`);

    const archive = archiver('zip', {
        zlib: { level: 9 }
    });

    archive.on('error', (err) => {
        throw err;
    });

    archive.pipe(res);
    archive.directory(sourceDir, 'uploads');
    archive.finalize();
});

export default router;