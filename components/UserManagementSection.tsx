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
    const [newUserFirstName, setNewUserFirstName] = useState('');
    const [newUserLastName, setNewUserLastName] = useState('');
    const [newUserRole, setNewUserRole] = useState('User');

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
        if (!newUserEmail) {
            toast.error('Email is required to send an invitation.');
            return;
        }
        try {
            const newUser = await userService.createUser(newUserEmail, newUserFirstName, newUserLastName, newUserRole);
            const displayUser: User = { ...newUser, roles: [newUserRole], firstName: newUserFirstName, lastName: newUserLastName };
            setUsers([...users, displayUser].sort((a, b) => a.email.localeCompare(b.email)));
            toast.success(`Invitation sent to ${newUser.email}!`);
            setNewUserEmail('');
            setNewUserFirstName('');
            setNewUserLastName('');
            setNewUserRole('User');
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
        <section className="md:bg-surface-container-low md:p-8 md:rounded-2xl md:border md:border-outline/10 max-w-6xl mx-auto transition-all">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-8">
                <div className="md:col-span-2 lg:col-span-1">
                    <h3 className="text-xl font-bold mb-4 text-text-primary flex items-center gap-2">
                        <Users className="w-5 h-5 text-primary"/> Existing Users
                    </h3>
                    {isLoading ? ( <p className="text-text-secondary">Loading users...</p> ) : (
                        <div className="space-y-4 max-h-[50vh] overflow-y-auto pr-2">
                            {users.map((user) => (
                                <div key={user.userId} className="bg-surface-container-highest/30 p-4 rounded-2xl border border-outline/10 hover:border-outline/30 transition-colors">
                                    <div className="flex justify-between items-start mb-3">
                                        <div className="flex items-center gap-3">
                                            {user.avatarUrl ? (
                                                <img src={user.avatarUrl} alt={user.email} className="w-12 h-12 rounded-full object-cover border-2 border-surface-container-low shadow-sm"/>
                                            ) : (
                                                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-lg border-2 border-surface-container-low shadow-sm">
                                                    {(user.firstName ? user.firstName[0] : user.email[0]).toUpperCase()}
                                                </div>
                                            )}
                                            <div>
                                                <p className="font-bold text-text-primary text-base">
                                                    {user.firstName ? `${user.firstName} ${user.lastName}` : 'No Name Set'}
                                                </p>
                                                <p className="text-xs font-medium text-text-secondary">{user.email}</p>
                                            </div>
                                        </div>
                                        
                                        <button 
                                            onClick={() => handleDeleteUser(user)} 
                                            disabled={currentUser?.userId === user.userId} 
                                            className="text-error/80 hover:text-error p-2 rounded-full hover:bg-error/10 transition-colors disabled:opacity-30 disabled:cursor-not-allowed" 
                                            title="Delete User"
                                        >
                                            <Trash2 size={18} />
                                        </button>
                                    </div>
                                    <div className="flex flex-wrap items-center gap-4 border-t border-outline/10 pt-3">
                                        <div className="flex gap-4 items-center">
                                            {availableRoles.map(role => (
                                                <label key={role.id} className="flex items-center gap-2 text-sm font-medium text-text-secondary cursor-pointer hover:text-text-primary transition-colors">
                                                    <input type="checkbox" checked={user.roles.includes(role.name)} onChange={(e) => handleRoleChange(user.userId, role.name, e.target.checked)} disabled={currentUser?.userId === user.userId && role.name === 'Admin'} className="w-4 h-4 rounded border-outline/30 text-primary focus:ring-primary bg-surface-container-low" />
                                                    {role.name}
                                                </label>
                                            ))}
                                        </div>
                                        <button onClick={() => handleSaveRoles(user)} className="ml-auto flex items-center gap-2 py-1.5 px-4 text-xs font-bold bg-primary/10 hover:bg-primary hover:text-on-primary text-primary rounded-full transition-all"><Save size={14}/> Save</button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
                <div className="md:col-span-2 lg:col-span-1">
                    <h3 className="text-xl font-bold mb-4 text-text-primary">Invite New User</h3>
                    <form onSubmit={handleCreateUser} className="space-y-5 bg-surface-container-highest/30 p-6 rounded-2xl border border-outline/10">
                        <div>
                            <label className="block text-xs font-bold text-text-secondary uppercase tracking-wider mb-1">Email Address <span className="text-error">*</span></label>
                            <input type="email" value={newUserEmail} onChange={(e) => setNewUserEmail(e.target.value)} className="block w-full p-3 bg-surface-container-highest border-b-2 border-transparent rounded-t-lg text-text-primary placeholder:text-text-secondary/50 focus:border-primary focus:outline-none transition-all" placeholder="new.user@example.com" autoComplete="off" />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-bold text-text-secondary uppercase tracking-wider mb-1">First Name</label>
                                <input type="text" value={newUserFirstName} onChange={(e) => setNewUserFirstName(e.target.value)} className="block w-full p-3 bg-surface-container-highest border-b-2 border-transparent rounded-t-lg text-text-primary placeholder:text-text-secondary/50 focus:border-primary focus:outline-none transition-all" placeholder="John" />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-text-secondary uppercase tracking-wider mb-1">Last Name</label>
                                <input type="text" value={newUserLastName} onChange={(e) => setNewUserLastName(e.target.value)} className="block w-full p-3 bg-surface-container-highest border-b-2 border-transparent rounded-t-lg text-text-primary placeholder:text-text-secondary/50 focus:border-primary focus:outline-none transition-all" placeholder="Doe" />
                            </div>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-text-secondary uppercase tracking-wider mb-1">Initial Role</label>
                            <select 
                                value={newUserRole} 
                                onChange={(e) => setNewUserRole(e.target.value)} 
                                className="block w-full p-3 bg-surface-container-highest border-b-2 border-transparent rounded-t-lg text-text-primary focus:border-primary focus:outline-none transition-all cursor-pointer"
                            >
                                {availableRoles.map(role => (
                                    <option key={role.id} value={role.name}>{role.name}</option>
                                ))}
                            </select>
                        </div>
                        <div className="pt-4">
                            <button type="submit" className="w-full bg-primary hover:bg-primary-hover text-on-primary py-3 px-6 rounded-full font-bold shadow-sm flex items-center justify-center gap-2 transition-all hover:shadow-md">
                                <Users size={18} /> Send Invitation
                            </button>
                            <p className="text-xs text-text-tertiary mt-2 text-center">
                                The user will receive an email with a link to set their password.
                            </p>
                        </div>
                    </form>
                </div>
            </div>
        </section>
    );
};

export default UserManagementSection;