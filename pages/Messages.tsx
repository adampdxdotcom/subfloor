import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useData } from '../context/DataContext';
import { Send, Search, MessageCircle, ArrowLeft, Archive, Inbox, Users, AlertTriangle } from 'lucide-react';
import { createGravatarHash } from '../utils/cryptoUtils';
import SmartMessage from '../components/SmartMessage'; 
import MentionInput from '../components/MentionInput'; 

// --- TYPES ---
interface Participant {
    userId: string;
    email: string;
    firstName: string;
    lastName: string;
    avatarUrl: string | null;
}

interface Conversation {
    conversationId: string;
    type: 'DIRECT' | 'GROUP';
    title: string;
    isArchived: boolean;
    lastMessage: string;
    lastActivity: string;
    unreadCount: number;
    participants: Participant[];
}

interface Message {
    id: number;
    conversationId: string;
    senderId: string;
    senderName: string;
    senderAvatar: string | null;
    content: string;
    createdAt: string;
}

const Messages: React.FC = () => {
    // We use 'id' from params. It might be a UUID (Conversation) or a Legacy User ID
    const { partnerId: paramId } = useParams<{ partnerId: string }>(); 
    const navigate = useNavigate();
    const { currentUser, refreshNotifications } = useData();
    
    // --- STATE ---
    const [conversations, setConversations] = useState<Conversation[]>([]);
    const [activeConvId, setActiveConvId] = useState<string | null>(null);
    const [messages, setMessages] = useState<Message[]>([]);
    const [newMessage, setNewMessage] = useState('');
    const [viewMode, setViewMode] = useState<'inbox' | 'archived'>('inbox');
    const [filter, setFilter] = useState('');
    
    // Modal State for Privacy Warning
    const [showPrivacyModal, setShowPrivacyModal] = useState(false);
    const [pendingUsersToAdd, setPendingUsersToAdd] = useState<string[]>([]); // Names of users to add

    const scrollRef = useRef<HTMLDivElement>(null);

    // --- HELPER: CLEAN UP PREVIEW TEXT ---
    const formatMessagePreview = (content: string | null) => {
        if (!content) return 'No messages yet';
        
        // Regex to replace @[type:id|label] with just the label and an optional icon/prefix
        return content.replace(/@\[(\w+):[^|]+\|([^\]]+)\]/g, (match, type, label) => {
            if (type === 'user') return `@${label}`;
            if (type === 'project') return `📁 ${label}`;
            if (type === 'product') return `🎨 ${label}`;
            if (type === 'customer') return `👤 ${label}`;
            if (type === 'installer') return `👷 ${label}`;
            return label;
        });
    };

    // --- 1. RESOLVE URL PARAM (Legacy User ID vs New Conversation ID) ---
    useEffect(() => {
        if (!paramId) {
            setActiveConvId(null);
            return;
        }

        // Regex to check if param is a UUID (Conversation)
        const isUuid = /^[0-9a-fA-F]{8}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{12}$/.test(paramId);

        if (isUuid) {
            setActiveConvId(paramId);
        } else {
            // It's a User ID! We need to find/start the conversation for this user
            axios.post(`/api/messages/start/${paramId}`)
                .then(res => {
                    // Redirect to the real UUID URL
                    navigate(`/messages/${res.data.conversationId}`, { replace: true });
                })
                .catch(err => {
                    console.error("Failed to resolve conversation", err);
                    navigate('/messages'); // Fallback
                });
        }
    }, [paramId]);

    // --- 2. FETCH CONVERSATIONS (Sidebar) ---
    const fetchConversations = async () => {
        try {
            const res = await axios.get(`/api/messages/conversations`, {
                params: { archived: viewMode === 'archived' }
            });
            setConversations(res.data);
        } catch (e) { console.error("Failed to load conversations", e); }
    };

    // --- 3. FETCH MESSAGES (Chat Window) ---
    const fetchMessages = async () => {
        if (!activeConvId) return;
        try {
            const res = await axios.get(`/api/messages/${activeConvId}`);
            setMessages(res.data);
            
            // Mark as read locally
            setConversations(prev => prev.map(c => 
                c.conversationId === activeConvId ? { ...c, unreadCount: 0 } : c
            ));
            refreshNotifications(); // Clear red dot
        } catch (e) { console.error("Failed to load messages", e); }
    };

    // --- POLLING ---
    useEffect(() => {
        fetchConversations();
        if (activeConvId) fetchMessages();

        const interval = setInterval(() => {
            fetchConversations();
            if (activeConvId) fetchMessages();
        }, 5000);
        return () => clearInterval(interval);
    }, [activeConvId, viewMode]);

    // Auto-scroll
    useEffect(() => {
        if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }, [messages]);

    // --- ACTIONS ---

    const handlePreSendCheck = (e?: React.FormEvent) => {
        e?.preventDefault();
        if (!newMessage.trim() || !activeConvId) return;

        // 1. Parse for Mentions @[user:ID|Name]
        const mentionRegex = /@\[user:([^|]+)\|([^\]]+)\]/g;
        let match;
        const mentionedIds = new Set<string>();
        
        while ((match = mentionRegex.exec(newMessage)) !== null) {
            mentionedIds.add(match[1]);
        }

        if (mentionedIds.size === 0) {
            // No mentions, just send
            executeSend();
            return;
        }

        // 2. Check if mentioned users are ALREADY in the chat
        const currentConv = conversations.find(c => c.conversationId === activeConvId);
        if (!currentConv) {
            executeSend(); 
            return;
        }

        const currentParticipantIds = new Set(currentConv.participants.map(p => p.userId));
        // Add myself just in case (though I shouldn't mention myself)
        if (currentUser) currentParticipantIds.add(currentUser.userId);

        // Find names of people NOT in the chat
        const newNames: string[] = [];
        let match2;
        const regex2 = /@\[user:([^|]+)\|([^\]]+)\]/g;
        while ((match2 = regex2.exec(newMessage)) !== null) {
            const id = match2[1];
            const name = match2[2];
            if (!currentParticipantIds.has(id)) {
                newNames.push(name);
            }
        }

        if (newNames.length > 0) {
            // TRIGGER WARNING MODAL
            setPendingUsersToAdd(newNames);
            setShowPrivacyModal(true);
        } else {
            // Everyone is already here
            executeSend();
        }
    };

    const executeSend = async () => {
        if (!activeConvId) return;
        try {
            await axios.post(`/api/messages/${activeConvId}`, { content: newMessage });
            setNewMessage('');
            setShowPrivacyModal(false);
            setPendingUsersToAdd([]);
            fetchMessages(); 
            fetchConversations(); // Update "Last Message" snippet
        } catch (e) { console.error(e); }
    };

    const handleArchiveToggle = async () => {
        if (!activeConvId) return;
        const current = conversations.find(c => c.conversationId === activeConvId);
        if (!current) return;

        const newState = !current.isArchived;

        try {
            await axios.patch(`/api/messages/${activeConvId}/archive`, { isArchived: newState });
            
            // Optimistic update
            setConversations(prev => prev.filter(c => c.conversationId !== activeConvId));
            
            // If archiving, kick user back to list
            if (newState) { 
                setActiveConvId(null);
                navigate('/messages');
            } else {
                fetchConversations();
            }
        } catch (e) { console.error(e); }
    };

    const handleKeyDown = (e: any) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handlePreSendCheck();
        }
    };

    // --- DERIVED UI ---
    const activeConv = conversations.find(c => c.conversationId === activeConvId) 
        || (conversations.length > 0 ? null : null); // Placeholder logic

    const filteredConversations = conversations.filter(c => 
        c.title.toLowerCase().includes(filter.toLowerCase())
    );

    return (
        <div className="flex bg-surface rounded-lg shadow-md border border-border overflow-hidden h-full">
            
            {/* --- SIDEBAR --- */}
            <div className={`
                bg-surface border-r border-border flex-col 
                ${activeConvId ? 'hidden md:flex' : 'flex w-full'} 
                md:w-80
            `}>
                <div className="p-4 border-b border-border space-y-3">
                    <div className="flex justify-between items-center">
                        <h2 className="text-lg font-bold text-text-primary flex items-center gap-2">
                            <MessageCircle className="w-5 h-5 text-primary" />
                            Messages
                        </h2>
                        {/* Archive Toggle */}
                        <div className="flex bg-background rounded-lg p-1 border border-border">
                            <button 
                                onClick={() => setViewMode('inbox')}
                                className={`p-1.5 rounded transition-colors ${viewMode === 'inbox' ? 'bg-surface shadow text-primary' : 'text-text-tertiary hover:text-text-primary'}`}
                                title="Inbox"
                            >
                                <Inbox size={16} />
                            </button>
                            <button 
                                onClick={() => setViewMode('archived')}
                                className={`p-1.5 rounded transition-colors ${viewMode === 'archived' ? 'bg-surface shadow text-primary' : 'text-text-tertiary hover:text-text-primary'}`}
                                title="Archived"
                            >
                                <Archive size={16} />
                            </button>
                        </div>
                    </div>
                    
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" size={16} />
                        <input 
                            type="text" 
                            placeholder="Search conversations or people..." 
                            className="w-full pl-9 pr-3 py-2 bg-background border border-border rounded-lg text-sm text-text-primary focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                            value={filter}
                            onChange={(e) => setFilter(e.target.value)}
                        />
                    </div>
                </div>
                
                <div className="flex-1 overflow-y-auto">
                    {/* 1. Existing Conversations */}
                    {filteredConversations.map(conv => {
                        const isActive = activeConvId === conv.conversationId;
                        const avatar = conv.participants[0]?.avatarUrl || 
                            `https://www.gravatar.com/avatar/${createGravatarHash(conv.title)}?s=40&d=mp`;
                        const isGroup = conv.participants.length > 1;

                        return (
                            <div 
                                key={conv.conversationId}
                                onClick={() => navigate(`/messages/${conv.conversationId}`)}
                                className={`flex items-center gap-3 p-3 cursor-pointer border-l-4 transition-all ${
                                    isActive 
                                        ? 'bg-primary/10 border-primary' 
                                        : 'border-transparent hover:bg-background'
                                }`}
                            >
                                <div className="relative">
                                    <img src={avatar} className="w-10 h-10 rounded-full bg-background object-cover border border-border" />
                                    {isGroup && (
                                        <div className="absolute -bottom-1 -right-1 bg-surface rounded-full p-0.5 border border-border">
                                            <Users size={12} className="text-text-secondary" />
                                        </div>
                                    )}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex justify-between items-center">
                                        <p className={`font-medium truncate text-sm ${isActive ? 'text-primary' : 'text-text-primary'}`}>
                                            {conv.title}
                                        </p>
                                        {conv.unreadCount > 0 && (
                                            <span className="bg-accent text-on-accent text-[10px] px-1.5 py-0.5 rounded-full font-bold shadow-sm">
                                                {conv.unreadCount}
                                            </span>
                                        )}
                                    </div>
                                    {/* FIX: Use formatMessagePreview to clean up the snippet */}
                                    <p className={`text-xs truncate ${conv.unreadCount > 0 ? 'text-text-primary font-medium' : 'text-text-secondary'}`}>
                                        {formatMessagePreview(conv.lastMessage)}
                                    </p>
                                </div>
                            </div>
                        );
                    })}

                    {/* 2. Global User Search Results */}
                    {filter.length > 1 && (
                        <UserSearchResults query={filter} navigate={navigate} />
                    )}

                    {filteredConversations.length === 0 && filter.length < 2 && (
                        <div className="text-center p-8 text-text-tertiary text-sm">
                            {viewMode === 'inbox' ? 'No active conversations.' : 'No archived conversations.'}
                        </div>
                    )}
                </div>
            </div>

            {/* --- CHAT WINDOW --- */}
            <div className={`
                flex-col bg-background relative 
                ${!activeConvId ? 'hidden md:flex' : 'flex w-full'} 
                flex-1
            `}>
                <div className="absolute inset-0 opacity-[0.02] pointer-events-none bg-[radial-gradient(#000_1px,transparent_1px)] [background-size:16px_16px]"></div>

                {activeConvId ? (
                    <>
                        {/* Header */}
                        <div className="p-4 border-b border-border flex items-center justify-between bg-surface shadow-sm z-10">
                            <div className="flex items-center gap-3">
                                <button 
                                    onClick={() => navigate('/messages')} 
                                    className="md:hidden p-2 -ml-2 text-text-secondary hover:text-text-primary"
                                >
                                    <ArrowLeft size={20} />
                                </button>

                                {/* Title */}
                                <div>
                                    <h3 className="font-bold text-text-primary text-lg leading-tight">
                                        {activeConv?.title || 'Loading...'}
                                    </h3>
                                    {activeConv?.type === 'GROUP' && (
                                        <p className="text-xs text-text-secondary">
                                            {activeConv.participants.length + 1} participants
                                        </p>
                                    )}
                                </div>
                            </div>

                            {/* Actions */}
                            <button 
                                onClick={handleArchiveToggle}
                                className="p-2 text-text-secondary hover:text-primary transition-colors rounded-lg hover:bg-background"
                                title={activeConv?.isArchived ? "Unarchive" : "Archive"}
                            >
                                {activeConv?.isArchived ? <Inbox size={20} /> : <Archive size={20} />}
                            </button>
                        </div>

                        {/* Messages */}
                        <div className="flex-1 overflow-y-auto p-6 space-y-4 z-0" ref={scrollRef}>
                            {messages.map(msg => {
                                const isMe = msg.senderId === currentUser?.userId;
                                return (
                                    <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                                        {!isMe && (
                                            <img 
                                                src={msg.senderAvatar || `https://www.gravatar.com/avatar/${createGravatarHash(msg.senderName)}?s=40&d=mp`}
                                                className="w-8 h-8 rounded-full mr-2 self-end mb-1 border border-border"
                                                title={msg.senderName}
                                            />
                                        )}
                                        <div className={`max-w-[70%] p-3 rounded-lg shadow-sm text-sm ${
                                            isMe 
                                                ? 'bg-primary text-on-primary rounded-tr-none' 
                                                : 'bg-surface border border-border text-text-primary rounded-tl-none'
                                        }`}>
                                            {/* Show sender name in group chats if not me */}
                                            {!isMe && activeConv?.type === 'GROUP' && (
                                                <p className="text-[10px] font-bold opacity-70 mb-1">{msg.senderName}</p>
                                            )}
                                            
                                            <SmartMessage content={msg.content} />
                                            
                                            <p className={`text-[10px] mt-1 text-right ${isMe ? 'opacity-70' : 'text-text-secondary'}`}>
                                                {new Date(msg.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                            </p>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        {/* Input */}
                        <form onSubmit={handlePreSendCheck} className="p-4 bg-surface border-t border-border z-10">
                            <MentionInput 
                                value={newMessage} 
                                onChange={setNewMessage} 
                                placeholder="Type a message... Use @ to mention" 
                                onKeyDown={handleKeyDown}
                                rightElement={
                                    <button 
                                        type="submit" 
                                        disabled={!newMessage.trim()}
                                        className="bg-primary text-on-primary p-2 rounded-lg hover:bg-primary-hover transition-colors h-10 w-10 flex items-center justify-center shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        <Send size={18} />
                                    </button>
                                }
                            />
                        </form>
                    </>
                ) : (
                    <div className="flex-1 flex flex-col items-center justify-center text-text-tertiary opacity-40">
                        <MessageCircle size={64} className="mb-4 bg-surface p-4 rounded-full border border-border" />
                        <p className="text-lg font-medium">Select a conversation</p>
                    </div>
                )}
            </div>

            {/* --- PRIVACY WARNING MODAL --- */}
            {showPrivacyModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                    <div className="bg-surface rounded-xl shadow-2xl max-w-md w-full border border-border animate-in fade-in zoom-in duration-200">
                        <div className="p-6">
                            <div className="flex items-center gap-3 text-amber-600 mb-4">
                                <div className="bg-amber-100 p-2 rounded-full">
                                    <AlertTriangle size={24} />
                                </div>
                                <h3 className="text-lg font-bold text-text-primary">Add Users to Chat?</h3>
                            </div>
                            
                            <p className="text-text-secondary mb-4">
                                You mentioned <strong>{pendingUsersToAdd.join(', ')}</strong>. 
                            </p>
                            <p className="text-text-secondary mb-6 text-sm bg-background p-3 rounded-lg border border-border">
                                ⚠️ <strong>Note:</strong> By sending this message, they will be added to this conversation and will be able to see the <strong>entire chat history</strong>.
                            </p>
                            
                            <div className="flex gap-3 justify-end">
                                <button 
                                    onClick={() => setShowPrivacyModal(false)}
                                    className="px-4 py-2 text-sm font-medium text-text-secondary hover:bg-background rounded-lg transition-colors"
                                >
                                    Cancel
                                </button>
                                <button 
                                    onClick={executeSend}
                                    className="px-4 py-2 text-sm font-medium bg-primary text-on-primary rounded-lg hover:bg-primary-hover shadow-sm transition-colors"
                                >
                                    Confirm & Add
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

// --- HELPER COMPONENT: User Search Results ---
const UserSearchResults = ({ query, navigate }: { query: string, navigate: any }) => {
    const [results, setResults] = useState<Participant[]>([]);
    
    useEffect(() => {
        const doSearch = async () => {
            try {
                const res = await axios.get(`/api/messages/search-users?query=${query}`);
                setResults(res.data);
            } catch(e) {}
        };
        const timer = setTimeout(doSearch, 300);
        return () => clearTimeout(timer);
    }, [query]);

    if (results.length === 0) return null;

    return (
        <div className="mt-2 border-t border-border pt-2">
            <p className="px-4 text-xs font-bold text-text-tertiary mb-1 uppercase tracking-wider">Start New Chat</p>
            {results.map(u => (
                <div 
                    key={u.userId}
                    onClick={() => {
                        // Start chat logic
                        axios.post(`/api/messages/start/${u.userId}`).then(res => {
                            navigate(`/messages/${res.data.conversationId}`);
                        });
                    }}
                    className="flex items-center gap-3 p-3 cursor-pointer hover:bg-background border-l-4 border-transparent"
                >
                    <img src={u.avatarUrl || `https://www.gravatar.com/avatar/${createGravatarHash(u.email)}?s=40&d=mp`} className="w-8 h-8 rounded-full bg-background" />
                    <div>
                        <p className="text-sm font-medium text-text-primary">{u.firstName} {u.lastName}</p>
                        <p className="text-xs text-text-secondary">{u.email}</p>
                    </div>
                </div>
            ))}
        </div>
    );
};

export default Messages;