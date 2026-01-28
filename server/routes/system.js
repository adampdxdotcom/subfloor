import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pool from '../db.js';
import axios from 'axios';

const router = express.Router();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Helper to read metadata.json
const getAppMetadata = () => {
  try {
    const potentialPaths = [
      // 1. Production Docker (Assuming WORKDIR /app)
      '/app/metadata.json',
      // 2. Local Dev (Relative to this file in server/routes)
      path.join(__dirname, '../../metadata.json'),
      // 3. Current Working Directory (Root fallback)
      path.join(process.cwd(), 'metadata.json')
    ];

    for (const p of potentialPaths) {
      if (fs.existsSync(p)) {
        console.log("✅ Found metadata.json at:", p);
        return JSON.parse(fs.readFileSync(p, 'utf-8'));
      }
    }
    
    console.warn("⚠️ metadata.json not found in:", potentialPaths);

  } catch (err) {
    console.error('🔥 Failed to read metadata.json:', err);
  }
  return { version: '0.00', mobileBuild: 0, minMobileBuild: 0 };
};

// GET /api/system/info
router.get('/info', async (req, res) => {
  try {
    // 1. Get Static Version Info from JSON
    const metadata = getAppMetadata();

    // 2. Get Config from Metadata (Developer Controlled)
    // Fallback to empty string if not set
    let apkDownloadUrl = metadata.apkDownloadUrl || '';

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

    // 2. Fetch Remote Beacon (metadata.json)
    // This points to the metadata.json file in the main branch
    const REMOTE_BEACON_URL = 'https://subfloor.app/metadata.json';
    
    const { data: remoteData } = await axios.get(`${REMOTE_BEACON_URL}?t=${Date.now()}`, { timeout: 5000 });

    // 3. Compare (Simple string comparison works for standard versioning)
    const latestVersion = remoteData.version || '0.00'; // Note: using .version now
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