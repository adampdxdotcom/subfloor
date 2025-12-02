import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pool from '../db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Checks if the database is initialized.
 * If not, runs the schema.sql file.
 */
export const initDatabase = async () => {
  const client = await pool.connect();
  try {
    // 1. Check if a core table exists (e.g., system_preferences)
    const checkRes = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'system_preferences'
      );
    `);

    const isInitialized = checkRes.rows[0].exists;

    if (isInitialized) {
      console.log("✅ Database tables already exist.");
      return;
    }

    console.log("⚠️ Database empty. Running schema initialization...");

    // 2. Locate schema.sql
    // In Docker/Prod, it's copied to server/schema.sql (sibling to index.js)
    // In Dev, it might be in the project root. We try a few paths.
    const possiblePaths = [
      path.join(__dirname, '../schema.sql'),      // From server/lib/ -> server/schema.sql
      path.join(__dirname, '../../schema.sql'),   // From server/lib/ -> root/schema.sql
    ];

    let schemaSql = null;
    for (const p of possiblePaths) {
      if (fs.existsSync(p)) {
        schemaSql = fs.readFileSync(p, 'utf8');
        console.log(`📂 Found schema at: ${p}`);
        break;
      }
    }

    if (!schemaSql) {
      console.error("❌ CRITICAL: Could not find schema.sql to initialize database.");
      return;
    }

    // 3. Run Schema
    await client.query('BEGIN');
    await client.query(schemaSql);
    await client.query('COMMIT');
    
    console.log("🚀 Database Schema successfully applied!");

  } catch (error) {
    await client.query('ROLLBACK');
    console.error("❌ Failed to initialize database:", error);
    process.exit(1); // Fatal error
  } finally {
    client.release();
  }
};