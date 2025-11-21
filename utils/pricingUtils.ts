import { PricingSettings, Vendor } from '../types';

/**
 * Calculates the sell price based on cost, percentage, and method.
 */
export const calculatePrice = (cost: number, percentage: number, method: 'Markup' | 'Margin'): number => {
    if (cost < 0 || percentage < 0) return 0;

    if (method === 'Markup') {
        // Cost + (Cost * %)
        return cost * (1 + percentage / 100);
    } else {
        // Cost / (1 - %)
        // Prevent division by zero or negative prices if margin is >= 100%
        const decimalMargin = percentage / 100;
        if (decimalMargin >= 1) return 0; 
        return cost / (1 - decimalMargin);
    }
};

/**
 * Determines the active pricing rules for a specific item.
 * Hierarchy: Vendor Override > Global Settings
 */
export const getActivePricingRules = (
    vendor: Vendor | undefined, 
    globalSettings: PricingSettings,
    purchaserType: 'Customer' | 'Installer' = 'Customer'
): { percentage: number; method: 'Markup' | 'Margin' } => {
    
    // 1. Vendor Override (Highest Priority)
    // Note: Vendors currently only support a single 'default markup', usually applied to Retail.
    // Complex logic (Vendor Contractor vs. Vendor Retail) can be added later if needed.
    if (vendor && vendor.defaultMarkup !== null && vendor.defaultMarkup !== undefined) {
        return {
            percentage: Number(vendor.defaultMarkup),
            method: vendor.pricingMethod || globalSettings.calculationMethod
        };
    }

    // 2. Global Defaults
    if (purchaserType === 'Installer') {
        return {
            percentage: globalSettings.contractorMarkup,
            method: globalSettings.calculationMethod
        };
    } else {
        return {
            percentage: globalSettings.retailMarkup,
            method: globalSettings.calculationMethod
        };
    }
};

export const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
    }).format(amount);
};