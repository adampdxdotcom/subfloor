import React, { useState, useEffect } from 'react';
import { useToaster, Toast, toast } from 'react-hot-toast';
import { Activity, CheckCircle, AlertCircle, Clock, ChevronDown, X, Info } from 'lucide-react';

const MAX_HISTORY = 20;

const SystemStatusTicker: React.FC = () => {
    const { toasts, handlers } = useToaster();
    const { startPause, endPause } = handlers;
    
    // Local history state (persists even after toasts "expire")
    const [history, setHistory] = useState<Array<{ id: string; message: any; type: string; time: Date }>>([]);
    const [isHistoryOpen, setIsHistoryOpen] = useState(false);

    // Sync active toasts to history
    useEffect(() => {
        toasts.forEach(t => {
            // If this toast isn't in history yet, add it
            setHistory(prev => {
                if (prev.find(h => h.id === t.id)) return prev;
                
                // Extract text content safely
                let messageContent = t.message;
                // React-hot-toast allows components as messages, we try to grab text if possible, or render generic
                if (typeof messageContent === 'function') {
                    messageContent = "Custom Component Message"; 
                }

                return [
                    { 
                        id: t.id, 
                        message: messageContent, 
                        type: t.type, 
                        time: new Date() 
                    }, 
                    ...prev
                ].slice(0, MAX_HISTORY);
            });
        });
    }, [toasts]);

    // Get the current active toast (if any are visible)
    const activeToast = toasts.filter(t => t.visible)[0]; // Grab the first one

    // Helper to determine color based on type
    const getStatusColor = (type: string) => {
        switch (type) {
            case 'success': return 'text-green-500';
            case 'error': return 'text-red-500';
            case 'loading': return 'text-blue-500';
            default: return 'text-text-secondary';
        }
    };

    const getIcon = (type: string) => {
        switch (type) {
            case 'success': return <CheckCircle size={14} className="text-green-500" />;
            case 'error': return <AlertCircle size={14} className="text-red-500" />;
            case 'loading': return <Activity size={14} className="text-blue-500 animate-pulse" />;
            default: return <Info size={14} className="text-text-secondary" />;
        }
    };

    return (
        <>
            {/* --- DESKTOP VIEW (The Ticker) --- */}
            <div 
                className="hidden md:flex relative z-50 mr-4"
                onMouseEnter={startPause}
                onMouseLeave={endPause}
            >
                <div 
                    onClick={() => setIsHistoryOpen(!isHistoryOpen)}
                    className={`
                        cursor-pointer flex items-center gap-3 px-4 py-2 rounded-lg border transition-all duration-300 w-80 h-10 overflow-hidden relative
                        ${activeToast ? 'bg-surface border-primary shadow-sm' : 'bg-surface/50 border-transparent hover:bg-surface hover:border-border'}
                    `}
                >
                    {/* Status Icon */}
                    <div className="flex-shrink-0">
                        {activeToast ? getIcon(activeToast.type) : <Activity size={14} className="text-text-tertiary" />}
                    </div>

                    {/* Scrolling Text Area */}
                    <div className="flex-1 text-sm font-medium truncate relative">
                        {/* We use a key to trigger a subtle slide-up animation when content changes */}
                        <div key={activeToast?.id || 'idle'} className="animate-in slide-in-from-bottom-2 fade-in duration-300">
                            {activeToast ? (
                                <span className={getStatusColor(activeToast.type)}>
                                    {activeToast.message as React.ReactNode}
                                </span>
                            ) : (
                                <span className="text-text-tertiary">System Ready</span>
                            )}
                        </div>
                    </div>

                    {/* History Toggle Arrow */}
                    <ChevronDown size={14} className={`text-text-tertiary transition-transform ${isHistoryOpen ? 'rotate-180' : ''}`} />
                </div>

                {/* History Dropdown */}
                {isHistoryOpen && (
                    <>
                        <div className="fixed inset-0 z-40" onClick={() => setIsHistoryOpen(false)} /> {/* Backdrop */}
                        <div className="absolute top-full right-0 mt-2 w-96 bg-surface border border-border rounded-lg shadow-xl z-50 overflow-hidden flex flex-col max-h-[500px]">
                            <div className="p-3 border-b border-border bg-background flex justify-between items-center">
                                <span className="text-xs font-bold text-text-secondary uppercase tracking-wider">System Log</span>
                                <button onClick={() => setHistory([])} className="text-xs text-text-tertiary hover:text-red-500">Clear</button>
                            </div>
                            <div className="overflow-y-auto flex-1">
                                {history.length === 0 ? (
                                    <div className="p-8 text-center text-text-tertiary text-sm">No recent activity</div>
                                ) : (
                                    history.map(item => (
                                        <div key={item.id} className="p-3 border-b border-border last:border-0 hover:bg-background/50 flex gap-3">
                                            <div className="mt-0.5">{getIcon(item.type)}</div>
                                            <div className="flex-1 min-w-0">
                                                <div className="text-sm text-text-primary break-words">{item.message as React.ReactNode}</div>
                                                <div className="text-[10px] text-text-tertiary mt-1 flex items-center gap-1">
                                                    <Clock size={10} />
                                                    {item.time.toLocaleTimeString()}
                                                </div>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    </>
                )}
            </div>

            {/* --- MOBILE VIEW (Standard Fixed Overlay) --- */}
            {/* We manually render active toasts here for mobile so they don't get blocked by the desktop logic */}
            <div className="md:hidden fixed top-0 left-0 right-0 z-[100] p-4 flex flex-col gap-2 pointer-events-none">
                {toasts
                    .filter(t => t.visible)
                    .map(t => (
                        <div 
                            key={t.id} 
                            className={`
                                pointer-events-auto bg-surface shadow-lg border border-border rounded-lg p-3 flex items-center gap-3 animate-in slide-in-from-top-2 fade-in
                            `}
                        >
                            {getIcon(t.type)}
                            <div className="text-sm font-medium flex-1 text-text-primary">
                                {t.message as React.ReactNode}
                            </div>
                        </div>
                    ))
                }
            </div>
        </>
    );
};

export default SystemStatusTicker;