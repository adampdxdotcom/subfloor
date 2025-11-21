import React, { useState, useEffect } from 'react';
import { Users, Trash2, Save } from 'lucide-react';
import { User } from '../types';
import * as userService from '../services/userService';
import { Role } from '../services/userService';
import toast from 'react-hot-toast';
import { useData } from '../context/DataContext';

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
                <div className="md:col-span-2 lg:col-span-1">
                    <h3 className="text-xl font-medium mb-4 text-text-primary">Existing Users</h3>
                    {isLoading ? ( <p className="text-text-secondary">Loading users...</p> ) : (
                        <div className="space-y-4 max-h-[50vh] overflow-y-auto pr-2">
                            {users.map((user) => (
                                <div key={user.userId} className="bg-background p-4 rounded-md border border-border">
                                    <div className="flex justify-between items-start mb-3">
                                        <div className="flex items-center gap-3">
                                            {user.avatarUrl ? (
                                                <img src={user.avatarUrl} alt={user.email} className="w-10 h-10 rounded-full object-cover border border-border"/>
                                            ) : (
                                                <div className="w-10 h-10 rounded-full bg-surface flex items-center justify-center text-text-secondary font-bold border border-border">
                                                    {(user.firstName ? user.firstName[0] : user.email[0]).toUpperCase()}
                                                </div>
                                            )}
                                            <div>
                                                <p className="font-bold text-text-primary text-sm">
                                                    {user.firstName ? `${user.firstName} ${user.lastName}` : 'No Name Set'}
                                                </p>
                                                <p className="text-xs text-text-secondary">{user.email}</p>
                                            </div>
                                        </div>
                                        
                                        <button 
                                            onClick={() => handleDeleteUser(user)} 
                                            disabled={currentUser?.userId === user.userId} 
                                            className="text-red-500 hover:text-red-400 p-2 rounded hover:bg-surface transition-colors disabled:opacity-30 disabled:cursor-not-allowed" 
                                            title="Delete User"
                                        >
                                            <Trash2 size={18} />
                                        </button>
                                    </div>
                                    <div className="flex items-center gap-6 border-t border-border pt-3">
                                        <div className="flex gap-4 items-center">
                                            {availableRoles.map(role => (
                                                <label key={role.id} className="flex items-center gap-2 text-sm text-text-secondary cursor-pointer">
                                                    <input type="checkbox" checked={user.roles.includes(role.name)} onChange={(e) => handleRoleChange(user.userId, role.name, e.target.checked)} disabled={currentUser?.userId === user.userId && role.name === 'Admin'} className="h-4 w-4 rounded text-primary focus:ring-primary bg-surface border-border disabled:opacity-50" />
                                                    {role.name}
                                                </label>
                                            ))}
                                        </div>
                                        <button onClick={() => handleSaveRoles(user)} className="ml-auto flex items-center gap-2 py-1 px-3 text-sm bg-primary hover:bg-primary-hover text-on-primary rounded"><Save size={14}/> Save</button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
                <div className="md:col-span-2 lg:col-span-1">
                    <h3 className="text-xl font-medium mb-3 text-text-primary">Create New User</h3>
                    <form onSubmit={handleCreateUser} className="space-y-4 bg-background p-4 rounded-md border border-border">
                        <div>
                            <label className="block text-sm font-medium text-text-secondary">Email</label>
                            <input type="email" value={newUserEmail} onChange={(e) => setNewUserEmail(e.target.value)} className="mt-1 block w-full p-2 bg-surface border-border rounded text-text-primary placeholder-text-secondary" placeholder="new.user@example.com" autoComplete="off" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-text-secondary">Password</label>
                            <input type="password" value={newUserPassword} onChange={(e) => setNewUserPassword(e.target.value)} className="mt-1 block w-full p-2 bg-surface border-border rounded text-text-primary placeholder-text-secondary" placeholder="Enter a secure password" autoComplete="new-password" />
                        </div>
                        <button type="submit" className="w-full bg-primary hover:bg-primary-hover text-on-primary py-2 px-4 rounded-md">Create User</button>
                    </form>
                </div>
            </div>
        </section>
    );
};

export default UserManagementSection;