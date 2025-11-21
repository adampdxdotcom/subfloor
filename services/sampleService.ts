import { Sample } from "../types";

const API_BASE_URL = '/api/samples';

export const getSamples = async (): Promise<Sample[]> => {
    const response = await fetch(API_BASE_URL);
    if (!response.ok) {
        throw new Error('Failed to fetch samples.');
    }
    return response.json();
};

export const getUniqueSizes = async (): Promise<string[]> => {
    const response = await fetch(`${API_BASE_URL}/sizes`);
    if (!response.ok) {
        throw new Error('Failed to fetch unique sizes.');
    }
    return response.json();
};

// --- NEW: Function to update a size value globally ---
export const updateSizeValue = async (oldValue: string, newValue: string): Promise<any> => {
    const response = await fetch(`${API_BASE_URL}/sizes`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ oldValue, newValue })
    });
    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update size value.');
    }
    return response.json();
};

// --- NEW: Function to delete a size value globally ---
export const deleteSizeValue = async (value: string): Promise<any> => {
    const response = await fetch(`${API_BASE_URL}/sizes`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ value })
    });
    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete size value.');
    }
    return response.json();
};

export const addSample = async (sampleData: any): Promise<Sample> => {
    const response = await fetch(API_BASE_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(sampleData),
    });
    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to add sample.');
    }
    return response.json();
};

export const updateSample = async (sampleId: number, sampleData: any): Promise<Sample> => {
    const response = await fetch(`${API_BASE_URL}/${sampleId}`, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(sampleData),
    });

    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update sample.');
    }
    return response.json();
};

// --- NEW: Toggle Discontinued Status ---
export const toggleSampleDiscontinued = async (sampleId: number, isDiscontinued: boolean): Promise<Sample> => {
    const response = await fetch(`${API_BASE_URL}/${sampleId}/discontinue`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isDiscontinued }),
    });
    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update discontinued status');
    }
    return response.json();
};

export const deleteSample = async (sampleId: number): Promise<void> => {
    const response = await fetch(`${API_BASE_URL}/${sampleId}`, {
        method: 'DELETE',
    });

    if (!response.ok) {
        if (response.status === 409) { // Conflict error
            const errorData = await response.json();
            throw new Error(errorData.error);
        }
        throw new Error('Failed to delete sample.');
    }
};

export const getSampleHistory = async (sampleId: number) => {
    const response = await fetch(`${API_BASE_URL}/${sampleId}/history`);
    if (!response.ok) {
        throw new Error('Failed to fetch sample history.');
    }
    return response.json();
};