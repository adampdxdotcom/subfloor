import React, { useState, useEffect } from 'react';
import { DownloadCloud, Users, FileSliders, UserCog, Bell, Mail, DollarSign, Brush, Settings as SettingsIcon, ChevronDown, ChevronUp, Sparkles } from 'lucide-react';
import { useData } from '../context/DataContext';

// Import components
import UserManagementSection from '../components/UserManagementSection';
import BrandingSettingsSection from '../components/BrandingSettingsSection';
import BackupRestoreSection from '../components/BackupRestoreSection';
import MySettingsSection from '../components/MySettingsSection';
import SizeManagement from '../components/SizeManagement';
import UserNotificationSettings from '../components/UserNotificationSettings';
import SystemEmailSettings from '../components/SystemEmailSettings';
import PricingConfigurationSection from '../components/PricingConfigurationSection';
import { ChangelogViewer } from '../components/ChangelogViewer'; // New Import

// Tab Configuration Types
type TabId = 'mySettings' | 'notifications' | 'users' | 'data' | 'email' | 'backup' | 'pricing' | 'branding' | 'changelog';

interface TabDef {
    id: TabId; 
    label: string;
    icon?: React.ElementType;
    adminOnly: boolean;
}

interface CategoryDef {
    id: string;
    label: string;
    tabs: TabDef[];
}

const SETTINGS_STRUCTURE: CategoryDef[] = [
    {
        id: 'personal',
        label: 'My Settings',
        tabs: [
            { id: 'mySettings', label: 'Profile', icon: UserCog, adminOnly: false },
            { id: 'notifications', label: 'Notifications', icon: Bell, adminOnly: false }
        ]
    },
    {
        id: 'communications',
        label: 'Communications',
        tabs: [
            { id: 'email', label: 'Email Settings', icon: Mail, adminOnly: true }
        ]
    },
    {
        id: 'product',
        label: 'Product Management',
        tabs: [
            { id: 'pricing', label: 'Pricing', icon: DollarSign, adminOnly: true },
            { id: 'data', label: 'Data Management', icon: FileSliders, adminOnly: true }
        ]
    },
    {
        id: 'system',
        label: 'System',
        tabs: [
            { id: 'branding', label: 'Branding', icon: Brush, adminOnly: true },
            { id: 'users', label: 'Users', icon: Users, adminOnly: true },
            { id: 'backup', label: 'Backup', icon: DownloadCloud, adminOnly: true },
            { id: 'changelog', label: "What's New", icon: Sparkles, adminOnly: false } // New Tab
        ]
    }
];

const Settings: React.FC = () => {
    const { currentUser } = useData();
    const isAdmin = currentUser?.roles?.includes('Admin');
    
    const [activeTab, setActiveTab] = useState<TabId>('mySettings');

    const allTabs = SETTINGS_STRUCTURE.flatMap(cat => cat.tabs);
    
    const activeCategory = SETTINGS_STRUCTURE.find(cat => 
        cat.tabs.some(t => t.id === activeTab)
    ) || SETTINGS_STRUCTURE[0];

    const [expandedCategoryMobile, setExpandedCategoryMobile] = useState<string>(activeCategory.id);

    useEffect(() => {
        const currentTabObj = allTabs.find(t => t.id === activeTab);
        if (currentTabObj?.adminOnly && !isAdmin) {
            setActiveTab('mySettings');
        }
    }, [isAdmin, activeTab, allTabs]);

    const ActiveComponent = () => {
        switch (activeTab) {
            case 'mySettings': return <MySettingsSection />;
            case 'notifications': return <UserNotificationSettings />;
            case 'email': return <SystemEmailSettings />;
            case 'pricing': return <PricingConfigurationSection />;
            case 'branding': return <BrandingSettingsSection />;
            case 'users': return <UserManagementSection />;
            case 'data': return <SizeManagement />;
            case 'backup': return <BackupRestoreSection />;
            case 'changelog': return <ChangelogViewer />; // Added Case
            default: return null;
        }
    };
    
    const toggleCategory = (categoryId: string) => {
        setExpandedCategoryMobile(prevId => prevId === categoryId ? '' : categoryId);
    };

    return (
        <div className="max-w-7xl mx-auto">
            <div className="bg-surface p-6 rounded-lg shadow-md mb-8 border border-border">
                <div className="flex items-center mb-6">
                    <div className="w-16 h-16 bg-accent rounded-full flex items-center justify-center mr-6 flex-shrink-0">
                        <SettingsIcon className="w-8 h-8 text-white"/>
                    </div>
                    <div>
                        <h1 className="text-3xl font-bold text-text-primary">Settings</h1>
                    </div>
                </div>

                <div className="border-t border-border my-6 hidden md:block"></div>

                {/* DESKTOP NAVIGATION */}
                <div className="hidden md:block">
                    <div className="flex border-b border-border mb-6 overflow-x-auto">
                        {SETTINGS_STRUCTURE.map((cat) => {
                            const visibleTabs = cat.tabs.filter(t => !t.adminOnly || isAdmin);
                            if (visibleTabs.length === 0) return null;
                            const isCategoryActive = activeCategory.id === cat.id;
                            
                            return (
                                <button
                                    key={cat.id}
                                    onClick={() => setActiveTab(visibleTabs[0].id)}
                                    className={`px-6 py-3 text-sm font-bold uppercase tracking-wider transition-colors whitespace-nowrap
                                        ${isCategoryActive 
                                            ? 'text-primary border-b-2 border-primary' 
                                            : 'text-text-secondary hover:text-text-primary hover:border-b-2 hover:border-border'
                                        }`}
                                >
                                    {cat.label}
                                </button>
                            );
                        })}
                    </div>

                    <div className="flex flex-wrap gap-2">
                        {activeCategory.tabs.map((tab) => {
                            if (tab.adminOnly && !isAdmin) return null;
                            const isActive = activeTab === tab.id;
                            const Icon = tab.icon;

                            return (
                                <button
                                    key={tab.id}
                                    onClick={() => setActiveTab(tab.id)}
                                    className={`flex items-center px-4 py-2 rounded-full text-sm font-medium transition-colors border border-transparent
                                        ${isActive
                                            ? 'bg-primary text-on-primary shadow-sm'
                                            : 'bg-surface text-text-secondary border-border hover:border-primary hover:text-text-primary'
                                        }
                                    `}
                                >
                                    {Icon && <Icon className="w-4 h-4 mr-2" />}
                                    {tab.label}
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* MOBILE NAVIGATION */}
                <div className="md:hidden">
                    <div className="space-y-2">
                        {SETTINGS_STRUCTURE.map((cat) => {
                            const visibleTabs = cat.tabs.filter(t => !t.adminOnly || isAdmin);
                            if (visibleTabs.length === 0) return null;
                            const isExpanded = expandedCategoryMobile === cat.id;
                            const Chevron = isExpanded ? ChevronUp : ChevronDown;

                            return (
                                <div key={cat.id} className="border border-border rounded-lg overflow-hidden">
                                    <button
                                        onClick={() => toggleCategory(cat.id)}
                                        className={`flex justify-between items-center w-full p-4 text-left font-semibold transition-colors 
                                            ${isExpanded ? 'text-primary bg-background' : 'text-text-primary bg-surface hover:bg-background'}`
                                        }
                                    >
                                        {cat.label}
                                        <Chevron className="w-5 h-5 opacity-70" />
                                    </button>

                                    {isExpanded && (
                                        <nav className="border-t border-border bg-background">
                                            {visibleTabs.map((tab) => {
                                                const isActive = activeTab === tab.id;
                                                const Icon = tab.icon;
                                                return (
                                                    <button
                                                        key={tab.id}
                                                        onClick={() => {
                                                            setActiveTab(tab.id);
                                                            setExpandedCategoryMobile(cat.id);
                                                        }}
                                                        className={`w-full flex items-center px-6 py-3 text-sm transition-colors border-l-4 
                                                            ${isActive
                                                                ? 'text-primary border-primary font-medium bg-primary/10'
                                                                : 'text-text-secondary border-transparent hover:text-text-primary'
                                                            }`}
                                                    >
                                                        {Icon && <Icon className="w-4 h-4 mr-3 opacity-80" />}
                                                        {tab.label}
                                                    </button>
                                                );
                                            })}
                                        </nav>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>

            <div className="bg-surface rounded-lg shadow-md p-6 overflow-hidden border border-border">
                <ActiveComponent />
            </div>
        </div>
    );
};

export default Settings;