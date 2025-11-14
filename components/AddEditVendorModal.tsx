// components/AddEditVendorModal.tsx

import React, { useState, useEffect } from 'react';
import { Vendor } from '../types';
import { useData } from '../context/DataContext'; // <-- MODIFIED: Import useData
import { toast } from 'react-hot-toast';         // <-- MODIFIED: Import toast
import { Trash2 } from 'lucide-react';           // <-- MODIFIED: Import Trash2 icon

interface AddEditVendorModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (vendor: Omit<Vendor, 'id'> | Vendor) => void;
    vendorToEdit?: Vendor | null;
    initialVendorType?: 'manufacturer' | 'supplier'; 
}

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const AddEditVendorModal: React.FC<AddEditVendorModalProps> = ({ isOpen, onClose, onSave, vendorToEdit, initialVendorType }) => {
    // vvvvvvvvvvvv MODIFIED: Get currentUser and deleteVendor from context vvvvvvvvvvvv
    const { currentUser, deleteVendor } = useData();
    const [isDeleting, setIsDeleting] = useState(false);
    // ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^

    const [formData, setFormData] = useState({
        name: '', isManufacturer: false, isSupplier: true, address: '', phone: '',
        orderingEmail: '', claimsEmail: '', repName: '', repPhone: '', repEmail: '',
        shippingMethod: '', dedicatedShippingDay: null as number | null, notes: '',
    });

    useEffect(() => {
        const initialState = {
            name: '', isManufacturer: false, isSupplier: true, address: '', phone: '',
            orderingEmail: '', claimsEmail: '', repName: '', repPhone: '', repEmail: '',
            shippingMethod: '', dedicatedShippingDay: null as number | null, notes: '',
        };

        if (vendorToEdit) {
            setFormData({
                name: vendorToEdit.name || '',
                isManufacturer: vendorToEdit.isManufacturer || false,
                isSupplier: vendorToEdit.isSupplier || false,
                address: vendorToEdit.address || '',
                phone: vendorToEdit.phone || '',
                orderingEmail: vendorToEdit.orderingEmail || '',
                claimsEmail: vendorToEdit.claimsEmail || '',
                repName: vendorToEdit.repName || '',
                repPhone: vendorToEdit.repPhone || '',
                repEmail: vendorToEdit.repEmail || '',
                shippingMethod: vendorToEdit.shippingMethod || '',
                dedicatedShippingDay: vendorToEdit.dedicatedShippingDay ?? null,
                notes: vendorToEdit.notes || '',
            });
        } else {
            if (initialVendorType === 'manufacturer') {
                initialState.isManufacturer = true;
                initialState.isSupplier = false;
            } else if (initialVendorType === 'supplier') {
                initialState.isManufacturer = false;
                initialState.isSupplier = true;
            }
            setFormData(initialState);
        }
    }, [vendorToEdit, isOpen, initialVendorType]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        const { name, value, type } = e.target;
        if (type === 'checkbox') {
            const checked = (e.target as HTMLInputElement).checked;
            setFormData(prev => ({ ...prev, [name]: checked }));
        } else if (name === 'dedicatedShippingDay') {
            setFormData(prev => ({ ...prev, [name]: value === '' ? null : Number(value) }));
        } else {
            setFormData(prev => ({ ...prev, [name]: value }));
        }
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const dataToSave = {
            ...formData,
            dedicatedShippingDay: formData.dedicatedShippingDay === null ? undefined : formData.dedicatedShippingDay,
        };

        if (vendorToEdit) {
            onSave({ ...vendorToEdit, ...dataToSave });
        } else {
            onSave(dataToSave);
        }
    };
    
    // vvvvvvvvvvvv MODIFIED: Added handler for deletion vvvvvvvvvvvv
    const handleDelete = async () => {
        if (!vendorToEdit) return;
        if (window.confirm(`Are you sure you want to delete vendor "${vendorToEdit.name}"? This action cannot be undone.`)) {
            setIsDeleting(true);
            try {
                await deleteVendor(vendorToEdit.id);
                toast.success('Vendor deleted successfully.');
                onClose(); // Close the modal on successful deletion
            } catch (error) {
                toast.error((error as Error).message || 'Failed to delete vendor.');
                console.error(error);
            } finally {
                setIsDeleting(false);
            }
        }
    };
    // ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-[60]">
            <div className="bg-surface p-8 rounded-lg shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
                <h2 className="text-2xl font-bold mb-6 text-text-primary">{vendorToEdit ? 'Edit Vendor' : 'Add New Vendor'}</h2>
                <form onSubmit={handleSubmit}>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {/* Column 1: Core Info */}
                        <div className="space-y-4">
                            <h3 className="text-lg font-semibold text-text-primary border-b border-border pb-2">Contact Info</h3>
                            <div>
                                <label className="block text-sm font-medium text-text-secondary">Vendor Name</label>
                                <input type="text" name="name" value={formData.name} onChange={handleChange} className="mt-1 w-full p-2 bg-gray-800 border-border rounded" required />
                            </div>
                            <div className="flex gap-8 items-center pt-2">
                                <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="isManufacturer" checked={formData.isManufacturer} onChange={handleChange} className="h-4 w-4 rounded text-primary focus:ring-primary-dark bg-gray-700 border-gray-600"/> Is a Manufacturer</label>
                                <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="isSupplier" checked={formData.isSupplier} onChange={handleChange} className="h-4 w-4 rounded text-primary focus:ring-primary-dark bg-gray-700 border-gray-600"/> Is a Supplier</label>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-text-secondary">Address</label>
                                <textarea name="address" value={formData.address} onChange={handleChange} rows={2} className="mt-1 w-full p-2 bg-gray-800 border-border rounded"></textarea>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-text-secondary">Main Phone</label>
                                <input type="tel" name="phone" value={formData.phone} onChange={handleChange} className="mt-1 w-full p-2 bg-gray-800 border-border rounded" />
                            </div>
                             <div>
                                <label className="block text-sm font-medium text-text-secondary">Ordering Email</label>
                                <input type="email" name="orderingEmail" value={formData.orderingEmail} onChange={handleChange} className="mt-1 w-full p-2 bg-gray-800 border-border rounded" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-text-secondary">Claims Email</label>
                                <input type="email" name="claimsEmail" value={formData.claimsEmail} onChange={handleChange} className="mt-1 w-full p-2 bg-gray-800 border-border rounded" />
                            </div>
                        </div>

                        {/* Column 2: Rep & Shipping */}
                        <div className="space-y-4">
                             <h3 className="text-lg font-semibold text-text-primary border-b border-border pb-2">Representative</h3>
                            <div>
                                <label className="block text-sm font-medium text-text-secondary">Rep Name</label>
                                <input type="text" name="repName" value={formData.repName} onChange={handleChange} className="mt-1 w-full p-2 bg-gray-800 border-border rounded" />
                            </div>
                             <div>
                                <label className="block text-sm font-medium text-text-secondary">Rep Phone</label>
                                <input type="tel" name="repPhone" value={formData.repPhone} onChange={handleChange} className="mt-1 w-full p-2 bg-gray-800 border-border rounded" />
                            </div>
                             <div>
                                <label className="block text-sm font-medium text-text-secondary">Rep Email</label>
                                <input type="email" name="repEmail" value={formData.repEmail} onChange={handleChange} className="mt-1 w-full p-2 bg-gray-800 border-border rounded" />
                            </div>
                            
                            <div className="pt-4">
                                <h3 className="text-lg font-semibold text-text-primary border-b border-border pb-2">Shipping</h3>
                                <div>
                                    <label className="block text-sm font-medium text-text-secondary">Shipping Method</label>
                                    <input type="text" name="shippingMethod" value={formData.shippingMethod} placeholder="e.g., LTL Freight, UPS Ground" onChange={handleChange} className="mt-1 w-full p-2 bg-gray-800 border-border rounded" />
                                </div>
                                <div className="mt-4">
                                    <label className="block text-sm font-medium text-text-secondary">Dedicated Weekly Delivery Day</label>
                                    <select name="dedicatedShippingDay" value={formData.dedicatedShippingDay ?? ''} onChange={handleChange} className="mt-1 w-full p-2 bg-gray-800 border-border rounded">
                                        <option value="">None</option>
                                        {WEEKDAYS.map((day, index) => (<option key={index} value={index}>{day}</option>))}
                                    </select>
                                </div>
                            </div>
                        </div>

                        {/* Column 3: Notes */}
                        <div className="space-y-4">
                            <h3 className="text-lg font-semibold text-text-primary border-b border-border pb-2">Notes</h3>
                             <div>
                                <textarea name="notes" value={formData.notes} onChange={handleChange} rows={15} className="mt-1 w-full p-2 bg-gray-800 border-border rounded"></textarea>
                            </div>
                        </div>
                    </div>

                    {/* vvvvvvvvvvvv MODIFIED: Added conditional delete button vvvvvvvvvvvv */}
                    <div className="flex items-center justify-end space-x-4 mt-8 pt-6 border-t border-border">
                        {vendorToEdit && currentUser?.roles?.includes('Admin') && (
                            <button
                                type="button"
                                onClick={handleDelete}
                                disabled={isDeleting}
                                className="py-2 px-4 bg-red-600 hover:bg-red-700 rounded text-white font-semibold flex items-center gap-2 disabled:bg-red-900 disabled:cursor-not-allowed"
                                style={{ marginRight: 'auto' }} // Pushes this button to the far left
                            >
                                <Trash2 size={16} />
                                {isDeleting ? 'Deleting...' : 'Delete Vendor'}
                            </button>
                        )}
                        <button type="button" onClick={onClose} className="py-2 px-4 bg-gray-600 hover:bg-gray-700 rounded text-white">Cancel</button>
                        <button type="submit" className="py-2 px-4 bg-primary hover:bg-secondary rounded text-white">{vendorToEdit ? 'Save Changes' : 'Create Vendor'}</button>
                    </div>
                    {/* ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^ */}
                </form>
            </div>
        </div>
    );
};

export default AddEditVendorModal;