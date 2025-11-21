import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { Save, Mail } from 'lucide-react';
import * as preferenceService from '../services/preferenceService';

// Define the shape of our system-wide email settings
type SystemEmailSettingsData = {
    pastDueReminders: {
        isEnabled: boolean;
        frequencyDays: number;
    };
    // We can add the central "send-to" address here later
};

const DEFAULTS: SystemEmailSettingsData = {
    pastDueReminders: {
        isEnabled: false,
        frequencyDays: 2,
    },
};

const SystemEmailSettings: React.FC = () => {
    const [settings, setSettings] = useState<SystemEmailSettingsData>(DEFAULTS);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchSystemSettings = async () => {
            try {
                // Use the centralized service instead of direct axios
                const data = await preferenceService.getSystemPreferences('email');
                
                // Deep merge fetched data with defaults to ensure all keys are present
                setSettings(prev => ({
                    ...prev,
                    ...data,
                    pastDueReminders: {
                        ...prev.pastDueReminders,
                        ...(data.pastDueReminders || {}),
                    }
                }));
            } catch (error) {
                console.error("Failed to fetch system email settings:", error);
                toast.error("Could not load system email settings.");
            } finally {
                setIsLoading(false);
            }
        };
        fetchSystemSettings();
    }, []);

    const handleSettingChange = (field: `pastDueReminders.${keyof SystemEmailSettingsData['pastDueReminders']}`, value: any) => {
        const subField = field.split('.')[1] as keyof SystemEmailSettingsData['pastDueReminders'];
        let processedValue = value;
        if (subField === 'frequencyDays') {
            processedValue = Math.max(1, parseInt(value, 10) || 1);
        }
        setSettings(prev => ({
            ...prev,
            pastDueReminders: {
                ...prev.pastDueReminders,
                [subField]: processedValue,
            }
        }));
    };

    const handleSave = async () => {
        try {
            // Use centralized service
            await preferenceService.saveSystemPreferences('email', settings);
            toast.success("System email settings saved successfully!");
        } catch (error) {
            console.error("Failed to save system email settings:", error);
            toast.error("Failed to save system email settings.");
        }
    };

    if (isLoading) {
        return <div className="p-4 text-center text-text-secondary">Loading system settings...</div>;
    }

    return (
        <section className="bg-surface p-6 rounded-lg shadow-md border border-border max-w-4xl mx-auto">
            <h2 className="text-2xl font-semibold text-text-primary mb-2 flex items-center gap-3">
                <Mail className="w-7 h-7 text-accent" />
                System-Wide Email Settings
            </h2>
            <p className="text-text-secondary mb-6">
                These settings are global and affect all users and automated emails sent to customers.
            </p>
            <div className="space-y-6 border-t border-border pt-6">
                <h3 className="text-lg font-medium text-text-primary -mb-2">Past Due Sample Reminders</h3>
                <div className="flex items-center justify-between p-4 bg-background rounded-md border border-border">
                    <label htmlFor="pastDueIsEnabled" className="font-semibold text-text-primary">
                        Enable Past Due Reminders
                    </label>
                    <div className="relative inline-block w-14 h-8 align-middle select-none transition duration-200 ease-in">
                        <input
                            type="checkbox"
                            id="pastDueIsEnabled"
                            checked={settings.pastDueReminders.isEnabled}
                            onChange={(e) => handleSettingChange('pastDueReminders.isEnabled', e.target.checked)}
                            className="toggle-checkbox absolute block w-8 h-8 rounded-full bg-white border-4 appearance-none cursor-pointer"
                        />
                        <label htmlFor="pastDueIsEnabled" className="toggle-label block overflow-hidden h-8 rounded-full bg-secondary cursor-pointer"></label>
                    </div>
                </div>

                {settings.pastDueReminders.isEnabled && (
                    <div className="p-4 bg-background rounded-md border border-border">
                        <div className="flex items-center gap-3">
                            <label htmlFor="pastDueFrequencyDays" className="text-text-primary">Send reminder every</label>
                            <input
                                type="number"
                                id="pastDueFrequencyDays"
                                value={settings.pastDueReminders.frequencyDays}
                                onChange={(e) => handleSettingChange('pastDueReminders.frequencyDays', e.target.value)}
                                className="w-20 p-1 bg-surface border-border rounded text-text-primary text-center"
                            />
                            <label htmlFor="pastDueFrequencyDays" className="text-text-primary">days for overdue samples.</label>
                        </div>
                    </div>
                )}
            </div>

            <div className="mt-8 flex justify-end">
                <button onClick={handleSave} className="flex items-center gap-2 py-2 px-6 text-base bg-primary hover:bg-primary-hover text-on-primary rounded font-semibold">
                    <Save size={18}/> Save System Settings
                </button>
            </div>
        </section>
    );
};

export default SystemEmailSettings;