import { Job } from "../types";
import { getEndpoint } from "../utils/apiConfig";

const getApiUrl = () => getEndpoint('/api/jobs');

/**
 * Fetches all jobs from the API.
 */
export const getJobs = async (): Promise<Job[]> => {
    const response = await fetch(getApiUrl());
    if (!response.ok) {
        throw new Error('Failed to fetch jobs.');
    }
    const jobs = await response.json();
    return jobs.map((job: any) => ({ ...job, appointments: job.appointments || [] }));
};

/**
 * Fetches a single job for a project.
 */
export const getJobForProject = async (projectId: number): Promise<Job | null> => {
    const response = await fetch(`${getApiUrl()}/project/${projectId}`);
    
    if (response.status === 404) {
        return null;
    }

    if (!response.ok) {
        throw new Error(`Failed to fetch job for project ${projectId}. Status: ${response.status}`);
    }

    return response.json();
};

/**
 * Creates or updates job details.
 */
export const saveJob = async (jobDetails: Partial<Job>): Promise<Job> => {
    const response = await fetch(getApiUrl(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(jobDetails)
    });
    if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Failed to save job details.' }));
        throw new Error(errorData.error || 'Failed to save job details.');
    }
    return response.json();
};

export const updateProject = async (projectData: { id: number; [key: string]: any }): Promise<void> => {
    const { id, ...data } = projectData;
    const response = await fetch(getEndpoint(`/api/projects/${id}`), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
    });
    if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Failed to update project.' }));
        throw new Error(errorData.error || 'Failed to update project.');
    }
};