import React, { useState, useEffect } from 'react';
import { useData } from '../context/DataContext';
import { Save, X, Plus, Trash2, Upload } from 'lucide-react';
import { Product, PRODUCT_TYPES, ProductVariant, Vendor } from '../types';
import { toast } from 'react-hot-toast';
import CreatableSelect from 'react-select/creatable';
import AddEditVendorModal from './AddEditVendorModal';

export interface ProductFormData {
    manufacturerId: number | null;
    supplierId: number | null;
    name: string;
    productType: string;
    description: string;
    productLineUrl: string;
    // Variants are handled separately in the backend, but for creation we might batch them
    initialVariants: Partial<ProductVariant>[];
}

interface ProductFormProps {
    initialData?: Product;
    onSave: (formData: FormData) => Promise<void>;
    onCancel: () => void;
    isSaving: boolean;
}

const ProductForm: React.FC<ProductFormProps> = ({ initialData, onSave, onCancel, isSaving }) => {
    const { vendors, addVendor } = useData();
    const [name, setName] = useState(initialData?.name || '');
    const [manufacturerId, setManufacturerId] = useState<number | ''>(initialData?.manufacturerId || '');
    const [supplierId, setSupplierId] = useState<number | ''>(initialData?.supplierId || '');
    const [productType, setProductType] = useState(initialData?.productType || PRODUCT_TYPES[0]);
    const [description, setDescription] = useState(initialData?.description || '');
    const [productLineUrl, setProductLineUrl] = useState(initialData?.productLineUrl || '');
    const [hasMasterBoard, setHasMasterBoard] = useState(initialData?.variants?.some(v => v.isMaster) || false);
    
    // Image handling
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [defaultImageUrl, setDefaultImageUrl] = useState<string>('');
    const [imageInputType, setImageInputType] = useState<'upload' | 'url'>('upload');
    const [previewUrl, setPreviewUrl] = useState<string | null>(initialData?.defaultImageUrl || null);

    // Vendor Modal State
    const [isVendorModalOpen, setIsVendorModalOpen] = useState(false);
    const [pendingVendorName, setPendingVendorName] = useState('');
    const [targetVendorField, setTargetVendorField] = useState<'manufacturer' | 'supplier' | null>(null);

    // Effect to set initial URL if provided
    useEffect(() => {
        if (initialData?.defaultImageUrl && initialData.defaultImageUrl.startsWith('http')) {
            setDefaultImageUrl(initialData.defaultImageUrl);
            setImageInputType('url');
        }
    }, [initialData?.defaultImageUrl]);


    // Helper to format vendors for React-Select
    const vendorOptions = (type: 'Manufacturer' | 'Supplier') => 
        vendors
            .filter(v => v.vendorType === type || v.vendorType === 'Both')
            .map(v => ({ value: v.id, label: v.name }));

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files?.[0]) {
            setSelectedFile(e.target.files[0]);
            setPreviewUrl(URL.createObjectURL(e.target.files[0]));
            setDefaultImageUrl(''); // Clear URL if uploading a file
        }
    };

    // --- Handle New Vendor Creation ---
    const handleCreateVendorOption = (inputValue: string, field: 'manufacturer' | 'supplier') => {
        setPendingVendorName(inputValue);
        setTargetVendorField(field);
        setIsVendorModalOpen(true);
    };

    const handleSaveNewVendor = async (vendorData: Omit<Vendor, 'id'>) => {
        try {
            // Force the type based on which field triggered it
            const finalVendorData = { 
                ...vendorData, 
                vendorType: targetVendorField === 'manufacturer' ? 'Manufacturer' : 'Supplier' 
            };
            
            // The addVendor function in context refreshes the list via side effect.
            await addVendor(finalVendorData as any); 
            
            // NOTE: Due to addVendor refreshing the entire list via side effect in DataContext, 
            // the state `vendors` will update, and React-Select will rebuild.
            // A perfect solution would be to return the ID from the context function and set it here.
            
            setIsVendorModalOpen(false);
            setTargetVendorField(null);
        } catch (error) {
            console.error(error);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!name || !manufacturerId) {
            toast.error("Name and Manufacturer are required.");
            return;
        }

        const formData = new FormData();
        formData.append('name', name);
        formData.append('manufacturerId', String(manufacturerId));
        if (supplierId) formData.append('supplierId', String(supplierId));
        formData.append('productType', productType);
        formData.append('description', description);
        formData.append('productLineUrl', productLineUrl);
        formData.append('hasMasterBoard', String(hasMasterBoard));
        
        if (imageInputType === 'upload' && selectedFile) {
            formData.append('image', selectedFile);
        } else if (imageInputType === 'url' && defaultImageUrl) {
            formData.append('defaultImageUrl', defaultImageUrl);
        }

        await onSave(formData);
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* LEFT COLUMN: Image & Basic Info */}
                <div className="space-y-4">
                    <div className="w-full aspect-video bg-background border-2 border-dashed border-border rounded-lg flex items-center justify-center relative overflow-hidden group">
                        {previewUrl ? (
                            <img src={previewUrl} alt="Preview" className="w-full h-full object-cover" />
                        ) : (
                            <span className="text-text-secondary">Default Product Image</span>
                        )}
                        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                             {imageInputType === 'upload' ? (
                                 <label className="cursor-pointer bg-white text-black px-4 py-2 rounded-full text-sm font-bold flex items-center gap-2">
                                    <Upload size={16} /> Change File
                                    <input type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
                                 </label>
                             ) : null}
                        </div>
                    </div>

                    {/* Image Input Toggle */}
                    <div className="flex gap-4 text-sm">
                         <label className="flex items-center gap-2 cursor-pointer">
                             <input type="radio" name="imgType" checked={imageInputType === 'upload'} onChange={() => setImageInputType('upload')} />
                             Upload File
                         </label>
                         <label className="flex items-center gap-2 cursor-pointer">
                             <input type="radio" name="imgType" checked={imageInputType === 'url'} onChange={() => setImageInputType('url')} />
                             Paste URL
                         </label>
                    </div>
                    
                    {imageInputType === 'url' && (
                        <input 
                            type="text" 
                            placeholder="https://manufacturer.com/image.jpg" 
                            value={defaultImageUrl} 
                            onChange={e => {
                                setDefaultImageUrl(e.target.value);
                                setPreviewUrl(e.target.value); // Live preview
                            }} 
                            className="w-full p-2 bg-surface border border-border rounded text-text-primary text-sm" 
                        />
                    )}
                    
                    <div>
                        <label className="block text-sm font-medium text-text-secondary mb-1">Product Line Name *</label>
                        <input type="text" required value={name} onChange={e => setName(e.target.value)} className="w-full p-2 bg-surface border border-border rounded text-text-primary" placeholder="e.g. Forever Oak Collection" />
                    </div>
                </div>

                {/* RIGHT COLUMN: Logistics */}
                <div className="space-y-4">
                     <div>
                        <label className="block text-sm font-medium text-text-secondary mb-1">Manufacturer</label>
                        <CreatableSelect
                            isClearable
                            options={vendorOptions('Manufacturer')}
                            value={manufacturerId ? vendorOptions('Manufacturer').find(o => o.value === manufacturerId) : null}
                            onChange={(opt) => setManufacturerId(opt ? opt.value : '')}
                            onCreateOption={(val) => handleCreateVendorOption(val, 'manufacturer')}
                            className="react-select-container"
                            classNamePrefix="react-select"
                            placeholder="Select or Create Manufacturer..."
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-text-secondary mb-1">Preferred Supplier</label>
                        <CreatableSelect
                            isClearable
                            options={vendorOptions('Supplier')}
                            value={supplierId ? vendorOptions('Supplier').find(o => o.value === supplierId) : null}
                            onChange={(opt) => setSupplierId(opt ? opt.value : '')}
                            onCreateOption={(val) => handleCreateVendorOption(val, 'supplier')}
                            className="react-select-container"
                            classNamePrefix="react-select"
                            placeholder="Select or Create Supplier..."
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-text-secondary mb-1">Product Type *</label>
                        <select value={productType} onChange={e => setProductType(e.target.value)} className="w-full p-2 bg-surface border border-border rounded text-text-primary">
                            {PRODUCT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-text-secondary mb-1">Website URL</label>
                        <input type="url" value={productLineUrl} onChange={e => setProductLineUrl(e.target.value)} className="w-full p-2 bg-surface border border-border rounded text-text-primary" placeholder="https://manufacturer.com/product" />
                    </div>
                    
                    {/* MASTER BOARD TOGGLE */}
                    <div className="flex items-center gap-2 pt-4">
                        <input type="checkbox" id="masterBoard" checked={hasMasterBoard} onChange={e => setHasMasterBoard(e.target.checked)} className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary" />
                        <label htmlFor="masterBoard" className="text-sm font-medium text-text-primary cursor-pointer">Inventory includes a "Master Board" / Strap Set?</label>
                    </div>
                </div>
            </div>

            <div>
                <label className="block text-sm font-medium text-text-secondary mb-1">Description / Notes</label>
                <textarea value={description} onChange={e => setDescription(e.target.value)} className="w-full p-2 bg-surface border border-border rounded text-text-primary h-24" />
            </div>

            <div className="flex justify-end gap-4 pt-4 border-t border-border">
                <button type="button" onClick={onCancel} className="px-4 py-2 text-text-secondary hover:text-text-primary">Cancel</button>
                <button type="submit" disabled={isSaving} className="px-6 py-2 bg-primary hover:bg-primary-hover text-on-primary rounded font-bold flex items-center gap-2">
                    {isSaving ? 'Saving...' : <><Save size={18} /> Save Product Line</>}
                </button>
            </div>
            
            {isVendorModalOpen && (
                <AddEditVendorModal
                    isOpen={isVendorModalOpen}
                    onClose={() => setIsVendorModalOpen(false)}
                    initialData={{ name: pendingVendorName, vendorType: targetVendorField === 'manufacturer' ? 'Manufacturer' : 'Supplier' } as Vendor}
                    onSave={handleSaveNewVendor}
                />
            )}
        </form>
    );
};

export default ProductForm;