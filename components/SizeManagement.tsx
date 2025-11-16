// components/SizeManagement.tsx

import React, { useState, useEffect, useCallback } from 'react';
import * as sampleService from '../services/sampleService';
import { toast } from 'react-hot-toast';
import { Edit, Trash2, Save, X, Loader } from 'lucide-react';

const SizeManagement: React.FC = () => {
    const [sizes, setSizes] = useState<string[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [editingValue, setEditingValue] = useState<string | null>(null);
    const [newValue, setNewValue] = useState('');

    const fetchSizes = useCallback(async () => {
        try {
            setIsLoading(true);
            const fetchedSizes = await sampleService.getUniqueSizes();
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
        if (!newValue || oldValue === newValue) {
            handleCancelEdit();
            return;
        }
        try {
            await sampleService.updateSizeValue(oldValue, newValue);
            toast.success(`Size '${oldValue}' updated to '${newValue}'.`);
            handleCancelEdit();
            await fetchSizes(); // Refresh the list
        } catch (error: any) {
            toast.error(`Update failed: ${error.message}`);
        }
    };

    const handleDelete = async (sizeToDelete: string) => {
        if (window.confirm(`Are you sure you want to delete the size "${sizeToDelete}" from the system? This cannot be undone.`)) {
            try {
                await sampleService.deleteSizeValue(sizeToDelete);
                toast.success(`Size '${sizeToDelete}' is no longer in use.`);
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
        <section className="bg-surface p-6 rounded-lg shadow-md border border-border">
            <h2 className="text-2xl font-semibold text-text-primary mb-4">Manage Sample Sizes</h2>
            <p className="text-text-secondary mb-6 max-w-2xl">Here you can clean up typos or remove unused sample sizes from the suggestion list.</p>

            <div className="max-w-md space-y-2">
                {sizes.map(size => (
                    <div key={size} className="bg-gray-800 p-3 rounded-md flex items-center justify-between">
                        {editingValue === size ? (
                            <input
                                type="text"
                                value={newValue}
                                onChange={(e) => setNewValue(e.target.value)}
                                className="flex-grow p-1 bg-gray-900 border-accent rounded"
                                autoFocus
                            />
                        ) : (
                            <span className="text-text-primary">{size}</span>
                        )}
                        <div className="flex items-center gap-2 ml-4">
                            {editingValue === size ? (
                                <>
                                    <button onClick={() => handleSaveEdit(size)} className="p-1 text-green-400 hover:bg-green-900/50 rounded-full"><Save size={18} /></button>
                                    <button onClick={handleCancelEdit} className="p-1 text-red-500 hover:bg-red-900/50 rounded-full"><X size={18} /></button>
                                </>
                            ) : (
                                <>
                                    <button onClick={() => handleEditClick(size)} className="p-1 text-text-secondary hover:text-white hover:bg-gray-700 rounded-full"><Edit size={16} /></button>
                                    <button onClick={() => handleDelete(size)} className="p-1 text-red-500 hover:text-red-400 hover:bg-gray-700 rounded-full"><Trash2 size={16} /></button>
                                </>
                            )}
                        </div>
                    </div>
                ))}
                 {sizes.length === 0 && <p className="text-text-secondary italic text-center py-4">No custom sizes have been created yet.</p>}
            </div>
        </section>
    );
};

export default SizeManagement;