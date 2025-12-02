import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pool from '../db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const initDatabase = async () => {
    const client = await pool.connect();
    try {
        // 1. Check if a critical table exists (e.g., 'projects')
        const check = await client.query(`
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_schema = 'public' 
                AND table_name = 'projects'
            );
        `);

        const isInitialized = check.rows[0].exists;

        if (isInitialized) {
            console.log('✅ Database tables already exist. Skipping initialization.');
            return;
        }

        console.log('⚠️ Empty database detected. Running schema.sql...');

        // 2. Read schema file
        // In Prod, Docker copies it to server/schema.sql. In Dev, it's at root/schema.sql
        // We check a few relative paths to be safe.
        let schemaPath = path.join(__dirname, '../schema.sql'); // Prod location
        if (!fs.existsSync(schemaPath)) {
            schemaPath = path.join(__dirname, '../../schema.sql'); // Dev location
        }

        if (!fs.existsSync(schemaPath)) {
            console.error('❌ FATAL: Could not find schema.sql at', schemaPath);
            return;
        }

        const schemaSql = fs.readFileSync(schemaPath, 'utf8');

        // 3. Execute Schema
        await client.query('BEGIN');
        await client.query(schemaSql);
        await client.query('COMMIT');

        console.log('🚀 Database initialized successfully!');

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('❌ Database initialization failed:', error);
        // We don't exit process here, strictly speaking, to keep server alive for debug, 
        // but the app won't work well.
    } finally {
        client.release();
    }
};