import pool from './db.js';
import path from 'path';

console.log('--- Starting Historical Media Asset Migration ---');

const getMimeType = (filePath) => {
    if (!filePath) return 'application/octet-stream';
    const ext = path.extname(filePath).toLowerCase();
    switch (ext) {
        case '.jpg':
        case '.jpeg':
            return 'image/jpeg';
        case '.png':
            return 'image/png';
        case '.gif':
            return 'image/gif';
        case '.webp':
            return 'image/webp';
        case '.svg':
            return 'image/svg+xml';
        case '.pdf':
            return 'application/pdf';
        default:
            return 'application/octet-stream';
    }
};

const extractCategoryFromPath = (filePath) => {
    if (filePath.includes('/products/')) return 'products';
    if (filePath.includes('/avatars/')) return 'avatars';
    if (filePath.includes('/branding/')) return 'branding';
    if (filePath.includes('/jobs/')) return 'jobs';
    return 'misc';
};

const migrate = async () => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        console.log('🔍 Scanning database for existing file paths...');

        const queries = [
            // Products & Variants
            `SELECT default_image_url as path, default_thumbnail_url as thumb FROM products WHERE default_image_url IS NOT NULL`,
            `SELECT image_url as path, thumbnail_url as thumb FROM product_variants WHERE image_url IS NOT NULL`,
            // Job/Project Photos
            `SELECT url as path, thumbnail_url as thumb FROM photos WHERE url IS NOT NULL`,
            // User Avatars
            `SELECT avatar_url as path, null as thumb FROM user_profiles WHERE avatar_url IS NOT NULL`,
            // Branding Assets (Logo & Favicon)
            `SELECT settings->>'logoUrl' as path, null as thumb FROM system_preferences WHERE key = 'branding' AND settings->>'logoUrl' IS NOT NULL`,
            `SELECT settings->>'faviconUrl' as path, null as thumb FROM system_preferences WHERE key = 'branding' AND settings->>'faviconUrl' IS NOT NULL`,
        ];

        let totalPathsFound = 0;
        const uniquePaths = new Map();

        for (const query of queries) {
            const result = await client.query(query);
            for (const row of result.rows) {
                if (row.path && !uniquePaths.has(row.path)) {
                    uniquePaths.set(row.path, {
                        filePath: row.path,
                        thumbnailPath: row.thumb,
                        category: extractCategoryFromPath(row.path),
                        fileType: getMimeType(row.path),
                    });
                    totalPathsFound++;
                }
            }
        }
        
        console.log(`✅ Found ${totalPathsFound} unique file paths to migrate.`);

        if (totalPathsFound === 0) {
            console.log('No new assets to migrate. Database is up to date.');
            await client.query('COMMIT');
            return;
        }

        console.log('🚀 Inserting records into media_assets table...');
        
        const insertQuery = `
            INSERT INTO media_assets (file_path, thumbnail_path, file_type, category)
            VALUES ($1, $2, $3, $4)
            ON CONFLICT (file_path) DO NOTHING;
        `;
        
        let insertedCount = 0;
        for (const asset of uniquePaths.values()) {
            const res = await client.query(insertQuery, [
                asset.filePath,
                asset.thumbnailPath,
                asset.fileType,
                asset.category,
            ]);
            if (res.rowCount > 0) {
                insertedCount++;
            }
        }

        await client.query('COMMIT');
        console.log(`🎉 Success! Inserted ${insertedCount} new records into media_assets.`);
        if(insertedCount < totalPathsFound) {
            console.log(`   (${totalPathsFound - insertedCount} records already existed and were skipped.)`);
        }

    } catch (err) {
        await client.query('ROLLBACK');
        console.error('🔥 Migration failed:', err);
        throw err;
    } finally {
        client.release();
        console.log('--- Migration script finished ---');
    }
};

// --- SCRIPT EXECUTION ---
// We wrap the call in an async function to properly await its completion.
const run = async () => {
    try {
        await migrate();
    } catch (error) {
        // The script will now log any errors instead of exiting silently.
        process.exit(1);
    }
};

run();