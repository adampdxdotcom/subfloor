import React, { useState, useEffect } from 'react';
import { UserCog, Palette, Camera, Save, Trash2, Calendar, Copy, RefreshCw, Check, Fingerprint } from 'lucide-react';
import toast from 'react-hot-toast';
import { Capacitor } from '@capacitor/core';
import { useData } from '../context/DataContext';
import { useBiometrics } from '../context/BiometricContext';
import * as userService from '../services/userService';
import { getEndpoint } from '../utils/apiConfig';

const MySettingsSection: React.FC = () => {
    const { currentUser, saveCurrentUserPreferences, updateCurrentUserProfile, uploadCurrentUserAvatar, deleteCurrentUserAvatar } = useData();
    const { isEnabled: isBioEnabled, enableBiometrics, disableBiometrics } = useBiometrics();
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
        // Fallback: Check both .id and .userId (depending on how your User type is defined)
        const userId = currentUser?.id || currentUser?.userId;

        if (!currentUser || !userId || !calendarToken) {
            toast.error("User ID not found. Please refresh.");
            return;
        }

        // We need the absolute URL for the external calendar app
        const apiBase = getEndpoint('').replace(/\/$/, ''); // Remove trailing slash if any
        // Check if apiBase is relative (starts with /)
        const baseUrl = apiBase.startsWith('http') ? apiBase : window.location.origin;
        
        const feedUrl = `${baseUrl}/api/calendar/feed/${userId}/${calendarToken}`;
        
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

    const toggleBiometrics = async () => {
        if (isBioEnabled) {
            if (window.confirm("Disable biometric security?")) {
                disableBiometrics();
                toast.success("Biometrics disabled");
            }
        } else {
            const success = await enableBiometrics();
            if (success) toast.success("Biometrics enabled!");
        }
    };

    return (
        <section>
            <h2 className="text-2xl font-bold text-text-primary mb-6">
                My Settings
            </h2>
            <div className="space-y-6 max-w-md">
                {/* AVATAR UPLOAD SECTION */}
                <div className="flex flex-col items-center mb-6">
                    <div className="relative w-28 h-28 mb-4">
                        {currentUser?.avatarUrl ? (
                            <img 
                                src={currentUser.avatarUrl} 
                                alt="Profile" 
                                className="w-full h-full rounded-full object-cover border-4 border-surface shadow-md"
                            />
                        ) : (
                            <div className="w-full h-full rounded-full bg-surface-container-highest flex items-center justify-center border-4 border-surface shadow-md text-3xl font-bold text-primary">
                                {firstName ? `${firstName[0]}${lastName[0] || ''}`.toUpperCase() : currentUser?.email[0].toUpperCase()}
                            </div>
                        )}
                        
                        {/* DELETE BUTTON - Only show if avatarUrl exists */}
                        {currentUser?.avatarUrl && (
                            <button onClick={handleAvatarDelete} className="absolute top-0 right-0 bg-error-container text-error p-1.5 rounded-full shadow-sm hover:bg-error hover:text-white transition-colors z-10 border-2 border-surface" title="Remove Picture">
                                <Trash2 size={12} />
                            </button>
                        )}

                        <label htmlFor="avatar-upload" className="absolute bottom-0 right-0 bg-primary hover:bg-primary-hover text-on-primary p-2.5 rounded-full cursor-pointer shadow-lg transition-colors border-2 border-surface">
                            <Camera size={18} />
                        </label>
                        <input 
                            id="avatar-upload" 
                            type="file" 
                            accept="image/*" 
                            className="hidden" 
                            onChange={handleFileChange} 
                        />
                    </div>
                    <p className="text-xs text-text-secondary font-medium">Click camera icon to change</p>
                </div>

                <div className="space-y-5">
                    <h3 className="text-lg font-bold text-text-primary border-b border-outline/10 pb-2">Profile Information</h3>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-text-secondary mb-1">First Name</label>
                            <input type="text" value={firstName} onChange={(e) => setFirstName(e.target.value)} className="w-full p-3 bg-surface-container-highest border-b-2 border-transparent rounded-t-md text-text-primary focus:outline-none focus:border-primary transition-colors" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-text-secondary mb-1">Last Name</label>
                            <input type="text" value={lastName} onChange={(e) => setLastName(e.target.value)} className="w-full p-3 bg-surface-container-highest border-b-2 border-transparent rounded-t-md text-text-primary focus:outline-none focus:border-primary transition-colors" />
                        </div>
                    </div>
                    <button onClick={handleProfileSave} className="flex items-center gap-2 py-2 px-6 text-sm bg-primary hover:bg-primary-hover text-on-primary rounded-full font-semibold shadow-sm transition-all hover:shadow-md"><Save size={16}/> Update Profile</button>
                </div>
                
                <h3 className="text-lg font-bold text-text-primary border-b border-outline/10 pb-2 pt-6">Security</h3>
                <div className="space-y-5">
                    <div>
                        <label className="block text-sm font-medium text-text-secondary mb-1">Current Password</label>
                        <input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} className="w-full p-3 bg-surface-container-highest border-b-2 border-transparent rounded-t-md text-text-primary focus:outline-none focus:border-primary transition-colors" placeholder="Required to verify identity" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-text-secondary mb-1">New Password</label>
                        <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="w-full p-3 bg-surface-container-highest border-b-2 border-transparent rounded-t-md text-text-primary focus:outline-none focus:border-primary transition-colors" placeholder="Minimum 8 characters" />
                    </div>
                    <div className="flex justify-end">
                         <button onClick={handlePasswordChange} className="py-2 px-6 text-sm bg-surface-container-high border border-outline/20 text-text-primary hover:bg-surface-container-highest rounded-full font-medium transition-colors">Change Password</button>
                    </div>
                </div>

                {/* BIOMETRIC SETTINGS (MOBILE ONLY) */}
                {Capacitor.isNativePlatform() && (
                    <>
                        <h3 className="text-lg font-bold text-text-primary border-b border-outline/10 pb-2 pt-6">App Security</h3>
                        <div className="flex items-center justify-between p-4 bg-surface-container-low rounded-xl border border-outline/10">
                            <div className="flex items-center gap-3">
                                <div className={`p-2 rounded-full ${isBioEnabled ? 'bg-success-container text-success' : 'bg-surface-container-highest text-text-secondary'}`}>
                                    <Fingerprint size={24} />
                                </div>
                                <div>
                                    <h4 className="font-medium text-text-primary">Biometric Lock</h4>
                                    <p className="text-xs text-text-secondary">Require Face ID / Fingerprint after 5m inactivity</p>
                                </div>
                            </div>
                            <button
                                onClick={toggleBiometrics}
                                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
                                    isBioEnabled ? 'bg-primary' : 'bg-surface-container-highest'
                                }`}
                            >
                                <span
                                    className={`${
                                        isBioEnabled ? 'translate-x-6' : 'translate-x-1'
                                    } inline-block h-4 w-4 transform rounded-full bg-white transition-transform`}
                                />
                            </button>
                        </div>
                    </>
                )}

                <h3 className="text-lg font-bold text-text-primary border-b border-outline/10 pb-2 pt-6">Preferences</h3>
                <div className="flex items-center justify-between p-4 bg-surface-container-low rounded-xl border border-outline/10">
                    <div className="flex items-center gap-3">
                        <Palette className="w-6 h-6 text-accent" />
                        <label htmlFor="userColor" className="font-medium text-text-secondary">
                            My Calendar Color
                        </label>
                    </div>
                    <div className="relative w-10 h-10 rounded-full overflow-hidden border-2 border-surface shadow-sm ring-1 ring-outline/10 hover:ring-primary transition-all">
                        <input type="color" id="userColor" value={color} onChange={handleColorChange} className="absolute -top-4 -left-4 w-20 h-20 p-0 border-0 cursor-pointer"/>
                    </div>
                </div>
                <div className="flex justify-end">
                    <button onClick={handleColorSave} className="flex items-center gap-2 py-2 px-6 text-sm bg-primary hover:bg-primary-hover text-on-primary rounded-full font-semibold shadow-sm transition-all hover:shadow-md">
                        <Save size={16}/> Save Calendar Color
                    </button>
                </div>

                <h3 className="text-lg font-bold text-text-primary border-b border-outline/10 pb-2 pt-6">Calendar Sync</h3>
                <div className="bg-surface-container-low rounded-xl border border-outline/10 p-5">
                    <div className="flex items-start gap-3 mb-4">
                        <div className="p-2 bg-primary-container rounded-lg text-primary">
                            <Calendar className="w-6 h-6" />
                        </div>
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
                            className="w-full py-2 bg-primary hover:bg-primary-hover text-on-primary rounded-full font-bold transition-colors shadow-md"
                        >
                            Generate Sync Link
                        </button>
                    ) : (
                        <div className="space-y-3">
                            <div className="flex gap-2">
                                <button 
                                    onClick={handleCopyLink}
                                    className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-surface-container-highest hover:bg-surface-container-high border border-transparent hover:border-outline/10 text-text-primary rounded-full font-medium transition-all"
                                >
                                    {isCopied ? <Check size={16} className="text-success" /> : <Copy size={16} />}
                                    {isCopied ? "Copied!" : "Copy Link"}
                                </button>
                                <button 
                                    onClick={() => { if(confirm("Resetting this link will disconnect all current devices. Continue?")) handleGenerateToken() }}
                                    className="px-3 py-2 bg-error-container hover:bg-error/20 text-error border border-transparent rounded-full transition-colors"
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