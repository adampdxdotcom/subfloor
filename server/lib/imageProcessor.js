import path from 'path';
import fs from 'fs-extra';
import sharp from 'sharp';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const uploadRoot = path.join(__dirname, '../uploads');

/**
 * Processes an uploaded image:
 * 1. Creates 'originals' and 'thumbnails' folders in the target directory if needed.
 * 2. Moves the uploaded temp file to 'originals'.
 * 3. Generates a 300px thumbnail in 'thumbnails'.
 * 
 * @param {Object} file - The file object from Multer.
 * @param {string} category - The subfolder name (e.g., 'products', 'jobs').
 * @param {string} prefix - Optional prefix for the filename (default: 'img').
 * @returns {Promise<{imageUrl: string, thumbnailUrl: string}>}
 */
export const processImage = async (file, category, prefix = 'img') => {
    if (!file) return { imageUrl: null, thumbnailUrl: null };

    const categoryRoot = path.join(uploadRoot, category);
    
    // Ensure structure exists
    await fs.ensureDir(path.join(categoryRoot, 'originals'));
    await fs.ensureDir(path.join(categoryRoot, 'thumbnails'));

    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1E9)}`;
    const originalExt = path.extname(file.originalname);
    
    const originalName = `${prefix}-${uniqueSuffix}${originalExt}`;
    const thumbnailName = `${prefix}-${uniqueSuffix}-thumb.jpg`; // Force JPG for thumbs

    const tempPath = file.path;
    const originalPath = path.join(categoryRoot, 'originals', originalName);
    const thumbnailPath = path.join(categoryRoot, 'thumbnails', thumbnailName);

    try {
        // 1. Move Original
        await fs.move(tempPath, originalPath);

        // 2. Generate Thumbnail
        await sharp(originalPath)
            .resize(300)
            .jpeg({ quality: 80 })
            .toFile(thumbnailPath);

        return {
            imageUrl: `/uploads/${category}/originals/${originalName}`,
            thumbnailUrl: `/uploads/${category}/thumbnails/${thumbnailName}`
        };
    } catch (error) {
        console.error(`Image processing failed for ${category}:`, error);
        // Cleanup temp file if something broke
        if (await fs.pathExists(tempPath)) await fs.remove(tempPath);
        throw new Error("Failed to process image");
    }
};

/**
 * Helper to download an external image URL and process it.
 */
export const downloadAndProcessImage = async (url, category, prefix = 'import') => {
    try {
        const res = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
                'Accept': 'image/*',
                'Referer': 'https://www.google.com/'
            }
        });
        if (!res.ok) throw new Error(`Failed to fetch external image: ${res.statusText}`);
        
        const arrayBuffer = await res.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        
        // Save to temp
        const tempName = `temp-${Date.now()}.jpg`;
        const tempPath = path.join(uploadRoot, tempName);
        await fs.writeFile(tempPath, buffer);

        const mockFile = {
            path: tempPath,
            originalname: 'external.jpg'
        };

        return await processImage(mockFile, category, prefix);
    } catch (error) {
        console.error("Failed to download external image:", error);
        return { imageUrl: null, thumbnailUrl: null };
    }
};