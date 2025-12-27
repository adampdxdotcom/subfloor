import { JobNote } from '../types';
import { getEndpoint } from "../utils/apiConfig";

const getApiUrl = () => getEndpoint('/api/jobs');

export const getJobNotes = async (jobId: number): Promise<JobNote[]> => {
    const response = await fetch(`${getApiUrl()}/${jobId}/notes`, { credentials: 'include' });
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
        credentials: 'include'
    });

    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to add note');
    }
    return response.json();
};

export const toggleNotePin = async (noteId: number): Promise<JobNote> => {
    // Route: /api/jobs/notes/:noteId/pin
    const url = `${getApiUrl()}/notes/${noteId}/pin`;
    const response = await fetch(url, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include'
    });
    if (!response.ok) throw new Error('Failed to toggle pin');
    return response.json();
};