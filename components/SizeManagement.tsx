// components/SizeManagement.tsx

import React, { useState, useEffect, useCallback } from 'react';
import * as sampleService from '../services/sampleService';
import { SizeStat } from '../services/sampleService';
import { toast } from 'react-hot-toast';
import { Edit, Trash2, Save, X, Loader, Plus } from 'lucide-react';

const SizeManagement: React.FC = () => {
    const [sizes, setSizes] = useState<SizeStat[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [editingValue, setEditingValue] = useState<string | null>(null);
    const [newValue, setNewValue] = useState('');
    const [createValue, setCreateValue] = useState('');

    const fetchSizes = useCallback(async () => {
        try {
            setIsLoading(true);
            const fetchedSizes = await sampleService.getUniqueSizeStats();
            setSizes(fetchedSizes);
        } catch (error) {
            toast.error("Could not load sample sizes.");
            console.error(error);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchSizes();
    }, [fetchSizes]);

    const handleEditClick = (size: string) => {
        setEditingValue(size);
        setNewValue(size);
    };

    const handleCancelEdit = () => {
        setEditingValue(null);
        setNewValue('');
    };

    const handleSaveEdit = async (oldValue: string) => {
        const trimmedNewValue = newValue.trim();
        if (!trimmedNewValue || oldValue === trimmedNewValue) {
            handleCancelEdit();
            return;
        }
        try {
            await sampleService.updateSizeValue(oldValue, trimmedNewValue);
            toast.success(`Size '${oldValue}' updated to '${trimmedNewValue}'.`);
            handleCancelEdit();
            await fetchSizes(); // Refresh the list
        } catch (error: any) {
            toast.error(`Update failed: ${error.message}`);
        }
    };

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        const value = createValue.trim();
        if (!value) return;
        try {
            await sampleService.createSize(value);
            toast.success(`Size '${value}' created.`);
            setCreateValue('');
            await fetchSizes();
        } catch (error: any) {
            toast.error(`Create failed: ${error.message}`);
        }
    };

    const handleDelete = async (sizeToDelete: string) => {
        const sizeStat = sizes.find(s => s.value === sizeToDelete);
        const usageMessage = sizeStat && sizeStat.usageCount > 0 
            ? `WARNING: This size is currently in use by ${sizeStat.usageCount} variants. Deletion will fail unless usage is 0.` 
            : '';

        if (window.confirm(`Are you sure you want to delete the size "${sizeToDelete}" from the system? ${usageMessage}`)) {
            try {
                await sampleService.deleteSizeValue(sizeToDelete);
                toast.success(`Size '${sizeToDelete}' successfully deleted.`);
                await fetchSizes(); // Refresh the list
            } catch (error: any) {
                toast.error(`Delete failed: ${error.message}`);
            }
        }
    };

    if (isLoading) {
        return <div className="flex items-center justify-center p-8"><Loader className="animate-spin" /> <span className="ml-2">Loading sizes...</span></div>;
    }

    return (
        <section className="md:bg-surface-container-low md:p-8 md:rounded-2xl md:border md:border-outline/10 max-w-4xl mx-auto transition-all">
            <h2 className="text-2xl font-semibold text-text-primary mb-4">Manage Sample Sizes</h2>
            <p className="text-text-secondary mb-6 max-w-2xl">Here you can clean up typos or remove unused sample sizes from the suggestion list.</p>

            {/* Create New Size Form */}
            <form onSubmit={handleCreate} className="flex gap-2 mb-6 max-w-md">
                <input
                    type="text"
                    value={createValue}
                    onChange={(e) => setCreateValue(e.target.value)}
                    placeholder="Add new size (e.g. 24x48)"
                    className="flex-grow p-3 bg-surface-container-highest border-b-2 border-transparent rounded-t-lg text-text-primary placeholder-text-secondary focus:border-primary focus:outline-none transition-all"
                />
                <button 
                    type="submit" 
                    disabled={!createValue.trim()}
                    className="px-6 py-2 bg-primary text-on-primary rounded-full hover:bg-primary-hover disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition-colors font-bold shadow-sm"
                >
                    <Plus size={18} />
                    Add
                </button>
            </form>

            <div className="max-w-xl space-y-0 divide-y divide-outline/10 border border-outline/10 rounded-xl overflow-hidden">
                {sizes.map(size => (
                    <div key={size.value} className="bg-surface-container-highest/30 p-4 flex items-center justify-between group hover:bg-surface-container-highest/60 transition-colors">
                        {editingValue === size.value ? (
                            <input
                                type="text"
                                value={newValue}
                                onChange={(e) => setNewValue(e.target.value)}
                                className="flex-grow p-2 bg-surface-container-high border-b-2 border-primary text-text-primary focus:outline-none"
                                autoFocus
                            />
                        ) : (
                            <div className="flex items-center gap-4">
                                <span className="text-text-primary font-medium">{size.value}</span>
                                {size.usageCount > 0 && (
                                    <span className="text-xs px-2 py-0.5 bg-surface-container-high text-text-secondary rounded-full border border-outline/10">
                                        {size.usageCount} variant{size.usageCount !== 1 ? 's' : ''}
                                    </span>
                                )}
                            </div>
                        )}
                        <div className="flex items-center gap-2 ml-4">
                            {editingValue === size.value ? (
                                <>
                                    <button onClick={() => handleSaveEdit(size.value)} className="p-2 text-primary hover:bg-primary/10 rounded-full transition-colors"><Save size={18} /></button>
                                    <button onClick={handleCancelEdit} className="p-2 text-error hover:bg-error/10 rounded-full transition-colors"><X size={18} /></button>
                                </>
                            ) : (
                                <>
                                    <button onClick={() => handleEditClick(size.value)} className="p-2 text-text-secondary hover:text-primary hover:bg-primary/10 rounded-full transition-colors"><Edit size={18} /></button>
                                    <button 
                                        onClick={() => handleDelete(size.value)} 
                                        disabled={size.usageCount > 0}
                                        title={size.usageCount > 0 ? "Cannot delete size currently in use" : "Delete size"}
                                        className={`p-2 rounded-full transition-colors ${size.usageCount > 0 ? 'text-outline/40 cursor-not-allowed' : 'text-error/80 hover:text-error hover:bg-error/10'}`}
                                    >
                                        <Trash2 size={18} />
                                    </button>
                                </>
                            )}
                        </div>
                    </div>
                ))}
                 {sizes.length === 0 && !isLoading && (
                    <p className="text-text-secondary italic text-center py-4">
                        No custom sizes have been created yet.
                    </p>
                )}
            </div>
        </section>
    );
};

export default SizeManagement;