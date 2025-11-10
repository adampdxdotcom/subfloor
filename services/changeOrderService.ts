import { ChangeOrder } from "../types";

const API_BASE_URL = '/api/change-orders';

/**
 * Fetches all change orders from the API.
 */
export const getChangeOrders = async (): Promise<ChangeOrder[]> => {
    const response = await fetch(API_BASE_URL);
    if (!response.ok) {
        throw new Error('Failed to fetch change orders.');
    }
    return response.json();
};

/**
 * Adds a new change order for a project.
 */
export const addChangeOrder = async (changeOrderData: Omit<ChangeOrder, 'id' | 'createdAt'>): Promise<ChangeOrder> => {
    const response = await fetch(API_BASE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(changeOrderData)
    });
    if (!response.ok) {
        throw new Error('Failed to add change order.');
    }
    return response.json();
};

/**
 * Updates an existing change order.
 */
export const updateChangeOrder = async (changeOrderId: number, changeOrderData: Partial<Omit<ChangeOrder, 'id' | 'projectId' | 'createdAt'>>): Promise<ChangeOrder> => {
    const response = await fetch(`${API_BASE_URL}/${changeOrderId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(changeOrderData)
    });
    if (!response.ok) {
        throw new Error('Failed to update change order.');
    }
    return response.json();
};