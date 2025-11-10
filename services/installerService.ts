import { Installer } from "../types";

const API_BASE_URL = '/api/installers';

/**
 * Fetches all installers from the API.
 */
export const getInstallers = async (): Promise<Installer[]> => {
    const response = await fetch(API_BASE_URL);
    if (!response.ok) {
        throw new Error('Failed to fetch installers.');
    }
    return response.json();
};

/**
 * Adds a new installer.
 */
export const addInstaller = async (installerData: Omit<Installer, 'id' | 'jobs'>): Promise<Installer> => {
    const response = await fetch(API_BASE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(installerData)
    });
    if (!response.ok) {
        throw new Error('Failed to create installer.');
    }
    return response.json();
};

/**
 * Updates an existing installer.
 */
export const updateInstaller = async (installer: Installer): Promise<Installer> => {
    const response = await fetch(`${API_BASE_URL}/${installer.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(installer)
    });
    if (!response.ok) {
        throw new Error('Failed to update installer.');
    }
    return response.json();
};

/**
 * Deletes an installer by their ID.
 */
export const deleteInstaller = async (installerId: number): Promise<void> => {
    const response = await fetch(`${API_BASE_URL}/${installerId}`, {
        method: 'DELETE'
    });

    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete installer.');
    }
};