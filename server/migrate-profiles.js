import pool from './db.js';

const runMigration = async () => {
    console.log("Starting 'User Profiles' Migration...");
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        
        // Create the table if it doesn't exist
        // We use VARCHAR(255) for user_id to match your other tables
        await client.query(`
            CREATE TABLE IF NOT EXISTS user_profiles (
                user_id VARCHAR(255) PRIMARY KEY,
                first_name VARCHAR(100) DEFAULT '',
                last_name VARCHAR(100) DEFAULT '',
                avatar_url TEXT,
                created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
            );
        `);

        console.log("Table 'user_profiles' created successfully.");
        
        await client.query('COMMIT');
        console.log("Migration completed.");
    } catch (err) {
        await client.query('ROLLBACK');
        console.error("Migration failed:", err);
    } finally {
        client.release();
        process.exit();
    }
};

runMigration();