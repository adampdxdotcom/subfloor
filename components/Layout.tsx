import React, { useState } from 'react'; // --- MODIFIED: Import useState
import { NavLink, Outlet } from 'react-router-dom'; 
// --- MODIFICATION: Import Menu and X icons for the hamburger button ---
import { Home, Users, HardHat, Layers, Calendar, Menu, X } from 'lucide-react';
import UniversalSearch from './UniversalSearch';

const Layout: React.FC = () => {
    // --- MODIFICATION: State to manage the visibility of the mobile sidebar ---
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);

    const SidebarContent = () => (
        <>
            <h1 className="text-2xl font-bold mb-8">Joblogger</h1>
            <nav className="flex flex-col space-y-2">
                {/* When a link is clicked on mobile, close the sidebar */}
                <NavLink to="/" onClick={() => setIsSidebarOpen(false)} className={({ isActive }) => `flex items-center space-x-3 p-2 rounded-lg ${isActive ? 'bg-accent text-white' : 'hover:bg-gray-700'}`} end>
                    <Home className="w-6 h-6" />
                    <span>Dashboard</span>
                </NavLink>
                <NavLink to="/customers" onClick={() => setIsSidebarOpen(false)} className={({ isActive }) => `flex items-center space-x-3 p-2 rounded-lg ${isActive ? 'bg-accent text-white' : 'hover:bg-gray-700'}`}>
                    <Users className="w-6 h-6" />
                    <span>Customers</span>
                </NavLink>
                <NavLink to="/installers" onClick={() => setIsSidebarOpen(false)} className={({ isActive }) => `flex items-center space-x-3 p-2 rounded-lg ${isActive ? 'bg-accent text-white' : 'hover:bg-gray-700'}`}>
                    <HardHat className="w-6 h-6" />
                    <span>Installers</span>
                </NavLink>
                <NavLink to="/samples" onClick={() => setIsSidebarOpen(false)} className={({ isActive }) => `flex items-center space-x-3 p-2 rounded-lg ${isActive ? 'bg-accent text-white' : 'hover:bg-gray-700'}`}>
                    <Layers className="w-6 h-6" />
                    <span>Sample Library</span>
                </NavLink>
                <NavLink to="/calendar" onClick={() => setIsSidebarOpen(false)} className={({ isActive }) => `flex items-center space-x-3 p-2 rounded-lg ${isActive ? 'bg-accent text-white' : 'hover:bg-gray-700'}`}>
                    <Calendar className="w-6 h-6" />
                    <span>Calendar</span>
                </NavLink>
            </nav>
        </>
    );

    return (
        <div className="flex h-screen bg-background text-text-primary">
            {/* --- MODIFICATION: Desktop Sidebar --- */}
            {/* It is now hidden on small screens ('hidden') and becomes a flex container on medium screens and up ('md:flex') */}
            <aside className="hidden md:flex w-64 bg-surface p-6 flex-col shrink-0">
                <SidebarContent />
            </aside>

            {/* --- MODIFICATION: Mobile Sidebar (Overlay) --- */}
            {isSidebarOpen && (
                <>
                    {/* Dark overlay behind the sidebar */}
                    <div 
                        className="fixed inset-0 bg-black bg-opacity-50 z-20 md:hidden" 
                        onClick={() => setIsSidebarOpen(false)}
                    ></div>
                    {/* The sidebar itself */}
                    <aside className="fixed top-0 left-0 w-64 h-full bg-surface p-6 flex flex-col z-30 md:hidden">
                        <SidebarContent />
                    </aside>
                </>
            )}
            
            <div className="flex-1 flex flex-col overflow-hidden">
                {/* Top Header Bar */}
                <header className="bg-surface shadow-md p-4 flex justify-between items-center z-10">
                    {/* --- MODIFICATION: Hamburger menu button, only visible on mobile ('md:hidden') --- */}
                    <button 
                        className="p-2 rounded-md hover:bg-gray-700 md:hidden"
                        onClick={() => setIsSidebarOpen(true)}
                    >
                        <Menu className="w-6 h-6" />
                    </button>
                    
                    <div className="flex-1 flex justify-center md:justify-start">
                        <UniversalSearch />
                    </div>
                    
                    <div className="flex items-center">
                        {/* Placeholder for user profile */}
                    </div>
                </header>
                
                {/* Main Content */}
                {/* --- MODIFICATION: Padding is reduced on mobile for more space --- */}
                <main className="flex-1 overflow-y-auto p-4 md:p-8">
                    <Outlet />
                </main>
            </div>
        </div>
    );
};

export default Layout;