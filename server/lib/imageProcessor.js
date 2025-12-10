import path from 'path';
import fs from 'fs-extra';
import sharp from 'sharp';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// FIX: Enforce absolute path in production to match Volume and Routes
const uploadRoot = process.env.NODE_ENV === 'production' 
    ? '/app/server/uploads' 
    : path.join(__dirname, '../uploads');

/**
 * Processes an uploaded image/file:
 * 1. Creates 'originals' and 'thumbnails' folders in the target directory if needed.
 * 2. Moves the uploaded temp file to 'originals'.
 * 3. Generates a 300px thumbnail in 'thumbnails' IF it's an image.
 * 
 * @param {Object} file - The file object from Multer.
 * @param {string} category - The subfolder name (e.g., 'products', 'jobs').
 * @param {string} prefix - Optional prefix for the filename (default: 'img').
 * @returns {Promise<{imageUrl: string, thumbnailUrl: string | null, fileName: string | null, mimeType: string | null}>}
 */
export const processImage = async (file, category, prefix = 'img') => {
    if (!file) return { imageUrl: null, thumbnailUrl: null, fileName: null, mimeType: null };

    const categoryRoot = path.join(uploadRoot, category);
    
    // Ensure structure exists
    await fs.ensureDir(path.join(categoryRoot, 'originals'));
    await fs.ensureDir(path.join(categoryRoot, 'thumbnails'));

    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1E9)}`;
    const originalExt = path.extname(file.originalname).toLowerCase();
    
    // Use original name for documents to keep them readable, but sanitized
    const sanitizedOriginalName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
    const finalFilename = `${prefix}-${uniqueSuffix}-${sanitizedOriginalName}`;

    const tempPath = file.path;
    const originalPath = path.join(categoryRoot, 'originals', finalFilename);
    
    // Determine if it's an image we can resize
    const isImage = ['.jpg', '.jpeg', '.png', '.webp', '.avif'].includes(originalExt);

    try {
        // 1. Move Original
        await fs.move(tempPath, originalPath);

        let thumbnailUrl = null;

        // 2. Generate Thumbnail ONLY if it's an image
        if (isImage) {
            const thumbnailName = `${prefix}-${uniqueSuffix}-thumb.jpg`;
            const thumbnailPath = path.join(categoryRoot, 'thumbnails', thumbnailName);
            
            await sharp(originalPath)
                .resize(300)
                .jpeg({ quality: 80 })
                .toFile(thumbnailPath);
            
            thumbnailUrl = `/uploads/${category}/thumbnails/${thumbnailName}`;
        }

        return {
            imageUrl: `/uploads/${category}/originals/${finalFilename}`,
            thumbnailUrl: thumbnailUrl,
            fileName: sanitizedOriginalName,
            mimeType: file.mimetype || 'application/octet-stream'
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
export const downloadAndProcessImage = async (url, category, prefix = 'import', options = {}) => {
    try {
        const res = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.9',
                'Sec-Ch-Ua': '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
                'Sec-Ch-Ua-Mobile': '?0',
                'Sec-Ch-Ua-Platform': '"Windows"',
                'Sec-Fetch-Dest': 'document',
                'Sec-Fetch-Mode': 'navigate',
                'Sec-Fetch-Site': 'none',
                'Sec-Fetch-User': '?1',
                'Upgrade-Insecure-Requests': '1'
            }
        });
        if (!res.ok) throw new Error(`Failed to fetch external image: ${res.statusText}`);
        
        // Verify we actually got an image (and not a CAPTCHA/Block page)
        const contentType = res.headers.get('content-type');
        if (!contentType || !contentType.startsWith('image/')) {
            throw new Error(`Invalid content type: ${contentType}`);
        }

        const arrayBuffer = await res.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        
        // Save to temp
        const tempName = `temp-${Date.now()}.jpg`;
        const tempPath = path.join(uploadRoot, tempName);
        await fs.writeFile(tempPath, buffer);

        const mockFile = {
            path: tempPath,
            originalname: 'external.jpg',
            mimetype: 'image/jpeg'
        };

        // If we skip the original, we manually run the thumbnail process and clean up the original.
        if (options.skipOriginal) {
             const categoryRoot = path.join(uploadRoot, category);
             await fs.ensureDir(path.join(categoryRoot, 'thumbnails'));

             const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1E9)}`;
             const thumbnailName = `${prefix}-${uniqueSuffix}-thumb.jpg`; 
             const thumbnailPath = path.join(categoryRoot, 'thumbnails', thumbnailName);

             await sharp(tempPath)
                 .resize(300)
                 .jpeg({ quality: 80 })
                 .toFile(thumbnailPath);

             await fs.remove(tempPath); // Clean up temp original

             return {
                 imageUrl: null, // Only thumbnail generated
                 thumbnailUrl: `/uploads/${category}/thumbnails/${thumbnailName}`
             };
        }

        // If not skipping, process normally (this will handle moving the temp file)
        return await processImage(mockFile, category, prefix);
    } catch (error) {
        console.error("Failed to download external image:", error);
        // Re-throw so the UI knows the upload failed
        throw error;
    }
};