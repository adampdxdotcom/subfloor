import express from 'express';
import multer from 'multer';
import { exec } from 'child_process';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import unzipper from 'unzipper';

const router = express.Router();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.join(path.dirname(__filename), '..');

const tempUploadsDir = path.join(__dirname, 'temp-uploads');
fs.mkdirSync(tempUploadsDir, { recursive: true });

const upload = multer({ dest: tempUploadsDir });

router.post('/database', upload.single('backupFile'), async (req, res) => {
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

        if (!process.env.DATABASE_URL) {
            throw new Error('DATABASE_URL environment variable is not set!');
        }
        const dbUrl = new URL(process.env.DATABASE_URL);
        const dbUser = dbUrl.username;
        const dbPassword = dbUrl.password;
        const dbHost = dbUrl.hostname;
        const dbName = dbUrl.pathname.slice(1); // Remove leading '/'

        const restoreCommand = `PGPASSWORD="${dbPassword}" pg_restore -U "${dbUser}" -h "${dbHost}" --clean --if-exists -d "${dbName}" "${dumpFilePath}"`;
        
        console.log('Executing pg_restore command...');
        exec(restoreCommand, (error, stdout, stderr) => {
            if (fs.existsSync(dumpFilePath)) fs.unlinkSync(dumpFilePath);
            if (fs.existsSync(zipPath)) fs.unlinkSync(zipPath);

            if (error) {
                console.error('pg_restore execution error:', stderr);
                return res.status(500).json({ error: 'Database restore failed.', details: stderr });
            }

            console.log('Database restore successful:', stdout);
            res.status(200).json({ message: 'Database restored successfully.' });
        });

    } catch (err) {
        console.error('Error during database restore process:', err);
        if (fs.existsSync(zipPath)) fs.unlinkSync(zipPath);
        if (fs.existsSync(dumpFilePath)) fs.unlinkSync(dumpFilePath);
        res.status(500).json({ error: 'Failed to process database backup file.', details: err.message });
    }
});

router.post('/images', upload.single('backupFile'), async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'No backup file uploaded.' });
    }

    const zipPath = req.file.path;
    const liveUploadsDir = path.join(__dirname, 'uploads');
    const newUploadsDir = path.join(__dirname, 'uploads_new');

    try {
        console.log('--- Starting Image Restore (Content Swap Method) ---');
        await fs.promises.mkdir(liveUploadsDir, { recursive: true });

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
        const oldFiles = await fs.promises.readdir(liveUploadsDir);
        for (const file of oldFiles) {
            await fs.promises.rm(path.join(liveUploadsDir, file), { recursive: true, force: true });
        }
        
        console.log('Step 5: Moving new files into live uploads directory...');
        const newFiles = await fs.promises.readdir(newUploadsDir);
        for (const file of newFiles) {
            const sourcePath = path.join(newUploadsDir, file);
            const destPath = path.join(liveUploadsDir, file);
            await fs.promises.copyFile(sourcePath, destPath);
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