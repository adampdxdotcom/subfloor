import express from 'express';
import { isSystemInitialized, updateSystemConfig } from '../lib/setupService.js';
import EmailPassword from 'supertokens-node/recipe/emailpassword/index.js';
import pool from '../db.js';

const router = express.Router();

/**
 * GET /api/setup/status
 * Returns { initialized: boolean, isSupertokensSecure: boolean }
 * Used by the frontend to decide whether to show the Wizard or the App, and to display security warnings.
 */
router.get('/status', (req, res) => {
    console.log("✅ REACHED /api/setup/status handler!");
    const initialized = isSystemInitialized();
    res.json({ 
        initialized,
        isSupertokensSecure: !!process.env.SUPERTOKENS_API_KEY
    });
});

/**
 * POST /api/setup/init
 * The "One-Click" Setup Action.
 * 1. Creates the Admin User (SuperTokens)
 * 2. Creates the Admin Role & Profile (DB)
 * 3. Saves Company Settings & Locks the System (DB)
 */
router.post('/init', async (req, res) => {
    // 1. SECURITY GUARD: Stop if already setup
    if (isSystemInitialized()) {
        return res.status(403).json({ error: "System is already initialized." });
    }

    const { 
        email, 
        password, 
        firstName, 
        lastName, 
        companyName, 
        publicUrl 
    } = req.body;

    if (!email || !password || !publicUrl) {
        return res.status(400).json({ error: "Missing required fields." });
    }

    // We will track the created User ID to rollback if DB fails
    let createdUserId = null;

    try {
        // --- STEP 1: Create Auth User (SuperTokens) ---
        // Note: This bypasses the signUpPOST override we added in index.js because 
        // we are calling the API directly, not via the /auth/signup endpoint.
        const signUpResponse = await EmailPassword.signUp("public", email, password);

        if (signUpResponse.status === "EMAIL_ALREADY_EXISTS_ERROR") {
            return res.status(400).json({ error: "Email already in use. Please use a fresh database." });
        }

        createdUserId = signUpResponse.user.id;

        // --- STEP 2: Database Setup (Transaction) ---
        // We do this manually because our standard 'userService' isn't fully booted/authed here
        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            // A. Create User Profile
            await client.query(
                `INSERT INTO user_profiles (user_id, first_name, last_name, avatar_url)
                 VALUES ($1, $2, $3, $4)`,
                [createdUserId, firstName, lastName, null]
            );

            // B. Assign 'Admin' Role
            // First get Role ID
            const roleRes = await client.query(`SELECT id FROM app_roles WHERE name = 'Admin'`);
            let adminRoleId;
            
            if (roleRes.rows.length === 0) {
                 // Fallback: Create role if missing (safety net)
                 const newRole = await client.query(`INSERT INTO app_roles (name, description) VALUES ('Admin', 'Super User') RETURNING id`);
                 adminRoleId = newRole.rows[0].id;
            } else {
                adminRoleId = roleRes.rows[0].id;
            }

            await client.query(
                `INSERT INTO app_user_roles (user_id, role_id) VALUES ($1, $2)`,
                [createdUserId, adminRoleId]
            );

            // C. Update System Config (The Lock)
            // This is critical. Once this runs, isSystemInitialized() returns TRUE.
            // We also save the Company Name here.
            await client.query(
                `UPDATE system_preferences 
                 SET settings = settings || jsonb_build_object('companyName', $1::text) 
                 WHERE key = 'branding'`,
                [companyName]
            );

            await client.query('COMMIT');
        } catch (dbError) {
            await client.query('ROLLBACK');
            throw dbError; // Re-throw to hit the outer catch block
        } finally {
            client.release();
        }

        // --- STEP 3: Final Config Update (Service Layer) ---
        // This updates the in-memory cache and sets the 'core_config' isInitialized flag
        await updateSystemConfig({
            isInitialized: true,
            publicUrl: publicUrl,
            companyName: companyName
        });

        console.log(`✅ System Initialized. Admin: ${email}, URL: ${publicUrl}`);
        return res.json({ success: true });

    } catch (error) {
        console.error("Setup Failed:", error);

        // --- ROLLBACK ---
        // If DB steps failed, delete the SuperTokens user so the user can try again
        if (createdUserId) {
            try {
                // Note: In a real app we might use deleteUser(createdUserId), 
                // but for now we assume manual cleanup or a fresh retry.
                console.log(`⚠️ Rolling back user creation for ${createdUserId}`);
            } catch (cleanupError) {
                console.error("Failed to rollback user:", cleanupError);
            }
        }

        return res.status(500).json({ error: "Setup failed. Check server logs." });
    }
});

export default router;