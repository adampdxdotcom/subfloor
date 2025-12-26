import { SampleCheckout } from "../types";
import { getEndpoint } from "../utils/apiConfig";

const getApiUrl = () => getEndpoint('/api/sample-checkouts');

/**
 * Fetches all sample checkouts, optionally filtered by projectId.
 */
export const getSampleCheckouts = async (projectId?: number): Promise<SampleCheckout[]> => {
    const baseUrl = getApiUrl();
    const url = projectId ? `${baseUrl}?projectId=${projectId}` : baseUrl;
    const response = await fetch(url, { credentials: 'include' });
    if (!response.ok) {
        throw new Error('Failed to fetch sample checkouts.');
    }
    return response.json();
};

export const getCheckoutsByCustomer = async (customerId: number): Promise<SampleCheckout[]> => {
    const response = await fetch(`${getApiUrl()}?customerId=${customerId}`, { credentials: 'include' });
    if (!response.ok) {
        throw new Error('Failed to fetch customer samples.');
    }
    return response.json();
};

export const getCheckoutsByInstaller = async (installerId: number): Promise<SampleCheckout[]> => {
    const response = await fetch(`${getApiUrl()}?installerId=${installerId}`, { credentials: 'include' });
    if (!response.ok) {
        throw new Error('Failed to fetch installer samples.');
    }
    return response.json();
};

/**
 * Creates a new sample checkout record.
 */
export const addSampleCheckout = async (checkoutData: any): Promise<SampleCheckout> => {
    const response = await fetch(getApiUrl(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(checkoutData),
        credentials: 'include'
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
    const response = await fetch(`${getApiUrl()}/${checkout.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
        credentials: 'include'
    });
    if (!response.ok) {
        throw new Error('Failed to return sample.');
    }
    return response.json();
};

/**
 * Partially updates a sample checkout record, e.g., to change the return date or selection status.
 */
export const patchSampleCheckout = async (checkoutId: number, data: { expectedReturnDate?: string; isSelected?: boolean }): Promise<SampleCheckout> => {
    const response = await fetch(`${getApiUrl()}/${checkoutId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
        credentials: 'include'
    });
    if (!response.ok) {
        throw new Error('Failed to update sample checkout.');
    }
    return response.json();
};

/**
 * Extends the due date of a checkout by 2 days from NOW.
 */
export const extendSampleCheckout = async (checkoutId: number): Promise<SampleCheckout> => {
    const response = await fetch(`${getApiUrl()}/${checkoutId}/extend`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include'
    });
    if (!response.ok) {
        throw new Error('Failed to extend sample checkout.');
    }
    return response.json();
};

/**
 * Transfers existing checkouts to a new project.
 */
export const transferCheckoutsToProject = async (checkoutIds: number[], projectId: number): Promise<void> => {
    await fetch(`${getApiUrl()}/transfer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ checkoutIds, projectId }),
        credentials: 'include'
    });
};