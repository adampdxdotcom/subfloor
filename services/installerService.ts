import { Installer, ActivityLogEntry } from "../types";
import { getEndpoint } from "../utils/apiConfig";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import * as installerService from "./installerService"; // Assuming this is the filename or logic is local

const getApiUrl = () => getEndpoint('/api/installers');

/**
 * Fetches all installers from the API.
 */
export const getInstallers = async (): Promise<Installer[]> => {
    const response = await fetch(getApiUrl());
    if (!response.ok) {
        throw new Error('Failed to fetch installers.');
    }
    return response.json();
};

/**
 * Adds a new installer.
 */
export const addInstaller = async (installerData: Omit<Installer, 'id' | 'jobs'>): Promise<Installer> => {
    const response = await fetch(getApiUrl(), {
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
    const response = await fetch(`${getApiUrl()}/${installer.id}`, {
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
    const response = await fetch(`${getApiUrl()}/${installerId}`, {
        method: 'DELETE'
    });

    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete installer.');
    }
};

/**
 * Fetches the activity history for a specific installer.
 * @param installerId The ID of the installer.
 * @returns A promise that resolves to an array of activity log entries.
 */
export const getInstallerHistory = async (installerId: number): Promise<ActivityLogEntry[]> => {
    const response = await fetch(`${getApiUrl()}/${installerId}/history`);
    if (!response.ok) {
        throw new Error('Failed to fetch installer history.');
    }
    return response.json();
};

// --- NEW ---
export const useInstallerMutations = () => {
    const queryClient = useQueryClient();

    const createInstallerMutation = useMutation({
        mutationFn: addInstaller, // Use the correct local function name
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['installers'] });
        },
    });

    const updateInstallerMutation = useMutation({
        mutationFn: updateInstaller,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['installers'] });
        },
    });

    const deleteInstallerMutation = useMutation({
        mutationFn: deleteInstaller,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['installers'] });
        },
    });

    return {
        createInstaller: createInstallerMutation,
        updateInstaller: updateInstallerMutation,
        deleteInstaller: deleteInstallerMutation,
    };
};