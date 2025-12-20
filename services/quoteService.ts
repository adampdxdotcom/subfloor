import { Project, Quote, ActivityLogEntry } from "../types";
import { getEndpoint } from "../utils/apiConfig";

const getApiUrl = () => getEndpoint('/api/quotes');

/**
 * Fetches all quotes from the API.
 */
export const getQuotes = async (): Promise<Quote[]> => {
    const response = await fetch(getApiUrl());
    if (!response.ok) {
        throw new Error('Failed to fetch quotes.');
    }
    return response.json();
};

/**
 * Adds a new quote.
 */
export const addQuote = async (quoteData: Omit<Quote, 'id' | 'dateSent'>): Promise<Quote> => {
    const response = await fetch(getApiUrl(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(quoteData)
    });
    if (!response.ok) {
        throw new Error('Failed to add quote.');
    }
    return response.json();
};

/**
 * Updates an existing quote.
 */
export const updateQuote = async (quoteData: Partial<Quote> & { id: number }): Promise<Quote> => {
    const response = await fetch(`${getApiUrl()}/${quoteData.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(quoteData)
    });
    if (!response.ok) {
        throw new Error('Failed to update quote.');
    }
    return response.json();
};

/**
 * Accepts a quote, which also updates the parent project's status.
 * Returns both the updated quote and the updated project.
 */
export const acceptQuote = async (quoteData: Partial<Quote> & { id: number }): Promise<{ updatedQuote: Quote, updatedProject: Project }> => {
    const response = await fetch(`${getApiUrl()}/${quoteData.id}/accept`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(quoteData)
    });
    if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Failed to accept quote.' }));
        throw new Error(errorData.message);
    }
    return response.json();
};

/**
 * Fetches the activity history for all quotes associated with a project.
 * @param projectId The ID of the parent project.
 * @returns A promise that resolves to an array of activity log entries.
 */
export const getQuotesHistory = async (projectId: number): Promise<ActivityLogEntry[]> => {
    const response = await fetch(`${getApiUrl()}/project/${projectId}/history`);
    if (!response.ok) {
        throw new Error('Failed to fetch quote history.');
    }
    return response.json();
};