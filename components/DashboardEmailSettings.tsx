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
    const [isSendingPastDue, setIsSendingPastDue] = useState(false); // New state for the new button

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

    // Updated handler to manage nested state
    const handleSettingChange = (field: keyof DashboardEmailPrefs | `pastDueReminders.${keyof DashboardEmailPrefs['pastDueReminders']}`, value: any) => {
        if (field.startsWith('pastDueReminders.')) {
            const subField = field.split('.')[1] as keyof DashboardEmailPrefs['pastDueReminders'];
            let processedValue = value;
            if (subField === 'frequencyDays') {
                processedValue = Math.max(1, parseInt(value, 10) || 1); // Ensure it's at least 1
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
        <>
            <section className="bg-surface p-6 rounded-lg shadow-md border border-border max-w-4xl mx-auto">
                <h2 className="text-2xl font-semibold text-text-primary mb-2 flex items-center gap-3">
                    <Bell className="w-7 h-7 text-accent" />
                    Internal: Daily Dashboard Email
                </h2>
                <p className="text-text-secondary mb-6">
                    Configure a daily summary email to keep you updated on key business activities. This email is sent to you only.
                </p>
                <div className="space-y-6">
                    <div className="flex items-center justify-between p-4 bg-gray-800 rounded-md">
                        <label htmlFor="isEnabled" className="font-semibold text-lg text-text-primary">
                            Enable Dashboard Email
                        </label>
                        <div className="relative inline-block w-14 h-8 align-middle select-none transition duration-200 ease-in">
                            <input type="checkbox" id="isEnabled" checked={settings.isEnabled} onChange={(e) => handleSettingChange('isEnabled', e.target.checked)} className="toggle-checkbox absolute block w-8 h-8 rounded-full bg-white border-4 appearance-none cursor-pointer"/>
                            <label htmlFor="isEnabled" className="toggle-label block overflow-hidden h-8 rounded-full bg-gray-600 cursor-pointer"></label>
                        </div>
                    </div>
                    {settings.isEnabled && (
                        <div className="space-y-6 border-t border-border pt-6">
                            <div>
                                <h3 className="text-lg font-medium text-text-primary mb-2">Frequency</h3>
                                <div className="flex gap-4 p-4 bg-gray-800 rounded-md">
                                    <label className="flex items-center gap-2">
                                        <input type="radio" name="frequency" value="daily" checked={settings.frequency === 'daily'} onChange={() => handleSettingChange('frequency', 'daily')} className="form-radio h-5 w-5 text-accent bg-gray-900 border-border" />
                                        <span>Send Daily</span>
                                    </label>
                                    <label className="flex items-center gap-2">
                                        <input type="radio" name="frequency" value="on_event" checked={settings.frequency === 'on_event'} onChange={() => handleSettingChange('frequency', 'on_event')} className="form-radio h-5 w-5 text-accent bg-gray-900 border-border" />
                                        <span>Send only when there's an update</span>
                                    </label>
                                </div>
                            </div>
                            <div>
                               <h3 className="text-lg font-medium text-text-primary mb-2">Content to Include</h3>
                                <div className="space-y-3 p-4 bg-gray-800 rounded-md">
                                    <label className="flex items-center gap-3">
                                        <input type="checkbox" checked={settings.includeSamplesDue} onChange={(e) => handleSettingChange('includeSamplesDue', e.target.checked)} className="form-checkbox h-5 w-5 text-accent bg-gray-900 border-border rounded" />
                                        <span>Samples Due Today</span>
                                    </label>
                                    <div className="flex items-center gap-3">
                                        <input type="checkbox" id="includeUpcomingJobs" checked={settings.includeUpcomingJobs} onChange={(e) => handleSettingChange('includeUpcomingJobs', e.target.checked)} className="form-checkbox h-5 w-5 text-accent bg-gray-900 border-border rounded" />
                                        <label htmlFor="includeUpcomingJobs">Upcoming Jobs starting within</label>
                                        <input type="number" value={settings.upcomingJobsDays} onChange={(e) => handleSettingChange('upcomingJobsDays', e.target.value)} disabled={!settings.includeUpcomingJobs} className="w-20 p-1 bg-gray-900 border-border rounded disabled:opacity-50" />
                                        <label htmlFor="includeUpcomingJobs">days</label>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <input type="checkbox" id="includePendingQuotes" checked={settings.includePendingQuotes} onChange={(e) => handleSettingChange('includePendingQuotes', e.target.checked)} className="form-checkbox h-5 w-5 text-accent bg-gray-900 border-border rounded" />
                                        <label htmlFor="includePendingQuotes">Pending Quotes older than</label>
                                        <input type="number" value={settings.pendingQuotesDays} onChange={(e) => handleSettingChange('pendingQuotesDays', e.target.value)} disabled={!settings.includePendingQuotes} className="w-20 p-1 bg-gray-900 border-border rounded disabled:opacity-50" />
                                        <label htmlFor="includePendingQuotes">days</label>
                                    </div>
                               </div>
                            </div>
                        </div>
                    )}
                     <div className="flex justify-end items-center gap-4 pt-4 border-t border-border">
                        <button onClick={handleSendTest} disabled={isSendingTest} className="flex items-center gap-2 py-2 px-6 text-base bg-gray-600 text-white rounded hover:bg-gray-700 font-semibold disabled:opacity-50 disabled:cursor-not-allowed">
                            <Send size={18}/> {isSendingTest ? 'Sending...' : 'Send Test'}
                        </button>
                    </div>
                </div>
            </section>

            <section className="mt-8 bg-surface p-6 rounded-lg shadow-md border border-border max-w-4xl mx-auto">
                <h2 className="text-2xl font-semibold text-text-primary mb-2 flex items-center gap-3">
                    <Bell className="w-7 h-7 text-accent" />
                    Customer-Facing: Past Due Sample Reminders
                </h2>
                <p className="text-text-secondary mb-6">
                    Automatically send reminder emails to customers for samples that are overdue.
                </p>
                <div className="space-y-6">
                    <div className="flex items-center justify-between p-4 bg-gray-800 rounded-md">
                        <label htmlFor="pastDueIsEnabled" className="font-semibold text-lg text-text-primary">
                            Enable Past Due Reminders
                        </label>
                        <div className="relative inline-block w-14 h-8 align-middle select-none transition duration-200 ease-in">
                            <input type="checkbox" id="pastDueIsEnabled" checked={settings.pastDueReminders.isEnabled} onChange={(e) => handleSettingChange('pastDueReminders.isEnabled', e.target.checked)} className="toggle-checkbox absolute block w-8 h-8 rounded-full bg-white border-4 appearance-none cursor-pointer"/>
                            <label htmlFor="pastDueIsEnabled" className="toggle-label block overflow-hidden h-8 rounded-full bg-gray-600 cursor-pointer"></label>
                        </div>
                    </div>
                    {settings.pastDueReminders.isEnabled && (
                        <div className="space-y-3 p-4 bg-gray-800 rounded-md border-t border-border">
                            <div className="flex items-center gap-3">
                                <label htmlFor="pastDueFrequencyDays">Send reminder every</label>
                                <input type="number" id="pastDueFrequencyDays" value={settings.pastDueReminders.frequencyDays} onChange={(e) => handleSettingChange('pastDueReminders.frequencyDays', e.target.value)} className="w-20 p-1 bg-gray-900 border-border rounded" />
                                <label htmlFor="pastDueFrequencyDays">days for overdue samples.</label>
                            </div>
                        </div>
                    )}
                </div>
            </section>

            {currentUser?.roles.includes('Admin') && (
                 <section className="mt-8 bg-surface p-6 rounded-lg shadow-md border-2 border-yellow-500/50 max-w-4xl mx-auto">
                    <h2 className="text-2xl font-semibold text-yellow-400 mb-4 flex items-center gap-3">
                        <AlertTriangle className="w-7 h-7" />
                        Manual Actions
                    </h2>
                    <div className="space-y-4">
                        <div className="flex items-center justify-between p-4 bg-gray-800 rounded-md">
                            <div>
                                <h3 className="font-semibold text-lg text-text-primary">Send "Due Tomorrow" Reminders</h3>
                                <p className="text-text-secondary mt-1">
                                    Manually trigger the email reminder for all customers with samples due tomorrow.
                                </p>
                            </div>
                            <button onClick={handleSendAllReminders} disabled={isSendingReminders} className="flex items-center gap-2 py-2 px-6 text-base bg-yellow-600 text-white rounded hover:bg-yellow-700 font-semibold disabled:opacity-50 disabled:cursor-not-allowed">
                                <Send size={18}/> {isSendingReminders ? 'Sending...' : 'Send All Now'}
                            </button>
                        </div>
                        <div className="flex items-center justify-between p-4 bg-gray-800 rounded-md">
                            <div>
                                <h3 className="font-semibold text-lg text-text-primary">Send "Past Due" Reminders</h3>
                                <p className="text-text-secondary mt-1">
                                    Manually trigger the email reminder for ALL customers with past-due samples.
                                </p>
                            </div>
                            <button onClick={handleSendAllPastDue} disabled={isSendingPastDue} className="flex items-center gap-2 py-2 px-6 text-base bg-red-600 text-white rounded hover:bg-red-700 font-semibold disabled:opacity-50 disabled:cursor-not-allowed">
                                <Send size={18}/> {isSendingPastDue ? 'Sending...' : 'Send All Past Due'}
                            </button>
                        </div>
                    </div>
                </section>
            )}

            <div className="mt-8 flex justify-end max-w-4xl mx-auto">
                <button onClick={handleSave} className="flex items-center gap-2 py-2 px-6 text-base bg-blue-600 text-white rounded hover:bg-blue-700 font-semibold">
                    <Save size={18}/> Save All Settings
                </button>
            </div>
        </>
    );
};

export default DashboardEmailSettings;