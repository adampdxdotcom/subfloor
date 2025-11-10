import { Sample } from "../types";

const API_BASE_URL = '/api/samples';

/**
 * Fetches all samples from the API.
 */
export const getSamples = async (): Promise<Sample[]> => {
    const response = await fetch(API_BASE_URL);
    if (!response.ok) {
        throw new Error('Failed to fetch samples.');
    }
    return response.json();
};

/**
 * Adds a new sample.
 */
export const addSample = async (sampleData: Omit<Sample, 'id' | 'isAvailable' | 'imageUrl'>): Promise<Sample> => {
    const response = await fetch(API_BASE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sampleData)
    });
    if (!response.ok) {
        throw new Error('Failed to add sample.');
    }
    return response.json();
};

/**
 * Updates an existing sample.
 */
export const updateSample = async (sampleId: number, sampleData: Partial<Omit<Sample, 'id' | 'isAvailable' | 'imageUrl'>>): Promise<Sample> => {
    const response = await fetch(`${API_BASE_URL}/${sampleId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sampleData)
    });
    if (!response.ok) {
        throw new Error('Failed to update sample details.');
    }
    return response.json();
};

/**
 * Deletes a sample by its ID.
 */
export const deleteSample = async (sampleId: number): Promise<void> => {
    const response = await fetch(`${API_BASE_URL}/${sampleId}`, {
        method: 'DELETE'
    });

    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete sample.');
    }
};