import { Job } from "../types";

const API_BASE_URL = '/api/jobs';

/**
 * Fetches all jobs from the API.
 * NOTE: This returns a list of jobs WITHOUT their detailed appointments.
 * It's suitable for initial app load, but individual job details should be fetched separately.
 */
export const getJobs = async (): Promise<Job[]> => {
    const response = await fetch(API_BASE_URL);
    if (!response.ok) {
        throw new Error('Failed to fetch jobs.');
    }
    const jobs = await response.json();
    // Ensure every job has an empty appointments array to prevent crashes
    return jobs.map((job: any) => ({ ...job, appointments: job.appointments || [] }));
};

/**
 * --- NEW ---
 * Fetches a single, complete job object, including all its appointments, for a given project ID.
 */
export const getJobForProject = async (projectId: number): Promise<Job> => {
    const response = await fetch(`${API_BASE_URL}/project/${projectId}`);
    if (!response.ok) {
        if (response.status === 404) {
            // This is not a server error, but a valid case where a job hasn't been created yet.
            // Return null or a specific structure to indicate this. Let's throw a specific error.
            throw new Error('NoJobFound');
        }
        throw new Error(`Failed to fetch job for project ${projectId}.`);
    }
    return response.json();
};


/**
 * --- REBUILT ---
 * Creates or updates job details for a project, including its 'on hold' status and all appointments.
 * The backend handles the transactional logic.
 */
export const saveJobDetails = async (jobDetails: Partial<Job>): Promise<Job> => {
    const response = await fetch(API_BASE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(jobDetails)
    });
    if (!response.ok) {
        // Try to get more detailed error from backend
        const errorData = await response.json().catch(() => ({ error: 'Failed to save job details.' }));
        throw new Error(errorData.error || 'Failed to save job details.');
    }
    return response.json();
};