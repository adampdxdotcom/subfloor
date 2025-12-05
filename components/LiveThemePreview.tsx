import React from 'react';
import { Home, Users, Settings, Bell, Search, Menu } from 'lucide-react';

interface LiveThemePreviewProps {
    primary: string;
    secondary: string;
    accent: string;
    background: string;
    surface: string;
    textPrimary: string;
    textSecondary: string;
}

const LiveThemePreview: React.FC<LiveThemePreviewProps> = ({
    primary, secondary, accent, background, surface, textPrimary, textSecondary
}) => {
    // We inject the colors as CSS variables scoped specifically to this container
    const previewStyle = {
        '--preview-primary': primary,
        '--preview-secondary': secondary,
        '--preview-accent': accent,
        '--preview-bg': background,
        '--preview-surface': surface,
        '--preview-text-main': textPrimary,
        '--preview-text-sub': textSecondary,
        '--preview-border': secondary, // Explicit Secondary Color for Borders
    } as React.CSSProperties;

    return (
        <div className="w-full h-full min-h-[400px] rounded-xl overflow-hidden border border-border shadow-xl flex flex-col" style={previewStyle}>
            {/* Mock Browser Header */}
            <div className="h-6 bg-gray-900 flex items-center px-3 gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-red-500/80"></div>
                <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/80"></div>
                <div className="w-2.5 h-2.5 rounded-full bg-green-500/80"></div>
            </div>

            {/* Mock App Layout */}
            <div className="flex flex-1 overflow-hidden font-sans text-xs">
                
                {/* 1. MOCK SIDEBAR */}
                <div style={{ backgroundColor: 'var(--preview-surface)', borderRight: '1px solid var(--preview-border)' }} className="w-16 sm:w-48 flex flex-col p-3 gap-4">
                    {/* Logo Area */}
                    <div className="h-8 w-8 sm:w-32 bg-gray-500/20 rounded mb-2 animate-pulse"></div>
                    
                    {/* Nav Links */}
                    <div className="flex flex-col gap-1">
                        {/* Active Link (Primary Text + Accent Bg Low Opacity) */}
                        <div 
                            style={{ backgroundColor: 'var(--preview-primary)', opacity: 0.9, color: '#ffffff' }} 
                            className="p-2 rounded-md flex items-center gap-2 font-medium shadow-sm"
                        >
                            <Home size={14} /> <span className="hidden sm:inline">Dashboard</span>
                        </div>
                        
                        {/* Inactive Link */}
                        <div 
                            style={{ color: 'var(--preview-text-sub)' }} 
                            className="p-2 rounded-md flex items-center gap-2 hover:bg-black/5"
                        >
                            <Users size={14} /> <span className="hidden sm:inline">Customers</span>
                        </div>

                         {/* Inactive Link */}
                         <div 
                            style={{ color: 'var(--preview-text-sub)' }} 
                            className="p-2 rounded-md flex items-center gap-2 hover:bg-black/5"
                        >
                            <Settings size={14} /> <span className="hidden sm:inline">Settings</span>
                        </div>
                    </div>
                </div>

                {/* 2. MOCK MAIN CONTENT */}
                <div style={{ backgroundColor: 'var(--preview-bg)' }} className="flex-1 flex flex-col relative">
                    
                    {/* Mock Header */}
                    <div style={{ backgroundColor: 'var(--preview-surface)', borderBottom: '1px solid var(--preview-border)' }} className="h-12 flex items-center justify-between px-4">
                        <Menu size={14} style={{ color: 'var(--preview-secondary)' }} />
                        <div className="flex gap-3">
                            <Search size={14} style={{ color: 'var(--preview-secondary)' }} />
                            <div className="relative">
                                <Bell size={14} style={{ color: 'var(--preview-secondary)' }} />
                                {/* Notification Dot (Accent) */}
                                <div style={{ backgroundColor: 'var(--preview-accent)' }} className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full border border-black"></div>
                            </div>
                        </div>
                    </div>

                    {/* Content Body */}
                    <div className="p-4 space-y-4 overflow-hidden">
                        
                        {/* Headlines */}
                        <div>
                            <h3 style={{ color: 'var(--preview-text-main)' }} className="text-lg font-bold">Theme Preview</h3>
                            <p style={{ color: 'var(--preview-text-sub)' }}>Adjust colors to verify contrast.</p>
                        </div>

                        {/* Cards Row */}
                        <div className="grid grid-cols-2 gap-3">
                            {/* Card 1 */}
                            <div style={{ backgroundColor: 'var(--preview-surface)', borderColor: 'var(--preview-border)' }} className="p-3 rounded-lg border shadow-sm">
                                <div style={{ color: 'var(--preview-text-sub)' }} className="mb-1 text-[10px] uppercase tracking-wider">Total Sales</div>
                                <div style={{ color: 'var(--preview-text-main)' }} className="text-xl font-bold">$12,450</div>
                                <div style={{ color: 'var(--preview-accent)' }} className="text-[10px] font-medium mt-1">+12% from last month</div>
                            </div>
                            
                            {/* Card 2 */}
                             <div style={{ backgroundColor: 'var(--preview-surface)', borderColor: 'var(--preview-border)' }} className="p-3 rounded-lg border shadow-sm">
                                <div style={{ color: 'var(--preview-text-sub)' }} className="mb-1 text-[10px] uppercase tracking-wider">New Users</div>
                                <div style={{ color: 'var(--preview-text-main)' }} className="text-xl font-bold">24</div>
                            </div>
                        </div>

                        {/* Buttons Row */}
                        <div className="flex gap-2">
                            <button style={{ backgroundColor: 'var(--preview-primary)', color: '#fff' }} className="px-3 py-1.5 rounded shadow-sm font-medium">Primary Action</button>
                            <button style={{ borderColor: 'var(--preview-border)', color: 'var(--preview-text-main)', backgroundColor: 'var(--preview-surface)', borderStyle: 'solid', borderWidth: '1px' }} className="px-3 py-1.5 rounded shadow-sm font-medium">Cancel</button>
                        </div>

                    </div>

                    {/* Overlay Gradient (to make it look cool/cut off) */}
                    <div className="absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-black/20 to-transparent pointer-events-none"></div>
                </div>
            </div>
        </div>
    );
};

export default LiveThemePreview;