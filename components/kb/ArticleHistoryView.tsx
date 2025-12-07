import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { Clock, RotateCcw, X, User, ArrowLeft, ChevronRight } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { readStyles } from './kbStyles';

interface ArticleHistoryViewProps {
    articleId: number;
    onClose: () => void;
    onRestore: (content: string) => void;
}

export default function ArticleHistoryView({ articleId, onClose, onRestore }: ArticleHistoryViewProps) {
    const [history, setHistory] = useState<any[]>([]);
    const [selectedVersion, setSelectedVersion] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [showMobilePreview, setShowMobilePreview] = useState(false);

    useEffect(() => {
        fetchHistory();
    }, [articleId]);

    const fetchHistory = async () => {
        try {
            const res = await axios.get(`/api/kb/articles/${articleId}/history`);
            setHistory(res.data);
            // On Desktop, auto-select first. On Mobile, wait for user interaction.
            if (window.innerWidth >= 768 && res.data.length > 0) {
                setSelectedVersion(res.data[0]);
            }
        } catch (e) {
            console.error(e);
            toast.error("Failed to load history");
        } finally {
            setIsLoading(false);
        }
    };

    const handleVersionSelect = (ver: any) => {
        setSelectedVersion(ver);
        setShowMobilePreview(true);
    };

    const handleRestore = () => {
        if (!selectedVersion) return;
        onRestore(selectedVersion.previousContent);
        toast.success("Content restored. Please Save to confirm.");
    };

    return (
        <div className="flex flex-col h-full bg-surface">
            {/* INJECT STYLES FOR PREVIEW */}
            <style>{readStyles}</style>
            
            {/* Header */}
            <div className="p-4 border-b border-border bg-background flex justify-between items-center">
                <div className="flex items-center gap-2">
                    <button onClick={onClose} className="text-text-secondary hover:text-text-primary flex items-center gap-1 text-sm">
                        <ArrowLeft size={16} /> Back
                    </button>
                    <span className="text-border">|</span>
                    <h2 className="font-bold text-lg flex items-center gap-2 text-text-primary">
                        <Clock size={18} className="text-primary" /> History
                    </h2>
                </div>
            </div>

            <div className="flex-1 flex overflow-hidden relative">
                
                {/* LEFT: Timeline (List) */}
                <div className={`
                    w-full md:w-80 border-r border-border bg-background/50 overflow-y-auto p-2
                    ${showMobilePreview ? 'hidden md:block' : 'block'}
                `}>
                    <h3 className="text-xs font-bold text-text-tertiary uppercase tracking-wider mb-2 px-2 mt-2">Revisions</h3>
                    
                    {history.length === 0 && !isLoading && (
                        <div className="p-4 text-center text-text-secondary text-sm">No history found.</div>
                    )}

                    {history.map((ver) => (
                        <button
                            key={ver.id}
                            onClick={() => handleVersionSelect(ver)}
                            className={`w-full text-left p-3 rounded-lg mb-1 transition-colors border group relative ${
                                selectedVersion?.id === ver.id 
                                ? 'bg-primary/10 border-primary/50 ring-1 ring-primary' 
                                : 'bg-surface border-transparent hover:border-border'
                            }`}
                        >
                            <div className="flex items-center justify-between mb-1">
                                <div className="flex items-center gap-2">
                                    <div className="w-6 h-6 rounded-full bg-surface-hover flex items-center justify-center text-text-secondary">
                                        <User size={12} />
                                    </div>
                                    <span className="text-xs font-bold text-text-primary truncate max-w-[120px]">
                                        {ver.authorName || 'Unknown'}
                                    </span>
                                </div>
                                <span className="text-[10px] text-text-tertiary">
                                    {new Date(ver.createdAt).toLocaleDateString()}
                                </span>
                            </div>
                            <div className="text-xs text-text-secondary pl-8 flex justify-between items-center">
                                <span>{new Date(ver.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                                <ChevronRight size={14} className="opacity-0 group-hover:opacity-100 md:hidden text-primary" />
                            </div>
                        </button>
                    ))}
                </div>

                {/* RIGHT: Preview */}
                <div className={`
                    flex-1 flex flex-col bg-surface absolute inset-0 md:static z-10 md:z-auto
                    ${showMobilePreview ? 'block' : 'hidden md:flex'}
                `}>
                    {selectedVersion ? (
                        <>
                            {/* Preview Header */}
                            <div className="p-3 border-b border-border bg-background/50 flex justify-between items-center shadow-sm">
                                <div className="flex items-center gap-2">
                                    {/* Mobile "Back to List" */}
                                    <button 
                                        onClick={() => setShowMobilePreview(false)} 
                                        className="md:hidden p-1 -ml-1 text-text-secondary"
                                    >
                                        <ArrowLeft size={18} />
                                    </button>
                                    
                                    <div className="flex flex-col">
                                        <span className="text-xs font-bold text-text-primary">
                                            Snapshot from {new Date(selectedVersion.createdAt).toLocaleString()}
                                        </span>
                                        <span className="text-[10px] text-text-tertiary md:hidden">
                                            By {selectedVersion.authorName}
                                        </span>
                                    </div>
                                </div>
                                
                                <button 
                                    onClick={handleRestore}
                                    className="flex items-center gap-2 bg-primary text-on-primary px-3 py-1.5 rounded text-sm font-bold hover:bg-primary-hover shadow-sm"
                                >
                                    <RotateCcw size={14} /> <span className="hidden sm:inline">Restore</span>
                                </button>
                            </div>
                            
                            {/* Content */}
                            <div className="flex-1 overflow-y-auto p-4 md:p-8">
                                <div 
                                    className="kb-read-content opacity-90" // Re-using read styles
                                    dangerouslySetInnerHTML={{ __html: selectedVersion.previousContent }} 
                                />
                            </div>
                        </>
                    ) : (
                        <div className="h-full flex flex-col items-center justify-center text-text-tertiary p-4 text-center">
                            <Clock size={48} className="mb-4 opacity-20" />
                            <p>Select a revision from the list to preview.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}