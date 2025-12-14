import React from 'react';
import { Lock } from 'lucide-react';

interface LockedWidgetProps {
    children: React.ReactNode;
    isLocked: boolean;
    title?: string; // Optional title to show if the inner component is completely hidden
    message?: string;
}

const LockedWidget: React.FC<LockedWidgetProps> = ({ children, isLocked, title, message = "Available after Quote Acceptance" }) => {
    if (!isLocked) {
        return <>{children}</>;
    }

    return (
        <div className="relative w-full h-full bg-surface border border-border rounded-lg overflow-hidden flex flex-col">
            {/* If we have a title, show a fake header so the card doesn't look blank */}
            {title && (
                <div className="p-3 border-b border-border bg-background/50">
                    <h3 className="font-bold text-text-secondary opacity-70">{title}</h3>
                </div>
            )}
            
            {/* The Content (Blurred/Disabled) */}
            <div className="flex-1 opacity-40 pointer-events-none filter blur-[1px] p-4 overflow-hidden relative">
                {/* We render children so the layout/height is preserved if possible, 
                    but if the child crashes on null data, we might need to render a placeholder instead. 
                    For now, we'll assume we can pass null-safe props or render a placeholder div. 
                */}
                {children}
            </div>

            {/* The Lock Overlay */}
            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-background/10 backdrop-blur-[1px]">
                <div className="bg-surface/90 border border-border p-4 rounded-full shadow-lg mb-2">
                    <Lock className="w-6 h-6 text-text-secondary" />
                </div>
                <p className="font-semibold text-text-secondary text-sm bg-surface/80 px-3 py-1 rounded-full border border-border">
                    {message}
                </p>
            </div>
        </div>
    );
};

export default LockedWidget;