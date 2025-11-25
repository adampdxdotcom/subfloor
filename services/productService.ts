// services/productService.ts

import { Product, ProductVariant } from '../types';
import { ActivityLogEntry } from '../types'; // Assuming this import exists or is needed for getProductHistory

const API_URL = '/api/products';

/**
 * Fetches all products with their nested variants.
 */
export const getProducts = async (): Promise<Product[]> => {
    const response = await fetch(API_URL);
    if (!response.ok) {
        throw new Error('Failed to fetch products');
    }
    return response.json();
};

/**
 * Fetches discontinued products (Parent level only).
 */
export const getDiscontinuedProducts = async (): Promise<Product[]> => {
    const response = await fetch(`${API_URL}/discontinued`);
    if (!response.ok) {
        throw new Error('Failed to fetch discontinued products');
    }
    return response.json();
};

/**
 * Fetches history for a product.
 */
export const getProductHistory = async (id: string): Promise<ActivityLogEntry[]> => {
    const response = await fetch(`${API_URL}/${id}/history`);
    if (!response.ok) {
        throw new Error('Failed to fetch product history');
    }
    return response.json();
};

/**
 * Creates a new Parent Product.
 * @param formData Must contain 'name', 'productType', etc., and optionally 'image'.
 */
export const createProduct = async (formData: FormData): Promise<Product> => {
    const response = await fetch(API_URL, {
        method: 'POST',
        // Content-Type header is set automatically by browser for FormData
        body: formData,
    });

    if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Failed to create product' }));
        throw new Error(error.error || 'Failed to create product');
    }
    return response.json();
};

/**
 * Updates a Parent Product.
 */
export const updateProduct = async (id: string, formData: FormData): Promise<Product> => {
    const response = await fetch(`${API_URL}/${id}`, {
        method: 'PATCH',
        body: formData,
    });

    if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Failed to update product' }));
        throw new Error(error.error || 'Failed to update product');
    }
    return response.json();
};

/**
 * Deletes a Parent Product (and cascades to all variants).
 */
export const deleteProduct = async (id: string): Promise<void> => {
    const response = await fetch(`${API_URL}/${id}`, {
        method: 'DELETE',
    });

    if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Failed to delete product' }));
        throw new Error(error.error || 'Failed to delete product');
    }
};

/**
 * Adds a new Variant to an existing Product.
 */
export const addVariant = async (productId: string, formData: FormData): Promise<ProductVariant> => {
    const response = await fetch(`${API_URL}/${productId}/variants`, {
        method: 'POST',
        body: formData,
    });

    if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Failed to add variant' }));
        throw new Error(error.error || 'Failed to add variant');
    }
    return response.json();
};

// --- NEW: Batch Create Variants ---
export const createVariantsBatch = async (productId: string, variants: any[]): Promise<any[]> => {
    const response = await fetch(`${API_URL}/${productId}/variants/batch`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ variants }),
    });
    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to batch create variants.');
    }
    return response.json();
};

/**
 * Patches a specific Product Variant.
 */
export const updateVariant = async (variantId: string, formData: FormData): Promise<ProductVariant> => {
    const response = await fetch(`${API_URL}/variants/${variantId}`, {
        method: 'PATCH',
        body: formData,
    });
    if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Failed to update variant' }));
        throw new Error(error.error || 'Failed to update variant');
    }
    return response.json();
};

/**
 * Deletes a specific Product Variant.
 */
export const deleteVariant = async (variantId: string): Promise<void> => {
    const response = await fetch(`${API_URL}/variants/${variantId}`, { method: 'DELETE' });
    if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Failed to delete variant' }));
        throw new Error(error.error || 'Failed to delete variant');
    }
};