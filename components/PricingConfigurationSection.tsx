import React, { useState, useEffect } from 'react';
import { DollarSign, Save, Percent, Calculator } from 'lucide-react';
import { toast } from 'react-hot-toast';
import * as preferenceService from '../services/preferenceService';
import { PricingSettings } from '../types';

const PricingConfigurationSection: React.FC = () => {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [settings, setSettings] = useState<PricingSettings>({
        retailMarkup: 40,
        contractorMarkup: 20,
        calculationMethod: 'Markup'
    });

    useEffect(() => {
        const fetchSettings = async () => {
            try {
                const data = await preferenceService.getPricingSettings();
                // Merge with defaults to ensure fields exist
                setSettings({
                    retailMarkup: data.retailMarkup ?? 40,
                    contractorMarkup: data.contractorMarkup ?? 20,
                    calculationMethod: data.calculationMethod ?? 'Markup'
                });
            } catch (error) {
                console.error("Failed to load pricing settings:", error);
                toast.error("Could not load pricing configuration.");
            } finally {
                setLoading(false);
            }
        };
        fetchSettings();
    }, []);

    const handleSave = async () => {
        setSaving(true);
        try {
            await preferenceService.savePricingSettings(settings);
            toast.success("Pricing configuration saved.");
        } catch (error) {
            console.error("Failed to save pricing:", error);
            toast.error("Failed to save changes.");
        } finally {
            setSaving(false);
        }
    };

    const calculateExample = (cost: number, percent: number) => {
        if (settings.calculationMethod === 'Markup') {
            return (cost * (1 + percent / 100)).toFixed(2);
        } else {
            // Margin Calculation: Cost / (1 - Margin%)
            const decimalMargin = percent / 100;
            if (decimalMargin >= 1) return "Error"; // Prevent division by zero/negative
            return (cost / (1 - decimalMargin)).toFixed(2);
        }
    };

    if (loading) return <div className="p-6 text-center text-text-secondary">Loading configuration...</div>;

    return (
        <section className="bg-surface p-6 rounded-lg shadow-md border border-border max-w-3xl">
            <div className="flex items-center gap-3 mb-6 border-b border-border pb-4">
                <div className="p-2 bg-green-900/30 rounded-lg text-green-400">
                    <DollarSign size={24} />
                </div>
                <div>
                    <h2 className="text-xl font-bold text-text-primary">Pricing Configuration</h2>
                    <p className="text-sm text-text-secondary">Set the global defaults for product pricing.</p>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-6">
                    <div>
                        <label className="block text-sm font-medium text-text-secondary mb-2">Calculation Method</label>
                        <div className="flex bg-background p-1 rounded-lg border border-border">
                            <button
                                onClick={() => setSettings({ ...settings, calculationMethod: 'Markup' })}
                                className={`flex-1 py-2 px-4 rounded-md text-sm font-semibold transition-colors ${
                                    settings.calculationMethod === 'Markup' 
                                    ? 'bg-primary text-on-primary shadow-sm' 
                                    : 'text-text-secondary hover:text-text-primary'
                                }`}
                            >
                                Markup
                            </button>
                            <button
                                onClick={() => setSettings({ ...settings, calculationMethod: 'Margin' })}
                                className={`flex-1 py-2 px-4 rounded-md text-sm font-semibold transition-colors ${
                                    settings.calculationMethod === 'Margin' 
                                    ? 'bg-primary text-on-primary shadow-sm' 
                                    : 'text-text-secondary hover:text-text-primary'
                                }`}
                            >
                                Margin
                            </button>
                        </div>
                        <p className="text-xs text-text-secondary mt-2">
                            {settings.calculationMethod === 'Markup' 
                                ? "Cost + (Cost × %)" 
                                : "Cost ÷ (100% - %)"}
                        </p>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-text-secondary mb-2">Default Retail Percentage</label>
                        <div className="relative">
                            <input 
                                type="number" 
                                value={settings.retailMarkup}
                                onChange={(e) => setSettings({ ...settings, retailMarkup: parseFloat(e.target.value) || 0 })}
                                className="w-full bg-background border border-border rounded-lg py-2 pl-4 pr-10 text-text-primary focus:ring-2 focus:ring-primary focus:border-primary"
                            />
                            <div className="absolute right-3 top-2.5 text-text-secondary">
                                <Percent size={16} />
                            </div>
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-text-secondary mb-2">Default Contractor Percentage</label>
                        <div className="relative">
                            <input 
                                type="number" 
                                value={settings.contractorMarkup}
                                onChange={(e) => setSettings({ ...settings, contractorMarkup: parseFloat(e.target.value) || 0 })}
                                className="w-full bg-background border border-border rounded-lg py-2 pl-4 pr-10 text-text-primary focus:ring-2 focus:ring-primary focus:border-primary"
                            />
                            <div className="absolute right-3 top-2.5 text-text-secondary">
                                <Percent size={16} />
                            </div>
                        </div>
                    </div>

                    <button 
                        onClick={handleSave} 
                        disabled={saving}
                        className="flex items-center justify-center w-full py-2 px-4 bg-primary hover:bg-primary-hover text-on-primary font-bold rounded-lg transition-colors disabled:opacity-50"
                    >
                        <Save size={18} className="mr-2" />
                        {saving ? "Saving..." : "Save Configuration"}
                    </button>
                </div>

                {/* LIVE PREVIEW PANEL */}
                <div className="bg-background rounded-lg border border-border p-5">
                    <h3 className="text-sm font-bold text-text-primary mb-4 flex items-center gap-2">
                        <Calculator size={16} className="text-accent"/> Live Example
                    </h3>
                    <div className="space-y-4 text-sm">
                        <div className="p-3 bg-surface rounded border border-border">
                            <p className="text-text-secondary mb-1">If Unit Cost is:</p>
                            <p className="text-xl font-bold text-text-primary">$100.00</p>
                        </div>
                        
                        <div className="relative pl-4 border-l-2 border-border space-y-4">
                            <div>
                                <p className="text-text-secondary text-xs uppercase tracking-wider mb-1">Retail Price</p>
                                <p className="text-lg font-bold text-green-400">
                                    ${calculateExample(100, settings.retailMarkup)}
                                </p>
                                <p className="text-xs text-text-secondary">
                                    {settings.calculationMethod} of {settings.retailMarkup}%
                                </p>
                            </div>
                            <div>
                                <p className="text-text-secondary text-xs uppercase tracking-wider mb-1">Contractor Price</p>
                                <p className="text-lg font-bold text-blue-400">
                                    ${calculateExample(100, settings.contractorMarkup)}
                                </p>
                                <p className="text-xs text-text-secondary">
                                    {settings.calculationMethod} of {settings.contractorMarkup}%
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
};

export default PricingConfigurationSection;