import { UiPreferences } from '../types'; // Import the type from our types file

const API_BASE_URL = '/api/preferences';

/**
 * Fetches the UI preferences for the current user.
 * @returns {Promise<UiPreferences>} A promise that resolves to the user's preferences object.
 */
export const getPreferences = async (): Promise<UiPreferences> => {
  try {
    const response = await fetch(API_BASE_URL);
    if (!response.ok) {
        // If the server returns an error, we'll throw to be caught by the catch block
        throw new Error(`Failed to fetch preferences with status: ${response.status}`);
    }
    return response.json();
  } catch (error) {
    console.error('Failed to fetch user preferences:', error);
    // Return a default empty object on failure to prevent crashes in the UI
    return {};
  }
};

/**
 * Saves the UI preferences for the current user.
 * @param {UiPreferences} preferences - The preferences object to save.
 * @returns {Promise<UiPreferences>} A promise that resolves to the saved preferences object.
 */
export const savePreferences = async (preferences: UiPreferences): Promise<UiPreferences> => {
  try {
    const response = await fetch(API_BASE_URL, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(preferences),
    });

    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to save preferences.');
    }
    return response.json();
  } catch (error) {
    console.error('Failed to save user preferences:', error);
    // Re-throw the error so the DataContext can catch it and show a toast message
    throw error;
  }
};