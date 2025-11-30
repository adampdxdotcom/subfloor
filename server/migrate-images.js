import pg from 'pg';
import fs from 'fs-extra';
import path from 'path';
import sharp from 'sharp';
import { fileURLToPath } from 'url';

// --- CONFIGURATION ---
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const uploadRoot = path.join(__dirname, 'uploads');
const productRoot = path.join(uploadRoot, 'products');

// Ensure directories exist
fs.ensureDirSync(path.join(productRoot, 'originals'));
fs.ensureDirSync(path.join(productRoot, 'thumbnails'));

// Database Config (Matches Docker internal network)
const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://postgres:password@db:5432/supertokens'
});

const processEntity = async (client, table, idColumn, imageColumn, thumbColumn, entityName) => {
    console.log(`\n--- Processing ${entityName} ---`);
    
    // Find items that have images but NO thumbnail yet (or old path structure)
    // We look for images that are NOT null, and check if they are still in the root /uploads/
    const res = await client.query(`
        SELECT ${idColumn}, ${imageColumn} 
        FROM ${table} 
        WHERE ${imageColumn} IS NOT NULL 
        AND ${imageColumn} LIKE '/uploads/%' 
        AND ${imageColumn} NOT LIKE '/uploads/products/%'
    `);

    console.log(`Found ${res.rows.length} ${entityName} to migrate.`);

    for (const row of res.rows) {
        const oldUrl = row[imageColumn];
        const id = row[idColumn];

        // 1. Resolve File Path
        // URL: /uploads/my-image.jpg -> File: /app/uploads/my-image.jpg
        const filename = path.basename(oldUrl);
        const oldPath = path.join(uploadRoot, filename);
        
        // New Paths
        const newFilename = `migrated-${id}-${Date.now()}${path.extname(filename)}`;
        const newOriginalPath = path.join(productRoot, 'originals', newFilename);
        const newThumbPath = path.join(productRoot, 'thumbnails', `${newFilename}-thumb.jpg`);

        try {
            // Check if file actually exists
            if (!await fs.pathExists(oldPath)) {
                console.warn(`[WARN] File missing for ${entityName} ${id}: ${oldPath}`);
                continue;
            }

            // 2. Move File
            await fs.move(oldPath, newOriginalPath);

            // 3. Generate Thumbnail
            await sharp(newOriginalPath)
                .resize(300)
                .jpeg({ quality: 80 })
                .toFile(newThumbPath);

            // 4. Update Database
            const newImageUrl = `/uploads/products/originals/${newFilename}`;
            const newThumbUrl = `/uploads/products/thumbnails/${newFilename}-thumb.jpg`;

            await client.query(`
                UPDATE ${table} 
                SET ${imageColumn} = $1, ${thumbColumn} = $2 
                WHERE ${idColumn} = $3
            `, [newImageUrl, newThumbUrl, id]);

            console.log(`[OK] Migrated ${entityName} ${id}`);

        } catch (err) {
            console.error(`[ERR] Failed to migrate ${entityName} ${id}:`, err.message);
        }
    }
};

const run = async () => {
    const client = await pool.connect();
    try {
        await processEntity(client, 'products', 'id', 'default_image_url', 'default_thumbnail_url', 'Products');
        await processEntity(client, 'product_variants', 'id', 'image_url', 'thumbnail_url', 'Variants');
        console.log('\n--- Migration Complete ---');
    } catch (err) {
        console.error('Migration failed:', err);
    } finally {
        client.release();
        await pool.end();
    }
};

run();