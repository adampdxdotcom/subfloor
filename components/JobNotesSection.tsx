import React, { useState, useEffect, useRef } from 'react';
import { Job, JobNote } from '../types';
import { useData } from '../context/DataContext';
import { Send, MessageSquare, User, Move, Pin } from 'lucide-react';
import * as jobNotesService from '../services/jobNotesService';
import { toast } from 'react-hot-toast';
import { createGravatarHash } from '../utils/cryptoUtils';
import SmartMessage from './SmartMessage';
import MentionInput from './MentionInput';

interface JobNotesSectionProps {
    job: Job;
    // onSaveNotes prop is deprecated but kept for interface compatibility if parent still passes it
    onSaveNotes?: (notes: string) => Promise<void>;
}

const JobNotesSection: React.FC<JobNotesSectionProps> = ({ job }) => {
    const { currentUser } = useData();
    const [notes, setNotes] = useState<JobNote[]>([]);
    const [newNoteContent, setNewNoteContent] = useState('');
    const [isSending, setIsSending] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    
    const scrollRef = useRef<HTMLDivElement>(null);

    // Fetch notes on mount
    useEffect(() => {
        let isMounted = true;
        const fetchNotes = async () => {
            try {
                const data = await jobNotesService.getJobNotes(job.id);
                if (isMounted) {
                    setNotes(data);
                    setIsLoading(false);
                }
            } catch (error) {
                console.error(error);
                toast.error("Failed to load notes history.");
            }
        };
        fetchNotes();
        
        // --- NEW: Short Polling for Live Chat feel ---
        const interval = setInterval(fetchNotes, 5000); // Check every 5s

        return () => { isMounted = false; clearInterval(interval); };
    }, [job.id]); // Re-run if job ID changes

    // Auto-scroll to bottom when notes change
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [notes]);

    const handleSendNote = async (e?: React.FormEvent) => {
        e?.preventDefault();
        if (!newNoteContent.trim()) return;

        setIsSending(true);
        try {
            const createdNote = await jobNotesService.addJobNote(job.id, newNoteContent);
            setNotes(prev => [...prev, createdNote]);
            setNewNoteContent('');
        } catch (error) {
            console.error(error);
            toast.error("Failed to send note.");
        } finally {
            setIsSending(false);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSendNote();
        }
    };

    const handleTogglePin = async (noteId: number) => {
        try {
            await jobNotesService.toggleNotePin(noteId);
            setNotes(prev => prev.map(n => n.id === noteId ? { ...n, isPinned: !n.isPinned } : n));
            toast.success("Note updated");
        } catch (err) {
            toast.error("Failed to pin note");
        }
    };

    return (
        <div className="bg-surface rounded-lg shadow-md flex flex-col h-full border border-border overflow-hidden">
            {/* Header */}
            <div className="p-3 border-b border-border bg-background flex items-center gap-2 flex-shrink-0">
                <Move className="drag-handle cursor-move text-text-secondary hover:text-text-primary transition-colors" size={18} />
                <MessageSquare size={18} className="text-primary" />
                <h3 className="font-bold text-text-primary">Job Notes & Activity</h3>
            </div>

            {/* Timeline Area */}
            <div 
                ref={scrollRef}
                className="flex-grow overflow-y-auto p-4 space-y-4 bg-background/50 scrollbar-thin scrollbar-thumb-border"
            >
                {isLoading ? (
                    <div className="text-center text-text-secondary py-4 text-sm">Loading timeline...</div>
                ) : notes.length === 0 ? (
                    <div className="text-center text-text-tertiary py-8 italic text-sm">
                        No notes yet. Start the conversation below.
                    </div>
                ) : (
                    notes.map((note) => {
                        const isMe = note.userId === currentUser?.userId;
                        return (
                            <div key={note.id} className={`flex gap-3 group ${isMe ? 'flex-row-reverse' : ''}`}>
                                {/* Avatar */}
                                <div className="flex-shrink-0 mt-1">
                                    {note.authorAvatar ? (
                                        <img src={note.authorAvatar} alt={note.authorName} className="w-8 h-8 rounded-full object-cover border border-border" />
                                    ) : (
                                        <>
                                            <img 
                                                src={`https://www.gravatar.com/avatar/${createGravatarHash(note.authorEmail || note.authorName)}?s=40&d=mp`} 
                                                alt={note.authorName} 
                                                className="w-8 h-8 rounded-full border border-border object-cover"
                                                onError={(e) => {
                                                    (e.target as HTMLImageElement).style.display = 'none';
                                                    (e.target as HTMLImageElement).nextElementSibling?.classList.remove('hidden');
                                                }}
                                            />
                                            <div className="hidden w-8 h-8 rounded-full bg-indigo-600 text-white flex items-center justify-center text-xs font-bold border border-border">
                                                {note.authorName ? note.authorName.charAt(0).toUpperCase() : '?'}
                                            </div>
                                        </>
                                    )}
                                </div>

                                {/* Bubble */}
                                <div className={`flex flex-col max-w-[85%] ${isMe ? 'items-end' : 'items-start'}`}>
                                    <div className={`flex items-baseline gap-2 mb-1 ${isMe ? 'flex-row-reverse' : ''}`}>
                                        <span className="text-xs font-bold text-text-primary">{note.authorName}</span>
                                        <span className="text-[10px] text-text-tertiary">
                                            {note.createdAt 
                                                ? new Date(note.createdAt).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
                                                : 'Unknown Date'}
                                        </span>
                                        
                                        {/* Pin Button */}
                                        <button 
                                            onClick={() => handleTogglePin(note.id)}
                                            className={`transition-opacity ${note.isPinned ? 'opacity-100 text-yellow-500' : 'opacity-0 group-hover:opacity-100 text-text-tertiary hover:text-text-primary'}`}
                                            title={note.isPinned ? "Unpin from Calendar" : "Pin to Calendar"}
                                        >
                                            <Pin size={14} fill={note.isPinned ? "currentColor" : "none"} />
                                        </button>
                                    </div>
                                    
                                    <div className={`p-3 rounded-lg text-sm whitespace-pre-wrap shadow-sm relative ${
                                        note.isPinned ? 'ring-2 ring-yellow-500/50' : ''
                                    } ${
                                        isMe 
                                            ? 'bg-primary text-on-primary rounded-tr-none' 
                                            : 'bg-surface border border-border text-text-primary rounded-tl-none'
                                    }`}>
                                        <SmartMessage content={note.content} />
                                    </div>
                                </div>
                            </div>
                        );
                    })
                )}
            </div>

            {/* Input Area */}
            <div className="p-3 bg-surface border-t border-border flex-shrink-0">
                <form onSubmit={handleSendNote} className="flex items-end gap-2">
                    <div className="flex-1">
                        <MentionInput
                            value={newNoteContent}
                            onChange={setNewNoteContent}
                            onKeyDown={handleKeyDown}
                            placeholder="Type a note..."
                            minHeight={40}
                        />
                    </div>
                    <button 
                        type="submit" 
                        disabled={!newNoteContent.trim() || isSending}
                        className="flex-shrink-0 h-[42px] w-[42px] flex items-center justify-center bg-primary hover:bg-primary-hover text-on-primary rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
                    >
                        <Send size={18} />
                    </button>
                </form>
            </div>
        </div>
    );
};

export default JobNotesSection;