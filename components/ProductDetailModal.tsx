import React, { useState, useEffect } from 'react';
import { Product, ProductVariant, PricingSettings } from '../types';
import { X, Edit2, QrCode, Trash2, Plus, Image as ImageIcon, Save, Star } from 'lucide-react';
import { useData } from '../context/DataContext';
import { getPricingSettings } from '../services/preferenceService';
import { calculatePrice, getActivePricingRules } from '../utils/pricingUtils';
import { toast } from 'react-hot-toast';
// We reuse ProductForm for editing the parent
import ProductForm from './ProductForm'; 

const API_URL = "https://flooring.dumbleigh.com"; // Or import from a config file

interface ProductDetailModalProps {
    isOpen: boolean;
    onClose: () => void;
    product: Product;
}

const ProductDetailModal: React.FC<ProductDetailModalProps> = ({ isOpen, onClose, product }) => {
    const { products, vendors, updateProduct, deleteProduct, addVariant, updateVariant, deleteVariant } = useData();
    
    // Get the "Live" version of the product from state so updates appear instantly
    const activeProduct = products.find(p => p.id === product.id) || product;

    const [isEditingParent, setIsEditingParent] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [isAddingVariant, setIsAddingVariant] = useState(false);

    // --- Variant Form State ---
    const [newVariant, setNewVariant] = useState<Partial<ProductVariant>>({});
    const [variantImage, setVariantImage] = useState<File | null>(null);
    const [variantImageUrl, setVariantImageUrl] = useState<string>('');
    const [editingVariantId, setEditingVariantId] = useState<string | null>(null);
    const [pricingSettings, setPricingSettings] = useState<PricingSettings | null>(null);
    const [imageInputType, setImageInputType] = useState<'upload' | 'url'>('upload');

    useEffect(() => {
        if (isOpen) {
            getPricingSettings().then(setPricingSettings).catch(console.error);
        }
    }, [isOpen]);

    if (!isOpen) return null;
    
    const resolveImageUrl = (path?: string | null) => {
        if (!path) return null;
        if (path.startsWith('http')) return path;
        return `${API_URL}${path}`;
    };

    const handleSaveParent = async (formData: FormData) => {
        setIsSaving(true);
        try {
            await updateProduct(activeProduct.id, formData);
            setIsEditingParent(false);
        } catch (error) {
            console.error(error);
        } finally {
            setIsSaving(false);
        }
    };

    const handleDeleteParent = async () => {
        if (confirm(`Delete "${activeProduct.name}" and ALL its variants? This cannot be undone.`)) {
            try {
                await deleteProduct(activeProduct.id);
                onClose();
            } catch (e) { console.error(e); }
        }
    };

    // --- VARIANT HANDLERS ---
    
    const handleEditVariant = (variant: ProductVariant) => {
        setNewVariant(variant);
        setEditingVariantId(variant.id);
        // If existing image is a URL (not a blob), set it
        if (variant.imageUrl && variant.imageUrl.startsWith('http')) {
             setVariantImageUrl(variant.imageUrl);
             setImageInputType('url');
        } else {
             setVariantImageUrl('');
             setImageInputMode('upload');
        }
        setIsAddingVariant(true); // Re-use the add form UI
    };
    
    // Note: deleteVariant needs to be added to DataContext context first, 
    // but for now we can just implement the UI stub or skip it.
    const handleDeleteVariant = async (variantId: string) => {
        if(!confirm("Delete this variant?")) return;
        try {
            await deleteVariant(variantId, activeProduct.id);
        } catch(e) { console.error(e); }
    };

    const handleCostChange = (cost: number) => {
        // Auto-calc retail if we have settings
        if (pricingSettings) {
            // 1. Find the Vendor object for this product
            const manufacturer = vendors.find(v => v.id === activeProduct.manufacturerId);
            
            // 2. Get Rules (Vendor override or Global default)
            const rules = getActivePricingRules(manufacturer, pricingSettings, 'Customer');
            
            // 3. Calculate
            const calculatedRetail = calculatePrice(cost, rules.percentage, rules.method);
            
            // 4. Update State
            setNewVariant(prev => ({ ...prev, unitCost: cost, retailPrice: Number(calculatedRetail.toFixed(2)) }));
        } else {
            setNewVariant(prev => ({ ...prev, unitCost: cost }));
        }
    };

    const handleSetHeroImage = async (imageUrl: string) => {
        if (!confirm("Use this variant's image as the main photo for the Product Line?")) return;
        
        const formData = new FormData();
        // If it's a local path (/uploads/...), the backend just saves the string.
        // If it's a remote URL (http...), the backend downloads it.
        formData.append('defaultImageUrl', imageUrl);
        
        try {
            await updateProduct(activeProduct.id, formData);
            toast.success("Main product image updated!");
        } catch (e) {
            console.error(e);
            toast.error("Failed to update main image.");
        }
    };

    const handleToggleSampleInventory = async (variant: ProductVariant) => {
        try {
            const formData = new FormData();
            formData.append('hasSample', String(!variant.hasSample));
            await updateVariant(variant.id, formData);
            // Toast is handled in context
        } catch (e) {
            console.error(e);
            toast.error("Failed to update inventory status.");
        }
    };

    const handleSaveVariant = async () => {
        if (!newVariant.name) return toast.error("Variant Name (e.g. Color) is required.");
        
        const formData = new FormData();
        
        // Append all common fields
        formData.append('name', newVariant.name);
        if (newVariant.size) formData.append('size', newVariant.size);
        if (newVariant.finish) formData.append('finish', newVariant.finish);
        if (newVariant.style) formData.append('style', newVariant.style);
        if (newVariant.sku) formData.append('sku', newVariant.sku);
        if (newVariant.unitCost) formData.append('unitCost', String(newVariant.unitCost));
        if (newVariant.retailPrice) formData.append('retailPrice', String(newVariant.retailPrice));
        if (newVariant.uom) formData.append('uom', newVariant.uom);
        if (newVariant.cartonSize) formData.append('cartonSize', String(newVariant.cartonSize));
        
        // Logic for optional image update
        if (imageInputType === 'upload' && variantImage) {
            formData.append('image', variantImage);
        } else if (imageInputType === 'url' && variantImageUrl) {
            formData.append('imageUrl', variantImageUrl);
        }

        if (editingVariantId) {
            // --- EDIT MODE ---
            try {
                await updateVariant(editingVariantId, formData);
                setIsAddingVariant(false);
                setEditingVariantId(null);
                setNewVariant({});
                setVariantImage(null);
                setVariantImageUrl('');
            } catch(e) { console.error(e); }
            return;
        }

        // --- ADD MODE ---
        try {
            await addVariant(activeProduct.id, formData);
            setIsAddingVariant(false);
            setNewVariant({});
            setVariantImage(null);
            setVariantImageUrl('');
        } catch (e) { console.error(e); }
    };

    const handlePrintQr = async (id: string, type: 'product' | 'variant', name: string, subName?: string, sku?: string) => {
        try {
            // Fetch the QR code blob from the correct endpoint
            const endpoint = type === 'product' ? `/api/products/${id}/qr` : `/api/products/variants/${id}/qr`;
            const response = await fetch(endpoint);
            if (!response.ok) throw new Error("Failed to fetch QR code");
            
            const blob = await response.blob();
            const url = URL.createObjectURL(blob);
            
            // Open print window with enhanced layout
            const printWindow = window.open('', '_blank', 'width=400,height=400');
            if (printWindow) {
                printWindow.document.write(`
                    <html>
                        <head><title>Print Label</title></head>
                        <body style="display:flex; flex-direction:column; justify-content:center; align-items:center; height:100vh; margin:0; font-family:sans-serif; text-align:center;">
                            
                            <div style="margin-bottom: 10px;">
                                <h2 style="margin:0; font-size:18px;">${name}</h2>
                                ${subName ? `<h3 style="margin:5px 0 0 0; font-size:16px; font-weight:normal;">${subName}</h3>` : ''}
                                ${sku ? `<p style="margin:5px 0 0 0; font-size:12px; color:#555;">SKU: ${sku}</p>` : ''}
                            </div>
                            
                            <img src="${url}" style="width:150px; height:150px;" />
                            
                            <div style="margin-top: 10px; font-size: 10px; color: #888;">
                                Joblogger Inventory
                            </div>

                            <script>window.onload = function() { window.print(); setTimeout(function(){ window.close(); }, 500); }</script>
                        </body>
                    </html>
                `);
                printWindow.document.close();
            }
        } catch (e) {
            console.error(e);
            toast.error("Failed to generate QR code.");
        }
    };

    return (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
            <div className="bg-surface w-full max-w-5xl max-h-[90vh] rounded-xl shadow-2xl flex flex-col overflow-hidden">
                
                {/* HEADER */}
                <div className="p-4 border-b border-border flex justify-between items-center bg-background">
                    <h2 className="text-xl font-bold text-text-primary flex items-center gap-2">
                        {isEditingParent ? 'Edit Product Line' : activeProduct.name}
                        {!isEditingParent && activeProduct.isDiscontinued && (
                             <span className="text-xs bg-red-900/50 text-red-200 px-2 py-0.5 rounded">DISCONTINUED</span>
                        )}
                    </h2>
                    <div className="flex items-center gap-2">
                        {!isEditingParent && (
                            <>
                                <button onClick={() => handlePrintQr(activeProduct.id, 'product', activeProduct.name)} className="p-2 hover:bg-surface rounded text-text-secondary hover:text-primary" title="Print Product Line QR">
                                    <QrCode size={18} />
                                </button>
                                <button onClick={() => setIsEditingParent(true)} className="p-2 hover:bg-surface rounded text-text-secondary hover:text-primary" title="Edit Product Details">
                                    <Edit2 size={18} />
                                </button>
                                <button onClick={handleDeleteParent} className="p-2 hover:bg-surface rounded text-text-secondary hover:text-red-500" title="Delete Entire Product Line">
                                    <Trash2 size={18} />
                                </button>
                            </>
                        )}
                        <button onClick={onClose} className="p-2 hover:bg-surface rounded text-text-secondary hover:text-text-primary">
                            <X size={24} />
                        </button>
                    </div>
                </div>

                {/* BODY */}
                <div className="flex-1 overflow-y-auto p-6">
                    
                    {isEditingParent ? (
                        <ProductForm 
                            initialData={activeProduct} 
                            onSave={handleSaveParent} 
                            onCancel={() => setIsEditingParent(false)} 
                            isSaving={isSaving} 
                        />
                    ) : (
                        <div className="space-y-8">
                            {/* 1. PARENT INFO CARD */}
                            <div className="flex flex-col md:flex-row gap-6">
                                <div className="w-48 h-48 bg-black/20 rounded-lg flex-shrink-0 overflow-hidden border border-border">
                                    {activeProduct.defaultImageUrl ? (
                                        <img src={resolveImageUrl(activeProduct.defaultImageUrl)!} alt={activeProduct.name} className="w-full h-full object-cover" />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center text-text-tertiary">No Image</div>
                                    )}
                                </div>
                                <div className="flex-1 space-y-2">
                                    <div className="grid grid-cols-2 gap-4 text-sm">
                                        <div>
                                            <span className="block text-text-secondary text-xs uppercase tracking-wide">Manufacturer</span>
                                            <span className="font-medium text-text-primary">{activeProduct.manufacturerName}</span>
                                        </div>
                                        <div>
                                            <span className="block text-text-secondary text-xs uppercase tracking-wide">Product Type</span>
                                            <span className="font-medium text-text-primary">{activeProduct.productType}</span>
                                        </div>
                                        <div className="col-span-2">
                                            <span className="block text-text-secondary text-xs uppercase tracking-wide">Description</span>
                                            <p className="text-text-primary mt-1">{activeProduct.description || 'No description provided.'}</p>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* 2. VARIANTS TABLE */}
                            <div>
                                <div className="flex justify-between items-end mb-4">
                                    <h3 className="text-lg font-bold text-text-primary">Product Variants</h3>
                                    {!isAddingVariant && (
                                        <button onClick={() => setIsAddingVariant(true)} className="text-sm flex items-center gap-2 bg-secondary hover:bg-secondary-hover text-on-secondary px-3 py-1.5 rounded transition-colors">
                                            <Plus size={16} /> Add Variant
                                        </button>
                                    )}
                                </div>

                                <div className="bg-background rounded-lg border border-border overflow-hidden">
                                    <table className="w-full text-sm text-left">
                                        <thead className="bg-surface text-text-secondary border-b border-border">
                                            <tr>
                                                <th className="p-3 w-16">Img</th>
                                                <th className="p-3">Variant / Color</th>
                                                <th className="p-3">Size</th>
                                                <th className="p-3">SKU</th>
                                                <th className="p-3 text-right">Cost</th>
                                                <th className="p-3 text-right">Retail</th>
                                                <th className="p-3 text-center">Sample?</th>
                                                <th className="p-3 text-center">Status</th>
                                                <th className="p-3 w-24 text-center">Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-border">
                                            {activeProduct.variants.map(v => (
                                                <tr key={v.id} className="hover:bg-surface/50 transition-colors">
                                                    <td className="p-2">
                                                        <div className="w-10 h-10 bg-black/20 rounded overflow-hidden">
                                                            {v.imageUrl ? <img src={resolveImageUrl(v.imageUrl)!} className="w-full h-full object-cover"/> : null}
                                                        </div>
                                                    </td>
                                                    <td className="p-3 font-medium text-text-primary">{v.name}</td>
                                                    <td className="p-3 text-text-secondary">{v.size || '-'}</td>
                                                    <td className="p-3 text-text-secondary">{v.sku || '-'}</td>
                                                    <td className="p-3 text-right text-text-secondary">{v.unitCost ? `$${Number(v.unitCost).toFixed(2)}` : '-'}</td>
                                                    <td className="p-3 text-right text-green-400 font-medium">{v.retailPrice ? `$${Number(v.retailPrice).toFixed(2)}` : '-'}</td>
                                                    <td className="p-3 text-center">
                                                        <button 
                                                            onClick={() => handleToggleSampleInventory(v)}
                                                            className={`w-10 h-5 rounded-full transition-colors relative flex items-center ${v.hasSample ? 'bg-green-500' : 'bg-gray-600'}`}
                                                            title={v.hasSample ? "Sample in Library" : "No Sample (Order Only)"}
                                                        >
                                                            <div className={`absolute w-4 h-4 bg-white rounded-full shadow-sm transition-transform duration-200 ${v.hasSample ? 'translate-x-5' : 'translate-x-1'}`} />
                                                        </button>
                                                    </td>
                                                    <td className="p-3 text-center">
                                                        {!v.hasSample && !v.isMaster ? (
                                                            <span className="text-text-tertiary text-xs italic">Order Only</span>
                                                        ) : (v.activeCheckouts || 0) > 0 ? (
                                                            <span className="px-2 py-1 text-xs font-bold bg-orange-500/20 text-orange-400 rounded-full">
                                                                {v.activeCheckouts} Out
                                                            </span>
                                                        ) : (
                                                            <span className="text-green-400 text-xs font-medium">Available</span>
                                                        )}
                                                    </td>
                                                    <td className="p-3 flex justify-center gap-2">
                                                        {v.imageUrl && (
                                                            <button onClick={() => handleSetHeroImage(v.imageUrl!)} title="Set as Main Product Image" className="text-text-secondary hover:text-yellow-400">
                                                                <Star size={16} />
                                                            </button>
                                                        )}
                                                        <button onClick={() => handlePrintQr(v.id, 'variant', activeProduct.name, v.name, v.sku || undefined)} title="Print QR" className="text-text-secondary hover:text-primary"><QrCode size={16} /></button>
                                                        <button onClick={() => handleEditVariant(v)} title="Edit" className="text-text-secondary hover:text-primary"><Edit2 size={16} /></button>
                                                        <button onClick={() => handleDeleteVariant(v.id)} title="Delete" className="text-text-secondary hover:text-red-500"><Trash2 size={16} /></button>
                                                    </td>
                                                </tr>
                                            ))}
                                            {activeProduct.variants.length === 0 && (
                                                <tr><td colSpan={9} className="p-6 text-center text-text-tertiary">No variants added yet.</td></tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>

                                {/* INLINE ADD FORM */}
                                {isAddingVariant && (
                                    <div className="mt-4 p-4 bg-surface border border-border rounded-lg animate-in fade-in slide-in-from-top-2">
                                        <h4 className="font-bold text-text-primary mb-3">{editingVariantId ? 'Edit Variant' : 'New Variant'}</h4>
                                        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-start">
                                            <div className="col-span-2">
                                                <input type="text" placeholder="Variant Name (e.g. Red)" className="w-full p-2 rounded border border-border bg-background text-text-primary" value={newVariant.name || ''} onChange={e => setNewVariant({...newVariant, name: e.target.value})} />
                                            </div>
                                            <div>
                                                <input type="text" placeholder="Size (e.g. 12x24)" className="w-full p-2 rounded border border-border bg-background text-text-primary" value={newVariant.size || ''} onChange={e => setNewVariant({...newVariant, size: e.target.value})} />
                                            </div>
                                            
                                            {/* IMAGE INPUT */}
                                            <div className="col-span-1">
                                                <div className="flex gap-2 mb-1 text-xs">
                                                    <button onClick={() => setImageInputType('upload')} className={`pb-0.5 ${imageInputType === 'upload' ? 'text-primary font-bold border-b-2 border-primary' : 'text-text-secondary'}`}>Upload</button>
                                                    <button onClick={() => setImageInputType('url')} className={`pb-0.5 ${imageInputType === 'url' ? 'text-primary font-bold border-b-2 border-primary' : 'text-text-secondary'}`}>URL</button>
                                                </div>
                                                {imageInputType === 'upload' ? (
                                                    <div className="relative group">
                                                        <input type="file" accept="image/*" onChange={e => setVariantImage(e.target.files?.[0] || null)} className="hidden" id="variant-img-upload" />
                                                        <label htmlFor="variant-img-upload" className="flex items-center gap-2 px-3 py-2 border border-dashed border-border rounded cursor-pointer hover:bg-surface hover:border-primary text-text-secondary text-sm truncate">
                                                            <ImageIcon size={16} />
                                                            <span className="truncate">{variantImage ? variantImage.name : "Choose File"}</span>
                                                        </label>
                                                    </div>
                                                ) : (
                                                    <input 
                                                        type="text" 
                                                        placeholder="https://..." 
                                                        value={variantImageUrl} 
                                                        onChange={e => setVariantImageUrl(e.target.value)}
                                                        className="w-full p-2 rounded border border-border bg-background text-text-primary text-sm"
                                                    />
                                                )}
                                            </div>

                                            <div>
                                                <input type="number" placeholder="Cost" className="w-full p-2 rounded border border-border bg-background text-text-primary" value={newVariant.unitCost || ''} onChange={e => handleCostChange(Number(e.target.value))} />
                                            </div>
                                             <div>
                                                <input type="number" placeholder="Retail" className="w-full p-2 rounded border border-border bg-background text-text-primary" value={newVariant.retailPrice || ''} onChange={e => setNewVariant({...newVariant, retailPrice: Number(e.target.value)})} />
                                            </div>
                                        </div>
                                        <div className="flex justify-end gap-3 mt-3">
                                            <button onClick={() => { setIsAddingVariant(false); setEditingVariantId(null); setNewVariant({}); setVariantImage(null); setVariantImageUrl(''); }} className="px-3 py-1 text-text-secondary hover:text-text-primary">Cancel</button>
                                            <button onClick={handleSaveVariant} className="px-4 py-1 bg-primary hover:bg-primary-hover text-on-primary rounded font-bold flex items-center gap-2">
                                                <Save size={16} /> Save Variant
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ProductDetailModal;