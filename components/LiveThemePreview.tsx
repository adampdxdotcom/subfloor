import React from 'react';
import { Home, Users, Settings, Bell, Search } from 'lucide-react';

interface LiveThemePreviewProps {
    primary: string;
    secondary: string;
    accent: string;
    background: string;
    surface: string;
}

const LiveThemePreview: React.FC<LiveThemePreviewProps> = ({
    primary, secondary, accent, background, surface
}) => {
    // We inject the colors as CSS variables scoped specifically to this container
    const previewStyle = {
        '--preview-primary': primary,
        '--preview-secondary': secondary,
        '--preview-accent': accent,
        '--preview-bg': background,
        '--preview-surface': surface,
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
                <div style={{ backgroundColor: 'color-mix(in srgb, var(--preview-surface), var(--preview-bg) 50%)' }} className="w-16 sm:w-48 flex flex-col p-3 gap-4">
                    {/* Logo Area */}
                    <div className="h-8 w-8 sm:w-32 bg-gray-500/20 rounded mb-2 animate-pulse"></div>
                    
                    {/* Nav Links */}
                    <div className="flex flex-col gap-1">
                        {/* Active Link (Primary Text + Accent Bg Low Opacity) */}
                        <div 
                            style={{ backgroundColor: 'color-mix(in srgb, var(--preview-primary), var(--preview-surface) 85%)', color: 'var(--preview-primary)' }} 
                            className="p-2 rounded-full flex items-center gap-2 font-bold"
                        >
                            <Home size={14} /> <span className="hidden sm:inline">Dashboard</span>
                        </div>
                        
                        {/* Inactive Link */}
                        <div 
                            className="p-2 rounded-full flex items-center gap-2 hover:bg-black/5 text-gray-400"
                        >
                            <Users size={14} /> <span className="hidden sm:inline">Customers</span>
                        </div>

                         {/* Inactive Link */}
                         <div 
                            className="p-2 rounded-full flex items-center gap-2 hover:bg-black/5 text-gray-400"
                        >
                            <Settings size={14} /> <span className="hidden sm:inline">Settings</span>
                        </div>
                    </div>
                </div>

                {/* 2. MOCK MAIN CONTENT */}
                <div style={{ backgroundColor: 'var(--preview-bg)' }} className="flex-1 flex flex-col relative">
                    
                    {/* Mock Header */}
                    <div className="h-12 flex items-center justify-between px-4 mt-2">
                        <h1 className="font-bold text-lg" style={{ color: 'white' }}>Dashboard</h1>
                        <div className="flex gap-3">
                            <div style={{ backgroundColor: 'color-mix(in srgb, var(--preview-surface) 90%, #fff)', color: 'gray' }} className="h-8 w-8 rounded-full flex items-center justify-center">
                                <Search size={14} />
                            </div>
                            <div style={{ backgroundColor: 'color-mix(in srgb, var(--preview-surface) 90%, #fff)', color: 'gray' }} className="h-8 w-8 rounded-full flex items-center justify-center relative">
                                <Bell size={14} />
                                <div style={{ backgroundColor: 'var(--preview-accent)' }} className="absolute top-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-white"></div>
                            </div>
                        </div>
                    </div>

                    {/* Content Body */}
                    <div className="p-4 space-y-4 overflow-hidden">
                        
                        {/* Cards Row */}
                        <div className="grid grid-cols-2 gap-3">
                            {/* Card 1 */}
                            <div style={{ backgroundColor: 'color-mix(in srgb, var(--preview-surface) 90%, #fff)' }} className="p-4 rounded-xl shadow-sm">
                                <div className="mb-1 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Active Jobs</div>
                                <div style={{ color: 'white' }} className="text-2xl font-bold">12</div>
                                <div style={{ color: 'var(--preview-primary)', backgroundColor: 'color-mix(in srgb, var(--preview-primary), var(--preview-surface) 85%)' }} className="text-[10px] font-bold mt-2 px-2 py-0.5 rounded-full w-fit">On Track</div>
                            </div>
                            
                            {/* Card 2 */}
                             <div style={{ backgroundColor: 'color-mix(in srgb, var(--preview-surface) 90%, #fff)' }} className="p-4 rounded-xl shadow-sm">
                                <div className="mb-1 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Pending</div>
                                <div style={{ color: 'white' }} className="text-2xl font-bold">5</div>
                                <div style={{ color: 'var(--preview-accent)', backgroundColor: 'color-mix(in srgb, var(--preview-accent), var(--preview-surface) 85%)' }} className="text-[10px] font-bold mt-2 px-2 py-0.5 rounded-full w-fit">Action Needed</div>
                            </div>
                        </div>

                        {/* Buttons Row */}
                        <div className="flex gap-2 mt-4">
                            <button style={{ backgroundColor: 'var(--preview-primary)', color: '#fff' }} className="px-4 py-2 rounded-full shadow-md font-bold">Save</button>
                            <button style={{ color: 'gray', backgroundColor: 'color-mix(in srgb, var(--preview-surface) 90%, #fff)' }} className="px-4 py-2 rounded-full shadow-sm font-medium">Cancel</button>
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