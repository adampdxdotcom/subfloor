import React, { useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom'; 
import { Home, Users, HardHat, Layers, Calendar, Menu, X, Settings as SettingsIcon, Building, Truck, ClipboardList, Database, MessageCircle, BookOpen } from 'lucide-react'; 
import UniversalSearch from './UniversalSearch';
import UserStatus from './UserStatus';
import NavigationListener from './NavigationListener'; 
import SystemStatusTicker from './SystemStatusTicker';
import { useData } from '../context/DataContext';
import { getImageUrl } from '../utils/apiConfig';

const Layout: React.FC = () => {
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const { systemBranding } = useData();
    
    const SidebarContent = () => (
        <>
            <div className="mb-8 flex items-center justify-between h-16 px-2">
                {systemBranding?.logoUrl ? (
                    <img 
                        src={getImageUrl(systemBranding.logoUrl)} 
                        alt="Company Logo" 
                        className="max-h-16 lg:max-h-12 max-w-full object-contain"
                    />
                ) : (
                    <h1 className="text-3xl lg:text-2xl font-bold text-primary">Subfloor</h1>
                )}
                {/* Mobile Close Button */}
                <button 
                    onClick={() => setIsSidebarOpen(false)} 
                    className="lg:hidden p-2 text-text-secondary hover:text-text-primary"
                >
                    <X className="w-8 h-8" />
                </button>
            </div>
            <nav className="flex flex-col space-y-4 lg:space-y-2 flex-grow">
                {/* NavLinks using M3 Container colors */}
                <NavLink to="/" onClick={() => setIsSidebarOpen(false)} className={({ isActive }) => `flex items-center space-x-4 px-4 py-3 lg:px-4 lg:py-2 rounded-full transition-colors ${isActive ? 'bg-primary-container text-on-primary-container font-semibold' : 'text-text-secondary hover:bg-surface-container-high hover:text-text-primary font-medium'}`} end>
                    <Home className="w-8 h-8 lg:w-6 lg:h-6" />
                    <span className="text-xl lg:text-base">Dashboard</span>
                </NavLink>
                <NavLink to="/customers" onClick={() => setIsSidebarOpen(false)} className={({ isActive }) => `flex items-center space-x-4 px-4 py-3 lg:px-4 lg:py-2 rounded-full transition-colors ${isActive ? 'bg-primary-container text-on-primary-container font-semibold' : 'text-text-secondary hover:bg-surface-container-high hover:text-text-primary font-medium'}`}>
                    <Users className="w-8 h-8 lg:w-6 lg:h-6" />
                    <span className="text-xl lg:text-base">Customers</span>
                </NavLink>
                <NavLink to="/installers" onClick={() => setIsSidebarOpen(false)} className={({ isActive }) => `flex items-center space-x-4 px-4 py-3 lg:px-4 lg:py-2 rounded-full transition-colors ${isActive ? 'bg-primary-container text-on-primary-container font-semibold' : 'text-text-secondary hover:bg-surface-container-high hover:text-text-primary font-medium'}`}>
                    <HardHat className="w-8 h-8 lg:w-6 lg:h-6" />
                    <span className="text-xl lg:text-base">Installers</span>
                </NavLink>
                <NavLink to="/samples" onClick={() => setIsSidebarOpen(false)} className={({ isActive }) => `flex items-center space-x-4 px-4 py-3 lg:px-4 lg:py-2 rounded-full transition-colors ${isActive ? 'bg-primary-container text-on-primary-container font-semibold' : 'text-text-secondary hover:bg-surface-container-high hover:text-text-primary font-medium'}`}>
                    <Layers className="w-8 h-8 lg:w-6 lg:h-6" />
                    <span className="text-xl lg:text-base">Sample Library</span>
                </NavLink>
                <NavLink to="/vendors" onClick={() => setIsSidebarOpen(false)} className={({ isActive }) => `flex items-center space-x-4 px-4 py-3 lg:px-4 lg:py-2 rounded-full transition-colors ${isActive ? 'bg-primary-container text-on-primary-container font-semibold' : 'text-text-secondary hover:bg-surface-container-high hover:text-text-primary font-medium'}`}>
                    <Building className="w-8 h-8 lg:w-6 lg:h-6" />
                    <span className="text-xl lg:text-base">Vendor Directory</span>
                </NavLink>
                <NavLink to="/orders" onClick={() => setIsSidebarOpen(false)} className={({ isActive }) => `flex items-center space-x-4 px-4 py-3 lg:px-4 lg:py-2 rounded-full transition-colors ${isActive ? 'bg-primary-container text-on-primary-container font-semibold' : 'text-text-secondary hover:bg-surface-container-high hover:text-text-primary font-medium'}`}>
                    <Truck className="w-8 h-8 lg:w-6 lg:h-6" />
                    <span className="text-xl lg:text-base">Orders</span>
                </NavLink>                
                <NavLink to="/import" onClick={() => setIsSidebarOpen(false)} className={({ isActive }) => `flex items-center space-x-4 px-4 py-3 lg:px-4 lg:py-2 rounded-full transition-colors ${isActive ? 'bg-primary-container text-on-primary-container font-semibold' : 'text-text-secondary hover:bg-surface-container-high hover:text-text-primary font-medium'}`}>
                    <Database className="w-8 h-8 lg:w-6 lg:h-6" />
                    <span className="text-xl lg:text-base">Import Data</span>
                </NavLink>
                <NavLink to="/kb" onClick={() => setIsSidebarOpen(false)} className={({ isActive }) => `flex items-center space-x-4 px-4 py-3 lg:px-4 lg:py-2 rounded-full transition-colors ${isActive ? 'bg-primary-container text-on-primary-container font-semibold' : 'text-text-secondary hover:bg-surface-container-high hover:text-text-primary font-medium'}`}>
                    <BookOpen className="w-8 h-8 lg:w-6 lg:h-6" />
                    <span className="text-xl lg:text-base">Knowledge Base</span>
                </NavLink>
                <NavLink to="/calendar" onClick={() => setIsSidebarOpen(false)} className={({ isActive }) => `flex items-center space-x-4 px-4 py-3 lg:px-4 lg:py-2 rounded-full transition-colors ${isActive ? 'bg-primary-container text-on-primary-container font-semibold' : 'text-text-secondary hover:bg-surface-container-high hover:text-text-primary font-medium'}`}>
                    <Calendar className="w-8 h-8 lg:w-6 lg:h-6" />
                    <span className="text-xl lg:text-base">Calendar</span>
                </NavLink>
                <NavLink to="/reports" onClick={() => setIsSidebarOpen(false)} className={({ isActive }) => `flex items-center space-x-4 px-4 py-3 lg:px-4 lg:py-2 rounded-full transition-colors ${isActive ? 'bg-primary-container text-on-primary-container font-semibold' : 'text-text-secondary hover:bg-surface-container-high hover:text-text-primary font-medium'}`}>
                    <ClipboardList className="w-8 h-8 lg:w-6 lg:h-6" />
                    <span className="text-xl lg:text-base">Reports</span>
                </NavLink>
                <NavLink to="/messages" onClick={() => setIsSidebarOpen(false)} className={({ isActive }) => `flex items-center space-x-4 px-4 py-3 lg:px-4 lg:py-2 rounded-full transition-colors ${isActive ? 'bg-primary-container text-on-primary-container font-semibold' : 'text-text-secondary hover:bg-surface-container-high hover:text-text-primary font-medium'}`}>
                    <MessageCircle className="w-8 h-8 lg:w-6 lg:h-6" />
                    <span className="text-xl lg:text-base">Messages</span>
                </NavLink>
            </nav>

            <div className="mt-auto">
                 <NavLink to="/settings" onClick={() => setIsSidebarOpen(false)} className={({ isActive }) => `flex items-center space-x-4 px-4 py-3 lg:px-4 lg:py-2 rounded-full transition-colors ${isActive ? 'bg-primary-container text-on-primary-container font-semibold' : 'text-text-secondary hover:bg-surface-container-high hover:text-text-primary font-medium'}`}>
                    <SettingsIcon className="w-8 h-8 lg:w-6 lg:h-6" />
                    <span className="text-xl lg:text-base">Settings</span>
                </NavLink>
            </div>
        </>
    );

    return (
        <div className="flex h-screen bg-background text-text-primary">
            <NavigationListener /> 
            
            <aside className="hidden lg:flex w-64 bg-background p-6 flex-col shrink-0">
                <SidebarContent />
            </aside>

            {isSidebarOpen && (
                <>
                    <div 
                        id="sidebar-overlay"
                        className="fixed inset-0 bg-black bg-opacity-50 z-20 lg:hidden" 
                        onClick={() => setIsSidebarOpen(false)}
                    ></div>
                    <aside className="fixed top-0 left-0 w-full h-full bg-background p-6 flex flex-col z-30 lg:hidden overflow-y-auto">
                        <SidebarContent />
                    </aside>
                </>
            )}
            
            <div className="flex-1 flex flex-col min-w-0">
                <header className="bg-background border-b border-surface-container-high/50 p-4 flex justify-between items-center z-10 text-text-primary print:hidden">
                    <button 
                        className="p-2 rounded-md hover:bg-background lg:hidden"
                        onClick={() => setIsSidebarOpen(true)}
                    >
                        <Menu className="w-6 h-6" />
                    </button>
                    
                    <div className="flex-1 flex justify-center lg:justify-start md:ml-4 min-w-0 px-2">
                        <UniversalSearch />
                    </div>
                    
                    <div className="flex items-center gap-2 md:gap-4 flex-shrink-0">
                        <div className="hidden xl:block">
                            <SystemStatusTicker />
                        </div>
                        <UserStatus />
                    </div>
                </header>
                
                <main className="flex-1 overflow-y-auto lg:p-8 print:p-0 print:overflow-visible print:h-auto print:block">
                    <Outlet />
                </main>
            </div>
        </div>
    );
};

export default Layout;