import React, { useState, useEffect } from 'react';
import { UserCog, Palette, Camera, Save, Trash2, Calendar, Copy, RefreshCw, Check } from 'lucide-react';
import toast from 'react-hot-toast';
import { useData } from '../context/DataContext';
import * as userService from '../services/userService';
import { getEndpoint } from '../utils/apiConfig';

const MySettingsSection: React.FC = () => {
    const { currentUser, saveCurrentUserPreferences, updateCurrentUserProfile, uploadCurrentUserAvatar, deleteCurrentUserAvatar } = useData();
    const [color, setColor] = useState('#ffffff');
    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    
    // Calendar Sync State
    const [calendarToken, setCalendarToken] = useState<string | null>(null);
    const [isCopied, setIsCopied] = useState(false);

    useEffect(() => {
        // Fetch Calendar Token
        const fetchToken = async () => {
            try {
                const res = await fetch(getEndpoint('/api/preferences/calendar-token'), { credentials: 'include' });
                if (res.ok) {
                    const data = await res.json();
                    setCalendarToken(data.token);
                }
            } catch (err) {
                console.error("Failed to fetch calendar token", err);
            }
        };
        fetchToken();

        // FIX: Read directly from 'calendarColor' to match backend query
        if (currentUser?.preferences?.calendarColor) {
            setColor(currentUser.preferences.calendarColor as string);
        }
        if (currentUser) {
            setFirstName(currentUser.firstName || '');
            setLastName(currentUser.lastName || '');
        }
    }, [currentUser]);

    const handleColorChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newColor = e.target.value;
        setColor(newColor);
    };
    
    const handleColorSave = async () => {
        if (!currentUser) return;
        const newPreferences = {
            ...currentUser.preferences,
            // FIX: Save directly to 'calendarColor'
            calendarColor: color
        };
        await saveCurrentUserPreferences(newPreferences);
        toast.success("Color preference saved!");
    };
    
    const handleGenerateToken = async () => {
        try {
            const res = await fetch(getEndpoint('/api/preferences/calendar-token'), { 
                method: 'POST',
                credentials: 'include' 
            });
            if (res.ok) {
                const data = await res.json();
                setCalendarToken(data.token);
                toast.success("Calendar link generated!");
            }
        } catch (err) {
            toast.error("Failed to generate link");
        }
    };

    const handleCopyLink = () => {
        if (!currentUser || !calendarToken) return;
        
        // We need the absolute URL for the external calendar app
        const apiBase = getEndpoint('').replace(/\/$/, ''); // Remove trailing slash if any
        // Check if apiBase is relative (starts with /)
        const baseUrl = apiBase.startsWith('http') ? apiBase : window.location.origin;
        
        const feedUrl = `${baseUrl}/api/calendar/feed/${currentUser.id}/${calendarToken}`;
        
        navigator.clipboard.writeText(feedUrl);
        setIsCopied(true);
        toast.success("Link copied to clipboard!");
        setTimeout(() => setIsCopied(false), 2000);
    };

    const handleProfileSave = async () => {
        await updateCurrentUserProfile(firstName, lastName);
    };

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            await uploadCurrentUserAvatar(e.target.files[0]);
        }
    };

    const handleAvatarDelete = async () => {
        if (window.confirm("Remove your custom profile picture?")) {
            await deleteCurrentUserAvatar();
        }
    };

    const handlePasswordChange = async () => {
        if (!currentPassword || !newPassword) {
            toast.error("Please fill in both password fields.");
            return;
        }
        try {
            await userService.changeUserPassword(currentPassword, newPassword);
            toast.success("Password changed successfully!");
            setCurrentPassword('');
            setNewPassword('');
        } catch (error: any) {
            toast.error(error.message);
        }
    };

    return (
        <section className="bg-surface p-6 rounded-lg shadow-md border border-border">
            <h2 className="text-2xl font-semibold text-text-primary mb-4">
                My Settings
            </h2>
            <div className="space-y-6 max-w-md">
                {/* AVATAR UPLOAD SECTION */}
                <div className="flex flex-col items-center mb-6">
                    <div className="relative w-24 h-24 mb-2">
                        {currentUser?.avatarUrl ? (
                            <img 
                                src={currentUser.avatarUrl} 
                                alt="Profile" 
                                className="w-full h-full rounded-full object-cover border-2 border-border"
                            />
                        ) : (
                            <div className="w-full h-full rounded-full bg-surface flex items-center justify-center border-2 border-border text-2xl font-bold text-text-secondary">
                                {firstName ? `${firstName[0]}${lastName[0] || ''}`.toUpperCase() : currentUser?.email[0].toUpperCase()}
                            </div>
                        )}
                        
                        {/* DELETE BUTTON - Only show if avatarUrl exists */}
                        {currentUser?.avatarUrl && (
                            <button onClick={handleAvatarDelete} className="absolute top-0 right-0 bg-red-500 hover:bg-red-600 text-white p-1.5 rounded-full shadow-lg transition-colors z-10" title="Remove Picture">
                                <Trash2 size={12} />
                            </button>
                        )}

                        <label htmlFor="avatar-upload" className="absolute bottom-0 right-0 bg-primary hover:bg-primary-hover text-white p-2 rounded-full cursor-pointer shadow-lg transition-colors">
                            <Camera size={16} />
                        </label>
                        <input 
                            id="avatar-upload" 
                            type="file" 
                            accept="image/*" 
                            className="hidden" 
                            onChange={handleFileChange} 
                        />
                    </div>
                    <p className="text-xs text-text-secondary">Click camera icon to change</p>
                </div>

                <div className="space-y-4">
                    <h3 className="text-lg font-medium text-text-primary border-b border-gray-700 pb-2">Profile Information</h3>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-text-secondary mb-1">First Name</label>
                            <input type="text" value={firstName} onChange={(e) => setFirstName(e.target.value)} className="w-full p-2 bg-background border border-border rounded text-text-primary" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-text-secondary mb-1">Last Name</label>
                            <input type="text" value={lastName} onChange={(e) => setLastName(e.target.value)} className="w-full p-2 bg-background border border-border rounded text-text-primary" />
                        </div>
                    </div>
                    <button onClick={handleProfileSave} className="flex items-center gap-2 py-2 px-4 text-sm bg-primary hover:bg-primary-hover text-on-primary rounded"><Save size={16}/> Update Profile</button>
                </div>
                
                <h3 className="text-lg font-medium text-text-primary border-b border-gray-700 pb-2 pt-4">Security</h3>
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-text-secondary mb-1">Current Password</label>
                        <input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} className="w-full p-2 bg-background border border-border rounded text-text-primary" placeholder="Required to verify identity" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-text-secondary mb-1">New Password</label>
                        <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="w-full p-2 bg-background border border-border rounded text-text-primary" placeholder="Minimum 8 characters" />
                    </div>
                    <div className="flex justify-end">
                         <button onClick={handlePasswordChange} className="py-2 px-4 text-sm bg-red-600 text-white rounded hover:bg-red-700">Change Password</button>
                    </div>
                </div>

                <h3 className="text-lg font-medium text-text-primary border-b border-gray-700 pb-2 pt-4">Preferences</h3>
                <div className="flex items-center gap-4 p-4 bg-background rounded-md border border-border">
                    <Palette className="w-6 h-6 text-accent" />
                    <label htmlFor="userColor" className="font-medium text-text-secondary">
                        My Calendar Color
                    </label>
                    <input type="color" id="userColor" value={color} onChange={handleColorChange} className="ml-auto w-24 h-10 p-1 bg-surface border border-border rounded-md cursor-pointer"/>
                </div>
                <div className="flex justify-end">
                    <button onClick={handleColorSave} className="flex items-center gap-2 py-2 px-4 text-sm bg-primary hover:bg-primary-hover text-on-primary rounded">
                        <Save size={16}/> Save Calendar Color
                    </button>
                </div>

                <h3 className="text-lg font-medium text-text-primary border-b border-gray-700 pb-2 pt-4">Calendar Sync</h3>
                <div className="bg-background rounded-md border border-border p-4">
                    <div className="flex items-start gap-3 mb-4">
                        <Calendar className="w-10 h-10 text-accent shrink-0" />
                        <div>
                            <h4 className="font-bold text-text-primary">Sync to Phone</h4>
                            <p className="text-sm text-text-secondary">
                                See your jobs and appointments in Google Calendar, Apple Calendar, or Outlook.
                            </p>
                        </div>
                    </div>

                    {!calendarToken ? (
                        <button 
                            onClick={handleGenerateToken}
                            className="w-full py-2 bg-primary hover:bg-primary-hover text-white rounded font-medium transition-colors"
                        >
                            Generate Sync Link
                        </button>
                    ) : (
                        <div className="space-y-3">
                            <div className="flex gap-2">
                                <button 
                                    onClick={handleCopyLink}
                                    className="flex-1 flex items-center justify-center gap-2 py-2 bg-surface hover:bg-surface-hover border border-border text-text-primary rounded transition-colors"
                                >
                                    {isCopied ? <Check size={16} className="text-green-500" /> : <Copy size={16} />}
                                    {isCopied ? "Copied!" : "Copy Link"}
                                </button>
                                <button 
                                    onClick={() => { if(confirm("Resetting this link will disconnect all current devices. Continue?")) handleGenerateToken() }}
                                    className="px-3 py-2 bg-red-900/20 hover:bg-red-900/40 text-red-500 border border-red-900/50 rounded transition-colors"
                                    title="Reset Link"
                                >
                                    <RefreshCw size={16} />
                                </button>
                            </div>
                            <p className="text-xs text-text-tertiary">
                                Paste this link into your calendar app's "Subscribe by URL" or "Add Calendar from Internet" section.
                            </p>
                        </div>
                    )}
                </div>
            </div>
        </section>
    );
};

export default MySettingsSection;