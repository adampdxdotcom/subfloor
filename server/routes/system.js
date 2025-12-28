import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pool from '../db.js';
import axios from 'axios'; // Added from diff

const router = express.Router();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Helper to read metadata.json
const getAppMetadata = () => {
  try {
    // Attempt 1: Up 2 levels (assuming /app/server/routes -> /app)
    const path1 = path.join(__dirname, '../../metadata.json');
    
    // Attempt 2: Up 3 levels (just in case structure is deeper)
    const path2 = path.join(__dirname, '../../../metadata.json');

    if (fs.existsSync(path1)) {
      return JSON.parse(fs.readFileSync(path1, 'utf-8'));
    }
    if (fs.existsSync(path2)) {
      return JSON.parse(fs.readFileSync(path2, 'utf-8'));
    }

  } catch (err) {
    console.error('🔥 Failed to read metadata.json:', err);
  }
  return { version: '0.00', mobileBuild: 0, minMobileBuild: 0 };
};

// GET /api/system/info
router.get('/info', async (req, res) => {
  try {
    const metadata = getAppMetadata();

    let apkDownloadUrl = '';
    const dbRes = await pool.query("SELECT settings FROM system_preferences WHERE key = 'mobile_settings'");
    
    if (dbRes.rows.length > 0) {
      apkDownloadUrl = dbRes.rows[0].settings.apkDownloadUrl || '';
    }

    res.json({
      version: metadata.version || '0.00',
      mobileBuild: metadata.mobileBuild || 0,
      minMobileBuild: metadata.minMobileBuild || 0,
      apkDownloadUrl
    });

  } catch (error) {
    console.error('Error fetching system info:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// GET /api/system/check-remote - Check if a newer version exists online
router.get('/check-remote', async (req, res) => {
  try {
    // 1. Get Local Version
    const localMetadata = getAppMetadata();
    const currentVersion = localMetadata.version || '0.00';

    // 2. Fetch Remote Version Beacon
    // This points to the version.json file in the main branch
    const REMOTE_BEACON_URL = 'https://raw.githubusercontent.com/adampdxdotcom/subfloor/refs/heads/main/version.json';
    
    const { data: remoteData } = await axios.get(REMOTE_BEACON_URL, { timeout: 5000 });

    // 3. Compare (Simple string comparison works for standard versioning)
    const latestVersion = remoteData.latestVersion || '0.00';
    const isUpdateAvailable = latestVersion > currentVersion;

    res.json({
      currentVersion,
      latestVersion,
      isUpdateAvailable,
      releaseNotesUrl: remoteData.releaseNotesUrl || '',
      critical: remoteData.critical || false
    });

  } catch (error) {
    // Silent fail if offline or GitHub is down to prevent UI errors
    console.warn('Failed to check remote version:', error.message);
    res.json({ 
      isUpdateAvailable: false, 
      error: 'Check failed' 
    });
  }
});

export default router;