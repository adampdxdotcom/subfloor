// server/make-admin.js

import pool from './db.js';

const makeAdmin = async () => {
  const email = process.argv[2];
  if (!email) {
    console.error('ERROR: Please provide an email address as an argument.');
    console.log('Usage: node make-admin.js user@example.com');
    process.exit(1);
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Find the user ID for the given email
    const userResult = await client.query(
      "SELECT user_id FROM emailpassword_users WHERE email = $1",
      [email]
    );

    if (userResult.rows.length === 0) {
      throw new Error(`User with email "${email}" not found.`);
    }
    const userId = userResult.rows[0].user_id;
    console.log(`Found user ID: ${userId} for email: ${email}`);

    // 2. Find the ID for the 'Admin' role
    const roleResult = await client.query(
      "SELECT id FROM app_roles WHERE name = 'Admin'"
    );

    if (roleResult.rows.length === 0) {
      throw new Error("'Admin' role not found in app_roles table. Please ensure the database is seeded correctly.");
    }
    const adminRoleId = roleResult.rows[0].id;
    console.log(`Found 'Admin' role with ID: ${adminRoleId}`);

    // 3. Insert the user-role mapping, ignoring if it already exists
    await client.query(
      "INSERT INTO app_user_roles (user_id, role_id) VALUES ($1, $2) ON CONFLICT (user_id, role_id) DO NOTHING",
      [userId, adminRoleId]
    );

    await client.query('COMMIT');
    console.log(`✅ Successfully assigned 'Admin' role to ${email}.`);

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ FAILED to assign admin role:', error.message);
    process.exit(1);
  } finally {
    client.release();
    pool.end();
  }
};

makeAdmin();