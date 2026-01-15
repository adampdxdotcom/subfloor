import React, { useState, useEffect } from 'react';
import { DownloadCloud, Users, FileSliders, UserCog, Bell, Mail, DollarSign, Brush, Settings as SettingsIcon, Sparkles, ChevronRight, ArrowLeft } from 'lucide-react';
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
import { ChangelogViewer } from '../components/ChangelogViewer';

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
            { id: 'changelog', label: "What's New", icon: Sparkles, adminOnly: false }
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

    // Mobile View State: 'Master' (Menu) vs 'Detail' (Content)
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(true);

    useEffect(() => {
        const currentTabObj = allTabs.find(t => t.id === activeTab);
        // Security check: Redirect if user lacks permission
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
            case 'changelog': return <ChangelogViewer />;
            default: return null;
        }
    };
    
    const handleMobileTabClick = (tabId: TabId) => {
        setActiveTab(tabId);
        setIsMobileMenuOpen(false); // Switch to Detail view
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleMobileBack = () => {
        setIsMobileMenuOpen(true); // Return to Menu
    };
    
    const currentTabLabel = allTabs.find(t => t.id === activeTab)?.label;

    return (
        <div className="space-y-8">
            {/* 1. Header (Floating - De-boxed) */}
            <div className="px-1 flex items-center gap-4">
                {/* Mobile Back Button (Visible only in Detail View) */}
                <button 
                    onClick={handleMobileBack}
                    className={`md:hidden p-2 -ml-2 rounded-full hover:bg-surface-container-highest transition-colors ${isMobileMenuOpen ? 'hidden' : 'block'}`}
                >
                    <ArrowLeft className="w-6 h-6 text-text-primary" />
                </button>

                <div className={`w-12 h-12 bg-primary-container rounded-full flex items-center justify-center flex-shrink-0 text-primary ${!isMobileMenuOpen ? 'hidden md:flex' : 'flex'}`}>
                    <SettingsIcon className="w-6 h-6"/>
                </div>
                <h1 className="text-3xl md:text-4xl font-bold text-text-primary tracking-tight">
                    {!isMobileMenuOpen ? currentTabLabel : 'Settings'}
                </h1>
            </div>

            {/* 2. Desktop Navigation (Floating) */}
            <div className="hidden md:block space-y-6">
                {/* Level 1: Categories */}
                <div className="flex border-b border-outline/10 overflow-x-auto">
                    {SETTINGS_STRUCTURE.map((cat) => {
                        const visibleTabs = cat.tabs.filter(t => !t.adminOnly || isAdmin);
                        if (visibleTabs.length === 0) return null;
                        const isCategoryActive = activeCategory.id === cat.id;
                        
                        return (
                            <button
                                key={cat.id}
                                onClick={() => setActiveTab(visibleTabs[0].id)}
                                className={`px-6 py-3 text-sm font-bold uppercase tracking-wider transition-colors whitespace-nowrap border-b-2 mb-[-2px]
                                    ${isCategoryActive 
                                        ? 'text-primary border-primary' 
                                        : 'text-text-secondary border-transparent hover:text-text-primary hover:border-outline/20'
                                    }`}
                            >
                                {cat.label}
                            </button>
                        );
                    })}
                </div>

                {/* Level 2: Sub-tabs (Pills) */}
                <div className="flex flex-wrap gap-2">
                    {activeCategory.tabs.map((tab) => {
                        if (tab.adminOnly && !isAdmin) return null;
                        const isActive = activeTab === tab.id;
                        const Icon = tab.icon;

                        return (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`flex items-center px-5 py-2 rounded-full text-sm font-medium transition-colors border shadow-sm
                                    ${isActive
                                        ? 'bg-primary text-on-primary border-transparent'
                                        : 'bg-surface-container-high text-text-secondary border-outline/10 hover:border-primary/50 hover:text-text-primary'
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

            {/* 3. Mobile Navigation (Android Style Drill-Down) */}
            <div className={`md:hidden space-y-6 ${!isMobileMenuOpen ? 'hidden' : 'block'}`}>
                    {SETTINGS_STRUCTURE.map((cat) => {
                        const visibleTabs = cat.tabs.filter(t => !t.adminOnly || isAdmin);
                        if (visibleTabs.length === 0) return null;

                        return (
                            <div key={cat.id} className="space-y-2">
                                <div className="px-4 text-xs font-bold text-primary uppercase tracking-wider">
                                    {cat.label}
                                </div>
                                
                                <div className="bg-surface-container-low rounded-2xl overflow-hidden shadow-sm border border-outline/10 divide-y divide-outline/10">
                                    {visibleTabs.map((tab) => {
                                        const Icon = tab.icon;
                                        return (
                                            <button
                                                key={tab.id}
                                                onClick={() => handleMobileTabClick(tab.id)}
                                                className="w-full flex items-center p-4 hover:bg-surface-container-highest transition-colors active:bg-primary/5"
                                            >
                                                {/* Icon Box */}
                                                <div className="w-10 h-10 rounded-full bg-surface-container flex items-center justify-center mr-4 text-primary">
                                                    {Icon && <Icon className="w-5 h-5" />}
                                                </div>
                                                
                                                <span className="flex-1 text-left text-base font-medium text-text-primary">
                                                    {tab.label}
                                                </span>
                                                
                                                <ChevronRight className="w-5 h-5 text-outline/40" />
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        );
                    })}
            </div>

            {/* 4. Content Area */}
            <div className={`
                bg-surface-container-high rounded-2xl shadow-sm overflow-hidden border border-outline/10 min-h-[400px]
                ${isMobileMenuOpen ? 'hidden md:block' : 'block'}
            `}>
                <div className="p-4 md:p-8">
                    <ActiveComponent />
                </div>
            </div>
        </div>
    );
};

export default Settings;