import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { Save, Mail, Lock, Eye, EyeOff, Clock, Send, Globe, Calendar, FileEdit } from 'lucide-react';
import * as preferenceService from '../services/preferenceService';
import { emailTemplateService } from '../services/emailTemplateService'; // New Service
import { EmailTemplateModal } from './settings/EmailTemplateModal'; // New Modal
import { EmailTemplate } from '../types'; // Type

// Define the shape of our system-wide email settings
type SystemEmailSettingsData = {
    dailyUpdateTime?: string; // "HH:MM" 24h format
    timezone?: string;
    pastDueReminders: {
        isEnabled: boolean;
        frequencyDays: number;
    };
    upcomingJobReminders?: { // NEW
        isEnabled: boolean;
    };
};

const DEFAULTS: SystemEmailSettingsData = {
    dailyUpdateTime: "07:00",
    timezone: "America/New_York",
    pastDueReminders: {
        isEnabled: false,
        frequencyDays: 2,
    },
    upcomingJobReminders: {
        isEnabled: false
    }
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
    const [templates, setTemplates] = useState<EmailTemplate[]>([]);
    const [editingTemplateKey, setEditingTemplateKey] = useState<string | null>(null);

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
                    },
                    upcomingJobReminders: {
                        isEnabled: false,
                        ...(reminderData.upcomingJobReminders || {})
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
        fetchTemplates();
    }, []);

    const fetchTemplates = async () => {
        try {
            const data = await emailTemplateService.getAll();
            setTemplates(data);
        } catch (error) {
            console.error("Failed to fetch email templates:", error);
        }
    };

    const handleSettingChange = (field: string, value: any) => {
        // Helper to update nested state safely
        if (field.startsWith('pastDueReminders.')) {
            const subField = field.split('.')[1];
            let processedValue = value;
            if (subField === 'frequencyDays') {
                processedValue = Math.max(1, parseInt(value, 10) || 1);
            }
            setSettings(prev => ({
                ...prev,
                pastDueReminders: { ...prev.pastDueReminders, [subField]: processedValue }
            }));
        } else if (field.startsWith('upcomingJobReminders.')) {
            const subField = field.split('.')[1];
            setSettings(prev => ({
                ...prev,
                upcomingJobReminders: { 
                    ...(prev.upcomingJobReminders || { isEnabled: false }), 
                    [subField]: value 
                }
            }));
        } else {
            // Top level
            setSettings(prev => ({ ...prev, [field]: value }));
        }
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
        <section className="md:bg-surface-container-low md:p-8 md:rounded-2xl md:border md:border-outline/10 max-w-5xl mx-auto transition-all">
            <h2 className="text-2xl font-semibold text-text-primary mb-2 flex items-center gap-3">
                <Mail className="w-7 h-7 text-accent" />
                System-Wide Email Settings
            </h2>
            <p className="text-text-secondary mb-6">
                These settings are global and affect all users and automated emails sent to customers.
            </p>
            
            <div className="space-y-6 pt-6 mb-8">
                <h3 className="text-lg font-medium text-text-primary mb-2 flex items-center gap-2">
                    <Lock className="w-4 h-4 text-secondary" /> SMTP Credentials (Gmail)
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-text-secondary mb-1">Gmail Address</label>
                        <input 
                            type="email" 
                            value={credentials.emailUser}
                            onChange={(e) => setCredentials(prev => ({ ...prev, emailUser: e.target.value }))}
                            placeholder="company@gmail.com"
                            className="w-full p-3 bg-surface-container-highest border-b-2 border-transparent rounded-t-md text-text-primary focus:outline-none focus:border-primary transition-all placeholder:text-text-tertiary"
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
                                className="w-full p-3 bg-surface-container-highest border-b-2 border-transparent rounded-t-md text-text-primary focus:outline-none focus:border-primary transition-all pr-10"
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-text-secondary hover:text-text-primary"
                            >
                                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                            </button>
                        </div>
                        <p className="text-xs text-text-tertiary mt-1">
                            Use an "App Password" generated from your Google Account settings, not your login password.
                        </p>
                    </div>
                </div>
                
                <div className="mt-2 flex justify-end">
                    <button 
                        onClick={handleSendTest} 
                        type="button"
                        className="text-sm flex items-center gap-2 text-primary hover:text-primary-hover font-bold bg-primary/5 hover:bg-primary/10 px-4 py-2 rounded-full transition-colors"
                    >
                        <Send size={16} /> Send Test Email
                    </button>
                </div>
            </div>

            <div className="space-y-6 border-t border-outline/10 pt-6 mb-8">
                <h3 className="text-lg font-medium text-text-primary mb-2 flex items-center gap-2">
                    <Clock className="w-4 h-4 text-secondary" /> Company Communication Schedule
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="p-4 bg-surface-container-highest rounded-xl border border-outline/10 flex flex-col gap-2">
                        <label className="text-sm font-medium text-text-secondary">Send daily updates at:</label>
                        <input 
                            type="time" 
                            value={settings.dailyUpdateTime || "07:00"}
                            onChange={(e) => setSettings(prev => ({ ...prev, dailyUpdateTime: e.target.value }))}
                            className="p-2 bg-surface-container-low border border-outline/10 rounded-lg text-text-primary cursor-pointer w-full focus:border-primary focus:outline-none"
                        />
                    </div>
                    <div className="p-4 bg-surface-container-highest rounded-xl border border-outline/10 flex flex-col gap-2">
                        <label className="text-sm font-medium text-text-secondary flex items-center gap-2">
                            <Globe size={14} /> Server Timezone
                        </label>
                        <select
                            value={settings.timezone || "America/New_York"}
                            onChange={(e) => setSettings(prev => ({ ...prev, timezone: e.target.value }))}
                            className="p-2 bg-surface-container-low border border-outline/10 rounded-lg text-text-primary w-full focus:border-primary focus:outline-none"
                        >
                            {TIMEZONES.map(tz => <option key={tz} value={tz}>{tz}</option>)}
                        </select>
                    </div>
                </div>
            </div>

            <div className="space-y-4 border-t border-outline/10 pt-6 mb-8">
                <h3 className="text-lg font-medium text-text-primary mb-2">Customer Automations</h3>
                
                {/* 1. PAST DUE REMINDERS */}
                <div className="flex items-center justify-between py-4 border-b border-outline/10 md:bg-surface-container-highest md:border md:rounded-xl md:p-6 md:border-outline/10">
                    <label htmlFor="pastDueIsEnabled" className="font-medium text-text-primary">
                        Enable Past Due Reminders
                    </label>
                    <div className="relative inline-block w-14 h-8 align-middle select-none transition duration-200 ease-in">
                        <input
                            type="checkbox"
                            id="pastDueIsEnabled"
                            checked={settings.pastDueReminders.isEnabled}
                            onChange={(e) => handleSettingChange('pastDueReminders.isEnabled', e.target.checked)}
                            className="peer absolute block w-8 h-8 rounded-full bg-surface border-4 border-outline appearance-none cursor-pointer checked:right-0 checked:border-primary checked:bg-primary transition-all duration-200"
                        />
                        <label htmlFor="pastDueIsEnabled" className="block overflow-hidden h-8 rounded-full bg-surface-container-highest border border-outline/20 cursor-pointer peer-checked:bg-primary/20 transition-colors"></label>
                    </div>
                </div>

                {settings.pastDueReminders.isEnabled && (
                    <div className="p-4 bg-surface-container-highest/50 rounded-xl border border-outline/10 ml-4 border-l-4 border-l-primary">
                        <div className="flex items-center gap-3">
                            <label htmlFor="pastDueFrequencyDays" className="text-text-secondary">Send reminder every</label>
                            <input
                                type="number"
                                id="pastDueFrequencyDays"
                                value={settings.pastDueReminders.frequencyDays}
                                onChange={(e) => handleSettingChange('pastDueReminders.frequencyDays', e.target.value)}
                                className="w-20 p-1 bg-surface-container-low border border-outline/20 rounded text-text-primary text-center focus:border-primary focus:outline-none"
                            />
                            <label htmlFor="pastDueFrequencyDays" className="text-text-secondary">days for overdue samples.</label>
                        </div>
                    </div>
                )}

                {/* 2. UPCOMING JOB REMINDERS (NEW) */}
                <div className="flex items-center justify-between py-4 border-b border-outline/10 md:bg-surface-container-highest md:border md:rounded-xl md:p-6 md:border-outline/10">
                    <div className="flex flex-col">
                        <label htmlFor="upcomingJobIsEnabled" className="font-medium text-text-primary flex items-center gap-2">
                            Enable Upcoming Job Reminders <Calendar size={16} className="text-primary" />
                        </label>
                        <span className="text-sm text-text-secondary mt-1">Automatically emails customers 2 business days before a job starts.</span>
                    </div>
                    
                    <div className="relative inline-block w-14 h-8 align-middle select-none transition duration-200 ease-in">
                        <input
                            type="checkbox"
                            id="upcomingJobIsEnabled"
                            checked={settings.upcomingJobReminders?.isEnabled || false}
                            onChange={(e) => handleSettingChange('upcomingJobReminders.isEnabled', e.target.checked)}
                            className="peer absolute block w-8 h-8 rounded-full bg-surface border-4 border-outline appearance-none cursor-pointer checked:right-0 checked:border-primary checked:bg-primary transition-all duration-200"
                        />
                        <label htmlFor="upcomingJobIsEnabled" className="block overflow-hidden h-8 rounded-full bg-surface-container-highest border border-outline/20 cursor-pointer peer-checked:bg-primary/20 transition-colors"></label>
                    </div>
                </div>
            </div>

            {/* 3. EMAIL TEMPLATES (NEW SECTION) */}
            <div className="space-y-6 border-t border-outline/10 pt-6">
                <h3 className="text-lg font-medium text-text-primary mb-2 flex items-center gap-2">
                    <FileEdit className="w-4 h-4 text-secondary" /> Message Templates
                </h3>
                <p className="text-sm text-text-secondary">
                    Customize the automated emails sent by the system.
                </p>
                
                <div className="grid grid-cols-1 gap-3">
                    {templates.map(template => (
                        <div key={template.key} className="flex items-center justify-between p-4 bg-surface-container-highest border border-outline/10 rounded-xl hover:border-primary/50 transition-colors group">
                            <div>
                                <div className="font-medium text-text-primary">{template.description}</div>
                                <div className="text-xs text-text-secondary mt-0.5">Subject: {template.subject}</div>
                            </div>
                            <button 
                                onClick={() => setEditingTemplateKey(template.key)}
                                className="px-4 py-2 text-sm font-bold text-primary bg-surface-container-low border border-outline/10 rounded-full hover:bg-primary hover:text-on-primary transition-all opacity-100 md:opacity-0 md:group-hover:opacity-100"
                            >
                                Edit
                            </button>
                        </div>
                    ))}
                    {templates.length === 0 && (
                        <div className="text-sm text-text-secondary italic p-4 text-center">No templates loaded.</div>
                    )}
                </div>
            </div>

            <div className="mt-8 pt-6 border-t border-outline/10 flex justify-end">
                <button onClick={handleSave} className="flex items-center gap-2 py-3 px-8 text-base bg-primary hover:bg-primary-hover text-on-primary rounded-full font-bold shadow-sm transition-all hover:shadow-md">
                    <Save size={18}/> Save System Settings
                </button>
            </div>

            {/* Template Editor Modal */}
            {editingTemplateKey && (
                <EmailTemplateModal 
                    templateKey={editingTemplateKey}
                    onClose={() => setEditingTemplateKey(null)}
                    onSave={fetchTemplates}
                />
            )}
        </section>
    );
};

export default SystemEmailSettings;