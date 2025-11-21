// components/AddEditVendorModal.tsx

import React, { useState, useEffect } from 'react';
import { Vendor, PRODUCT_TYPES } from '../types'; // --- MODIFIED: Import PRODUCT_TYPES ---
import { useData } from '../context/DataContext';
import { toast } from 'react-hot-toast';
import { Trash2 } from 'lucide-react';

interface AddEditVendorModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (vendor: Omit<Vendor, 'id'> | Vendor) => void;
    vendorToEdit?: Vendor | null;
    initialVendorType?: 'Manufacturer' | 'Supplier'; // --- MODIFIED: Changed type slightly ---
}

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const AddEditVendorModal: React.FC<AddEditVendorModalProps> = ({ isOpen, onClose, onSave, vendorToEdit, initialVendorType }) => {
    const { currentUser, deleteVendor } = useData();
    const [isDeleting, setIsDeleting] = useState(false);

    // --- MODIFIED: Updated formData state to match new Vendor type ---
    const [formData, setFormData] = useState({
        name: '',
        vendorType: 'Supplier' as 'Manufacturer' | 'Supplier' | 'Both' | null,
        defaultProductType: null as string | null,
        address: '', phone: '',
        orderingEmail: '', claimsEmail: '', repName: '', repPhone: '', repEmail: '',
        defaultMarkup: null as number | null, pricingMethod: null as 'Markup' | 'Margin' | null,
        shippingMethod: '', dedicatedShippingDay: null as number | null, notes: '',
    });

    useEffect(() => {
        // --- MODIFIED: Updated useEffect to handle new fields ---
        const initialState = {
            name: '',
            vendorType: 'Supplier' as 'Manufacturer' | 'Supplier' | 'Both' | null,
            defaultProductType: null as string | null,
            address: '', phone: '',
            orderingEmail: '', claimsEmail: '', repName: '', repPhone: '', repEmail: '',
            defaultMarkup: null as number | null, pricingMethod: null as 'Markup' | 'Margin' | null,
            shippingMethod: '', dedicatedShippingDay: null as number | null, notes: '',
        };

        if (vendorToEdit) {
            setFormData({
                name: vendorToEdit.name || '',
                vendorType: vendorToEdit.vendorType || null,
                defaultProductType: vendorToEdit.defaultProductType || null,
                address: vendorToEdit.address || '',
                phone: vendorToEdit.phone || '',
                orderingEmail: vendorToEdit.orderingEmail || '',
                claimsEmail: vendorToEdit.claimsEmail || '',
                repName: vendorToEdit.repName || '',
                repPhone: vendorToEdit.repPhone || '',
                repEmail: vendorToEdit.repEmail || '',
                defaultMarkup: vendorToEdit.defaultMarkup ?? null,
                pricingMethod: vendorToEdit.pricingMethod ?? null,
                shippingMethod: vendorToEdit.shippingMethod || '',
                dedicatedShippingDay: vendorToEdit.dedicatedShippingDay ?? null,
                notes: vendorToEdit.notes || '',
            });
        } else {
            if (initialVendorType) {
                initialState.vendorType = initialVendorType;
            }
            setFormData(initialState);
        }
    }, [vendorToEdit, isOpen, initialVendorType]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        const { name, value, type } = e.target;
        if (type === 'checkbox') {
            // This case is no longer used for vendor type but kept for safety
            const checked = (e.target as HTMLInputElement).checked;
            setFormData(prev => ({ ...prev, [name]: checked }));
        } else if (name === 'dedicatedShippingDay' || name === 'defaultProductType' || name === 'vendorType') {
            setFormData(prev => ({ ...prev, [name]: value === '' ? null : value }));
        } else if (name === 'defaultMarkup') {
             setFormData(prev => ({ ...prev, [name]: value === '' ? null : parseFloat(value) }));
        } else if (name === 'pricingMethod') {
             setFormData(prev => ({ ...prev, [name]: value === '' ? null : value }));
        } else {
            setFormData(prev => ({ ...prev, [name]: value }));
        }
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const dataToSave = {
            ...formData,
        };

        if (vendorToEdit) {
            onSave({ ...vendorToEdit, ...dataToSave });
        } else {
            onSave(dataToSave as Omit<Vendor, 'id'>);
        }
    };
    
    const handleDelete = async () => {
        if (!vendorToEdit) return;
        if (window.confirm(`Are you sure you want to delete vendor "${vendorToEdit.name}"? This action cannot be undone.`)) {
            setIsDeleting(true);
            try {
                await deleteVendor(vendorToEdit.id);
                toast.success('Vendor deleted successfully.');
                onClose();
            } catch (error) {
                toast.error((error as Error).message || 'Failed to delete vendor.');
                console.error(error);
            } finally {
                setIsDeleting(false);
            }
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-[60]">
            <div className="bg-surface p-8 rounded-lg shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto border border-border">
                <h2 className="text-2xl font-bold mb-6 text-text-primary">{vendorToEdit ? 'Edit Vendor' : 'Add New Vendor'}</h2>
                <form onSubmit={handleSubmit}>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {/* Column 1: Core Info */}
                        <div className="space-y-4">
                            <h3 className="text-lg font-semibold text-text-primary border-b border-border pb-2">Contact Info</h3>
                            <div>
                                <label className="block text-sm font-medium text-text-secondary">Vendor Name</label>
                                <input type="text" name="name" value={formData.name} onChange={handleChange} className="mt-1 w-full p-2 bg-background border-border rounded text-text-primary placeholder-text-secondary" required />
                            </div>
                            
                            {/* --- MODIFIED: Replaced checkboxes with dropdowns --- */}
                            <div>
                                <label className="block text-sm font-medium text-text-secondary">Vendor Type</label>
                                <select name="vendorType" value={formData.vendorType ?? ''} onChange={handleChange} className="mt-1 w-full p-2 bg-background border-border rounded text-text-primary">
                                    <option value="Supplier">Supplier</option>
                                    <option value="Manufacturer">Manufacturer</option>
                                    <option value="Both">Both</option>
                                </select>
                            </div>
                             
                            <div>
                                <label className="block text-sm font-medium text-text-secondary">Default Product Type</label>
                                <select name="defaultProductType" value={formData.defaultProductType ?? ''} onChange={handleChange} className="mt-1 w-full p-2 bg-background border-border rounded text-text-primary">
                                    <option value="">None</option>
                                    {PRODUCT_TYPES.map(type => (<option key={type} value={type}>{type}</option>))}
                                </select>
                            </div>
                            
                            {/* --- NEW: Pricing Override Section --- */}
                            <div className="p-3 bg-background rounded border border-border space-y-3 mt-4">
                                <h4 className="text-sm font-semibold text-text-primary border-b border-border pb-1 mb-2">Pricing Overrides</h4>
                                <div>
                                    <label className="block text-sm font-medium text-text-secondary">Default Markup %</label>
                                    <input type="number" name="defaultMarkup" value={formData.defaultMarkup ?? ''} placeholder="Use Global Default" onChange={handleChange} className="mt-1 w-full p-2 bg-surface border-border rounded text-text-primary" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-text-secondary">Calculation Method</label>
                                    <select name="pricingMethod" value={formData.pricingMethod ?? ''} onChange={handleChange} className="mt-1 w-full p-2 bg-surface border-border rounded text-text-primary">
                                        <option value="">Use Global Default</option>
                                        <option value="Markup">Markup</option>
                                        <option value="Margin">Margin</option>
                                    </select>
                                </div>
                            </div>
                            {/* --- END MODIFIED --- */}

                            <div>
                                <label className="block text-sm font-medium text-text-secondary">Address</label>
                                <textarea name="address" value={formData.address} onChange={handleChange} rows={2} className="mt-1 w-full p-2 bg-background border-border rounded text-text-primary"></textarea>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-text-secondary">Main Phone</label>
                                <input type="tel" name="phone" value={formData.phone} onChange={handleChange} className="mt-1 w-full p-2 bg-background border-border rounded text-text-primary" />
                            </div>
                             <div>
                                <label className="block text-sm font-medium text-text-secondary">Ordering Email</label>
                                <input type="email" name="orderingEmail" value={formData.orderingEmail} onChange={handleChange} className="mt-1 w-full p-2 bg-background border-border rounded text-text-primary" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-text-secondary">Claims Email</label>
                                <input type="email" name="claimsEmail" value={formData.claimsEmail} onChange={handleChange} className="mt-1 w-full p-2 bg-background border-border rounded text-text-primary" />
                            </div>
                        </div>

                        {/* Column 2: Rep & Shipping */}
                        <div className="space-y-4">
                             <h3 className="text-lg font-semibold text-text-primary border-b border-border pb-2">Representative</h3>
                            <div>
                                <label className="block text-sm font-medium text-text-secondary">Rep Name</label>
                                <input type="text" name="repName" value={formData.repName} onChange={handleChange} className="mt-1 w-full p-2 bg-background border-border rounded text-text-primary" />
                            </div>
                             <div>
                                <label className="block text-sm font-medium text-text-secondary">Rep Phone</label>
                                <input type="tel" name="repPhone" value={formData.repPhone} onChange={handleChange} className="mt-1 w-full p-2 bg-background border-border rounded text-text-primary" />
                            </div>
                             <div>
                                <label className="block text-sm font-medium text-text-secondary">Rep Email</label>
                                <input type="email" name="repEmail" value={formData.repEmail} onChange={handleChange} className="mt-1 w-full p-2 bg-background border-border rounded text-text-primary" />
                            </div>
                            
                            <div className="pt-4">
                                <h3 className="text-lg font-semibold text-text-primary border-b border-border pb-2">Shipping</h3>
                                <div>
                                    <label className="block text-sm font-medium text-text-secondary">Shipping Method</label>
                                    <input type="text" name="shippingMethod" value={formData.shippingMethod} placeholder="e.g., LTL Freight, UPS Ground" onChange={handleChange} className="mt-1 w-full p-2 bg-background border-border rounded text-text-primary" />
                                </div>
                                <div className="mt-4">
                                    <label className="block text-sm font-medium text-text-secondary">Dedicated Weekly Delivery Day</label>
                                    <select name="dedicatedShippingDay" value={formData.dedicatedShippingDay ?? ''} onChange={handleChange} className="mt-1 w-full p-2 bg-background border-border rounded text-text-primary">
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
                                <textarea name="notes" value={formData.notes} onChange={handleChange} rows={15} className="mt-1 w-full p-2 bg-background border-border rounded text-text-primary"></textarea>
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center justify-end space-x-4 mt-8 pt-6 border-t border-border">
                        {vendorToEdit && currentUser?.roles?.includes('Admin') && (
                            <button
                                type="button"
                                onClick={handleDelete}
                                disabled={isDeleting}
                                className="py-2 px-4 bg-red-600 hover:bg-red-700 rounded text-white font-semibold flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                                style={{ marginRight: 'auto' }}
                            >
                                <Trash2 size={16} />
                                {isDeleting ? 'Deleting...' : 'Delete Vendor'}
                            </button>
                        )}
                        <button type="button" onClick={onClose} className="py-2 px-4 bg-secondary hover:bg-secondary-hover rounded text-on-secondary">Cancel</button>
                        <button type="submit" className="py-2 px-4 bg-primary hover:bg-primary-hover rounded text-on-primary">{vendorToEdit ? 'Save Changes' : 'Create Vendor'}</button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default AddEditVendorModal;