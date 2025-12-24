import React, { useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom'; 
import { Home, Users, HardHat, Layers, Calendar, Menu, X, Settings as SettingsIcon, Building, Truck, ClipboardList, Database, MessageCircle, BookOpen } from 'lucide-react'; // Added BookOpen
import UniversalSearch from './UniversalSearch';
import UserStatus from './UserStatus';
import NavigationListener from './NavigationListener'; // <-- NEW: Import the listener
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
                {/* When a link is clicked on mobile, close the sidebar */}
                <NavLink to="/" onClick={() => setIsSidebarOpen(false)} className={({ isActive }) => `flex items-center space-x-4 p-4 lg:p-2 rounded-lg transition-colors ${isActive ? 'bg-primary text-on-primary' : 'text-text-secondary hover:bg-background hover:text-text-primary'}`} end>
                    <Home className="w-8 h-8 lg:w-6 lg:h-6" />
                    <span className="text-xl lg:text-base font-medium">Dashboard</span>
                </NavLink>
                <NavLink to="/customers" onClick={() => setIsSidebarOpen(false)} className={({ isActive }) => `flex items-center space-x-4 p-4 lg:p-2 rounded-lg transition-colors ${isActive ? 'bg-primary text-on-primary' : 'text-text-secondary hover:bg-background hover:text-text-primary'}`}>
                    <Users className="w-8 h-8 lg:w-6 lg:h-6" />
                    <span className="text-xl lg:text-base font-medium">Customers</span>
                </NavLink>
                <NavLink to="/installers" onClick={() => setIsSidebarOpen(false)} className={({ isActive }) => `flex items-center space-x-4 p-4 lg:p-2 rounded-lg transition-colors ${isActive ? 'bg-primary text-on-primary' : 'text-text-secondary hover:bg-background hover:text-text-primary'}`}>
                    <HardHat className="w-8 h-8 lg:w-6 lg:h-6" />
                    <span className="text-xl lg:text-base font-medium">Installers</span>
                </NavLink>
                <NavLink to="/samples" onClick={() => setIsSidebarOpen(false)} className={({ isActive }) => `flex items-center space-x-4 p-4 lg:p-2 rounded-lg transition-colors ${isActive ? 'bg-primary text-on-primary' : 'text-text-secondary hover:bg-background hover:text-text-primary'}`}>
                    <Layers className="w-8 h-8 lg:w-6 lg:h-6" />
                    <span className="text-xl lg:text-base font-medium">Sample Library</span>
                </NavLink>
                <NavLink to="/vendors" onClick={() => setIsSidebarOpen(false)} className={({ isActive }) => `flex items-center space-x-4 p-4 lg:p-2 rounded-lg transition-colors ${isActive ? 'bg-primary text-on-primary' : 'text-text-secondary hover:bg-background hover:text-text-primary'}`}>
                    <Building className="w-8 h-8 lg:w-6 lg:h-6" />
                    <span className="text-xl lg:text-base font-medium">Vendor Directory</span>
                </NavLink>
                <NavLink to="/orders" onClick={() => setIsSidebarOpen(false)} className={({ isActive }) => `flex items-center space-x-4 p-4 lg:p-2 rounded-lg transition-colors ${isActive ? 'bg-primary text-on-primary' : 'text-text-secondary hover:bg-background hover:text-text-primary'}`}>
                    <Truck className="w-8 h-8 lg:w-6 lg:h-6" />
                    <span className="text-xl lg:text-base font-medium">Orders</span>
                </NavLink>                
                <NavLink to="/import" onClick={() => setIsSidebarOpen(false)} className={({ isActive }) => `flex items-center space-x-4 p-4 lg:p-2 rounded-lg transition-colors ${isActive ? 'bg-primary text-on-primary' : 'text-text-secondary hover:bg-background hover:text-text-primary'}`}>
                    <Database className="w-8 h-8 lg:w-6 lg:h-6" />
                    <span className="text-xl lg:text-base font-medium">Import Data</span>
                </NavLink>
                <NavLink to="/kb" onClick={() => setIsSidebarOpen(false)} className={({ isActive }) => `flex items-center space-x-4 p-4 lg:p-2 rounded-lg transition-colors ${isActive ? 'bg-primary text-on-primary' : 'text-text-secondary hover:bg-background hover:text-text-primary'}`}>
                    <BookOpen className="w-8 h-8 lg:w-6 lg:h-6" />
                    <span className="text-xl lg:text-base font-medium">Knowledge Base</span>
                </NavLink>
                <NavLink to="/calendar" onClick={() => setIsSidebarOpen(false)} className={({ isActive }) => `flex items-center space-x-4 p-4 lg:p-2 rounded-lg transition-colors ${isActive ? 'bg-primary text-on-primary' : 'text-text-secondary hover:bg-background hover:text-text-primary'}`}>
                    <Calendar className="w-8 h-8 lg:w-6 lg:h-6" />
                    <span className="text-xl lg:text-base font-medium">Calendar</span>
                </NavLink>
                <NavLink to="/reports" onClick={() => setIsSidebarOpen(false)} className={({ isActive }) => `flex items-center space-x-4 p-4 lg:p-2 rounded-lg transition-colors ${isActive ? 'bg-primary text-on-primary' : 'text-text-secondary hover:bg-background hover:text-text-primary'}`}>
                    <ClipboardList className="w-8 h-8 lg:w-6 lg:h-6" />
                    <span className="text-xl lg:text-base font-medium">Reports</span>
                </NavLink>
                <NavLink to="/messages" onClick={() => setIsSidebarOpen(false)} className={({ isActive }) => `flex items-center space-x-4 p-4 lg:p-2 rounded-lg transition-colors ${isActive ? 'bg-primary text-on-primary' : 'text-text-secondary hover:bg-background hover:text-text-primary'}`}>
                    <MessageCircle className="w-8 h-8 lg:w-6 lg:h-6" />
                    <span className="text-xl lg:text-base font-medium">Messages</span>
                </NavLink>
            </nav>

            <div className="mt-auto">
                 <NavLink to="/settings" onClick={() => setIsSidebarOpen(false)} className={({ isActive }) => `flex items-center space-x-4 p-4 lg:p-2 rounded-lg transition-colors ${isActive ? 'bg-primary text-on-primary' : 'text-text-secondary hover:bg-background hover:text-text-primary'}`}>
                    <SettingsIcon className="w-8 h-8 lg:w-6 lg:h-6" />
                    <span className="text-xl lg:text-base font-medium">Settings</span>
                </NavLink>
            </div>
        </>
    );

    return (
        <div className="flex h-screen bg-background text-text-primary">
            <NavigationListener /> {/* <-- NEW: Place the listener here */}
            
            <aside className="hidden lg:flex w-64 bg-surface p-6 flex-col shrink-0">
                <SidebarContent />
            </aside>

            {isSidebarOpen && (
                <>
                    <div 
                        id="sidebar-overlay"
                        className="fixed inset-0 bg-black bg-opacity-50 z-20 lg:hidden" 
                        onClick={() => setIsSidebarOpen(false)}
                    ></div>
                    <aside className="fixed top-0 left-0 w-full h-full bg-surface p-6 flex flex-col z-30 lg:hidden overflow-y-auto">
                        <SidebarContent />
                    </aside>
                </>
            )}
            
            <div className="flex-1 flex flex-col overflow-hidden">
                {/* Header: Removed text-white, used text-text-primary to respect theme */}
                <header className="bg-surface shadow-md p-4 flex justify-between items-center z-10 text-text-primary">
                    <button 
                        className="p-2 rounded-md hover:bg-background lg:hidden"
                        onClick={() => setIsSidebarOpen(true)}
                    >
                        <Menu className="w-6 h-6" />
                    </button>
                    
                    {/* Logo removed from header to prevent duplication with sidebar */}
        
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
                
                <main className="flex-1 overflow-y-auto p-4 md:p-8">
                    <Outlet />
                </main>
            </div>
        </div>
    );
};

export default Layout;