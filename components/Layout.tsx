import React, { useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom'; 
import { Home, Users, HardHat, Layers, Calendar, Menu, X, Settings as SettingsIcon, Building, Truck, ClipboardList, Database, MessageCircle } from 'lucide-react'; // Added MessageCircle
import UniversalSearch from './UniversalSearch';
import UserStatus from './UserStatus';
import NavigationListener from './NavigationListener'; // <-- NEW: Import the listener
import { useData } from '../context/DataContext';

const Layout: React.FC = () => {
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const { systemBranding } = useData();
    
    // Ensure this matches your production domain or use relative path for local dev proxy
    const API_URL = import.meta.env.PROD ? "https://flooring.dumbleigh.com" : "";

    const SidebarContent = () => (
        <>
            <div className="mb-8 flex items-center h-12 px-2">
                {systemBranding?.logoUrl ? (
                    <img 
                        src={systemBranding.logoUrl.startsWith('http') ? systemBranding.logoUrl : `${API_URL}${systemBranding.logoUrl}`} 
                        alt="Company Logo" 
                        className="max-h-12 max-w-full object-contain"
                    />
                ) : (
                    <h1 className="text-2xl font-bold text-primary">Subfloor</h1>
                )}
            </div>
            <nav className="flex flex-col space-y-2 flex-grow">
                {/* When a link is clicked on mobile, close the sidebar */}
                <NavLink to="/" onClick={() => setIsSidebarOpen(false)} className={({ isActive }) => `flex items-center space-x-3 p-2 rounded-lg ${isActive ? 'bg-primary text-white' : 'hover:bg-gray-700'}`} end>
                    <Home className="w-6 h-6" />
                    <span>Dashboard</span>
                </NavLink>
                <NavLink to="/customers" onClick={() => setIsSidebarOpen(false)} className={({ isActive }) => `flex items-center space-x-3 p-2 rounded-lg ${isActive ? 'bg-primary text-white' : 'hover:bg-gray-700'}`}>
                    <Users className="w-6 h-6" />
                    <span>Customers</span>
                </NavLink>
                <NavLink to="/installers" onClick={() => setIsSidebarOpen(false)} className={({ isActive }) => `flex items-center space-x-3 p-2 rounded-lg ${isActive ? 'bg-primary text-white' : 'hover:bg-gray-700'}`}>
                    <HardHat className="w-6 h-6" />
                    <span>Installers</span>
                </NavLink>
                <NavLink to="/samples" onClick={() => setIsSidebarOpen(false)} className={({ isActive }) => `flex items-center space-x-3 p-2 rounded-lg ${isActive ? 'bg-primary text-white' : 'hover:bg-gray-700'}`}>
                    <Layers className="w-6 h-6" />
                    <span>Sample Library</span>
                </NavLink>
                <NavLink to="/vendors" onClick={() => setIsSidebarOpen(false)} className={({ isActive }) => `flex items-center space-x-3 p-2 rounded-lg ${isActive ? 'bg-primary text-white' : 'hover:bg-gray-700'}`}>
                    <Building className="w-6 h-6" />
                    <span>Vendor Directory</span>
                </NavLink>
                <NavLink to="/orders" onClick={() => setIsSidebarOpen(false)} className={({ isActive }) => `flex items-center space-x-3 p-2 rounded-lg ${isActive ? 'bg-primary text-white' : 'hover:bg-gray-700'}`}>
                    <Truck className="w-6 h-6" />
                    <span>Orders</span>
                </NavLink>                
                <NavLink to="/import" onClick={() => setIsSidebarOpen(false)} className={({ isActive }) => `flex items-center space-x-3 p-2 rounded-lg ${isActive ? 'bg-primary text-white' : 'hover:bg-gray-700'}`}>
                    <Database className="w-6 h-6" />
                    <span>Import Data</span>
                </NavLink>
                <NavLink to="/calendar" onClick={() => setIsSidebarOpen(false)} className={({ isActive }) => `flex items-center space-x-3 p-2 rounded-lg ${isActive ? 'bg-primary text-white' : 'hover:bg-gray-700'}`}>
                    <Calendar className="w-6 h-6" />
                    <span>Calendar</span>
                </NavLink>
                <NavLink to="/reports" onClick={() => setIsSidebarOpen(false)} className={({ isActive }) => `flex items-center space-x-3 p-2 rounded-lg ${isActive ? 'bg-primary text-white' : 'hover:bg-gray-700'}`}>
                    <ClipboardList className="w-6 h-6" />
                    <span>Reports</span>
                </NavLink>
                <NavLink to="/messages" onClick={() => setIsSidebarOpen(false)} className={({ isActive }) => `flex items-center space-x-3 p-2 rounded-lg ${isActive ? 'bg-primary text-white' : 'hover:bg-gray-700'}`}>
                    <MessageCircle className="w-6 h-6" />
                    <span>Messages</span>
                </NavLink>
            </nav>

            <div className="mt-auto">
                 <NavLink to="/settings" onClick={() => setIsSidebarOpen(false)} className={({ isActive }) => `flex items-center space-x-3 p-2 rounded-lg ${isActive ? 'bg-primary text-white' : 'hover:bg-gray-700'}`}>
                    <SettingsIcon className="w-6 h-6" />
                    <span>Settings</span>
                </NavLink>
            </div>
        </>
    );

    return (
        <div className="flex h-screen bg-background text-text-primary">
            <NavigationListener /> {/* <-- NEW: Place the listener here */}
            
            <aside className="hidden md:flex w-64 bg-surface p-6 flex-col shrink-0">
                <SidebarContent />
            </aside>

            {isSidebarOpen && (
                <>
                    <div 
                        className="fixed inset-0 bg-black bg-opacity-50 z-20 md:hidden" 
                        onClick={() => setIsSidebarOpen(false)}
                    ></div>
                    <aside className="fixed top-0 left-0 w-64 h-full bg-surface p-6 flex flex-col z-30 md:hidden">
                        <SidebarContent />
                    </aside>
                </>
            )}
            
            <div className="flex-1 flex flex-col overflow-hidden">
                <header className="bg-surface shadow-md p-4 flex justify-between items-center z-10 text-white">
                    <button 
                        className="p-2 rounded-md hover:bg-gray-700 md:hidden"
                        onClick={() => setIsSidebarOpen(true)}
                    >
                        <Menu className="w-6 h-6" />
                    </button>
                    
                    <div className="flex-1 flex justify-center md:justify-start md:ml-4">
                        <UniversalSearch />
                    </div>
                    
                    <div className="flex items-center">
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