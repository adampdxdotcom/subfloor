import express from 'express';
import supertokens from 'supertokens-node';
import EmailPassword from 'supertokens-node/recipe/emailpassword/index.js';
import { verifySession } from 'supertokens-node/recipe/session/framework/express/index.js';
import pool from '../db.js';
import { verifyRole, encrypt } from '../utils.js';
import { sendEmail } from '../lib/emailService.js'; // Import email service
import crypto from 'crypto'; // For random password generation
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { getSystemConfig } from '../lib/setupService.js';

const router = express.Router();

// --- CONFIGURE AVATAR UPLOAD STORAGE ---
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const uploadDir = path.join(__dirname, '../uploads/avatars');

// Ensure avatar directory exists
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        // Filename: avatar-[userId]-[timestamp].ext
        const userId = req.session.getUserId();
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, `avatar-${userId}-${uniqueSuffix}${path.extname(file.originalname)}`);
    }
});

const upload = multer({ storage: storage });

// GET /api/users - Fetch all users
router.get('/', verifySession(), async (req, res, next) => {
  try {
    // --- MODIFIED: Added a LEFT JOIN to user_preferences to get the color ---
    const query = `
      SELECT 
        a.user_id, 
        e.email,
        up.preferences->>'calendarColor' AS color, -- Extracts the 'calendarColor' value from the JSONB
        p.first_name,
        p.last_name,
        p.avatar_url,
        COALESCE( (
            SELECT json_agg(r.name) FROM app_user_roles ur
            JOIN app_roles r ON ur.role_id = r.id
            WHERE ur.user_id = a.user_id
        ), '[]'::json ) AS roles
      FROM all_auth_recipe_users AS a
      JOIN emailpassword_users AS e ON a.user_id = e.user_id
      LEFT JOIN user_preferences up ON a.user_id = up.user_id
      LEFT JOIN user_profiles p ON a.user_id = p.user_id
      ORDER BY e.email ASC;
    `;
    const result = await pool.query(query);
    const users = result.rows.map(row => ({
      userId: row.user_id,
      email: row.email,
      roles: row.roles,
      color: row.color || null, // Ensure color is null if not set, not undefined
      firstName: row.first_name || '',
      lastName: row.last_name || '',
      avatarUrl: row.avatar_url || null,
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
          up.preferences->>'calendarColor' AS color,
          p.first_name,
          p.last_name,
          p.avatar_url,
          COALESCE( (
              SELECT json_agg(r.name) FROM app_user_roles ur
              JOIN app_roles r ON ur.role_id = r.id
              WHERE ur.user_id = epu.user_id
          ), '[]'::json ) AS roles
      FROM emailpassword_users epu
      LEFT JOIN user_preferences up ON epu.user_id = up.user_id
      LEFT JOIN user_profiles p ON epu.user_id = p.user_id
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
      firstName: result.rows[0].first_name || '',
      lastName: result.rows[0].last_name || '',
      avatarUrl: result.rows[0].avatar_url || null,
    };
    res.json(user);
  } catch (err) {
    console.error("ERROR in GET /api/users/me:", err);
    next(err);
  }
});

// PUT /api/users/me/profile - Update profile details (First/Last Name)
router.put('/me/profile', verifySession(), async (req, res, next) => {
  const userId = req.session.getUserId();
  const { firstName, lastName } = req.body;

  const client = await pool.connect();
  try {
    const query = `
      INSERT INTO user_profiles (user_id, first_name, last_name, updated_at)
      VALUES ($1, $2, $3, NOW())
      ON CONFLICT (user_id) 
      DO UPDATE SET 
        first_name = EXCLUDED.first_name,
        last_name = EXCLUDED.last_name,
        updated_at = NOW()
      RETURNING first_name, last_name, avatar_url;
    `;
    
    const result = await client.query(query, [userId, firstName || '', lastName || '']);
    const row = result.rows[0];
    
    res.json({ firstName: row.first_name, lastName: row.last_name, avatarUrl: row.avatar_url });

  } catch (err) {
    console.error("ERROR in PUT /api/users/me/profile:", err);
    next(err);
  } finally {
    client.release();
  }
});

// POST /api/users/me/avatar - Upload a profile picture
router.post('/me/avatar', verifySession(), upload.single('avatar'), async (req, res, next) => {
    const userId = req.session.getUserId();
    const file = req.file;

    if (!file) {
        return res.status(400).json({ message: 'No file uploaded.' });
    }

    // Construct the public URL (Assuming /uploads is served statically)
    const avatarUrl = `/uploads/avatars/${file.filename}`;

    try {
        const query = `
            INSERT INTO user_profiles (user_id, avatar_url, updated_at)
            VALUES ($1, $2, NOW())
            ON CONFLICT (user_id)
            DO UPDATE SET avatar_url = EXCLUDED.avatar_url, updated_at = NOW()
            RETURNING avatar_url;
        `;
        const result = await pool.query(query, [userId, avatarUrl]);
        
        res.json({ avatarUrl: result.rows[0].avatar_url });
    } catch (err) {
        console.error("ERROR in POST /api/users/me/avatar:", err);
        next(err);
    }
});

// DELETE /api/users/me/avatar - Remove profile picture
router.delete('/me/avatar', verifySession(), async (req, res, next) => {
    const userId = req.session.getUserId();

    const client = await pool.connect();
    try {
        // 1. Get current avatar URL to delete the file
        const checkRes = await client.query('SELECT avatar_url FROM user_profiles WHERE user_id = $1', [userId]);
        
        if (checkRes.rows.length > 0 && checkRes.rows[0].avatar_url) {
            const currentUrl = checkRes.rows[0].avatar_url;
            // Extract filename from URL (e.g., /uploads/avatars/file.jpg -> file.jpg)
            const filename = path.basename(currentUrl);
            const filePath = path.join(uploadDir, filename);

            // Delete file if it exists
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
            }
        }

        // 2. Clear the database field
        await client.query('UPDATE user_profiles SET avatar_url = NULL, updated_at = NOW() WHERE user_id = $1', [userId]);

        res.status(204).send(); // Success, no content
    } catch (err) {
        console.error("ERROR in DELETE /api/users/me/avatar:", err);
        next(err);
    } finally {
        client.release();
    }
});

// PUT /api/users/me/password - Change Password
router.put('/me/password', verifySession(), async (req, res, next) => {
    const userId = req.session.getUserId();
    const { currentPassword, newPassword } = req.body;

    if (!newPassword || newPassword.length < 8) {
        return res.status(400).json({ message: 'New password must be at least 8 characters long.' });
    }

    try {
        // 1. Get the user's email to verify credentials
        const userInfo = await supertokens.getUser(userId);
        
        if (!userInfo) {
            return res.status(404).json({ message: 'User not found.' });
        }

        // ROBUST EMAIL EXTRACTION:
        // Newer SDKs return { emails: ['...'] }, older ones return { email: '...' }
        let email = null;
        if (userInfo.emails && Array.isArray(userInfo.emails) && userInfo.emails.length > 0) {
            email = userInfo.emails[0];
        } else if (userInfo.email) {
            email = userInfo.email;
        }

        if (!email) {
            console.error("Password Change Error: Could not find an email for user", userId);
            return res.status(500).json({ message: 'User record is incomplete (missing email).' });
        }
        
        // FIND THE RECIPE USER ID (Required for password updates in newer SDKs)
        const emailPasswordMethod = userInfo.loginMethods.find(m => m.recipeId === 'emailpassword');
        if (!emailPasswordMethod) {
             return res.status(400).json({ message: 'User is not registered via Email/Password.' });
        }
        const recipeUserId = emailPasswordMethod.recipeUserId;

        // 2. Verify the OLD password first (Critical Security Step)
        // We use "public" as the tenantId to match your signUp logic.
        // We wrap this in a try/catch because signIn might throw if the SDK version mismatches.
        let isPasswordValid;
        try {
             isPasswordValid = await EmailPassword.signIn("public", email, currentPassword);
        } catch (signInError) {
            // Fallback: Try without tenantId (for older SDK compatibility)
            console.warn("SignIn with tenantId failed, retrying without:", signInError.message);
            isPasswordValid = await EmailPassword.signIn(email, currentPassword);
        }

        if (isPasswordValid.status !== "OK") {
            return res.status(401).json({ message: 'Current password is incorrect.' });
        }

        // 3. Update to the NEW password
        // FIX: Use recipeUserId and pass tenantId inside the object
        const response = await EmailPassword.updateEmailOrPassword({
            tenantId: "public", 
            recipeUserId: recipeUserId,
            password: newPassword
        });

        res.json({ message: 'Password updated successfully.' });
    } catch (err) {
        console.error("ERROR in PUT /api/users/me/password:", err);
        // Note: Catching an error during updateEmailOrPassword might include SuperTokens specific errors,
        // we return a generic message unless it's a known validation/auth error.
        res.status(500).json({ message: err.message || 'An error occurred while updating the password.' });
        next(err);
    }
});

// =================================================================
//  SECURED ADMIN-ONLY ROUTES
// =================================================================

// POST /api/users - Invite a new user (Admin Only)
router.post('/', verifySession(), verifyRole('Admin'), async (req, res, next) => {
  const { email, role, firstName, lastName } = req.body; // Expect Name & Role now
  const tenantId = "public";
  if (!email) {
    return res.status(400).json({ message: 'Email is required.' });
  }

  // 1. Generate a secure random placeholder password
  const placeholderPassword = crypto.randomBytes(24).toString('hex') + 'A1!';

  const client = await pool.connect();
  try {
    // 2. Create User with Placeholder
    const response = await EmailPassword.signUp(tenantId, email, placeholderPassword);
    
    if (response.status === 'OK') {
        const newUserId = response.user.id;
        
        // 3. Assign Role
        const roleNameToAssign = role || 'User';
        const roleResult = await client.query("SELECT id FROM app_roles WHERE name = $1", [roleNameToAssign]);
        if (roleResult.rows.length > 0) {
            const roleId = roleResult.rows[0].id;
            await client.query("INSERT INTO app_user_roles (user_id, role_id) VALUES ($1, $2)", [newUserId, roleId]);
        } else {
            console.error(`FATAL: Role '${roleNameToAssign}' not found. User ${newUserId} created without role.`);
        }

        // 4. Save Profile (Name)
        if (firstName || lastName) {
            await client.query(
                `INSERT INTO user_profiles (user_id, first_name, last_name, updated_at) VALUES ($1, $2, $3, NOW())`,
                [newUserId, firstName || '', lastName || '']
            );
        }

        // 5. Generate Invite Link
        const tokenResponse = await EmailPassword.createResetPasswordToken(tenantId, newUserId, email);
        if (tokenResponse.status === 'OK') {
            // FIX: Use Wizard URL -> Env -> Localhost Fallback
            const sysConfig = getSystemConfig();
            const baseUrl = sysConfig.publicUrl || process.env.APP_DOMAIN || 'http://localhost:5173';
            const inviteLink = `${baseUrl}/auth/reset-password?token=${tokenResponse.token}`;
            const companyName = sysConfig.companyName || 'Subfloor';
            
            // 6. Send Email
            const emailSuccess = await sendEmail({
                to: email,
                subject: `You have been invited to ${companyName}`,
                templateName: 'userInvite', // Use the new template
                data: {
                    firstName: firstName || 'there',
                    inviteLink: inviteLink,
                    currentYear: new Date().getFullYear()
                }
            });

            if (!emailSuccess) {
                // Warn the admin but don't fail the request since the user exists
                return res.status(201).json({ userId: newUserId, message: "User created, but failed to send invite email." });
            }
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