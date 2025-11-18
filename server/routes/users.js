// server/routes/users.js

import express from 'express';
import supertokens from 'supertokens-node';
import EmailPassword from 'supertokens-node/recipe/emailpassword/index.js';
import { verifySession } from 'supertokens-node/recipe/session/framework/express/index.js';
import pool from '../db.js';
import { verifyRole } from '../utils.js';

const router = express.Router();

// GET /api/users - Fetch all users
router.get('/', verifySession(), async (req, res, next) => {
  try {
    // --- MODIFIED: Added a LEFT JOIN to user_preferences to get the color ---
    const query = `
      SELECT 
        a.user_id, 
        e.email,
        up.preferences->>'color' AS color, -- Extracts the 'color' value from the JSONB
        COALESCE( (
            SELECT json_agg(r.name) FROM app_user_roles ur
            JOIN app_roles r ON ur.role_id = r.id
            WHERE ur.user_id = a.user_id
        ), '[]'::json ) AS roles
      FROM all_auth_recipe_users AS a
      JOIN emailpassword_users AS e ON a.user_id = e.user_id
      LEFT JOIN user_preferences up ON a.user_id = up.user_id
      ORDER BY e.email ASC;
    `;
    const result = await pool.query(query);
    const users = result.rows.map(row => ({
      userId: row.user_id,
      email: row.email,
      roles: row.roles,
      color: row.color || null, // Ensure color is null if not set, not undefined
    }));
    res.json(users);
  } catch (err) {
    console.error("ERROR in GET /api/users:", err);
    next(err);
  }
});

// GET /api/users/me - Fetch details for the currently logged-in user
router.get('/me', verifySession(), async (req, res, next) => {
  try {
    const userId = req.session.getUserId();
    // --- MODIFIED: Also fetch the color for the current user ---
    const query = `
      SELECT 
          epu.user_id, 
          epu.email,
          up.preferences->>'color' AS color,
          COALESCE( (
              SELECT json_agg(r.name) FROM app_user_roles ur
              JOIN app_roles r ON ur.role_id = r.id
              WHERE ur.user_id = epu.user_id
          ), '[]'::json ) AS roles
      FROM emailpassword_users epu
      LEFT JOIN user_preferences up ON epu.user_id = up.user_id
      WHERE epu.user_id = $1;
    `;
    const result = await pool.query(query, [userId]);
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'User not found.' });
    }
    const user = {
      userId: result.rows[0].user_id,
      email: result.rows[0].email,
      roles: result.rows[0].roles,
      color: result.rows[0].color || null,
    };
    res.json(user);
  } catch (err) {
    console.error("ERROR in GET /api/users/me:", err);
    next(err);
  }
});

// =================================================================
//  SECURED ADMIN-ONLY ROUTES
// =================================================================

// POST /api/users - Create a new user (Admin Only)
router.post('/', verifySession(), verifyRole('Admin'), async (req, res, next) => {
  const { email, password } = req.body;
  const tenantId = "public";
  if (!email || !password) {
    return res.status(400).json({ message: 'Email and password are required.' });
  }
  const client = await pool.connect();
  try {
    const response = await EmailPassword.signUp(tenantId, email, password);
    if (response.status === 'OK') {
        const newUserId = response.user.id;
        const userCountResult = await client.query('SELECT COUNT(*) FROM all_auth_recipe_users');
        const isFirstUser = parseInt(userCountResult.rows[0].count, 10) === 1;
        const roleNameToAssign = isFirstUser ? 'Admin' : 'User';
        const roleResult = await client.query("SELECT id FROM app_roles WHERE name = $1", [roleNameToAssign]);
        if (roleResult.rows.length > 0) {
            const roleId = roleResult.rows[0].id;
            await client.query("INSERT INTO app_user_roles (user_id, role_id) VALUES ($1, $2)", [newUserId, roleId]);
        } else {
            console.error(`FATAL: Default role '${roleNameToAssign}' not found. New user ${newUserId} was created without a role.`);
        }
        res.status(201).json({ userId: newUserId, email: response.user.email });
    } else if (response.status === 'EMAIL_ALREADY_EXISTS_ERROR') {
      res.status(409).json({ message: 'This email address is already in use.' });
    } else {
      console.error("Unexpected SuperTokens signUp status:", response.status);
      res.status(500).json({ message: 'An unexpected error occurred during sign up.' });
    }
  } catch (err) {
    console.error("ERROR in POST /api/users:", err);
    next(err);
  } finally {
    client.release();
  }
});

// DELETE /api/users/:userId - Delete a user (Admin Only)
router.delete('/:userId', verifySession(), verifyRole('Admin'), async (req, res, next) => {
  const { userId } = req.params;
  try {
    const sessionUserId = req.session.getUserId();
    if (userId === sessionUserId) {
        return res.status(403).json({ message: "You cannot delete your own account." });
    }
    await supertokens.deleteUser(userId);
    res.status(204).send();
  } catch (err) {
    console.error(`ERROR in DELETE /api/users/${userId}:`, err);
    next(err);
  }
});

// =================================================================
//  NEW ENDPOINT TO UPDATE USER ROLES
// =================================================================
router.put('/:userId/roles', verifySession(), verifyRole('Admin'), async (req, res, next) => {
    const { userId } = req.params;
    const { roles } = req.body; // Expects an array of role names, e.g., ['Admin', 'User']

    if (!Array.isArray(roles)) {
        return res.status(400).json({ message: 'Request body must contain a "roles" array.' });
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // Prevent an admin from removing their own Admin role, which could lock them out.
        const sessionUserId = req.session.getUserId();
        if (userId === sessionUserId && !roles.includes('Admin')) {
            throw new Error('You cannot remove your own Admin role.');
        }

        // Clear existing roles for the user
        await client.query('DELETE FROM app_user_roles WHERE user_id = $1', [userId]);

        // Get the IDs for the provided role names
        const rolesResult = await client.query('SELECT id, name FROM app_roles');
        const roleMap = new Map(rolesResult.rows.map(r => [r.name, r.id]));

        // Insert the new roles
        for (const roleName of roles) {
            const roleId = roleMap.get(roleName);
            if (roleId) {
                await client.query('INSERT INTO app_user_roles (user_id, role_id) VALUES ($1, $2)', [userId, roleId]);
            }
        }
        
        await client.query('COMMIT');
        res.status(200).json({ message: 'User roles updated successfully.' });

    } catch (err) {
        await client.query('ROLLBACK');
        console.error(`ERROR in PUT /api/users/${userId}/roles:`, err);
        res.status(500).json({ message: err.message || 'An error occurred while updating user roles.' });
    } finally {
        client.release();
    }
});

export default router;