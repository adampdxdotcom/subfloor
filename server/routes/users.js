import express from 'express';
import supertokens from 'supertokens-node';
import EmailPassword from 'supertokens-node/recipe/emailpassword/index.js';
import { verifySession } from 'supertokens-node/recipe/session/framework/express/index.js';
import pool from '../db.js';

const router = express.Router();

// GET /api/users - Fetch all users
router.get('/', verifySession(), async (req, res, next) => {
  try {
    // Corrected query to JOIN the two tables to get the email address.
    const query = `
      SELECT
        a.user_id,
        e.email
      FROM all_auth_recipe_users AS a
      JOIN emailpassword_users AS e ON a.user_id = e.user_id
      ORDER BY e.email ASC;
    `;
    const result = await pool.query(query);
    
    const users = result.rows.map(row => ({
      userId: row.user_id,
      email: row.email,
    }));

    res.json(users);
  } catch (err) {
    console.error("ERROR in GET /api/users:", err);
    next(err);
  }
});

// --- NEW ENDPOINT ---
// GET /api/users/me - Fetch details for the currently logged-in user
router.get('/me', verifySession(), async (req, res, next) => {
  try {
    // The verifySession() middleware adds the session object to the request.
    const userId = req.session.getUserId();

    const query = `
      SELECT user_id, email FROM emailpassword_users WHERE user_id = $1
    `;
    const result = await pool.query(query, [userId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'User not found.' });
    }

    const user = {
      userId: result.rows[0].user_id,
      email: result.rows[0].email
    };

    res.json(user);
  } catch (err) {
    console.error("ERROR in GET /api/users/me:", err);
    next(err);
  }
});

// POST /api/users - Create a new user
router.post('/', verifySession(), async (req, res, next) => {
  const { email, password } = req.body;
  const tenantId = "public"; // Explicitly specify the tenantId

  if (!email || !password) {
    return res.status(400).json({ message: 'Email and password are required.' });
  }

  try {
    // Pass the tenantId to the signUp function, as required by the newer SDK version.
    const response = await EmailPassword.signUp(tenantId, email, password);

    if (response.status === 'OK') {
      res.status(201).json({ 
        userId: response.user.id, 
        email: response.user.email 
      });
    } else if (response.status === 'EMAIL_ALREADY_EXISTS_ERROR') {
      res.status(409).json({ message: 'This email address is already in use.' });
    } else {
      console.error("Unexpected SuperTokens signUp status:", response.status);
      res.status(500).json({ message: 'An unexpected error occurred during sign up.' });
    }
  } catch (err) {
    console.error("ERROR in POST /api/users:", err);
    next(err);
  }
});

// DELETE /api/users/:userId - Delete a user
router.delete('/:userId', verifySession(), async (req, res, next) => {
  const { userId } = req.params;

  try {
    await supertokens.deleteUser(userId);
    res.status(204).send();
  } catch (err) {
    console.error(`ERROR in DELETE /api/users/${userId}:`, err);
    next(err);
  }
});

export default router;