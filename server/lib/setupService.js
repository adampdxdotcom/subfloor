// server/lib/setupService.js

import pool from '../db.js';
import crypto from 'crypto';

// In-memory cache to prevent DB hits on every request (CORS/Middleware)
let configCache = null;
let securityCache = null;

const DEFAULT_CONFIG = {
  isInitialized: false,
  publicUrl: null, // Null indicates "Setup Mode"
  companyName: "My Flooring Company",
  allowedDomains: []
};

/**
 * Loads the configuration from DB into memory.
 * Must be called at server startup.
 */
export const loadSystemConfig = async () => {
  try {
    // 1. Try to fetch existing core config
    const res = await pool.query("SELECT settings FROM system_preferences WHERE key = 'core_config'");
    
    if (res.rows.length === 0) {
      // 2. Row doesn't exist, insert default
      await pool.query(
        "INSERT INTO system_preferences (key, settings) VALUES ($1, $2)",
        ['core_config', JSON.stringify(DEFAULT_CONFIG)]
      );
      configCache = DEFAULT_CONFIG;
    } else {
      configCache = res.rows[0].settings;
    }

    // ----------------------------------------------------
    // 3. SECURITY CONFIG (Auto-Generate Encryption Key)
    // ----------------------------------------------------
    const secRes = await pool.query("SELECT settings FROM system_preferences WHERE key = 'security_config'");
    if (secRes.rows.length === 0) {
      // Generate a secure 32-character hex string (16 bytes * 2)
      const newKey = crypto.randomBytes(16).toString('hex');
      await pool.query(
        "INSERT INTO system_preferences (key, settings) VALUES ($1, $2)",
        ['security_config', JSON.stringify({ qrEncryptionKey: newKey })]
      );
      securityCache = { qrEncryptionKey: newKey };
      console.log("🔐 Security: Generated and stored new system encryption key.");
    } else {
      securityCache = secRes.rows[0].settings;
    }

  } catch (err) {
    // If the table doesn't exist yet (very first boot), we fall back to Default
    // The dbInit() script will create the table shortly after.
    console.log("⚠️ System config table not ready or empty. Defaulting to Setup Mode.");
    configCache = DEFAULT_CONFIG;
    // Fallback key for startup crash prevention (not persisted)
    securityCache = { qrEncryptionKey: crypto.randomBytes(16).toString('hex') };
  }
  return configCache;
};

/**
 * Returns the cached configuration.
 * Safe to call synchronously in critical paths (e.g. CORS).
 */
export const getSystemConfig = () => {
  if (!configCache) {
    // Fallback if accessed before load (shouldn't happen with await in index.js)
    return DEFAULT_CONFIG;
  }
  return configCache;
};

/**
 * Returns the cached security settings.
 */
export const getSecurityConfig = () => {
  return securityCache || { qrEncryptionKey: null };
};

/**
 * Updates the configuration in DB and refreshes cache.
 */
export const updateSystemConfig = async (partialSettings) => {
  // Ensure we have base state
  if (!configCache) await loadSystemConfig();
  
  const newSettings = { ...configCache, ...partialSettings };
  
  // Save to DB
  await pool.query(
    "INSERT INTO system_preferences (key, settings) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET settings = $2",
    ['core_config', JSON.stringify(newSettings)]
  );
  
  // Update Cache
  configCache = newSettings;
  return configCache;
};

/**
 * Helper to check initialization status
 */
export const isSystemInitialized = () => {
  return getSystemConfig().isInitialized;
};