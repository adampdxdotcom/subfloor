// src/utils/changeFormatter.ts

// Helper function to convert camelCase or snake_case to a readable "Title Case"
function formatFieldName(key: string): string {
    const result = key.replace(/([A-Z])/g, ' $1');
    return result.charAt(0).toUpperCase() + result.slice(1);
}

// A list of keys to ignore when generating descriptions
const IGNORED_KEYS = new Set([
    'id', 'createdAt', 'updatedAt', 'jobs', 'lineItems', 'userEmail',
    'checkoutProjectId', 'checkoutProjectName', 'checkoutCustomerName', 
    'checkoutId', 'imageUrl', 'color'
]);

// The main function to compare two objects and describe the changes
export function generateChangeDescriptions(before: any, after: any): string[] {
    if (!before || !after) {
        return [];
    }

    const changes: string[] = [];
    const allKeys = new Set([...Object.keys(before), ...Object.keys(after)]);

    for (const key of allKeys) {
        if (IGNORED_KEYS.has(key)) {
            continue; // Skip ignored keys
        }

        const beforeValue = before[key];
        const afterValue = after[key];

        // Normalize values for comparison (treat null, undefined, and empty string as the same "empty" state)
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
            // Handle boolean changes for better descriptions
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