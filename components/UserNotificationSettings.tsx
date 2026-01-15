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
        <div className="space-y-8 max-w-5xl mx-auto">
            <section className="md:bg-surface-container-low md:p-8 md:rounded-2xl md:border md:border-outline/10 transition-all">
                <h2 className="text-2xl font-semibold text-text-primary mb-2 flex items-center gap-3">
                    <Bell className="w-7 h-7 text-accent" />
                    My Daily Update Email
                </h2>
                <p className="text-text-secondary mb-6">
                    Configure a daily summary email with system updates and your personal appointments. This email is sent only to you.
                </p>
                <div className="space-y-6">
                    <div className="flex items-center justify-between py-6 border-b border-outline/10 md:border md:bg-surface-container-highest md:rounded-xl md:p-6 md:border-outline/10">
                        <label htmlFor="isEnabled" className="font-medium text-lg text-text-primary">
                            Receive Daily Update Email
                        </label>
                        <div className="relative inline-block w-14 h-8 align-middle select-none transition duration-200 ease-in">
                            <input type="checkbox" id="isEnabled" checked={settings.isEnabled} onChange={(e) => handleSettingChange('isEnabled', e.target.checked)} className="peer absolute block w-8 h-8 rounded-full bg-surface border-4 border-outline appearance-none cursor-pointer checked:right-0 checked:border-primary checked:bg-primary transition-all duration-200"/>
                            <label htmlFor="isEnabled" className="block overflow-hidden h-8 rounded-full bg-surface-container-highest border border-outline/20 cursor-pointer peer-checked:bg-primary/20 transition-colors"></label>
                        </div>
                    </div>
                    {settings.isEnabled && (
                        <div className="space-y-6 pt-2">
                            <div>
                               <h3 className="text-lg font-medium text-text-primary mb-2">Content to Include</h3>
                                <div className="space-y-4 py-4 md:p-6 md:bg-surface-container-highest md:rounded-xl md:border md:border-outline/10">
                                    <label className="flex items-center gap-3">
                                        <input type="checkbox" checked={settings.includeAllUpdates} onChange={(e) => handleSettingChange('includeAllUpdates', e.target.checked)} className="w-5 h-5 rounded border-outline/30 text-primary focus:ring-primary bg-surface-container-high" />
                                        <span className="text-text-primary">Include all system updates (samples, jobs, quotes, etc.)</span>
                                    </label>
                                    <div className="flex items-center gap-3">
                                        <input type="checkbox" id="includePersonalAppointments" checked={settings.includePersonalAppointments} onChange={(e) => handleSettingChange('includePersonalAppointments', e.target.checked)} className="w-5 h-5 rounded border-outline/30 text-primary focus:ring-primary bg-surface-container-high" />
                                        <label htmlFor="includePersonalAppointments" className="text-text-primary">Include my personal appointments for the next</label>
                                        <input type="number" value={settings.personalAppointmentsDays} onChange={(e) => handleSettingChange('personalAppointmentsDays', e.target.value)} disabled={!settings.includePersonalAppointments} className="w-16 p-1 bg-surface-container-high border border-outline/20 rounded text-center text-text-primary disabled:opacity-50 focus:border-primary focus:outline-none" />
                                        <label htmlFor="includePersonalAppointments" className="text-text-primary">days</label>
                                    </div>
                               </div>
                            </div>
                        </div>
                    )}
                     <div className="flex justify-end items-center gap-4 pt-4 mt-4 border-t border-outline/10">
                        <button onClick={handleSendTest} disabled={isSendingTest} className="flex items-center gap-2 py-2 px-6 text-sm bg-surface-container-highest hover:bg-surface-container-highest/80 rounded-full text-text-primary font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
                            <Send size={18}/> {isSendingTest ? 'Sending...' : 'Send Test'}
                        </button>
                    </div>
                </div>
            </section>

            {/* --- NEW SECTION: Project Alerts --- */}
            <section className="md:bg-surface-container-low md:p-8 md:rounded-2xl md:border md:border-outline/10 transition-all">
                <h2 className="text-xl font-semibold text-text-primary mb-2 flex items-center gap-3">
                    <Bell className="w-6 h-6 text-accent" />
                    Project Alerts
                </h2>
                <div className="py-6 border-b border-outline/10 md:border md:bg-surface-container-highest md:rounded-xl md:p-6 md:border-outline/10 mt-4">
                    <label className="flex items-center space-x-3 cursor-pointer">
                        <input 
                            type="checkbox" 
                            checked={notifyUpcomingJobs} 
                            onChange={e => setNotifyUpcomingJobs(e.target.checked)}
                            className="w-5 h-5 rounded border-outline/30 text-primary focus:ring-primary bg-surface-container-high" 
                        />
                        <span className="text-text-primary font-medium">Email me 2 days before my jobs start</span>
                    </label>
                    <p className="text-xs text-text-secondary mt-2 ml-8">
                        If enabled, you will receive an individual email reminder for every project where you are assigned as the Project Lead.
                    </p>
                </div>
                
                <div className="flex justify-end pt-8">
                    <button onClick={handleSave} className="flex items-center gap-2 py-3 px-8 text-base bg-primary hover:bg-primary-hover rounded-full text-on-primary font-bold shadow-sm transition-all hover:shadow-md">
                        <Save size={18}/> Save My Settings
                    </button>
                </div>
            </section>
        </div>
    );
};

export default UserNotificationSettings;