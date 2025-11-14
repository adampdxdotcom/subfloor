// services/materialOrderService.ts

import { MaterialOrder, ActivityLogEntry } from "../types"; // <-- MODIFIED: Added ActivityLogEntry

const API_BASE_URL = '/api/orders';

/**
 * Fetches all material orders from the API.
 */
export const getMaterialOrders = async (): Promise<MaterialOrder[]> => {
    const response = await fetch(API_BASE_URL);
    if (!response.ok) {
        throw new Error('Failed to fetch material orders.');
    }
    return response.json();
};

/**
 * Adds a new material order.
 * The payload should include projectId and line items with unit and totalCost.
 * @param {object} orderData - The order data from the form.
 * @param {number} orderData.projectId - The ID of the project.
 * @param {string | null} orderData.supplier - The supplier name.
 * @param {string | null} orderData.etaDate - The estimated arrival date.
 * @param {Array<{sampleId: number, quantity: number, unit: string | null, totalCost: number | null}>} orderData.lineItems - The line items.
 */
export const addMaterialOrder = async (orderData: any): Promise<MaterialOrder> => {
    const response = await fetch(API_BASE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(orderData),
    });
    if (!response.ok) {
        const errorBody = await response.json();
        throw new Error(errorBody.error || 'Failed to create material order');
    }
    return response.json();
};

/**
 * Updates an existing material order.
 * The payload should include supplier, etaDate, and line items with unit and totalCost.
 * @param {number} orderId - The ID of the order to update.
 * @param {object} orderData - The order data from the form.
 * @param {string | null} orderData.supplier - The supplier name.
 * @param {string | null} orderData.etaDate - The estimated arrival date.
 * @param {Array<{sampleId: number, quantity: number, unit: string | null, totalCost: number | null}>} orderData.lineItems - The line items.
 */
export const updateMaterialOrder = async (orderId: number, orderData: any): Promise<MaterialOrder> => {
    const response = await fetch(`${API_BASE_URL}/${orderId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(orderData),
    });
    if (!response.ok) {
        const errorBody = await response.json();
        throw new Error(errorBody.error || 'Failed to update material order');
    }
    return response.json();
};

/**
 * Deletes an existing material order.
 * @param {number} orderId - The ID of the order to delete.
 */
export const deleteMaterialOrder = async (orderId: number): Promise<void> => {
    const response = await fetch(`${API_BASE_URL}/${orderId}`, {
        method: 'DELETE',
    });
    if (!response.ok) {
        const errorBody = await response.json().catch(() => ({})); // Handle cases where body might be empty
        throw new Error(errorBody.error || 'Failed to delete material order');
    }
};

// =================================================================
//  NEW HISTORY FUNCTION
// =================================================================
/**
 * Fetches the activity history for a specific material order.
 * @param orderId The ID of the material order.
 * @returns A promise that resolves to an array of activity log entries.
 */
export const getMaterialOrderHistory = async (orderId: number): Promise<ActivityLogEntry[]> => {
    const response = await fetch(`${API_BASE_URL}/${orderId}/history`);
    if (!response.ok) {
        throw new Error('Failed to fetch material order history.');
    }
    return response.json();
};
// =================================================================