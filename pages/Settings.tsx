// pages/Settings.tsx

import React, { useState, useEffect } from 'react';
import { DownloadCloud, Database, Image as ImageIcon, AlertTriangle, Users, Trash2, Save } from 'lucide-react';
import RestoreForm from '../components/RestoreForm';
import { User } from '../types';
import * as userService from '../services/userService';
import { Role } from '../services/userService'; // Import the Role type
import toast from 'react-hot-toast';
import { useData } from '../context/DataContext';

// =================================================================
//  USER MANAGEMENT COMPONENT (Admin Only) - NOW WITH ROLE MANAGEMENT
// =================================================================
const UserManagementSection: React.FC = () => {
    const { currentUser } = useData();
    const [users, setUsers] = useState<User[]>([]);
    const [availableRoles, setAvailableRoles] = useState<Role[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [newUserEmail, setNewUserEmail] = useState('');
    const [newUserPassword, setNewUserPassword] = useState('');

    useEffect(() => {
        const fetchData = async () => {
            try {
                setIsLoading(true);
                const [fetchedUsers, fetchedRoles] = await Promise.all([
                    userService.getUsers(),
                    userService.getRoles()
                ]);
                setUsers(fetchedUsers.sort((a, b) => a.email.localeCompare(b.email)));
                setAvailableRoles(fetchedRoles);
            } catch (error) {
                toast.error('Could not load user management data.');
                console.error(error);
            } finally {
                setIsLoading(false);
            }
        };
        fetchData();
    }, []);

    const handleCreateUser = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newUserEmail || !newUserPassword) {
            toast.error('Email and password cannot be empty.');
            return;
        }
        try {
            const newUser = await userService.createUser(newUserEmail, newUserPassword);
            const displayUser: User = { ...newUser, roles: ['User'] };
            setUsers([...users, displayUser].sort((a, b) => a.email.localeCompare(b.email)));
            toast.success(`User ${newUser.email} created successfully!`);
            setNewUserEmail('');
            setNewUserPassword('');
        } catch (error: any) {
            toast.error(`Failed to create user: ${error.message}`);
        }
    };

    const handleDeleteUser = async (userToDelete: User) => {
        if (currentUser?.userId === userToDelete.userId) {
            toast.error("You cannot delete your own account.");
            return;
        }
        if (!window.confirm(`Are you sure you want to delete user "${userToDelete.email}"? This action cannot be undone.`)) {
            return;
        }
        try {
            await userService.deleteUser(userToDelete.userId);
            setUsers(users.filter(user => user.userId !== userToDelete.userId));
            toast.success('User deleted successfully.');
        } catch (error: any) {
            toast.error(`Failed to delete user: ${error.message}`);
        }
    };

    const handleRoleChange = (userId: string, roleName: string, isChecked: boolean) => {
        setUsers(currentUsers =>
            currentUsers.map(user => {
                if (user.userId === userId) {
                    const newRoles = isChecked
                        ? [...user.roles, roleName]
                        : user.roles.filter(r => r !== roleName);
                    return { ...user, roles: newRoles };
                }
                return user;
            })
        );
    };

    const handleSaveRoles = async (userToUpdate: User) => {
        try {
            await userService.updateUserRoles(userToUpdate.userId, userToUpdate.roles);
            toast.success(`Roles for ${userToUpdate.email} updated successfully.`);
        } catch (error: any) {
            toast.error(`Failed to update roles: ${error.message}`);
        }
    };

    return (
        <section className="bg-surface p-6 rounded-lg shadow-md border border-border">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-8">
                {/* Column 1: Existing Users & Role Management */}
                <div className="md:col-span-2 lg:col-span-1">
                    <h3 className="text-xl font-medium mb-4 text-text-primary">Existing Users</h3>
                    {isLoading ? ( <p className="text-text-secondary">Loading users...</p> ) : (
                        <div className="space-y-4 max-h-[50vh] overflow-y-auto pr-2">
                            {users.map((user) => (
                                <div key={user.userId} className="bg-gray-800 p-4 rounded-md">
                                    <div className="flex justify-between items-center mb-3">
                                        <p className="font-semibold text-text-primary break-all" title={user.email}>{user.email}</p>
                                        <button onClick={() => handleDeleteUser(user)} disabled={currentUser?.userId === user.userId} className="text-red-500 hover:text-red-700 p-1 rounded-full hover:bg-red-900/50 disabled:text-gray-600 disabled:hover:bg-transparent disabled:cursor-not-allowed" title="Delete User"><Trash2 size={18} /></button>
                                    </div>
                                    <div className="flex items-center gap-6 border-t border-border pt-3">
                                        <div className="flex gap-4 items-center">
                                            {availableRoles.map(role => (
                                                <label key={role.id} className="flex items-center gap-2 text-sm text-text-secondary">
                                                    <input 
                                                        type="checkbox" 
                                                        checked={user.roles.includes(role.name)}
                                                        onChange={(e) => handleRoleChange(user.userId, role.name, e.target.checked)}
                                                        disabled={currentUser?.userId === user.userId && role.name === 'Admin'}
                                                        className="h-4 w-4 rounded text-primary focus:ring-primary-dark bg-gray-700 border-gray-600 disabled:opacity-50"
                                                    />
                                                    {role.name}
                                                </label>
                                            ))}
                                        </div>
                                        <button onClick={() => handleSaveRoles(user)} className="ml-auto flex items-center gap-2 py-1 px-3 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"><Save size={14}/> Save</button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Column 2: Create New User */}
                <div className="md:col-span-2 lg:col-span-1">
                    <h3 className="text-xl font-medium mb-3 text-text-primary">Create New User</h3>
                    <form onSubmit={handleCreateUser} className="space-y-4 bg-gray-800 p-4 rounded-md">
                        <div>
                            <label className="block text-sm font-medium text-text-secondary">Email</label>
                            <input type="email" value={newUserEmail} onChange={(e) => setNewUserEmail(e.target.value)} className="mt-1 block w-full p-2 bg-gray-900 border-border rounded text-text-primary" placeholder="new.user@example.com" autoComplete="off" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-text-secondary">Password</label>
                            <input type="password" value={newUserPassword} onChange={(e) => setNewUserPassword(e.target.value)} className="mt-1 block w-full p-2 bg-gray-900 border-border rounded text-text-primary" placeholder="Enter a secure password" autoComplete="new-password" />
                        </div>
                        <button type="submit" className="w-full bg-primary text-white py-2 px-4 rounded-md hover:bg-secondary">Create User</button>
                    </form>
                </div>
            </div>
        </section>
    );
};

const BackupRestoreSection: React.FC = () => {
    return (
        <>
            <section className="bg-surface p-6 rounded-lg shadow-md border border-border">
                <h2 className="text-2xl font-semibold text-text-primary mb-4 flex items-center gap-3"><DownloadCloud className="w-7 h-7 text-accent" />Application Backup</h2>
                <p className="text-text-secondary mb-6 max-w-2xl">Download ZIP archives of your critical application data. It is recommended to perform backups regularly and store the files in a safe, separate location.</p>
                <div className="flex flex-col md:flex-row gap-4">
                    <a href="/api/backup/database" download className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-5 rounded-lg transition-colors flex items-center justify-center gap-3"><Database className="w-6 h-6" />Download Database Backup</a>
                    <a href="/api/backup/images" download className="flex-1 bg-teal-600 hover:bg-teal-700 text-white font-bold py-3 px-5 rounded-lg transition-colors flex items-center justify-center gap-3"><ImageIcon className="w-6 h-6" />Download Images Backup</a>
                </div>
            </section>
            <section className="mt-8 bg-surface p-6 rounded-lg shadow-md border-2 border-red-500/50">
                <h2 className="text-2xl font-semibold text-red-400 mb-4 flex items-center gap-3"><AlertTriangle className="w-7 h-7" />Danger Zone: Restore from Backup</h2>
                <p className="text-text-secondary mb-6 max-w-2xl">Restoring from a backup will permanently overwrite existing data. This action cannot be undone. Proceed with extreme caution.</p>
                <div className="space-y-6">
                    <RestoreForm title="Database" endpoint="/api/restore/database" warningMessage="Are you ABSOLUTELY SURE you want to restore the database? This will completely ERASE the current database. All data entered since this backup was created will be lost forever. This action cannot be undone." />
                    <RestoreForm title="Images" endpoint="/api/restore/images" warningMessage="Are you sure you want to restore the images? This will overwrite any new images that have been uploaded since this backup was created." />
                </div>
            </section>
        </>
    );
};

const Settings: React.FC = () => {
    const { currentUser } = useData();
    const isAdmin = currentUser?.roles?.includes('Admin');
    
    const [activeTab, setActiveTab] = useState<'users' | 'backup'>(isAdmin ? 'users' : 'backup');

    // Effect to switch tab if a non-admin is on the users tab somehow
    useEffect(() => {
        if (!isAdmin && activeTab === 'users') {
            setActiveTab('backup');
        }
    }, [isAdmin, activeTab]);
    
    return (
        <div className="container mx-auto p-4 md:p-8">
            <h1 className="text-3xl font-bold text-text-primary mb-6">Settings</h1>
            <div className="flex border-b border-border mb-8">
                {isAdmin && (
                    <button
                        onClick={() => setActiveTab('users')}
                        className={`py-3 px-6 text-lg font-semibold transition-colors ${activeTab === 'users' ? 'text-accent border-b-2 border-accent' : 'text-text-secondary hover:text-text-primary'}`}
                    >
                        <Users className="w-5 h-5 inline-block mr-2 mb-1" />
                        User Management
                    </button>
                )}
                <button
                    onClick={() => setActiveTab('backup')}
                    className={`py-3 px-6 text-lg font-semibold transition-colors ${activeTab === 'backup' ? 'text-accent border-b-2 border-accent' : 'text-text-secondary hover:text-text-primary'}`}
                >
                    <DownloadCloud className="w-5 h-5 inline-block mr-2 mb-1" />
                    Backup & Restore
                </button>
            </div>
            <div>
                {activeTab === 'users' && <UserManagementSection />}
                {activeTab === 'backup' && <BackupRestoreSection />}
            </div>
        </div>
    );
};

export default Settings;