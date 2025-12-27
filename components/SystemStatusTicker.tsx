import React, { useState, useEffect } from 'react';
import { useToaster, Toast, toast } from 'react-hot-toast';
import { Activity, CheckCircle, AlertCircle, Clock, ChevronDown, X, Info, DownloadCloud } from 'lucide-react';
import { getEndpoint } from '../utils/apiConfig';
import { useData } from '../context/DataContext';

const MAX_HISTORY = 20;

const SystemStatusTicker: React.FC = () => {
    const { currentUser } = useData();
    const isAdmin = currentUser?.roles?.includes('Admin');
    const { toasts, handlers } = useToaster();
    const { startPause, endPause } = handlers;
    
    // Local state
    const [history, setHistory] = useState<Array<{ id: string; message: any; type: string; time: Date }>>([]);
    const [isHistoryOpen, setIsHistoryOpen] = useState(false);
    const [updateAvailable, setUpdateAvailable] = useState<{ version: string; url: string } | null>(null);

    // NEW: Check for Remote Updates (Admins Only)
    useEffect(() => {
        if (!isAdmin) return;

        const checkUpdate = async () => {
            try {
                const response = await fetch(getEndpoint('/api/system/check-remote'), { credentials: 'include' });
                if (response.ok) {
                    const data = await response.json();
                    if (data.isUpdateAvailable) {
                        setUpdateAvailable({
                            version: data.latestVersion,
                            url: data.releaseNotesUrl
                        });
                    }
                }
            } catch (e) {
                console.error("Failed to check for updates:", e);
            }
        };

        checkUpdate(); // Check once on mount
    }, [isAdmin]);

    // Sync active toasts to history
    useEffect(() => {
        toasts.forEach(t => {
            setHistory(prev => {
                if (prev.find(h => h.id === t.id)) return prev;
                
                let messageContent = t.message;
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

    const activeToast = toasts.filter(t => t.visible)[0];

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
            {/* --- DESKTOP VIEW --- */}
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
                    {/* Left Icon: Use Update icon if update is available and system is idle */}
                    <div className="flex-shrink-0">
                        {activeToast ? (
                            getIcon(activeToast.type)
                        ) : updateAvailable ? (
                            <DownloadCloud size={14} className="text-blue-500 animate-bounce" />
                        ) : (
                            <Activity size={14} className="text-text-tertiary" />
                        )}
                    </div>

                    {/* Scrolling Text Area */}
                    <div className="flex-1 text-sm font-medium truncate relative">
                        <div key={activeToast?.id || (updateAvailable ? 'update' : 'idle')} className="animate-in slide-in-from-bottom-2 fade-in duration-300">
                            {activeToast ? (
                                <span className={getStatusColor(activeToast.type)}>
                                    {activeToast.message as React.ReactNode}
                                </span>
                            ) : updateAvailable ? (
                                <a 
                                    href={updateAvailable.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-blue-600 hover:underline font-bold flex items-center gap-1"
                                    onClick={(e) => e.stopPropagation()} // Don't open history when clicking link
                                >
                                    Update Available: v{updateAvailable.version}
                                </a>
                            ) : (
                                <span className="text-text-tertiary">System Ready</span>
                            )}
                        </div>
                    </div>

                    <ChevronDown size={14} className={`text-text-tertiary transition-transform ${isHistoryOpen ? 'rotate-180' : ''}`} />
                </div>

                {/* History Dropdown */}
                {isHistoryOpen && (
                    <>
                        <div className="fixed inset-0 z-40" onClick={() => setIsHistoryOpen(false)} />
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

            {/* --- MOBILE VIEW --- */}
            <div className="md:hidden fixed top-0 left-0 right-0 z-[100] p-4 flex flex-col gap-2 pointer-events-none">
                {/* Persistent Update Banner for Mobile */}
                {updateAvailable && !activeToast && (
                    <a 
                        href={updateAvailable.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="pointer-events-auto bg-blue-600 text-white shadow-lg rounded-lg p-3 flex items-center gap-3 animate-in slide-in-from-top-2 fade-in"
                    >
                        <DownloadCloud size={16} />
                        <div className="text-sm font-bold flex-1">
                            New Version v{updateAvailable.version} is available!
                        </div>
                    </a>
                )}

                {toasts
                    .filter(t => t.visible)
                    .map(t => (
                        <div 
                            key={t.id} 
                            className="pointer-events-auto bg-surface shadow-lg border border-border rounded-lg p-3 flex items-center gap-3 animate-in slide-in-from-top-2 fade-in"
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