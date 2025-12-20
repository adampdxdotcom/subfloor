import { JobNote } from '../types';
import { getEndpoint } from "../utils/apiConfig";

const getApiUrl = () => getEndpoint('/api/jobs');

export const getJobNotes = async (jobId: number): Promise<JobNote[]> => {
    const response = await fetch(`${getApiUrl()}/${jobId}/notes`);
    if (!response.ok) {
        throw new Error('Failed to fetch job notes');
    }
    return response.json();
};

export const addJobNote = async (jobId: number, content: string): Promise<JobNote> => {
    const response = await fetch(`${getApiUrl()}/${jobId}/notes`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ content }),
    });

    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to add note');
    }
    return response.json();
};