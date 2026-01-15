import React, { useState, useEffect } from 'react';
import { Vendor, PRODUCT_TYPES } from '../types';
import { useData } from '../context/DataContext';
import { useVendors } from '../hooks/useVendors';
import { toast } from 'react-hot-toast';
import { Trash2, Copy, Globe, Link as LinkIcon, Building, X } from 'lucide-react';

interface AddEditVendorModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (vendor: Omit<Vendor, 'id'> | Vendor) => void;
    vendorToEdit?: Vendor | null;
    initialVendorType?: 'Manufacturer' | 'Supplier';
}

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

// Helper for US Phone Formatting
const formatPhoneNumber = (value: string) => {
    if (!value) return value;
    const phoneNumber = value.replace(/[^\d]/g, '');
    const phoneNumberLength = phoneNumber.length;
    if (phoneNumberLength < 4) return phoneNumber;
    if (phoneNumberLength < 7) {
        return `(${phoneNumber.slice(0, 3)}) ${phoneNumber.slice(3)}`;
    }
    return `(${phoneNumber.slice(0, 3)}) ${phoneNumber.slice(3, 6)}-${phoneNumber.slice(6, 10)}`;
};

const AddEditVendorModal: React.FC<AddEditVendorModalProps> = ({ isOpen, onClose, onSave, vendorToEdit, initialVendorType }) => {
    const { currentUser, deleteVendor } = useData();
    const { data: allVendors = [] } = useVendors();
    const [isDeleting, setIsDeleting] = useState(false);

    const [formData, setFormData] = useState({
        name: '',
        vendorType: 'Supplier' as 'Manufacturer' | 'Supplier' | 'Both' | null,
        defaultSupplierId: null as number | null,
        defaultProductType: null as string | null,
        websiteUrl: '',
        portalUrl: '',
        address: '', phone: '',
        orderingEmail: '', claimsEmail: '', repName: '', repPhone: '', repEmail: '',
        defaultMarkup: null as number | null, pricingMethod: null as 'Markup' | 'Margin' | null,
        shippingMethod: '', dedicatedShippingDay: null as number | null, notes: '',
    });

    useEffect(() => {
        const initialState = {
            name: '',
            vendorType: 'Supplier' as 'Manufacturer' | 'Supplier' | 'Both' | null,
            defaultSupplierId: null as number | null,
            defaultProductType: null as string | null,
            websiteUrl: '',
            portalUrl: '',
            address: '', phone: '',
            orderingEmail: '', claimsEmail: '', repName: '', repPhone: '', repEmail: '',
            defaultMarkup: null as number | null, pricingMethod: null as 'Markup' | 'Margin' | null,
            shippingMethod: '', dedicatedShippingDay: null as number | null, notes: '',
        };

        if (vendorToEdit) {
            setFormData({
                name: vendorToEdit.name || '',
                vendorType: vendorToEdit.vendorType || null,
                defaultSupplierId: vendorToEdit.defaultSupplierId || null,
                defaultProductType: vendorToEdit.defaultProductType || null,
                websiteUrl: vendorToEdit.websiteUrl || '',
                portalUrl: vendorToEdit.portalUrl || '',
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
        
        if (name === 'phone' || name === 'repPhone') {
            const raw = value.replace(/[^\d]/g, '');
            if (raw.length <= 10) {
                 setFormData(prev => ({ ...prev, [name]: formatPhoneNumber(raw) }));
            }
            return;
        }

        if (type === 'checkbox') {
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
            defaultSupplierId: formData.vendorType === 'Manufacturer' ? formData.defaultSupplierId : null,
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

    const potentialSuppliers = allVendors.filter(v => 
        (v.vendorType === 'Supplier' || v.vendorType === 'Both') && 
        v.id !== vendorToEdit?.id
    );

    const handleSupplierChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const val = e.target.value;
        const newSupplierId = val === '' ? null : parseInt(val);
        const supplier = allVendors.find(v => v.id === newSupplierId);
        
        setFormData(prev => ({
            ...prev,
            defaultSupplierId: newSupplierId,
            shippingMethod: supplier?.shippingMethod || prev.shippingMethod,
            dedicatedShippingDay: supplier?.dedicatedShippingDay ?? prev.dedicatedShippingDay
        }));
    };

    const handleCopySupplierInfo = () => {
        const supplier = allVendors.find(v => v.id === formData.defaultSupplierId);
        if (supplier) {
            setFormData(prev => ({
                ...prev,
                address: supplier.address || prev.address,
                phone: supplier.phone || prev.phone,
                orderingEmail: supplier.orderingEmail || prev.orderingEmail,
                claimsEmail: supplier.claimsEmail || prev.claimsEmail,
                repName: supplier.repName || prev.repName,
                repPhone: supplier.repPhone || prev.repPhone,
                repEmail: supplier.repEmail || prev.repEmail,
                websiteUrl: supplier.websiteUrl || prev.websiteUrl,
                portalUrl: supplier.portalUrl || prev.portalUrl,
                shippingMethod: supplier.shippingMethod || prev.shippingMethod,
                dedicatedShippingDay: supplier.dedicatedShippingDay ?? prev.dedicatedShippingDay
            }));
            toast.success(`Copied contact info from ${supplier.name}`);
        }
    };

    if (!isOpen) return null;

    const inputClasses = "w-full p-3 bg-surface-container-highest border-b-2 border-transparent rounded-t-md text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-primary transition-colors";

    return (
        <div className="fixed inset-0 bg-black/75 z-[60] overflow-y-auto">
            <div className="flex min-h-full items-center justify-center p-0 lg:p-4">
                <div className="bg-surface-container-high w-full min-h-full lg:min-h-0 lg:h-auto lg:max-h-[90vh] lg:max-w-4xl lg:rounded-2xl shadow-2xl flex flex-col border border-outline/10 relative">
                    
                    <div className="p-4 border-b border-outline/10 flex justify-between items-center bg-surface-container-low lg:rounded-t-2xl sticky top-0 z-10">
                        <h2 className="text-xl font-bold text-text-primary flex items-center gap-2">
                            <Building className="text-primary" />
                            {vendorToEdit ? 'Edit Vendor' : 'New Vendor'}
                        </h2>
                        <button onClick={onClose} className="p-2 hover:bg-surface-container-highest rounded-full text-text-secondary hover:text-text-primary transition-colors">
                            <X size={24} />
                        </button>
                    </div>

                    <form onSubmit={handleSubmit} className="flex flex-col flex-grow">
                        <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 overflow-y-auto flex-grow">
                            {/* Column 1: Core Info */}
                            <div className="space-y-4">
                                <h3 className="text-xs font-bold uppercase tracking-wider text-text-tertiary border-b border-outline/10 pb-2">Contact Info</h3>
                                <div>
                                    <label className="block text-xs font-medium text-text-secondary mb-1 ml-1">Vendor Name</label>
                                    <input type="text" name="name" value={formData.name} onChange={handleChange} className={inputClasses} required />
                                </div>
                                
                                <div>
                                    <label className="block text-xs font-medium text-text-secondary mb-1 ml-1">Vendor Type</label>
                                    <select name="vendorType" value={formData.vendorType ?? ''} onChange={handleChange} className={inputClasses}>
                                        <option value="Supplier">Supplier</option>
                                        <option value="Manufacturer">Manufacturer</option>
                                        <option value="Both">Both</option>
                                    </select>
                                </div>

                                {formData.vendorType === 'Manufacturer' && (
                                    <div>
                                        <label className="block text-xs font-medium text-text-secondary mb-1 ml-1">Default Supplier / Distributor</label>
                                        <div className="flex gap-2">
                                            <select name="defaultSupplierId" value={formData.defaultSupplierId ?? ''} onChange={handleSupplierChange} className={inputClasses}>
                                                <option value="">Select a Supplier...</option>
                                                {potentialSuppliers.map(supplier => (
                                                    <option key={supplier.id} value={supplier.id}>{supplier.name}</option>
                                                ))}
                                            </select>
                                            
                                            {formData.defaultSupplierId && (
                                                <button 
                                                    type="button" 
                                                    onClick={handleCopySupplierInfo}
                                                    className="p-3 bg-primary-container text-primary rounded-lg hover:bg-primary hover:text-on-primary transition-all shadow-sm"
                                                    title="Copy Address/Phone/Email from Supplier"
                                                >
                                                    <Copy size={20} />
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                )}
                                
                                <div>
                                    <label className="block text-xs font-medium text-text-secondary mb-1 ml-1">Default Product Type</label>
                                    <select name="defaultProductType" value={formData.defaultProductType ?? ''} onChange={handleChange} className={inputClasses}>
                                        <option value="">None</option>
                                        {PRODUCT_TYPES.map(type => (<option key={type} value={type}>{type}</option>))}
                                    </select>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-medium text-text-secondary mb-1 ml-1 flex items-center gap-1.5"><Globe size={12}/> Website</label>
                                        <input type="url" name="websiteUrl" value={formData.websiteUrl} onChange={handleChange} placeholder="https://..." className={inputClasses} />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-text-secondary mb-1 ml-1 flex items-center gap-1.5"><LinkIcon size={12}/> Portal</label>
                                        <input type="url" name="portalUrl" value={formData.portalUrl} onChange={handleChange} placeholder="https://..." className={inputClasses} />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-xs font-medium text-text-secondary mb-1 ml-1">Main Phone</label>
                                    <input type="tel" name="phone" value={formData.phone} onChange={handleChange} className={inputClasses} />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-text-secondary mb-1 ml-1">Ordering Email</label>
                                    <input type="email" name="orderingEmail" value={formData.orderingEmail} onChange={handleChange} className={inputClasses} />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-text-secondary mb-1 ml-1">Claims Email</label>
                                    <input type="email" name="claimsEmail" value={formData.claimsEmail} onChange={handleChange} className={inputClasses} />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-text-secondary mb-1 ml-1">Address</label>
                                    <textarea name="address" value={formData.address} onChange={handleChange} rows={2} className={inputClasses}></textarea>
                                </div>
                            </div>

                            {/* Column 2: Rep, Shipping, Pricing */}
                            <div className="space-y-6">
                                <div className="space-y-4">
                                    <h3 className="text-xs font-bold uppercase tracking-wider text-text-tertiary border-b border-outline/10 pb-2">Representative</h3>
                                    <div>
                                        <label className="block text-xs font-medium text-text-secondary mb-1 ml-1">Rep Name</label>
                                        <input type="text" name="repName" value={formData.repName} onChange={handleChange} className={inputClasses} />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-text-secondary mb-1 ml-1">Rep Phone</label>
                                        <input type="tel" name="repPhone" value={formData.repPhone} onChange={handleChange} className={inputClasses} />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-text-secondary mb-1 ml-1">Rep Email</label>
                                        <input type="email" name="repEmail" value={formData.repEmail} onChange={handleChange} className={inputClasses} />
                                    </div>
                                </div>
                                
                                <div className="space-y-4">
                                    <h3 className="text-xs font-bold uppercase tracking-wider text-text-tertiary border-b border-outline/10 pb-2">Shipping</h3>
                                    <div>
                                        <label className="block text-xs font-medium text-text-secondary mb-1 ml-1">Shipping Method</label>
                                        <input type="text" name="shippingMethod" value={formData.shippingMethod} placeholder="LTL, UPS, etc." onChange={handleChange} className={inputClasses} />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-text-secondary mb-1 ml-1">Delivery Day</label>
                                        <select name="dedicatedShippingDay" value={formData.dedicatedShippingDay ?? ''} onChange={handleChange} className={inputClasses}>
                                            <option value="">None</option>
                                            {WEEKDAYS.map((day, index) => (<option key={index} value={index}>{day}</option>))}
                                        </select>
                                    </div>
                                </div>

                                <div className="bg-surface-container-low p-4 rounded-xl border border-outline/10 space-y-4">
                                    <h4 className="text-xs font-bold uppercase tracking-wider text-text-tertiary border-b border-outline/10 pb-2">Pricing Overrides</h4>
                                    <div>
                                        <label className="block text-xs font-medium text-text-secondary mb-1 ml-1">Markup %</label>
                                        <input type="number" name="defaultMarkup" value={formData.defaultMarkup ?? ''} placeholder="Use Global" onChange={handleChange} className={inputClasses.replace('bg-surface-container-highest', 'bg-surface-container-high')} />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-text-secondary mb-1 ml-1">Method</label>
                                        <select name="pricingMethod" value={formData.pricingMethod ?? ''} onChange={handleChange} className={inputClasses.replace('bg-surface-container-highest', 'bg-surface-container-high')}>
                                            <option value="">Use Global</option>
                                            <option value="Markup">Markup</option>
                                            <option value="Margin">Margin</option>
                                        </select>
                                    </div>
                                </div>
                            </div>

                            {/* Column 3: Notes */}
                            <div className="space-y-4 flex flex-col h-full">
                                <h3 className="text-xs font-bold uppercase tracking-wider text-text-tertiary border-b border-outline/10 pb-2">Internal Notes</h3>
                                <textarea 
                                    name="notes" 
                                    value={formData.notes} 
                                    onChange={handleChange} 
                                    className={`${inputClasses} flex-grow min-h-[300px] resize-none`}
                                    placeholder="Add any specific details about ordering, shipping windows, or claims processes..."
                                ></textarea>
                            </div>
                        </div>

                        <div className="p-4 border-t border-outline/10 bg-surface-container-low lg:rounded-b-2xl flex justify-end gap-3 shrink-0 sticky bottom-0 z-10 lg:static">
                            {vendorToEdit && currentUser?.roles?.includes('Admin') && (
                                <button
                                    type="button"
                                    onClick={handleDelete}
                                    disabled={isDeleting}
                                    className="py-2 px-6 bg-error-container hover:bg-error/20 text-error rounded-full font-semibold flex items-center gap-2 disabled:opacity-50 transition-colors mr-auto"
                                >
                                    <Trash2 size={16} />
                                    <span>{isDeleting ? 'Deleting...' : 'Delete'}</span>
                                </button>
                            )}
                            <button 
                                type="button" 
                                onClick={onClose} 
                                className="py-2 px-6 bg-surface hover:bg-surface-container-highest border border-outline/20 rounded-full text-text-primary font-medium transition-colors"
                            >
                                Cancel
                            </button>
                            <button 
                                type="submit" 
                                className="py-2 px-6 bg-primary hover:bg-primary-hover rounded-full text-on-primary font-semibold shadow-md transition-all"
                            >
                                {vendorToEdit ? 'Save Changes' : 'Create Vendor'}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default AddEditVendorModal;