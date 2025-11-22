import { UserPreferences, PricingSettings } from '../types'; 

const API_BASE_URL = '/api/preferences';
const SYSTEM_PREFS_URL = '/api/preferences/system';

/**
 * Fetches the UI preferences for the current user.
 * @returns {Promise<UserPreferences>} A promise that resolves to the user's preferences object.
 */
export const getPreferences = async (): Promise<UserPreferences> => {
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
 * @param {UserPreferences} preferences - The preferences object to save.
 * @returns {Promise<UserPreferences>} A promise that resolves to the saved preferences object.
 */
export const savePreferences = async (preferences: UserPreferences): Promise<UserPreferences> => {
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

// --- ADMIN: SYSTEM PREFERENCES (Pricing, Email, etc.) ---

export const getSystemPreferences = async (key: string): Promise<any> => {
  const response = await fetch(`${SYSTEM_PREFS_URL}/${key}`);
  if (!response.ok) throw new Error(`Failed to fetch system preference: ${key}`);
  return response.json();
};

export const saveSystemPreferences = async (key: string, settings: any): Promise<void> => {
  const response = await fetch(`${SYSTEM_PREFS_URL}/${key}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(settings),
  });
  if (!response.ok) throw new Error(`Failed to save system preference: ${key}`);
};

export const sendTestSystemEmail = async (): Promise<void> => {
    const response = await fetch(`${SYSTEM_PREFS_URL}/email_test`, {
        method: 'POST',
    });
    if (!response.ok) throw new Error('Failed to send test email.');
};

// Helper specific to pricing to ensure type safety
export const getPricingSettings = async (): Promise<PricingSettings> => {
    // The key 'pricing' should match the key used in the system_preferences table insertion
    return getSystemPreferences('pricing'); 
};

export const savePricingSettings = async (settings: PricingSettings): Promise<void> => {
    return saveSystemPreferences('pricing', settings);
};

// --- BRANDING FUNCTIONS (Added for Session 15) ---

export const uploadSystemBranding = async (formData: FormData): Promise<any> => {
  const response = await fetch(`${SYSTEM_PREFS_URL}/branding`, {
    method: 'POST',
    // Note: Do NOT set Content-Type header manually here; 
    // the browser automatically sets it to multipart/form-data with the correct boundary
    body: formData,
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to upload branding files.');
  }
  return response.json();
};

// Alias for compatibility with DataContext imports
export const getSystemPreference = getSystemPreferences;

export const deleteSystemBranding = async (type: 'logo' | 'favicon'): Promise<any> => {
  const response = await fetch(`${SYSTEM_PREFS_URL}/branding/${type}`, {
    method: 'DELETE',
  });
  if (!response.ok) {
    throw new Error(`Failed to delete ${type}.`);
  }
  return response.json();
};