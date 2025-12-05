import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useData } from '../context/DataContext';
import { Send, User as UserIcon, Search, MessageCircle, ArrowLeft } from 'lucide-react';
import { createGravatarHash } from '../utils/cryptoUtils';
import SmartMessage from '../components/SmartMessage'; 
import MentionInput from '../components/MentionInput'; 

interface ChatUser {
    userId: string;
    email: string;
    firstName: string;
    lastName: string;
    avatarUrl: string | null;
    unreadCount: number;
    lastActivity: string | null;
}

interface Message {
    id: number;
    senderId: string;
    content: string;
    createdAt: string;
}

const Messages: React.FC = () => {
    const { partnerId } = useParams<{ partnerId: string }>();
    const navigate = useNavigate();
    const { currentUser, refreshNotifications } = useData();
    
    // State
    const [users, setUsers] = useState<ChatUser[]>([]);
    const [messages, setMessages] = useState<Message[]>([]);
    const [newMessage, setNewMessage] = useState('');
    const [filter, setFilter] = useState('');
    
    const scrollRef = useRef<HTMLDivElement>(null);

    // 1. Fetch User List (Sidebar)
    const fetchUsers = async () => {
        try {
            const res = await axios.get('/api/messages/users');
            setUsers(res.data);
        } catch (e) { console.error("Failed to load users", e); }
    };

    // 2. Fetch Messages (Main Window)
    const fetchMessages = async () => {
        if (!partnerId) return;
        try {
            const res = await axios.get(`/api/messages/${partnerId}`);
            setMessages(res.data);
            
            // If we are looking at this chat, refresh global notification count (red dot)
            refreshNotifications();
            
            // Clear local unread count for sidebar
            setUsers(prev => prev.map(u => u.userId === partnerId ? { ...u, unreadCount: 0 } : u));
        } catch (e) { console.error("Failed to load messages", e); }
    };

    // Polling Effect
    useEffect(() => {
        fetchUsers();
        fetchMessages();
        const interval = setInterval(() => {
            fetchUsers(); // Update sidebar counts/sorting
            if (partnerId) fetchMessages(); // Update chat content
        }, 5000); // 5s Poll
        return () => clearInterval(interval);
    }, [partnerId]);

    // Scroll to bottom on new message
    useEffect(() => {
        if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }, [messages]);

    const handleSend = async (e?: React.FormEvent) => {
        e?.preventDefault();
        if (!newMessage.trim() || !partnerId) return;
        try {
            await axios.post(`/api/messages/${partnerId}`, { content: newMessage });
            setNewMessage('');
            fetchMessages(); // Immediate refresh
        } catch (e) { console.error(e); }
    };

    const handleKeyDown = (e: any) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault(); // Prevent default if event is passed
            handleSend();
        }
    };

    // Derived State
    const activePartner = users.find(u => u.userId === partnerId);
    const filteredUsers = users.filter(u => 
        (u.firstName || u.email).toLowerCase().includes(filter.toLowerCase())
    );

    return (
        // MAIN CONTAINER: Matches the height logic of dashboard cards
        <div className="flex bg-surface rounded-lg shadow-md border border-border overflow-hidden h-full">
            
            {/* SIDEBAR */}
            {/* Logic: On Mobile, HIDE this sidebar if a chat is active (partnerId exists). 
                On Desktop (md:), always show it as w-80. */}
            <div className={`
                bg-surface border-r border-border flex-col 
                ${partnerId ? 'hidden md:flex' : 'flex w-full'} 
                md:w-80
            `}>
                <div className="p-4 border-b border-border">
                    <h2 className="text-lg font-bold text-text-primary mb-4 flex items-center gap-2">
                        <MessageCircle className="w-5 h-5 text-primary" />
                        Messages
                    </h2>
                    
                    {/* Search Input (Themed) */}
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" size={16} />
                        <input 
                            type="text" 
                            placeholder="Search people..." 
                            className="w-full pl-9 pr-3 py-2 bg-background border border-border rounded-lg text-sm text-text-primary focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all placeholder-text-tertiary"
                            value={filter}
                            onChange={(e) => setFilter(e.target.value)}
                        />
                    </div>
                </div>
                
                <div className="flex-1 overflow-y-auto">
                    {filteredUsers.map(user => {
                        const name = user.firstName ? `${user.firstName} ${user.lastName || ''}` : user.email;
                        const avatar = user.avatarUrl || `https://www.gravatar.com/avatar/${createGravatarHash(user.email)}?s=40&d=mp`;
                        
                        const isActive = partnerId === user.userId;

                        return (
                            <div 
                                key={user.userId}
                                onClick={() => navigate(`/messages/${user.userId}`)}
                                className={`flex items-center gap-3 p-3 cursor-pointer border-l-4 transition-all ${
                                    isActive 
                                        ? 'bg-primary/10 border-primary' 
                                        : 'border-transparent hover:bg-background'
                                }`}
                            >
                                <img src={avatar} className="w-10 h-10 rounded-full bg-background object-cover border border-border" />
                                <div className="flex-1 min-w-0">
                                    <div className="flex justify-between items-center">
                                        <p className={`font-medium truncate text-sm ${isActive ? 'text-primary' : 'text-text-primary'}`}>{name}</p>
                                        {user.unreadCount > 0 && (
                                            <span className="bg-accent text-on-accent text-[10px] px-1.5 py-0.5 rounded-full font-bold shadow-sm">
                                                {user.unreadCount}
                                            </span>
                                        )}
                                    </div>
                                    <p className="text-xs text-text-secondary truncate">
                                        {user.lastActivity ? new Date(user.lastActivity).toLocaleDateString() : 'No history'}
                                    </p>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* CHAT WINDOW */}
            {/* Logic: On Mobile, HIDE this window if NO chat is active. 
                On Desktop, always show it as flex-1. */}
            <div className={`
                flex-col bg-background relative 
                ${!partnerId ? 'hidden md:flex' : 'flex w-full'} 
                flex-1
            `}>
                {/* Background Pattern Overlay (Optional Texture) */}
                <div className="absolute inset-0 opacity-[0.02] pointer-events-none bg-[radial-gradient(#000_1px,transparent_1px)] [background-size:16px_16px]"></div>

                {partnerId && activePartner ? (
                    <>
                        {/* Chat Header */}
                        <div className="p-4 border-b border-border flex items-center gap-3 bg-surface shadow-sm z-10">
                            
                            {/* Mobile Back Button */}
                            <button 
                                onClick={() => navigate('/messages')} 
                                className="md:hidden p-2 -ml-2 text-text-secondary hover:text-text-primary"
                            >
                                <ArrowLeft size={20} />
                            </button>

                            <img 
                                src={activePartner.avatarUrl || `https://www.gravatar.com/avatar/${createGravatarHash(activePartner.email)}?s=40&d=mp`} 
                                className="w-8 h-8 rounded-full border border-border"
                            />
                            <span className="font-bold text-text-primary text-lg">
                                {activePartner.firstName ? `${activePartner.firstName} ${activePartner.lastName || ''}` : activePartner.email}
                            </span>
                        </div>

                        {/* Messages Area */}
                        <div className="flex-1 overflow-y-auto p-6 space-y-4 z-0" ref={scrollRef}>
                            {messages.map(msg => {
                                const isMe = msg.senderId === currentUser?.userId;
                                return (
                                    <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                                        <div className={`max-w-[70%] p-3 rounded-lg shadow-sm text-sm ${
                                            isMe 
                                                ? 'bg-primary text-on-primary rounded-tr-none' 
                                                : 'bg-surface border border-border text-text-primary rounded-tl-none'
                                        }`}>
                                            <SmartMessage content={msg.content} />
                                            <p className={`text-[10px] mt-1 text-right ${isMe ? 'opacity-70' : 'text-text-secondary'}`}>
                                                {new Date(msg.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                            </p>
                                        </div>
                                    </div>
                                );
                            })}
                            {messages.length === 0 && (
                                <div className="flex flex-col items-center justify-center h-full text-text-secondary opacity-50">
                                    <MessageCircle size={48} className="mb-2" />
                                    <p className="text-sm">Start the conversation...</p>
                                </div>
                            )}
                        </div>

                        {/* Input Area */}
                        <form onSubmit={handleSend} className="p-4 bg-surface border-t border-border z-10">
                            <MentionInput 
                                value={newMessage} 
                                onChange={setNewMessage} 
                                placeholder="Type a message..." 
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
                        <UserIcon size={64} className="mb-4 bg-surface p-4 rounded-full border border-border" />
                        <p className="text-lg font-medium">Select a user to start chatting</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default Messages;