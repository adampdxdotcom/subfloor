import { Project } from "../types";

const API_BASE_URL = '/api/projects';

/**
 * Fetches all projects, optionally filtered by installerId.
 */
export const getProjects = async (installerId?: number): Promise<Project[]> => {
    const url = installerId ? `${API_BASE_URL}?installerId=${installerId}` : API_BASE_URL;
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
    const response = await fetch(API_BASE_URL, {
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
    const response = await fetch(`${API_BASE_URL}/${projectData.id}`, {
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
    const response = await fetch(`${API_BASE_URL}/${projectId}`, {
        method: 'DELETE'
    });

    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete project.');
    }
};