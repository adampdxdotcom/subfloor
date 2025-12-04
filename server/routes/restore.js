import express from 'express';
import multer from 'multer';
import { exec } from 'child_process';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import unzipper from 'unzipper';
import { verifySession } from 'supertokens-node/recipe/session/framework/express/index.js';
import pool from '../db.js';
import { loadSystemConfig } from '../lib/setupService.js';

const router = express.Router();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.join(path.dirname(__filename), '..');

const tempUploadsDir = path.join(__dirname, 'temp-uploads');
fs.mkdirSync(tempUploadsDir, { recursive: true });

const upload = multer({ dest: tempUploadsDir });

router.post('/database', verifySession(), upload.single('backupFile'), async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'No backup file uploaded.' });
    }

    const zipPath = req.file.path;
    let dumpFilePath = '';

    try {
        console.log('Starting database restore...');
        const directory = await unzipper.Open.file(zipPath);
        const dumpFileEntry = directory.files.find(entry => entry.path.endsWith('.dump'));

        if (!dumpFileEntry) {
            fs.unlinkSync(zipPath);
            return res.status(400).json({ error: 'No .dump file found in the zip archive.' });
        }

        dumpFilePath = path.join(tempUploadsDir, path.basename(dumpFileEntry.path));
        console.log(`Extracting ${dumpFileEntry.path} to ${dumpFilePath}`);

        await new Promise((resolve, reject) => {
            dumpFileEntry.stream()
                .pipe(fs.createWriteStream(dumpFilePath))
                .on('finish', resolve)
                .on('error', reject);
        });

        // --- STEP 0: PARSE DB CREDENTIALS (Moved Up) ---
        // We need the user name for the Wipe step permissions
        let dbUser, dbPassword, dbHost, dbPort, dbName;

        if (process.env.DATABASE_URL) {
            const dbUrl = new URL(process.env.DATABASE_URL);
            dbUser = dbUrl.username;
            dbPassword = dbUrl.password;
            dbHost = dbUrl.hostname;
            dbPort = dbUrl.port || '5432';
            dbName = dbUrl.pathname.slice(1); // Remove leading '/'
        } else {
            dbUser = process.env.DB_USER;
            dbPassword = process.env.DB_PASSWORD;
            dbHost = process.env.DB_HOST;
            dbPort = process.env.DB_PORT || '5432';
            dbName = process.env.DB_NAME;
        }

        if (!dbUser || !dbPassword || !dbHost || !dbName) {
             throw new Error('Missing database configuration variables.');
        }

        // --- STEP 1: NUCLEAR WIPE (DROP SCHEMA CASCADE) ---
        // We must manually wipe the DB because pg_restore --clean fails on complex foreign keys
        console.log('💥 Initiating Nuclear Wipe (DROP SCHEMA public CASCADE)...');
        const client = await pool.connect();
        try {
            // Drop everything and recreate the public schema
            await client.query('DROP SCHEMA public CASCADE;');
            await client.query('CREATE SCHEMA public;');
            // FIX: Grant permissions to the ACTUAL database user, not hardcoded 'postgres'
            await client.query(`GRANT ALL ON SCHEMA public TO "${dbUser}";`);
            await client.query('GRANT ALL ON SCHEMA public TO public;');
            console.log('✅ Database wiped clean.');
        } catch (wipeError) {
            console.error('❌ Wipe failed:', wipeError);
            throw new Error('Failed to wipe database before restore.');
        } finally {
            client.release();
        }

        // --- UPDATED: Robust pg_restore command ---
        // Removed --clean --if-exists because we wiped manually. Added --no-acl.
        const restoreCommand = `PGPASSWORD="${dbPassword}" pg_restore -U "${dbUser}" -h "${dbHost}" -p "${dbPort}" -d "${dbName}" --no-owner --no-privileges --no-acl "${dumpFilePath}"`;
        
        console.log('Executing pg_restore command...');
        
        exec(restoreCommand, async (error, stdout, stderr) => {
            // Clean up temp files
            if (fs.existsSync(dumpFilePath)) fs.unlinkSync(dumpFilePath);
            if (fs.existsSync(zipPath)) fs.unlinkSync(zipPath);

            if (error) {
                console.error('pg_restore execution error:', stderr);
                return res.status(500).json({ error: 'Database restore failed.', details: stderr });
            }

            console.log('Database restore successful:', stdout);

            // --- DETECT CURRENT ORIGIN ---
            // We grab the protocol and host from the request headers to ensure 
            // the system config matches the environment we are restoring INTO,
            // not the environment the backup came FROM.
            let detectedUrl = process.env.APP_DOMAIN;
            if (!detectedUrl && req.headers.origin) {
                detectedUrl = req.headers.origin;
            } else if (!detectedUrl) {
                detectedUrl = "http://localhost:3001"; // Fallback
            }

            // --- STEP 3: PATCH SYSTEM CONFIGURATION ---
            try {
                console.log("🔧 Patching system configuration...");
                const patchClient = await pool.connect();

                // 1. Ensure table exists (for very old backups)
                await patchClient.query(`
                    CREATE TABLE IF NOT EXISTS system_preferences (
                        key VARCHAR(100) PRIMARY KEY NOT NULL,
                        settings JSONB NOT NULL DEFAULT '{}'::jsonb,
                        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
                    );
                `);

                // 2. Force Initialized = true AND Correct Public URL
                // We explicitly set 'publicUrl' to override whatever old value came in from the backup.
                await patchClient.query(`
                    INSERT INTO system_preferences (key, settings)
                    VALUES ('core_config', $1)
                    ON CONFLICT (key) DO UPDATE 
                    SET settings = system_preferences.settings || jsonb_build_object(
                        'isInitialized', true, 
                        'publicUrl', $2::text
                    );
                `, [JSON.stringify({ 
                    isInitialized: true, 
                    publicUrl: detectedUrl,
                    companyName: "Restored System"
                }), detectedUrl]);

                patchClient.release();
                
                // --- NEW: Force the server to reload config from DB ---
                await loadSystemConfig(); 
                
                console.log("✅ System configuration patched and reloaded.");

            } catch (patchErr) {
                console.error("⚠️ Warning: Failed to patch system config:", patchErr);
            }

            res.status(200).json({ message: 'Database restored successfully.' });
        });

    } catch (err) {
        console.error('Error during database restore process:', err);
        if (fs.existsSync(zipPath)) fs.unlinkSync(zipPath);
        if (fs.existsSync(dumpFilePath)) fs.unlinkSync(dumpFilePath);
        res.status(500).json({ error: 'Failed to process database backup file.', details: err.message });
    }
});

router.post('/images', verifySession(), upload.single('backupFile'), async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'No backup file uploaded.' });
    }

    const zipPath = req.file.path;
    const liveUploadsDir = path.join(__dirname, 'uploads');
    const newUploadsDir = path.join(__dirname, 'uploads_new');

    try {
        console.log('--- Starting Image Restore (Content Swap Method) ---');
        // Ensure parent uploads dir exists
        if (!fs.existsSync(liveUploadsDir)) {
            await fs.promises.mkdir(liveUploadsDir, { recursive: true });
        }

        console.log('Step 1: Cleaning up any old temp directories...');
        if (fs.existsSync(newUploadsDir)) await fs.promises.rm(newUploadsDir, { recursive: true, force: true });
        await fs.promises.mkdir(newUploadsDir, { recursive: true });

        console.log(`Step 2: Unzipping backup to ${newUploadsDir}`);
        await fs.createReadStream(zipPath).pipe(unzipper.Extract({ path: newUploadsDir })).promise();
        await fs.promises.unlink(zipPath);

        console.log('Step 3: Checking for and promoting nested directory...');
        const contents = await fs.promises.readdir(newUploadsDir);
        if (contents.length === 1) {
            const nestedPath = path.join(newUploadsDir, contents[0]);
            if ((await fs.promises.stat(nestedPath)).isDirectory()) {
                console.log(`Found nested directory '${contents[0]}'. Promoting contents...`);
                const nestedContents = await fs.promises.readdir(nestedPath);
                for (const file of nestedContents) {
                    await fs.promises.rename(path.join(nestedPath, file), path.join(newUploadsDir, file));
                }
                await fs.promises.rmdir(nestedPath);
            }
        }
        
        console.log('Step 4: Clearing contents of live uploads directory...');
        // Only clear if live dir exists
        if (fs.existsSync(liveUploadsDir)) {
             const oldFiles = await fs.promises.readdir(liveUploadsDir);
             for (const file of oldFiles) {
                 await fs.promises.rm(path.join(liveUploadsDir, file), { recursive: true, force: true });
             }
        }
        
        console.log('Step 5: Moving new files into live uploads directory...');
        const newFiles = await fs.promises.readdir(newUploadsDir);
        for (const file of newFiles) {
            const sourcePath = path.join(newUploadsDir, file);
            const destPath = path.join(liveUploadsDir, file);
            // Use cp with recursive: true to handle folders (like 'branding', 'avatars', and 'OLD')
            await fs.promises.cp(sourcePath, destPath, { recursive: true });
        }

        console.log('--- Image Restore Successful ---');
        res.status(200).json({ message: 'Images restored successfully.' });
        
        console.log('Step 6: Cleaning up temporary staging directory...');
        await fs.promises.rm(newUploadsDir, { recursive: true, force: true });
        
    } catch (err) {
        console.error('--- ERROR DURING IMAGE RESTORE ---', err);
        if (fs.existsSync(zipPath)) fs.promises.unlink(zipPath).catch(console.error);
        if (fs.existsSync(newUploadsDir)) fs.promises.rm(newUploadsDir, { recursive: true, force: true }).catch(console.error);
        res.status(500).json({ error: 'Failed to restore images.', details: err.message });
    }
});

export default router;