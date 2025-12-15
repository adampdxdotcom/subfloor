// src/components/UserNotificationSettings.tsx

import React, { useState, useEffect } from 'react';
import { useData } from '../context/DataContext';
import toast from 'react-hot-toast';
import { Save, Bell, Send } from 'lucide-react';
import { UserPreferences } from '../types';
import * as reportService from '../services/reportService';

// Updated type to reflect the new user-facing options
type UserNotificationPrefs = {
    isEnabled: boolean;
    includeAllUpdates: boolean;
    includePersonalAppointments: boolean;
    personalAppointmentsDays: number;
    // The following fields are kept for backend compatibility but hidden from the UI
    frequency: 'daily' | 'on_event';
    includeSamplesDue: boolean;
    includeUpcomingJobs: boolean;
    upcomingJobsDays: number;
    includePendingQuotes: boolean;
    pendingQuotesDays: number;
};

// Updated defaults
const DEFAULT_SETTINGS: UserNotificationPrefs = {
    isEnabled: false,
    includeAllUpdates: true,
    includePersonalAppointments: true,
    personalAppointmentsDays: 7,
    // Default legacy fields
    frequency: 'daily',
    includeSamplesDue: true,
    includeUpcomingJobs: true,
    upcomingJobsDays: 7,
    includePendingQuotes: true,
    pendingQuotesDays: 14,
};

const UserNotificationSettings: React.FC = () => {
    const { currentUser, saveCurrentUserPreferences, isDataLoading } = useData();
    const [settings, setSettings] = useState<UserNotificationPrefs>(DEFAULT_SETTINGS);
    const [notifyUpcomingJobs, setNotifyUpcomingJobs] = useState(true); // NEW
    const [isLoading, setIsLoading] = useState(true);
    const [isSendingTest, setIsSendingTest] = useState(false);

    useEffect(() => {
        if (!isDataLoading && currentUser) {
            const savedPrefs = currentUser.preferences?.dashboardEmail || {};
            setSettings({ ...DEFAULT_SETTINGS, ...savedPrefs });
            setNotifyUpcomingJobs(currentUser.preferences?.notifyUpcomingJobs !== false); // Default True
            setIsLoading(false);
        }
    }, [currentUser, isDataLoading]);

    const handleSettingChange = (field: keyof UserNotificationPrefs, value: any) => {
        let processedValue = value;
        if (field === 'personalAppointmentsDays') {
            processedValue = Math.max(1, parseInt(value, 10) || 1);
        }
        
        if (field === 'includeAllUpdates') {
            setSettings(prev => ({ 
                ...prev,
                [field]: processedValue,
                includeSamplesDue: processedValue,
                includeUpcomingJobs: processedValue,
                includePendingQuotes: processedValue,
            }));
        } else {
            setSettings(prev => ({ ...prev, [field]: processedValue }));
        }
    };

    const handleSave = async () => {
        if (!currentUser) { toast.error("User not found."); return; }
        const newPreferences: UserPreferences = {
            ...currentUser.preferences,
            dashboardEmail: settings,
            notifyUpcomingJobs: notifyUpcomingJobs // Save new pref
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

    if (isLoading) {
        return <div className="text-center p-8">Loading settings...</div>;
    }

    return (
        <div className="space-y-8">
            <section className="bg-surface p-6 rounded-lg shadow-md border border-border max-w-4xl mx-auto">
                <h2 className="text-2xl font-semibold text-text-primary mb-2 flex items-center gap-3">
                    <Bell className="w-7 h-7 text-accent" />
                    My Daily Update Email
                </h2>
                <p className="text-text-secondary mb-6">
                    Configure a daily summary email with system updates and your personal appointments. This email is sent only to you.
                </p>
                <div className="space-y-6">
                    <div className="flex items-center justify-between p-4 bg-background rounded-md border border-border">
                        <label htmlFor="isEnabled" className="font-semibold text-lg text-text-primary">
                            Receive Daily Update Email
                        </label>
                        <div className="relative inline-block w-14 h-8 align-middle select-none transition duration-200 ease-in">
                            <input type="checkbox" id="isEnabled" checked={settings.isEnabled} onChange={(e) => handleSettingChange('isEnabled', e.target.checked)} className="toggle-checkbox absolute block w-8 h-8 rounded-full bg-white border-4 appearance-none cursor-pointer"/>
                            <label htmlFor="isEnabled" className="toggle-label block overflow-hidden h-8 rounded-full bg-secondary cursor-pointer"></label>
                        </div>
                    </div>
                    {settings.isEnabled && (
                        <div className="space-y-6 border-t border-border pt-6">
                            <div>
                               <h3 className="text-lg font-medium text-text-primary mb-2">Content to Include</h3>
                                <div className="space-y-3 p-4 bg-background rounded-md border border-border">
                                    <label className="flex items-center gap-3">
                                        <input type="checkbox" checked={settings.includeAllUpdates} onChange={(e) => handleSettingChange('includeAllUpdates', e.target.checked)} className="form-checkbox h-5 w-5 text-primary bg-surface border-border rounded focus:ring-primary" />
                                        <span className="text-text-primary">Include all system updates (samples, jobs, quotes, etc.)</span>
                                    </label>
                                    <div className="flex items-center gap-3">
                                        <input type="checkbox" id="includePersonalAppointments" checked={settings.includePersonalAppointments} onChange={(e) => handleSettingChange('includePersonalAppointments', e.target.checked)} className="form-checkbox h-5 w-5 text-primary bg-surface border-border rounded focus:ring-primary" />
                                        <label htmlFor="includePersonalAppointments" className="text-text-primary">Include my personal appointments for the next</label>
                                        <input type="number" value={settings.personalAppointmentsDays} onChange={(e) => handleSettingChange('personalAppointmentsDays', e.target.value)} disabled={!settings.includePersonalAppointments} className="w-20 p-1 bg-surface border-border rounded text-text-primary disabled:opacity-50" />
                                        <label htmlFor="includePersonalAppointments" className="text-text-primary">days</label>
                                    </div>
                               </div>
                            </div>
                        </div>
                    )}
                     <div className="flex justify-end items-center gap-4 pt-4 border-t border-border">
                        <button onClick={handleSendTest} disabled={isSendingTest} className="flex items-center gap-2 py-2 px-6 text-base bg-secondary hover:bg-secondary-hover rounded text-on-secondary font-semibold disabled:opacity-50 disabled:cursor-not-allowed">
                            <Send size={18}/> {isSendingTest ? 'Sending...' : 'Send Test'}
                        </button>
                    </div>
                </div>
            </section>

            {/* --- NEW SECTION: Project Alerts --- */}
            <section className="bg-surface p-6 rounded-lg shadow-md border border-border max-w-4xl mx-auto">
                <h2 className="text-xl font-semibold text-text-primary mb-2 flex items-center gap-3">
                    <Bell className="w-6 h-6 text-accent" />
                    Project Alerts
                </h2>
                <div className="p-4 bg-background rounded-md border border-border">
                    <label className="flex items-center space-x-3 cursor-pointer">
                        <input 
                            type="checkbox" 
                            checked={notifyUpcomingJobs} 
                            onChange={e => setNotifyUpcomingJobs(e.target.checked)}
                            className="form-checkbox h-5 w-5 text-primary bg-surface border-border rounded focus:ring-primary" 
                        />
                        <span className="text-text-primary font-medium">Email me 2 days before my jobs start</span>
                    </label>
                    <p className="text-xs text-text-secondary mt-2 ml-8">
                        If enabled, you will receive an individual email reminder for every project where you are assigned as the Project Lead.
                    </p>
                </div>
                
                <div className="flex justify-end pt-6">
                    <button onClick={handleSave} className="flex items-center gap-2 py-2 px-6 text-base bg-primary hover:bg-primary-hover rounded text-on-primary font-semibold">
                        <Save size={18}/> Save My Settings
                    </button>
                </div>
            </section>
        </div>
    );
};

export default UserNotificationSettings;