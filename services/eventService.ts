import { Event } from '../types';

const BASE_URL = '/api/events';

// Type for creating or updating an event, omitting the server-generated fields
export type NewEventData = Omit<Event, 'id' | 'createdByUserId' | 'createdAt'>;

export const createEvent = async (eventData: NewEventData): Promise<Event> => {
    const response = await fetch(BASE_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(eventData),
    });
    if (!response.ok) {
        throw new Error('Failed to create event');
    }
    return response.json();
};

export const updateEvent = async (eventId: number, eventData: Partial<NewEventData>): Promise<Event> => {
    const response = await fetch(`${BASE_URL}/${eventId}`, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(eventData),
    });
    if (!response.ok) {
        throw new Error('Failed to update event');
    }
    return response.json();
};

export const deleteEvent = async (eventId: number): Promise<void> => {
    const response = await fetch(`${BASE_URL}/${eventId}`, {
        method: 'DELETE',
    });
    if (!response.ok) {
        throw new Error('Failed to delete event');
    }
};