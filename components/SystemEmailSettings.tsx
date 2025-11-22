import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { Save, Mail, Lock, Eye, EyeOff, Clock, Send, Globe } from 'lucide-react';
import * as preferenceService from '../services/preferenceService';

// Define the shape of our system-wide email settings
type SystemEmailSettingsData = {
    dailyUpdateTime?: string; // "HH:MM" 24h format
    timezone?: string;
    pastDueReminders: {
        isEnabled: boolean;
        frequencyDays: number;
    };
    // We can add the central "send-to" address here later
};

const DEFAULTS: SystemEmailSettingsData = {
    dailyUpdateTime: "07:00",
    timezone: "America/New_York",
    pastDueReminders: {
        isEnabled: false,
        frequencyDays: 2,
    },
};

const TIMEZONES = [
    "America/New_York", "America/Chicago", "America/Denver", 
    "America/Los_Angeles", "America/Phoenix", "America/Anchorage", "Pacific/Honolulu"
];

const SystemEmailSettings: React.FC = () => {
    const [settings, setSettings] = useState<SystemEmailSettingsData>(DEFAULTS);
    const [credentials, setCredentials] = useState({ emailUser: '', emailPass: '' });
    const [showPassword, setShowPassword] = useState(false);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchSystemSettings = async () => {
            try {
                // Load both the reminder settings (public-ish) and credentials (secure)
                const [reminderData, credsData] = await Promise.all([
                    preferenceService.getSystemPreferences('email'),
                    preferenceService.getSystemPreferences('email_settings')
                ]);
                
                // Deep merge fetched data with defaults to ensure all keys are present
                setSettings(prev => ({
                    ...prev,
                    ...reminderData,
                    dailyUpdateTime: reminderData.dailyUpdateTime || prev.dailyUpdateTime,
                    timezone: reminderData.timezone || prev.timezone,
                    pastDueReminders: {
                        ...prev.pastDueReminders,
                        ...(reminderData.pastDueReminders || {}),
                    }
                }));

                setCredentials({
                    emailUser: credsData.emailUser || '',
                    emailPass: credsData.emailPass || ''
                });
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

    const handleSendTest = async () => {
        const toastId = toast.loading("Sending test email...");
        try {
            await preferenceService.sendTestSystemEmail();
            toast.success("Test email sent!", { id: toastId });
        } catch (error) {
            toast.error("Failed to send test email.", { id: toastId });
        }
    };

    const handleSave = async () => {
        try {
            await Promise.all([
                preferenceService.saveSystemPreferences('email', settings),
                preferenceService.saveSystemPreferences('email_settings', credentials)
            ]);
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
            
            <div className="space-y-6 border-t border-border pt-6 mb-6">
                <h3 className="text-lg font-medium text-text-primary -mb-2 flex items-center gap-2">
                    <Lock className="w-4 h-4" /> SMTP Credentials (Gmail)
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-text-secondary mb-1">Gmail Address</label>
                        <input 
                            type="email" 
                            value={credentials.emailUser}
                            onChange={(e) => setCredentials(prev => ({ ...prev, emailUser: e.target.value }))}
                            placeholder="company@gmail.com"
                            className="w-full p-2 bg-background border border-border rounded-md text-text-primary focus:ring-2 focus:ring-primary focus:border-transparent"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-text-secondary mb-1">App Password</label>
                        <div className="relative">
                            <input 
                                type={showPassword ? "text" : "password"} 
                                value={credentials.emailPass}
                                onChange={(e) => setCredentials(prev => ({ ...prev, emailPass: e.target.value }))}
                                placeholder={credentials.emailPass === '********' ? '********' : "Enter App Password"}
                                className="w-full p-2 bg-background border border-border rounded-md text-text-primary focus:ring-2 focus:ring-primary focus:border-transparent pr-10"
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute right-2 top-1/2 transform -translate-y-1/2 text-text-secondary hover:text-text-primary"
                            >
                                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                            </button>
                        </div>
                        <p className="text-xs text-text-tertiary mt-1">
                            Use an "App Password" generated from your Google Account settings, not your login password.
                        </p>
                    </div>
                </div>
                
                <div className="mt-4 flex justify-end">
                    <button 
                        onClick={handleSendTest} 
                        type="button"
                        className="text-sm flex items-center gap-2 text-primary hover:text-primary-hover font-medium"
                    >
                        <Send size={16} /> Send Test Email
                    </button>
                </div>
            </div>

            <div className="space-y-6 border-t border-border pt-6 mb-6">
                <h3 className="text-lg font-medium text-text-primary -mb-2 flex items-center gap-2">
                    <Clock className="w-4 h-4" /> Internal Daily Update Schedule
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="p-4 bg-background rounded-md border border-border flex flex-col gap-2">
                        <label className="text-sm font-medium text-text-secondary">Send daily updates at:</label>
                        <input 
                            type="time" 
                            value={settings.dailyUpdateTime || "07:00"}
                            onChange={(e) => setSettings(prev => ({ ...prev, dailyUpdateTime: e.target.value }))}
                            className="p-2 bg-surface border border-border rounded text-text-primary cursor-pointer w-full"
                        />
                    </div>
                    <div className="p-4 bg-background rounded-md border border-border flex flex-col gap-2">
                        <label className="text-sm font-medium text-text-secondary flex items-center gap-2">
                            <Globe size={14} /> Server Timezone
                        </label>
                        <select
                            value={settings.timezone || "America/New_York"}
                            onChange={(e) => setSettings(prev => ({ ...prev, timezone: e.target.value }))}
                            className="p-2 bg-surface border border-border rounded text-text-primary w-full"
                        >
                            {TIMEZONES.map(tz => <option key={tz} value={tz}>{tz}</option>)}
                        </select>
                    </div>
                </div>
            </div>

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