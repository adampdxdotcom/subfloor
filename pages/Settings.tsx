import React, { useState, useEffect } from 'react';
import { DownloadCloud, Database, Image as ImageIcon, AlertTriangle, Users, Trash2 } from 'lucide-react';
import RestoreForm from '../components/RestoreForm';
import { User } from '../types';
import * as userService from '../services/userService';
import toast from 'react-hot-toast';

const Settings: React.FC = () => {
    // --- State and Logic for User Management ---
    const [users, setUsers] = useState<User[]>([]);
    const [isLoadingUsers, setIsLoadingUsers] = useState(true);
    const [newUserEmail, setNewUserEmail] = useState('');
    const [newUserPassword, setNewUserPassword] = useState('');

    useEffect(() => {
        const fetchUsers = async () => {
            try {
                setIsLoadingUsers(true);
                const fetchedUsers = await userService.getUsers();
                setUsers(fetchedUsers);
            } catch (error) {
                toast.error('Could not fetch users.');
                console.error(error);
            } finally {
                setIsLoadingUsers(false);
            }
        };

        fetchUsers();
    }, []);

    const handleCreateUser = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newUserEmail || !newUserPassword) {
            toast.error('Email and password cannot be empty.');
            return;
        }

        try {
            const newUser = await userService.createUser(newUserEmail, newUserPassword);
            setUsers([...users, newUser].sort((a, b) => a.email.localeCompare(b.email)));
            toast.success(`User ${newUser.email} created successfully!`);
            setNewUserEmail('');
            setNewUserPassword('');
        } catch (error) {
            toast.error(`Failed to create user: ${error.message}`);
            console.error(error);
        }
    };

    const handleDeleteUser = async (userId: string) => {
        if (!window.confirm('Are you sure you want to delete this user? This action cannot be undone.')) {
            return;
        }

        try {
            await userService.deleteUser(userId);
            setUsers(users.filter(user => user.userId !== userId));
            toast.success('User deleted successfully.');
        } catch (error) {
            toast.error('Failed to delete user.');
            console.error(error);
        }
    };

    return (
        <div className="container mx-auto p-4 md:p-8">
            <h1 className="text-3xl font-bold text-text-primary mb-8 border-b border-border pb-4">
                Settings
            </h1>

            {/* User Management Section */}
            <section className="bg-surface p-6 rounded-lg shadow-md border border-border mb-12">
                <h2 className="text-2xl font-semibold text-text-primary mb-4 flex items-center gap-3">
                    <Users className="w-7 h-7 text-accent" />
                    User Management
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {/* Create User Form */}
                    <div>
                        <h3 className="text-xl font-medium mb-3">Create New User</h3>
                        <form onSubmit={handleCreateUser} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700">Email</label>
                                    <input
                                    type="email"
                                    value={newUserEmail}
                                    onChange={(e) => setNewUserEmail(e.target.value)}
                                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-gray-900" // Added text-gray-900
                                    placeholder="new.user@example.com"
                                    autoComplete="off" // Added autocomplete="off"
                                    />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700">Password</label>
                                    <input
                                    type="password"
                                    value={newUserPassword}
                                    onChange={(e) => setNewUserPassword(e.target.value)}
                                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-gray-900" // Added text color
                                    placeholder="Enter a secure password"
                                    autoComplete="off" // Added autocomplete
                                    />
                            </div>
                            <button
                                type="submit"
                                className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                            >
                                Create User
                            </button>
                        </form>
                    </div>

                    {/* User List */}
                    <div>
                        <h3 className="text-xl font-medium mb-3">Existing Users</h3>
                        {isLoadingUsers ? (
                            <p>Loading users...</p>
                        ) : (
                            <ul className="space-y-3 max-h-60 overflow-y-auto pr-2">
                                {users.map((user) => (
                                    <li key={user.userId} className="flex justify-between items-center bg-gray-50 p-3 rounded-md">
                                        <span className="text-gray-800 break-all">{user.email}</span>
                                        <button
                                            onClick={() => handleDeleteUser(user.userId)}
                                            className="text-red-500 hover:text-red-700 p-1 rounded-full hover:bg-red-100 ml-2"
                                            title="Delete User"
                                        >
                                            <Trash2 size={18} />
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                </div>
            </section>

            {/* Backup Section */}
            <section className="bg-surface p-6 rounded-lg shadow-md border border-border">
                {/* ... your existing backup JSX ... */}
                <h2 className="text-2xl font-semibold text-text-primary mb-4 flex items-center gap-3">
                    <DownloadCloud className="w-7 h-7 text-accent" />
                    Application Backup
                </h2>
                <p className="text-text-secondary mb-6 max-w-2xl">
                    Download ZIP archives of your critical application data. It is recommended to perform backups regularly and store the files in a safe, separate location.
                </p>
                <div className="flex flex-col md:flex-row gap-4">
                    <a
                        href="/api/backup/database"
                        download
                        className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-5 rounded-lg transition-colors flex items-center justify-center gap-3"
                    >
                        <Database className="w-6 h-6" />
                        Download Database Backup
                    </a>
                    <a
                        href="/api/backup/images"
                        download
                        className="flex-1 bg-teal-600 hover:bg-teal-700 text-white font-bold py-3 px-5 rounded-lg transition-colors flex items-center justify-center gap-3"
                    >
                        <ImageIcon className="w-6 h-6" />
                        Download Images Backup
                    </a>
                </div>
            </section>

            {/* Restore Section */}
            <section className="mt-12 bg-surface p-6 rounded-lg shadow-md border-2 border-red-500/50">
                {/* ... your existing restore JSX ... */}
                <h2 className="text-2xl font-semibold text-red-400 mb-4 flex items-center gap-3">
                    <AlertTriangle className="w-7 h-7" />
                    Danger Zone: Restore from Backup
                </h2>
                <p className="text-text-secondary mb-6 max-w-2xl">
                    Restoring from a backup will permanently overwrite existing data. This action cannot be undone. Proceed with extreme caution.
                </p>
                <div className="space-y-6">
                    <RestoreForm 
                        title="Database"
                        endpoint="/api/restore/database"
                        warningMessage="Are you ABSOLUTELY SURE you want to restore the database? This will completely ERASE the current database. All data entered since this backup was created will be lost forever. This action cannot be undone."
                    />
                    <RestoreForm 
                        title="Images"
                        endpoint="/api/restore/images"
                        warningMessage="Are you sure you want to restore the images? This will overwrite any new images that have been uploaded since this backup was created."
                    />
                </div>
            </section>
        </div>
    );
};

export default Settings;