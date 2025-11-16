// src/utils/changeFormatter.ts

// Helper function to convert camelCase or snake_case to a readable "Title Case"
function formatFieldName(key: string): string {
    const result = key.replace(/([A-Z])/g, ' $1');
    return result.charAt(0).toUpperCase() + result.slice(1);
}

// --- MODIFIED: Added our new/refactored keys to the ignore list ---
// The generic loop will ignore these, as we will handle them with special logic.
const IGNORED_KEYS = new Set([
    'id', 'createdAt', 'updatedAt', 'jobs', 'lineItems', 'userEmail',
    'checkoutProjectId', 'checkoutProjectName', 'checkoutCustomerName', 
    'checkoutId', 'imageUrl', 'color',
    'appointments', // Handled specially
    'isOnHold'      // Handled specially
]);

// The main function to compare two objects and describe the changes
export function generateChangeDescriptions(before: any, after: any): string[] {
    if (!before || !after) {
        return [];
    }

    const changes: string[] = [];

    // --- NEW: Special handling for the refactored Job properties ---
    // This logic runs first and is "backwards compatible".

    // 1. Check for 'isOnHold' changes (only applies to new log entries)
    if ('isOnHold' in before || 'isOnHold' in after) {
        if (before.isOnHold !== after.isOnHold) {
            changes.push(after.isOnHold ? 'Job was placed On Hold' : 'Job was taken Off Hold');
        }
    }

    // 2. Check for 'appointments' changes (only applies to new log entries)
    if ('appointments' in before || 'appointments' in after) {
        if (JSON.stringify(before.appointments) !== JSON.stringify(after.appointments)) {
            changes.push('Job schedule was updated.');
        }
    }
    
    // --- GENERIC LOOP: Handles all other properties, including old date fields ---
    const allKeys = new Set([...Object.keys(before), ...Object.keys(after)]);

    for (const key of allKeys) {
        if (IGNORED_KEYS.has(key)) {
            continue; // Skip keys we've already handled or want to ignore
        }

        const beforeValue = before[key];
        const afterValue = after[key];

        const normalizedBefore = (beforeValue === null || beforeValue === undefined || beforeValue === '') ? null : beforeValue;
        const normalizedAfter = (afterValue === null || afterValue === undefined || afterValue === '') ? null : afterValue;

        if (normalizedBefore === normalizedAfter) {
            continue; // No change
        }

        const fieldName = formatFieldName(key);

        if (normalizedBefore === null) {
            changes.push(`'${fieldName}' was set to "${normalizedAfter}"`);
        } else if (normalizedAfter === null) {
            changes.push(`'${fieldName}' was cleared (was "${normalizedBefore}")`);
        } else {
            if (typeof normalizedBefore === 'boolean' && typeof normalizedAfter === 'boolean') {
                 changes.push(`'${fieldName}' changed from "${normalizedBefore ? 'Yes' : 'No'}" to "${normalizedAfter ? 'Yes' : 'No'}"`);
            } else {
                 changes.push(`'${fieldName}' changed from "${normalizedBefore}" to "${normalizedAfter}"`);
            }
        }
    }

    // Special handling for complex fields like line items
    if (JSON.stringify(before.lineItems) !== JSON.stringify(after.lineItems)) {
        changes.push("'Line Items' were updated.");
    }
    
    return changes;
}