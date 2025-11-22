// server/utils.js

import pool from './db.js';
import crypto from 'crypto';

export const toCamelCase = (obj) => {
  if (!obj) return null;
  if (Array.isArray(obj)) {
    return obj.map(item => toCamelCase(item));
  }
  const newObj = {};
  for (let key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      if (key.includes('_')) {
        const camelKey = key.replace(/_([a-z])/g, (g) => g[1].toUpperCase());
        newObj[camelKey] = obj[key];
      } else {
        newObj[key] = obj[key];
      }
    }
  }
  return newObj;
};

/**
 * Logs a user action to the activity_log table.
 * @param {string} userId - The ID of the user performing the action.
 * @param {string} actionType - The type of action (e.g., 'CREATE', 'DELETE').
 * @param {string} targetEntity - The type of entity being affected (e.g., 'CUSTOMER').
 * @param {string | number} targetId - The ID of the entity being affected.
 * @param {object} details - A JSON object with extra info (e.g., { deletedName: 'Old Customer Name' }).
 */
export async function logActivity(userId, actionType, targetEntity, targetId, details = {}) {
  try {
    const query = `
      INSERT INTO activity_log(user_id, action_type, target_entity, target_id, details)
      VALUES($1, $2, $3, $4, $5)
    `;
    await pool.query(query, [userId, actionType, targetEntity, String(targetId), details]);
  } catch (error) {
    console.error('Failed to log activity:', error);
  }
}

// =================================================================
//  RBAC MIDDLEWARE
// =================================================================
/**
 * Express middleware to verify if a user has a required role.
 * Must be used *after* the verifySession() middleware.
 * @param {string|string[]} requiredRoles - The role(s) required to access the route.
 * @returns Express middleware function.
 */
export const verifyRole = (requiredRoles) => {
  return async (req, res, next) => {
    try {
      const userId = req.session.getUserId();
      const roles = Array.isArray(requiredRoles) ? requiredRoles : [requiredRoles];

      if (roles.length === 0) {
        return next(); // If no roles are required, proceed.
      }

      // MODIFIED: Query now uses 'app_user_roles' and 'app_roles'
      const query = `
        SELECT r.name
        FROM app_user_roles ur
        JOIN app_roles r ON ur.role_id = r.id
        WHERE ur.user_id = $1
      `;
      const result = await pool.query(query, [userId]);
      const userRoles = result.rows.map(row => row.name);

      const hasPermission = roles.some(role => userRoles.includes(role));

      if (hasPermission) {
        return next();
      } else {
        return res.status(403).json({ error: 'Forbidden: You do not have the required permissions.' });
      }
    } catch (err) {
      console.error('Role verification middleware failed:', err);
      return res.status(500).json({ error: 'Internal server error during role verification.' });
    }
  };
};

// =================================================================
//  ENCRYPTION UTILS
// =================================================================

const ALGORITHM = 'aes-256-cbc';
// Note: This key must be exactly 32 characters long
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || '01234567890123456789012345678901'; 
const IV_LENGTH = 16;

export const encrypt = (text) => {
  if (!text) return null;
  try {
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, Buffer.from(ENCRYPTION_KEY), iv);
    let encrypted = cipher.update(text);
    encrypted = Buffer.concat([encrypted, cipher.final()]);
    return iv.toString('hex') + ':' + encrypted.toString('hex');
  } catch (error) {
    console.error('Encryption failed:', error);
    return null;
  }
};

export const decrypt = (text) => {
  if (!text) return null;
  try {
    const textParts = text.split(':');
    const iv = Buffer.from(textParts.shift(), 'hex');
    const encryptedText = Buffer.from(textParts.join(':'), 'hex');
    const decipher = crypto.createDecipheriv(ALGORITHM, Buffer.from(ENCRYPTION_KEY), iv);
    let decrypted = decipher.update(encryptedText);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    return decrypted.toString();
  } catch (err) {
    console.error("Decryption failed (Key mismatch or corrupted data):", err.message);
    return null;
  }
};