// src/components/DashboardEmailSettings.tsx

import React, { useState, useEffect } from 'react';
import { useData } from '../context/DataContext';
import toast from 'react-hot-toast';
import { Save, Bell, Send, AlertTriangle } from 'lucide-react';
import { UserPreferences } from '../types';
import * as reportService from '../services/reportService';

// Updated type to include the new pastDueReminders settings
type DashboardEmailPrefs = {
    isEnabled: boolean;
    frequency: 'daily' | 'on_event';
    includeSamplesDue: boolean;
    includeUpcomingJobs: boolean;
    upcomingJobsDays: number;
    includePendingQuotes: boolean;
    pendingQuotesDays: number;
    pastDueReminders: {
        isEnabled: boolean;
        frequencyDays: number;
    };
};

// Updated default state
const DEFAULT_SETTINGS: DashboardEmailPrefs = {
    isEnabled: false,
    frequency: 'daily',
    includeSamplesDue: true,
    includeUpcomingJobs: true,
    upcomingJobsDays: 7,
    includePendingQuotes: true,
    pendingQuotesDays: 14,
    pastDueReminders: {
        isEnabled: false,
        frequencyDays: 2,
    },
};

const DashboardEmailSettings: React.FC = () => {
    const { currentUser, saveCurrentUserPreferences, isDataLoading } = useData();
    const [settings, setSettings] = useState<DashboardEmailPrefs>(DEFAULT_SETTINGS);
    const [isLoading, setIsLoading] = useState(true);
    const [isSendingTest, setIsSendingTest] = useState(false);
    const [isSendingReminders, setIsSendingReminders] = useState(false);
    const [isSendingPastDue, setIsSendingPastDue] = useState(false);

    useEffect(() => {
        if (!isDataLoading && currentUser) {
            const savedPrefs = currentUser.preferences?.dashboardEmail || {};
            const mergedSettings = {
                ...DEFAULT_SETTINGS,
                ...savedPrefs,
                pastDueReminders: {
                    ...DEFAULT_SETTINGS.pastDueReminders,
                    ...(savedPrefs.pastDueReminders || {}),
                }
            };
            setSettings(mergedSettings);
            setIsLoading(false);
        }
    }, [currentUser, isDataLoading]);

    const handleSettingChange = (field: keyof DashboardEmailPrefs | `pastDueReminders.${keyof DashboardEmailPrefs['pastDueReminders']}`, value: any) => {
        if (field.startsWith('pastDueReminders.')) {
            const subField = field.split('.')[1] as keyof DashboardEmailPrefs['pastDueReminders'];
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
        } else {
            if (field === 'upcomingJobsDays' || field === 'pendingQuotesDays') {
                value = parseInt(value, 10) || 0;
            }
            setSettings(prev => ({ ...prev, [field as keyof DashboardEmailPrefs]: value }));
        }
    };

    const handleSave = async () => {
        if (!currentUser) { toast.error("User not found."); return; }
        const newPreferences: UserPreferences = {
            ...currentUser.preferences,
            dashboardEmail: settings,
        };
        await saveCurrentUserPreferences(newPreferences);
    };

    const handleSendTest = async () => {
        setIsSendingTest(true);
        toast.loading('Sending test email...');
        try {
            await reportService.sendTestDashboardEmail(settings);
            toast.dismiss();
            toast.success(`Test email sent to ${currentUser?.email}!`);
        } catch (error: any) {
            toast.dismiss();
            const errorMessage = error.response?.data?.error || "An unknown error occurred.";
            toast.error(`Failed to send test: ${errorMessage}`);
        } finally {
            setIsSendingTest(false);
        }
    };

    const handleSendAllReminders = async () => {
        if (!window.confirm("Are you sure you want to send sample reminder emails to ALL customers with items due tomorrow? This action cannot be undone.")) {
            return;
        }
        setIsSendingReminders(true);
        toast.loading('Sending "due tomorrow" reminders...');
        try {
            const result = await reportService.sendAllCustomerReminders();
            toast.dismiss();
            toast.success(result.message);
        } catch (error: any) {
            toast.dismiss();
            const errorMessage = error.response?.data?.error || "An unknown error occurred.";
            toast.error(`Failed to send reminders: ${errorMessage}`);
        } finally {
            setIsSendingReminders(false);
        }
    };

    const handleSendAllPastDue = async () => {
        if (!window.confirm("Are you sure you want to send overdue reminder emails to ALL customers with past-due samples?")) {
            return;
        }
        setIsSendingPastDue(true);
        toast.loading('Sending past-due reminders...');
        try {
            const result = await reportService.sendAllPastDueReminders();
            toast.dismiss();
            toast.success(result.message);
        } catch (error: any) {
            toast.dismiss();
            const errorMessage = error.response?.data?.error || "An unknown error occurred.";
            toast.error(`Failed to send past-due reminders: ${errorMessage}`);
        } finally {
            setIsSendingPastDue(false);
        }
    };

    if (isLoading) {
        return <div className="text-center p-8">Loading settings...</div>;
    }

    return (
        <div className="space-y-8 max-w-4xl mx-auto">
            <section className="bg-surface-container-high p-6 md:p-8 rounded-2xl shadow-sm border border-outline/10">
                <h2 className="text-xl font-semibold text-text-primary mb-2 flex items-center gap-3">
                    <Bell className="w-6 h-6 text-primary" />
                    Internal: Daily Dashboard Email
                </h2>
                <p className="text-text-secondary text-sm mb-6">
                    Configure a daily summary email to keep you updated on key business activities. This email is sent to you only.
                </p>
                <div className="space-y-8">
                    <div className="flex items-center justify-between p-4 bg-surface-container rounded-xl">
                        <label htmlFor="isEnabled" className="font-semibold text-lg text-text-primary">
                            Enable Dashboard Email
                        </label>
                        <label className="relative inline-flex items-center cursor-pointer">
                            <input type="checkbox" id="isEnabled" checked={settings.isEnabled} onChange={(e) => handleSettingChange('isEnabled', e.target.checked)} className="sr-only peer" />
                            <div className="w-11 h-6 bg-surface-container-highest rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-on-primary after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-outline after:border after:border-outline after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                        </label>
                    </div>
                    {settings.isEnabled && (
                        <div className="space-y-6 border-t border-outline/10 pt-6">
                            <div>
                                <h3 className="text-md font-medium text-text-primary mb-3">Frequency</h3>
                                <div className="flex gap-6 p-4 bg-surface-container rounded-xl">
                                    <label className="flex items-center gap-2">
                                        <input type="radio" name="frequency" value="daily" checked={settings.frequency === 'daily'} onChange={() => handleSettingChange('frequency', 'daily')} className="form-radio h-5 w-5 text-primary bg-surface-container-low border-outline/50" />
                                        <span>Send Daily</span>
                                    </label>
                                    <label className="flex items-center gap-2">
                                        <input type="radio" name="frequency" value="on_event" checked={settings.frequency === 'on_event'} onChange={() => handleSettingChange('frequency', 'on_event')} className="form-radio h-5 w-5 text-primary bg-surface-container-low border-outline/50" />
                                        <span>Send only when there's an update</span>
                                    </label>
                                </div>
                            </div>
                            <div>
                               <h3 className="text-md font-medium text-text-primary mb-3">Content to Include</h3>
                                <div className="space-y-4 p-4 bg-surface-container rounded-xl">
                                    <label className="flex items-center gap-3">
                                        <input type="checkbox" checked={settings.includeSamplesDue} onChange={(e) => handleSettingChange('includeSamplesDue', e.target.checked)} className="form-checkbox h-5 w-5 text-primary bg-surface-container-low border-outline/50 rounded" />
                                        <span>Samples Due Today</span>
                                    </label>
                                    <div className="flex items-center gap-3 text-sm">
                                        <input type="checkbox" id="includeUpcomingJobs" checked={settings.includeUpcomingJobs} onChange={(e) => handleSettingChange('includeUpcomingJobs', e.target.checked)} className="form-checkbox h-5 w-5 text-primary bg-surface-container-low border-outline/50 rounded" />
                                        <label htmlFor="includeUpcomingJobs">Upcoming Jobs starting within</label>
                                        <input type="number" value={settings.upcomingJobsDays} onChange={(e) => handleSettingChange('upcomingJobsDays', e.target.value)} disabled={!settings.includeUpcomingJobs} className="w-20 bg-surface-container-low border border-outline/50 rounded-lg px-2 py-1 text-text-primary disabled:opacity-50" />
                                        <label htmlFor="includeUpcomingJobs">days</label>
                                    </div>
                                    <div className="flex items-center gap-3 text-sm">
                                        <input type="checkbox" id="includePendingQuotes" checked={settings.includePendingQuotes} onChange={(e) => handleSettingChange('includePendingQuotes', e.target.checked)} className="form-checkbox h-5 w-5 text-primary bg-surface-container-low border-outline/50 rounded" />
                                        <label htmlFor="includePendingQuotes">Pending Quotes older than</label>
                                        <input type="number" value={settings.pendingQuotesDays} onChange={(e) => handleSettingChange('pendingQuotesDays', e.target.value)} disabled={!settings.includePendingQuotes} className="w-20 bg-surface-container-low border border-outline/50 rounded-lg px-2 py-1 text-text-primary disabled:opacity-50" />
                                        <label htmlFor="includePendingQuotes">days</label>
                                    </div>
                               </div>
                            </div>
                        </div>
                    )}
                     <div className="flex justify-end items-center gap-4 pt-6 border-t border-outline/10">
                        <button onClick={handleSendTest} disabled={isSendingTest} className="flex items-center gap-2 py-2.5 px-6 rounded-full border border-outline text-text-primary hover:bg-surface-container-highest transition-colors font-semibold disabled:opacity-50 disabled:cursor-not-allowed">
                            <Send size={18}/> {isSendingTest ? 'Sending...' : 'Send Test'}
                        </button>
                    </div>
                </div>
            </section>

            {currentUser?.roles.includes('Admin') && (
                 <section className="bg-surface-container-high p-6 md:p-8 rounded-2xl shadow-sm border-2 border-tertiary-container/80">
                    <h2 className="text-xl font-semibold text-tertiary mb-3 flex items-center gap-3">
                        <AlertTriangle className="w-6 h-6" />
                        Manual Actions
                    </h2>
                    <p className="text-text-secondary text-sm mb-6">
                        Manually trigger system-wide email blasts. These actions are sent to all relevant customers immediately.
                    </p>
                    <div className="space-y-4">
                        <div className="flex items-center justify-between p-4 bg-surface-container rounded-xl">
                            <div>
                                <h3 className="font-semibold text-lg text-text-primary">Send "Due Tomorrow" Reminders</h3>
                                <p className="text-text-secondary text-sm mt-1">
                                    Trigger email to customers with samples due tomorrow.
                                </p>
                            </div>
                            <button onClick={handleSendAllReminders} disabled={isSendingReminders} className="flex items-center gap-2 py-2.5 px-6 rounded-full bg-tertiary text-on-tertiary font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition-all">
                                <Send size={18}/> {isSendingReminders ? 'Sending...' : 'Send All Now'}
                            </button>
                        </div>
                        <div className="flex items-center justify-between p-4 bg-surface-container rounded-xl">
                            <div>
                                <h3 className="font-semibold text-lg text-text-primary">Send "Past Due" Reminders</h3>
                                <p className="text-text-secondary text-sm mt-1">
                                    Trigger email for ALL customers with past-due samples.
                                </p>
                            </div>
                            <button onClick={handleSendAllPastDue} disabled={isSendingPastDue} className="flex items-center gap-2 py-2.5 px-6 rounded-full bg-error text-on-error font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition-all">
                                <Send size={18}/> {isSendingPastDue ? 'Sending...' : 'Send Past Due'}
                            </button>
                        </div>
                    </div>
                </section>
            )}

            <div className="flex justify-end">
                <button onClick={handleSave} className="flex items-center gap-2 py-3 px-6 rounded-full bg-primary hover:bg-primary-hover text-on-primary font-semibold shadow-md transition-all">
                    <Save size={18}/> Save My Settings
                </button>
            </div>
        </div>
    );
};

export const SystemEmailSettings: React.FC = () => {
    const { currentUser, systemPreferences, saveSystemPreferences } = useData();
    const [settings, setSettings] = useState(DEFAULT_SETTINGS.pastDueReminders);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        if (systemPreferences) {
            const merged = { ...DEFAULT_SETTINGS.pastDueReminders, ...systemPreferences.pastDueReminders };
            setSettings(merged);
            setIsLoading(false);
        }
    }, [systemPreferences]);

    const handleSettingChange = (field: keyof typeof settings, value: any) => {
        let processedValue = value;
        if (field === 'frequencyDays') {
             processedValue = Math.max(1, parseInt(value, 10) || 1);
        }
        setSettings(prev => ({ ...prev, [field]: processedValue }));
    };

    const handleSave = async () => {
        await saveSystemPreferences({ pastDueReminders: settings });
    };
    
    if (isLoading) return <div>Loading...</div>;
    if (!currentUser?.roles.includes('Admin')) return null;

    return (
        <div className="space-y-8 max-w-4xl mx-auto">
            <section className="bg-surface-container-high p-6 md:p-8 rounded-2xl shadow-sm border border-outline/10">
                <h2 className="text-xl font-semibold text-text-primary mb-2 flex items-center gap-3">
                    <Bell className="w-6 h-6 text-primary" />
                    Customer-Facing: Past Due Sample Reminders
                </h2>
                <p className="text-text-secondary text-sm mb-6">
                    Automatically send reminder emails to customers for samples that are overdue.
                </p>
                <div className="space-y-8">
                    <div className="flex items-center justify-between p-4 bg-surface-container rounded-xl">
                        <label htmlFor="pastDueIsEnabled" className="font-semibold text-lg text-text-primary ">
                            Enable Past Due Reminders
                        </label>
                        <label className="relative inline-flex items-center cursor-pointer">
                            <input type="checkbox" id="pastDueIsEnabled" checked={settings.isEnabled} onChange={(e) => handleSettingChange('isEnabled', e.target.checked)} className="sr-only peer" />
                            <div className="w-11 h-6 bg-surface-container-highest rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-on-primary after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-outline after:border after:border-outline after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                        </label>
                    </div>
                    {settings.isEnabled && (
                        <div className="space-y-3 p-4 bg-surface-container rounded-xl border-t border-outline/10">
                            <div className="flex items-center gap-3">
                                <label htmlFor="pastDueFrequencyDays">Send reminder every</label>
                                <input type="number" id="pastDueFrequencyDays" value={settings.frequencyDays} onChange={(e) => handleSettingChange('frequencyDays', e.target.value)} className="w-20 bg-surface-container-low border border-outline/50 rounded-lg px-2 py-1 text-text-primary" />
                                <label htmlFor="pastDueFrequencyDays">days for overdue samples.</label>
                            </div>
                        </div>
                    )}
                </div>
            </section>
            <div className="flex justify-end">
                <button onClick={handleSave} className="flex items-center gap-2 py-3 px-6 rounded-full bg-primary hover:bg-primary-hover text-on-primary font-semibold shadow-md transition-all">
                    <Save size={18}/> Save System Settings
                </button>
            </div>
        </div>
    );
};
 
export default DashboardEmailSettings;