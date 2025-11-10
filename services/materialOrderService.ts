import { MaterialOrder } from "../types";

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
 * The 'any' type is used here because the incoming data structure from the form
 * doesn't perfectly match the final MaterialOrder type.
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