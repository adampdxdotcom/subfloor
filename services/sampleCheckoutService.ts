import { SampleCheckout } from "../types";

const API_BASE_URL = '/api/sample-checkouts';

/**
 * Fetches all sample checkouts, optionally filtered by projectId.
 */
export const getSampleCheckouts = async (projectId?: number): Promise<SampleCheckout[]> => {
    const url = projectId ? `${API_BASE_URL}?projectId=${projectId}` : API_BASE_URL;
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error('Failed to fetch sample checkouts.');
    }
    return response.json();
};

/**
 * Creates a new sample checkout record.
 */
export const addSampleCheckout = async (checkoutData: any): Promise<SampleCheckout> => {
    const response = await fetch(API_BASE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(checkoutData)
    });
    if (!response.ok) {
        throw new Error('Failed to check out sample.');
    }
    return response.json();
};

/**
 * Updates a sample checkout to mark it as returned.
 */
export const returnSampleCheckout = async (checkout: SampleCheckout): Promise<SampleCheckout> => {
    const response = await fetch(`${API_BASE_URL}/${checkout.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}) 
    });
    if (!response.ok) {
        throw new Error('Failed to return sample.');
    }
    return response.json();
};

// --- NEW FUNCTION TO EXTEND CHECKOUTS ---
/**
 * Partially updates a sample checkout record, e.g., to change the return date or selection status.
 */
export const patchSampleCheckout = async (checkoutId: number, data: { expectedReturnDate?: string; isSelected?: boolean }): Promise<SampleCheckout> => {
    const response = await fetch(`${API_BASE_URL}/${checkoutId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
    });
    if (!response.ok) {
        throw new Error('Failed to update sample checkout.');
    }
    return response.json();
};