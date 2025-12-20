import { Project, ActivityLogEntry } from "../types";
import { getEndpoint } from "../utils/apiConfig";

const getApiUrl = () => getEndpoint('/api/projects');

/**
 * Fetches all projects, optionally filtered by installerId.
 */
export const getProjects = async (installerId?: number): Promise<Project[]> => {
    const baseUrl = getApiUrl();
    const url = installerId ? `${baseUrl}?installerId=${installerId}` : baseUrl;
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error('Failed to fetch projects.');
    }
    return response.json();
};

/**
 * Adds a new project.
 */
export const addProject = async (projectData: Omit<Project, 'id' | 'createdAt'> & { installerId?: number }): Promise<Project> => {
    const response = await fetch(getApiUrl(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(projectData)
    });
    if (!response.ok) {
        throw new Error('Failed to create project.');
    }
    return response.json();
};

/**
 * Updates an existing project.
 */
export const updateProject = async (projectData: Partial<Project> & { id: number }): Promise<Project> => {
    const response = await fetch(`${getApiUrl()}/${projectData.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(projectData)
    });
    if (!response.ok) {
        throw new Error('Failed to update project.');
    }
    return response.json();
};

/**
 * Deletes a project by its ID, which triggers a cascade on the backend.
 */
export const deleteProject = async (projectId: number): Promise<void> => {
    const response = await fetch(`${getApiUrl()}/${projectId}`, {
        method: 'DELETE'
    });

    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete project.');
    }
};

/**
 * Fetches the activity history for a specific project.
 * @param projectId The ID of the project.
 * @returns A promise that resolves to an array of activity log entries.
 */
export const getProjectHistory = async (projectId: number): Promise<ActivityLogEntry[]> => {
    const response = await fetch(`${getApiUrl()}/${projectId}/history`);
    if (!response.ok) {
        throw new Error('Failed to fetch project history.');
    }
    return response.json();
};