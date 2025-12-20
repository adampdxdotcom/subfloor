import { Job } from "../types";
import { getEndpoint } from "../utils/apiConfig";

const getApiUrl = () => getEndpoint('/api/jobs');

/**
 * Fetches all jobs from the API.
 * NOTE: This returns a list of jobs WITHOUT their detailed appointments.
 * It's suitable for initial app load, but individual job details should be fetched separately.
 */
export const getJobs = async (): Promise<Job[]> => {
    const response = await fetch(getApiUrl());
    if (!response.ok) {
        throw new Error('Failed to fetch jobs.');
    }
    const jobs = await response.json();
    // Ensure every job has an empty appointments array to prevent crashes
    return jobs.map((job: any) => ({ ...job, appointments: job.appointments || [] }));
};

/**
 * --- MODIFIED ---
 * Fetches a single, complete job object for a given project ID.
 * Returns null if no job is found (404), which is an expected condition.
 */
export const getJobForProject = async (projectId: number): Promise<Job | null> => {
    const response = await fetch(`${getApiUrl()}/project/${projectId}`);
    
    // --- THIS IS THE FIX ---
    // If the status is 404, we gracefully return null.
    if (response.status === 404) {
        return null;
    }

    // For any other non-ok status, we throw a real error.
    if (!response.ok) {
        throw new Error(`Failed to fetch job for project ${projectId}. Status: ${response.status}`);
    }

    return response.json();
};


/**
 * --- REBUILT ---
 * Creates or updates job details for a project, including its 'on hold' status and all appointments.
 * The backend handles the transactional logic.
 */
export const saveJobDetails = async (jobDetails: Partial<Job>): Promise<Job> => {
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