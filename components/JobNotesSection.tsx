import React, { useState, useEffect, useRef } from 'react';
import { Job, JobNote } from '../types';
import { useData } from '../context/DataContext';
import { Send, MessageSquare, User } from 'lucide-react';
import * as jobNotesService from '../services/jobNotesService';
import { toast } from 'react-hot-toast';

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
        return () => { isMounted = false; };
    }, [job.id]);

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

    return (
        <div className="bg-surface rounded-lg shadow-md flex flex-col h-full border border-border overflow-hidden">
            {/* Header */}
            <div className="p-3 border-b border-border bg-background flex items-center gap-2 flex-shrink-0">
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
                            <div key={note.id} className={`flex gap-3 ${isMe ? 'flex-row-reverse' : ''}`}>
                                {/* Avatar */}
                                <div className="flex-shrink-0 mt-1">
                                    {note.authorAvatar ? (
                                        <img src={note.authorAvatar} alt={note.authorName} className="w-8 h-8 rounded-full object-cover border border-border" />
                                    ) : (
                                        <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center text-on-secondary border border-border">
                                            <User size={14} />
                                        </div>
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
                                    </div>
                                    <div className={`p-3 rounded-lg text-sm whitespace-pre-wrap shadow-sm ${
                                        isMe 
                                            ? 'bg-primary text-on-primary rounded-tr-none' 
                                            : 'bg-surface border border-border text-text-primary rounded-tl-none'
                                    }`}>
                                        {note.content}
                                    </div>
                                </div>
                            </div>
                        );
                    })
                )}
            </div>

            {/* Input Area */}
            <div className="p-3 bg-surface border-t border-border flex-shrink-0">
                <form onSubmit={handleSendNote} className="relative">
                    <textarea
                        value={newNoteContent}
                        onChange={(e) => setNewNoteContent(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="Type a note... (Enter to send)"
                        className="w-full p-3 pr-12 bg-background border border-border rounded-lg text-text-primary placeholder-text-secondary focus:ring-2 focus:ring-primary focus:outline-none resize-none text-sm scrollbar-hide"
                        rows={1} // Auto-grow logic could be added here
                        style={{ minHeight: '44px', maxHeight: '120px' }}
                    />
                    <button 
                        type="submit" 
                        disabled={!newNoteContent.trim() || isSending}
                        className="absolute right-2 bottom-2 p-1.5 bg-primary hover:bg-primary-hover text-on-primary rounded-md disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                        <Send size={16} />
                    </button>
                </form>
            </div>
        </div>
    );
};

export default JobNotesSection;