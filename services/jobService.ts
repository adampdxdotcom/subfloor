import { Job } from "../types";

const API_BASE_URL = '/api/jobs';

/**
 * Fetches all jobs from the API.
 */
export const getJobs = async (): Promise<Job[]> => {
    const response = await fetch(API_BASE_URL);
    if (!response.ok) {
        throw new Error('Failed to fetch jobs.');
    }
    return response.json();
};

/**
 * Creates or updates job details for a project.
 * The backend handles whether to INSERT or UPDATE based on projectId.
 */
export const saveJobDetails = async (jobDetails: Omit<Job, 'id' | 'paperworkSignedUrl'>): Promise<Job> => {
    const response = await fetch(API_BASE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(jobDetails)
    });
    if (!response.ok) {
        throw new Error('Failed to save job details.');
    }
    return response.json();
};