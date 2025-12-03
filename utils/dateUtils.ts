// Default fallback if no system setting is found
export const DEFAULT_TIMEZONE = 'America/Los_Angeles';

/**
 * Formats a date string or object into a localized string based on the system timezone.
 * 
 * @param dateInput - ISO string or Date object
 * @param timezone - The IANA timezone string (e.g., 'America/New_York'). Defaults to LA.
 * @param options - Intl.DateTimeFormatOptions (defaults to short date: "Dec 3, 2025")
 */
export const formatDate = (
    dateInput: string | Date | null | undefined,
    timezone: string = DEFAULT_TIMEZONE,
    options: Intl.DateTimeFormatOptions = {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
    }
): string => {
    if (!dateInput) return '-';
    
    const date = new Date(dateInput);
    
    // Safety check for invalid dates
    if (isNaN(date.getTime())) return 'Invalid Date';

    try {
        return new Intl.DateTimeFormat('en-US', {
            ...options,
            timeZone: timezone
        }).format(date);
    } catch (error) {
        console.warn(`Invalid timezone '${timezone}', falling back to UTC.`);
        return new Intl.DateTimeFormat('en-US', {
            ...options,
            timeZone: 'UTC'
        }).format(date);
    }
};

/**
 * Convenience helper for displaying Date + Time (e.g. "Dec 3, 2025, 8:45 AM")
 */
export const formatDateTime = (
    dateInput: string | Date | null | undefined,
    timezone: string = DEFAULT_TIMEZONE
): string => {
    return formatDate(dateInput, timezone, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: 'numeric',
        hour12: true
    });
};

/**
 * Convenience helper for displaying Time only (e.g. "8:45 AM")
 */
export const formatTime = (
    dateInput: string | Date | null | undefined,
    timezone: string = DEFAULT_TIMEZONE
): string => {
    return formatDate(dateInput, timezone, {
        hour: 'numeric',
        minute: 'numeric',
        hour12: true
    });
};