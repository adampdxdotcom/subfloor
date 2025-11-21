import React, { useState, useEffect } from 'react';
import { DownloadCloud, Users, FileSliders, UserCog, Bell, Mail, DollarSign, Brush } from 'lucide-react';
import { useData } from '../context/DataContext';

// Import refactored components
import UserManagementSection from '../components/UserManagementSection';
import BrandingSettingsSection from '../components/BrandingSettingsSection';
import BackupRestoreSection from '../components/BackupRestoreSection';
import MySettingsSection from '../components/MySettingsSection';
import SizeManagement from '../components/SizeManagement';
import UserNotificationSettings from '../components/UserNotificationSettings';
import SystemEmailSettings from '../components/SystemEmailSettings';
import PricingConfigurationSection from '../components/PricingConfigurationSection';

// =================================================================
// MAIN SETTINGS PAGE COMPONENT
// =================================================================
const Settings: React.FC = () => {
    const { currentUser } = useData();
    const isAdmin = currentUser?.roles?.includes('Admin');
    
    const [activeTab, setActiveTab] = useState<'mySettings' | 'notifications' | 'users' | 'data' | 'email' | 'backup' | 'pricing' | 'branding'>('mySettings');

    useEffect(() => {
        const adminTabs: (typeof activeTab)[] = ['users', 'data', 'backup', 'email', 'pricing', 'branding'];
        if (!isAdmin && adminTabs.includes(activeTab)) {
            setActiveTab('mySettings');
        }
    }, [isAdmin, activeTab]);
    
    return (
        <div className="container mx-auto p-4 md:p-8">
            <h1 className="text-3xl font-bold text-text-primary mb-6">Settings</h1>
            <div className="flex flex-wrap border-b border-border mb-8">
                {/* My Settings Tab */}
                <button
                    onClick={() => setActiveTab('mySettings')}
                    className={`py-3 px-6 text-lg font-semibold transition-colors ${activeTab === 'mySettings' ? 'text-accent border-b-2 border-accent' : 'text-text-primary opacity-70 hover:opacity-100'}`}
                >
                    <UserCog className="w-5 h-5 inline-block mr-2 mb-1" />
                    My Settings
                </button>
                
                {/* RENAMED: "My Notifications" Tab (Visible to all users) */}
                <button
                    onClick={() => setActiveTab('notifications')}
                    className={`py-3 px-6 text-lg font-semibold transition-colors ${activeTab === 'notifications' ? 'text-accent border-b-2 border-accent' : 'text-text-primary opacity-70 hover:opacity-100'}`}
                >
                    <Bell className="w-5 h-5 inline-block mr-2 mb-1" />
                    My Notifications
                </button>

                {/* Admin-only Tabs */}
                {isAdmin && (
                    <>
                        {/* NEW: Admin-only Email Settings Tab */}
                        <button
                            onClick={() => setActiveTab('email')}
                            className={`py-3 px-6 text-lg font-semibold transition-colors ${activeTab === 'email' ? 'text-accent border-b-2 border-accent' : 'text-text-primary opacity-70 hover:opacity-100'}`}
                        >
                            <Mail className="w-5 h-5 inline-block mr-2 mb-1" />
                            Email Settings
                        </button>
                        {/* NEW: Pricing Configuration Tab */}
                        <button
                            onClick={() => setActiveTab('pricing')}
                            className={`py-3 px-6 text-lg font-semibold transition-colors ${activeTab === 'pricing' ? 'text-accent border-b-2 border-accent' : 'text-text-primary opacity-70 hover:opacity-100'}`}
                        >
                            <DollarSign className="w-5 h-5 inline-block mr-2 mb-1" />
                            Pricing Config
                        </button>
                         <button
                            onClick={() => setActiveTab('branding')}
                            className={`py-3 px-6 text-lg font-semibold transition-colors ${activeTab === 'branding' ? 'text-accent border-b-2 border-accent' : 'text-text-primary opacity-70 hover:opacity-100'}`}
                        >
                            <Brush className="w-5 h-5 inline-block mr-2 mb-1" />
                            Branding
                        </button>
                        <button
                            onClick={() => setActiveTab('users')}
                            className={`py-3 px-6 text-lg font-semibold transition-colors ${activeTab === 'users' ? 'text-accent border-b-2 border-accent' : 'text-text-primary opacity-70 hover:opacity-100'}`}
                        >
                            <Users className="w-5 h-5 inline-block mr-2 mb-1" />
                            User Management
                        </button>
                        <button
                            onClick={() => setActiveTab('data')}
                            className={`py-3 px-6 text-lg font-semibold transition-colors ${activeTab === 'data' ? 'text-accent border-b-2 border-accent' : 'text-text-primary opacity-70 hover:opacity-100'}`}
                        >
                            <FileSliders className="w-5 h-5 inline-block mr-2 mb-1" />
                            Data Management
                        </button>
                         <button
                            onClick={() => setActiveTab('backup')}
                            className={`py-3 px-6 text-lg font-semibold transition-colors  ${activeTab === 'backup' ? 'text-accent border-b-2 border-accent' : 'text-text-primary opacity-70 hover:opacity-100'}`}
                        >
                            <DownloadCloud className="w-5 h-5 inline-block mr-2 mb-1" />
                            Backup & Restore
                        </button>
                    </>
                )}
            </div>
            
            <div>
                {activeTab === 'mySettings' && <MySettingsSection />}
                {activeTab === 'notifications' && <UserNotificationSettings />} 
                {activeTab === 'email' && isAdmin && <SystemEmailSettings />}
                {activeTab === 'pricing' && isAdmin && <PricingConfigurationSection />}
                {activeTab === 'branding' && isAdmin && <BrandingSettingsSection />}
                {activeTab === 'users' && isAdmin && <UserManagementSection />}
                {activeTab === 'backup' && isAdmin && <BackupRestoreSection />}
                {activeTab === 'data' && isAdmin && <SizeManagement />}
            </div>
        </div>
    );
};

export default Settings;