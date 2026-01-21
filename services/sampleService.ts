import { Sample, SizeAlias } from "../types";
import { getEndpoint } from "../utils/apiConfig";

const getApiUrl = () => getEndpoint('/api/products');

// --- NEW: Import/Alias Service Methods ---
// We point directly to /api/import/aliases for these
const getAliasUrl = () => getEndpoint('/api/import/aliases');
const getProductAliasUrl = () => getEndpoint('/api/import/aliases/products');

export const getSizeAliases = async (): Promise<SizeAlias[]> => {
    const response = await fetch(getAliasUrl());
    if (!response.ok) {
        throw new Error('Failed to fetch size aliases.');
    }
    return response.json();
};

export const createSizeAlias = async (aliasText: string, mappedSize: string): Promise<SizeAlias> => {
    const response = await fetch(getAliasUrl(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ aliasText, mappedSize })
    });
    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to save alias.');
    }
    return response.json();
};

// --- PRODUCT NAME ALIASES ---

export const getProductAliases = async (): Promise<any[]> => {
    const response = await fetch(getProductAliasUrl());
    if (!response.ok) {
        throw new Error('Failed to fetch product aliases.');
    }
    return response.json();
};

export const createProductAlias = async (aliasText: string, mappedProductName: string): Promise<any> => {
    const response = await fetch(getProductAliasUrl(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ aliasText, mappedProductName })
    });
    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to save product alias.');
    }
    return response.json();
};
// ----------------------------------------

export interface SizeStat {
    value: string;
    usageCount: number;
    isStandard: boolean;
}

export const getSamples = async (): Promise<Sample[]> => {
    const response = await fetch(getApiUrl());
    if (!response.ok) {
        throw new Error('Failed to fetch samples.');
    }
    return response.json();
};

export const getUniqueSizes = async (): Promise<string[]> => {
    const response = await fetch(`${getApiUrl()}/sizes`);
    if (!response.ok) {
        throw new Error('Failed to fetch unique sizes.');
    }
    return response.json();
};

export const getUniqueSizeStats = async (): Promise<SizeStat[]> => {
    const response = await fetch(`${getApiUrl()}/sizes/stats`);
    if (!response.ok) {
        const text = await response.text();
        throw new Error(`Error ${response.status}: ${text || response.statusText}`);
    }
    return response.json();
};

// --- NEW: Function to update a size value globally ---
export const updateSizeValue = async (oldValue: string, newValue: string): Promise<any> => {
    const response = await fetch(`${getApiUrl()}/sizes`, {
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
    const response = await fetch(`${getApiUrl()}/sizes`, {
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

// --- NEW: Function to create a standalone size ---
export const createSize = async (value: string): Promise<void> => {
    const response = await fetch(`${getApiUrl()}/sizes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ value })
    });
    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create size.');
    }
};

export const addSample = async (sampleData: any): Promise<Sample> => {
    const response = await fetch(getApiUrl(), {
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
    const response = await fetch(`${getApiUrl()}/${sampleId}`, {
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
    const response = await fetch(`${getApiUrl()}/${sampleId}/discontinue`, {
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
    const response = await fetch(`${getApiUrl()}/${sampleId}`, {
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
    const response = await fetch(`${getApiUrl()}/${sampleId}/history`);
    if (!response.ok) {
        throw new Error('Failed to fetch sample history.');
    }
    return response.json();
};