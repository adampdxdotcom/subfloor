const { sql } = require('drizzle-orm'); 
// Note: Even if not using drizzle ORM directly in these scripts, 
// we stick to the project's migration pattern. 
// If your custom runner just takes raw SQL:

exports.up = async (client) => {
    await client.query(`
        ALTER TABLE user_preferences 
        ADD COLUMN IF NOT EXISTS calendar_token VARCHAR(255) UNIQUE;
    `);
    
    // Optional: Backfill existing preferences with a token if you want immediate access,
    // but usually better to generate on demand via UI to avoid "dead" tokens.
};

exports.down = async (client) => {
    await client.query(`
        ALTER TABLE user_preferences 
        DROP COLUMN IF EXISTS calendar_token;
    `);
};