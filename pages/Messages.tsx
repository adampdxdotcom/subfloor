import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useData } from '../context/DataContext';
import { Send, User as UserIcon, Search } from 'lucide-react';
import { createGravatarHash } from '../utils/cryptoUtils';
import SmartMessage from '../components/SmartMessage'; // NEW
import MentionInput from '../components/MentionInput'; // NEW

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
        <div className="flex h-screen bg-gray-50 overflow-hidden" style={{ maxHeight: 'calc(100vh - 64px)' }}>
            
            {/* SIDEBAR */}
            <div className="w-80 bg-white border-r border-gray-200 flex flex-col">
                <div className="p-4 border-b border-gray-200">
                    <h2 className="text-lg font-bold text-gray-900 mb-2">Messages</h2>
                    <div className="relative">
                        <Search className="absolute left-2 top-1.5 text-gray-400" size={16} />
                        <input 
                            type="text" 
                            placeholder="Search people..." 
                            className="w-full pl-8 pr-2 py-1 bg-gray-100 border-none rounded text-sm focus:ring-1 focus:ring-indigo-500"
                            value={filter}
                            onChange={(e) => setFilter(e.target.value)}
                        />
                    </div>
                </div>
                <div className="flex-1 overflow-y-auto">
                    {filteredUsers.map(user => {
                        const name = user.firstName ? `${user.firstName} ${user.lastName || ''}` : user.email;
                        const avatar = user.avatarUrl || `https://www.gravatar.com/avatar/${createGravatarHash(user.email)}?s=40&d=mp`;
                        
                        return (
                            <div 
                                key={user.userId}
                                onClick={() => navigate(`/messages/${user.userId}`)}
                                className={`flex items-center gap-3 p-3 cursor-pointer border-l-4 transition-colors ${
                                    partnerId === user.userId 
                                        ? 'bg-indigo-50 border-indigo-500' 
                                        : 'border-transparent hover:bg-gray-50'
                                }`}
                            >
                                <img src={avatar} className="w-10 h-10 rounded-full bg-gray-200 object-cover" />
                                <div className="flex-1 min-w-0">
                                    <div className="flex justify-between items-center">
                                        <p className="font-medium text-gray-900 truncate text-sm">{name}</p>
                                        {user.unreadCount > 0 && (
                                            <span className="bg-red-500 text-white text-[10px] px-1.5 py-0.5 rounded-full font-bold">
                                                {user.unreadCount}
                                            </span>
                                        )}
                                    </div>
                                    <p className="text-xs text-gray-500 truncate">
                                        {user.lastActivity ? new Date(user.lastActivity).toLocaleDateString() : 'No history'}
                                    </p>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* CHAT WINDOW */}
            <div className="flex-1 flex flex-col bg-white">
                {partnerId && activePartner ? (
                    <>
                        {/* Chat Header */}
                        <div className="p-4 border-b border-gray-200 flex items-center gap-3 bg-white">
                            <span className="font-bold text-gray-900">
                                {activePartner.firstName ? `${activePartner.firstName} ${activePartner.lastName || ''}` : activePartner.email}
                            </span>
                        </div>

                        {/* Messages Area */}
                        <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-gray-50" ref={scrollRef}>
                            {messages.map(msg => {
                                const isMe = msg.senderId === currentUser?.userId;
                                return (
                                    <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                                        <div className={`max-w-[70%] p-3 rounded-lg shadow-sm text-sm ${
                                            isMe 
                                                ? 'bg-indigo-600 text-white rounded-tr-none' 
                                                : 'bg-white border border-gray-200 text-gray-800 rounded-tl-none'
                                        }`}>
                                            {/* Use SmartMessage component */}
                                            <SmartMessage content={msg.content} />
                                            <p className={`text-[10px] mt-1 text-right ${isMe ? 'text-indigo-200' : 'text-gray-400'}`}>
                                                {new Date(msg.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                            </p>
                                        </div>
                                    </div>
                                );
                            })}
                            {messages.length === 0 && (
                                <p className="text-center text-gray-400 text-sm mt-10">Start the conversation...</p>
                            )}
                        </div>

                        {/* Input Area */}
                        <form onSubmit={handleSend} className="p-4 bg-white border-t border-gray-200 flex gap-2">
                            <MentionInput 
                                value={newMessage} 
                                onChange={setNewMessage} 
                                placeholder="Type a message..." 
                                onKeyDown={handleKeyDown}
                            />
                            <button type="submit" className="bg-indigo-600 text-white p-2 rounded-lg hover:bg-indigo-700 h-10 w-10 flex items-center justify-center">
                                <Send size={20} />
                            </button>
                        </form>
                    </>
                ) : (
                    <div className="flex-1 flex flex-col items-center justify-center text-gray-400">
                        <UserIcon size={48} className="mb-4 opacity-20" />
                        <p>Select a user to start chatting</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default Messages;