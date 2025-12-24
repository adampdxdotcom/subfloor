// src/utils/apiConfig.ts

export const STORAGE_KEY_API_URL = 'subfloor_server_url';

/**
 * Determines the Base URL for API requests.
 * 
 * Logic:
 * 1. If a user has manually set a server URL (e.g. on Mobile), use it.
 * 2. Otherwise, default to an empty string '' to allow the browser to 
 *    handle relative paths (standard web behavior).
 */
export const getBaseUrl = (): string => {
    const isCapacitor = (window as any).Capacitor !== undefined;

    // On standard Web, always use relative paths. 
    // This prevents browser users from being intercepted by the "Connect" screen.
    if (!isCapacitor) return '';

    const storedUrl = localStorage.getItem(STORAGE_KEY_API_URL);
    
    if (storedUrl) {
        // Ensure no trailing slash
        return storedUrl.replace(/\/$/, '');
    }

    // Default to relative path for standard web usage
    return '';
};

/**
 * Helper to construct full API endpoints.
 * Usage: getEndpoint('/api/jobs') -> 'https://site.com/api/jobs' OR '/api/jobs'
 */
export const getEndpoint = (path: string): string => {
    const base = getBaseUrl();
    const normalizedPath = path.startsWith('/') ? path : `/${path}`;
    return `${base}${normalizedPath}`;
};

/**
 * Converts a relative image path (e.g. /uploads/foo.jpg) to a full URL.
 * Handles paths that are already full URLs correctly.
 */
export const getImageUrl = (path: string | null | undefined): string => {
    if (!path) return '';
    if (path.startsWith('http')) return path;
    
    // Ensure path starts with /
    const normalizedPath = path.startsWith('/') ? path : `/${path}`;
    const base = getBaseUrl();
    
    // If base is empty (Web), relative path is fine.
    // If base is set (Mobile), prepend it.
    return `${base}${normalizedPath}`;
};