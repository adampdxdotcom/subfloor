import { Vendor, ActivityLogEntry } from '../types';

const API_BASE_URL = '/api/vendors';

/**
 * Fetches all vendors from the API.
 */
export const getVendors = async (): Promise<Vendor[]> => {
    const response = await fetch(API_BASE_URL);
    if (!response.ok) {
        throw new Error('Failed to fetch vendors.');
    }
    return response.json();
};

/**
 * Adds a new vendor.
 * @param vendorData - The vendor data to add, excluding the ID.
 */
export const addVendor = async (vendorData: Omit<Vendor, 'id'>): Promise<Vendor> => {
    const response = await fetch(API_BASE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(vendorData),
    });
    if (!response.ok) {
        const errorBody = await response.json();
        throw new Error(errorBody.error || 'Failed to create vendor');
    }
    return response.json();
};

/**
 * Updates an existing vendor.
 * @param vendorId - The ID of the vendor to update.
 * @param vendorData - The vendor data to update.
 */
export const updateVendor = async (vendorId: number, vendorData: Partial<Omit<Vendor, 'id'>>): Promise<Vendor> => {
    const response = await fetch(`${API_BASE_URL}/${vendorId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(vendorData),
    });
    if (!response.ok) {
        const errorBody = await response.json();
        throw new Error(errorBody.error || 'Failed to update vendor');
    }
    return response.json();
};

/**
 * Deletes a vendor by their ID.
 * @param vendorId - The ID of the vendor to delete.
 */
export const deleteVendor = async (vendorId: number): Promise<void> => {
    const response = await fetch(`${API_BASE_URL}/${vendorId}`, {
        method: 'DELETE',
    });
    if (!response.ok) {
        if (response.status === 409) { // Conflict error
            throw new Error('Cannot delete vendor because it is currently in use.');
        }
        const errorBody = await response.json().catch(() => ({}));
        throw new Error(errorBody.error || 'Failed to delete vendor');
    }
};

/**
 * Fetches the activity history for a specific vendor.
 * @param vendorId The ID of the vendor.
 * @returns A promise that resolves to an array of activity log entries.
 */
export const getVendorHistory = async (vendorId: number): Promise<ActivityLogEntry[]> => {
    const response = await fetch(`${API_BASE_URL}/${vendorId}/history`);
    if (!response.ok) {
        throw new Error('Failed to fetch vendor history.');
    }
    return response.json();
};