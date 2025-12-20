import { ChangeOrder } from "../types";
import { getEndpoint } from "../utils/apiConfig";

const getApiUrl = () => getEndpoint('/api/change-orders');

/**
 * Fetches all change orders from the API.
 */
export const getChangeOrders = async (): Promise<ChangeOrder[]> => {
    const response = await fetch(getApiUrl());
    if (!response.ok) {
        throw new Error('Failed to fetch change orders.');
    }
    return response.json();
}

/**
 * Adds a new change order for a project.
 */
export const addChangeOrder = async (changeOrderData: Omit<ChangeOrder, 'id' | 'createdAt'>): Promise<ChangeOrder> => {
    const response = await fetch(getApiUrl(), {
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
    const response = await fetch(`${getApiUrl()}/${changeOrderId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(changeOrderData)
    });
    if (!response.ok) {
        throw new Error('Failed to update change order.');
    }
    return response.json();
};

/**
 * Deletes a change order by its ID.
 * @param changeOrderId The ID of the change order to delete.
 */
export const deleteChangeOrder = async (changeOrderId: number): Promise<void> => {
    const response = await fetch(`${getApiUrl()}/${changeOrderId}`, {
        method: 'DELETE'
    });

    if (!response.ok) {
        // Handle cases where the server sends a specific error message (like 403 Forbidden)
        if (response.status === 403 || response.status === 404) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to delete change order.');
        }
        throw new Error('Failed to delete change order.');
    }
    // A successful DELETE should return a 204 No Content, so we don't return JSON.
};