import React, { useState, useEffect } from 'react';
import { DownloadCloud, Users, FileSliders, UserCog, Bell, Mail, DollarSign, Brush, Settings as SettingsIcon, ChevronDown, ChevronUp } from 'lucide-react';
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

// Tab Configuration Types
type TabId = 'mySettings' | 'notifications' | 'users' | 'data' | 'email' | 'backup' | 'pricing' | 'branding';

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

// Two-Tier Navigation Structure
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
            { id: 'backup', label: 'Backup', icon: DownloadCloud, adminOnly: true }
        ]
    }
];

const Settings: React.FC = () => {
    const { currentUser } = useData();
    const isAdmin = currentUser?.roles?.includes('Admin');
    
    const [activeTab, setActiveTab] = useState<TabId>('mySettings');

    // Flatten tabs for easy lookup and permission checking
    const allTabs = SETTINGS_STRUCTURE.flatMap(cat => cat.tabs);
    
    // Determine current active category based on activeTab
    const activeCategory = SETTINGS_STRUCTURE.find(cat => 
        cat.tabs.some(t => t.id === activeTab)
    ) || SETTINGS_STRUCTURE[0];

    // Mobile state: Track which category accordion is open
    const [expandedCategoryMobile, setExpandedCategoryMobile] = useState<string>(activeCategory.id);

    // Security check: redirect if user is on an admin tab but loses admin status
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
            default: return null;
        }
    };
    
    const toggleCategory = (categoryId: string) => {
        setExpandedCategoryMobile(prevId => prevId === categoryId ? '' : categoryId);
    };

    return (
        <div className="container mx-auto p-4 md:p-8 max-w-7xl">
            {/* HEADER & NAVIGATION CARD */}
            <div className="bg-surface p-6 rounded-lg shadow-md mb-8">
                <div className="flex items-center mb-6">
                    <div className="w-16 h-16 bg-accent rounded-full flex items-center justify-center mr-6 flex-shrink-0">
                        <SettingsIcon className="w-8 h-8 text-white"/>
                    </div>
                    <div>
                        <h1 className="text-3xl font-bold text-text-primary">Settings</h1>
                    </div>
                </div>

                <div className="border-t border-border my-6 hidden md:block"></div>

                {/* ==============================================
                    DESKTOP NAVIGATION (Horizontal Tabs + Pills)
                   ============================================== */}
                <div className="hidden md:block">
                    {/* LEVEL 1: Main Categories */}
                    <div className="flex border-b border-border mb-6 overflow-x-auto">
                        {SETTINGS_STRUCTURE.map((cat) => {
                            const hasAccess = cat.tabs.some(t => !t.adminOnly || isAdmin);
                            if (!hasAccess) return null;

                            const isCategoryActive = activeCategory.id === cat.id;
                            
                            return (
                                <button
                                    key={cat.id}
                                    onClick={() => setActiveTab(cat.tabs[0].id)}
                                    className={`px-6 py-3 text-sm font-bold uppercase tracking-wider transition-colors whitespace-nowrap
                                        ${isCategoryActive 
                                            ? 'text-accent border-b-2 border-accent' 
                                            : 'text-text-primary opacity-60 hover:opacity-100 hover:text-accent'
                                        }`}
                                >
                                    {cat.label}
                                </button>
                            );
                        })}
                    </div>

                    {/* LEVEL 2: Sub-Tabs (Pills) */}
                    <div className="flex flex-wrap gap-2">
                        {activeCategory.tabs.map((tab) => {
                            if (tab.adminOnly && !isAdmin) return null;
                            
                            const isActive = activeTab === tab.id;
                            const Icon = tab.icon;

                            return (
                                <button
                                    key={tab.id}
                                    onClick={() => setActiveTab(tab.id)}
                                    className={`flex items-center px-4 py-2 rounded-full text-sm font-medium transition-colors
                                        ${isActive
                                            ? 'bg-accent text-white shadow-md'
                                            : 'bg-surface-subtle text-text-primary hover:bg-surface-hover'
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

                {/* ==============================================
                    MOBILE NAVIGATION (Vertical Accordion)
                   ============================================== */}
                <div className="md:hidden">
                    <div className="space-y-2">
                        {SETTINGS_STRUCTURE.map((cat) => {
                            // Only show categories the user has access to
                            const visibleTabs = cat.tabs.filter(t => !t.adminOnly || isAdmin);
                            if (visibleTabs.length === 0) return null;

                            const isExpanded = expandedCategoryMobile === cat.id;
                            const Chevron = isExpanded ? ChevronUp : ChevronDown;

                            return (
                                <div key={cat.id} className="border border-border rounded-lg overflow-hidden">
                                    {/* Level 1: Category Header */}
                                    <button
                                        onClick={() => toggleCategory(cat.id)}
                                        className={`flex justify-between items-center w-full p-4 text-left font-semibold transition-colors 
                                            ${isExpanded ? 'bg-surface-light text-accent' : 'bg-surface hover:bg-surface-light'}`
                                        }
                                    >
                                        {cat.label}
                                        <Chevron className="w-5 h-5 opacity-70" />
                                    </button>

                                    {/* Level 2: Sub-Tabs (Accordion Content) */}
                                    {isExpanded && (
                                        <nav className="border-t border-border bg-surface-light dark:bg-gray-800">
                                            {visibleTabs.map((tab) => {
                                                const isActive = activeTab === tab.id;
                                                const Icon = tab.icon;
                                                
                                                return (
                                                    <button
                                                        key={tab.id}
                                                        onClick={() => {
                                                            setActiveTab(tab.id);
                                                            // Keep the category expanded when a tab inside it is selected
                                                            setExpandedCategoryMobile(cat.id);
                                                        }}
                                                        className={`w-full flex items-center px-6 py-3 text-sm transition-colors border-l-4 
                                                            ${isActive
                                                                ? 'text-accent border-accent font-medium bg-accent/10 dark:bg-accent/20'
                                                                : 'text-text-primary border-transparent hover:bg-surface-hover'
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

            {/* CONTENT AREA */}
            <div className="bg-surface rounded-lg shadow-md p-6 overflow-hidden">
                <ActiveComponent />
            </div>
        </div>
    );
};

export default Settings;