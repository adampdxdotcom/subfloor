// components/ProductDetailModal.tsx
import React, { useState, useEffect } from 'react';
import { Product, ProductVariant, PricingSettings, UNITS } from '../types';
import { X, Edit2, QrCode, Trash2, Plus, Image as ImageIcon, Save, Star, Calculator, ExternalLink } from 'lucide-react';
import { useData } from '../context/DataContext';
import { getPricingSettings } from '../services/preferenceService';
import { calculatePrice, getActivePricingRules } from '../utils/pricingUtils';
import { toast } from 'react-hot-toast';
// We reuse ProductForm for editing the parent
import ProductForm from './ProductForm'; 
import VariantGeneratorModal from './VariantGeneratorModal';
import VariantImageModal from './VariantImageModal';

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
    const [showGenerator, setShowGenerator] = useState(false);

    // --- Variant Inline Editing State ---
    const [editingVariantId, setEditingVariantId] = useState<string | null>(null);
    const [newVariant, setNewVariant] = useState<Partial<ProductVariant>>({});
    
    // --- Image Modal State ---
    const [showImageModal, setShowImageModal] = useState(false);
    // Stores the file/url temporarily while editing a row, before the row is saved
    const [pendingImage, setPendingImage] = useState<{ file: File | null, url: string | null, preview: string | null }>({ file: null, url: null, preview: null });

    const [pricingSettings, setPricingSettings] = useState<PricingSettings | null>(null);

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
    
    const handleAddRow = () => {
        const tempId = 'NEW_' + Date.now();
        setEditingVariantId(tempId);
        setNewVariant({
            name: '', 
            size: '', 
            sku: '', 
            unitCost: 0, 
            retailPrice: 0, 
            hasSample: false, // Default off for new variants per request
            cartonSize: 0,
            uom: 'SF'
        });
        setPendingImage({ file: null, url: null, preview: null });
    };

    const handleEditVariant = (variant: ProductVariant) => {
        setNewVariant({
            name: variant.name,
            size: variant.size,
            sku: variant.sku,
            unitCost: variant.unitCost,
            retailPrice: variant.retailPrice,
            hasSample: variant.hasSample,
            cartonSize: variant.cartonSize,
            uom: variant.uom
        });
        setEditingVariantId(variant.id);
        
        // Setup initial image state
        const initialPreview = resolveImageUrl(variant.imageUrl);
        setPendingImage({ file: null, url: null, preview: initialPreview || null });
    };

    const handleCancelEdit = () => {
        setEditingVariantId(null);
        setNewVariant({});
        setPendingImage({ file: null, url: null, preview: null });
    };
    
    const handleDeleteVariant = async (variantId: string) => {
        if(!confirm("Delete this variant?")) return;
        try {
            await deleteVariant(variantId);
            toast.success("Variant deleted.");
        } catch(e) { 
            console.error(e); 
            toast.error(e instanceof Error ? e.message : "Failed to delete variant.");
        }
    };

    const handleCostChange = (costInput: string) => {
        const cost = parseFloat(costInput);
        let newRetail = newVariant.retailPrice || 0;

        // Auto-calc retail if we have settings and a valid cost
        if (!isNaN(cost) && pricingSettings) {
            const manufacturer = vendors.find(v => v.id === activeProduct.manufacturerId);
            const rules = getActivePricingRules(manufacturer, pricingSettings, 'Customer');
            const calculatedRetail = calculatePrice(cost, rules.percentage, rules.method);
            newRetail = Number(calculatedRetail.toFixed(2));
        } else if (costInput === "") {
             newRetail = newVariant.retailPrice; // Don't clear retail if cost input is empty
        }
        
        setNewVariant(prev => ({ ...prev, unitCost: cost, retailPrice: newRetail }));
    };

    const handleSetHeroImage = async (imageUrl: string) => {
        if (!confirm("Use this variant's image as the main photo for the Product Line?")) return;
        const formData = new FormData();
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
        } catch (e) {
            console.error(e);
            toast.error("Failed to update inventory status.");
        }
    };

    // Called when the VariantImageModal saves
    const handleImageUpdate = (file: File | null, url: string | null) => {
        let preview = null;
        if (file) preview = URL.createObjectURL(file);
        else if (url) preview = url;

        setPendingImage({ file, url, preview });
    };

    const handleSaveVariant = async () => {
        if (!newVariant.name) return toast.error("Variant Name (e.g. Color) is required.");
        
        const formData = new FormData();
        
        formData.append('name', newVariant.name);
        if (newVariant.size) formData.append('size', newVariant.size);
        if (newVariant.sku) formData.append('sku', newVariant.sku);
        if (newVariant.unitCost !== undefined) formData.append('unitCost', String(newVariant.unitCost));
        if (newVariant.retailPrice !== undefined) formData.append('retailPrice', String(newVariant.retailPrice));
        if (newVariant.hasSample !== undefined) formData.append('hasSample', String(newVariant.hasSample));
        if (newVariant.cartonSize !== undefined) formData.append('cartonSize', String(newVariant.cartonSize));
        if (newVariant.uom) formData.append('uom', newVariant.uom);
        
        // Handle Image from the pending state
        if (pendingImage.file) {
            formData.append('image', pendingImage.file);
        } else if (pendingImage.url) {
            formData.append('imageUrl', pendingImage.url);
        }

        try {
            if (editingVariantId && !editingVariantId.startsWith('NEW_')) {
                // UPDATE
                await updateVariant(editingVariantId, formData);
                toast.success("Variant updated.");
            } else {
                // CREATE
                await addVariant(activeProduct.id, formData);
                toast.success("Variant created.");
            }
            handleCancelEdit(); // Reset UI
        } catch (e) { 
            console.error(e); 
            toast.error("Failed to save variant.");
        }
    };

    const handleGeneratorSuccess = (newVariants: any[]) => {
        toast.success(`${newVariants.length} variants created!`);
        setShowGenerator(false);
    };

    const handlePrintQr = async (id: string, type: 'product' | 'variant', name: string, subName?: string, sku?: string) => {
        try {
            const endpoint = type === 'product' ? `/api/products/${id}/qr` : `/api/products/variants/${id}/qr`;
            const response = await fetch(endpoint);
            if (!response.ok) throw new Error("Failed to fetch QR code");
            const blob = await response.blob();
            const url = URL.createObjectURL(blob);
            const printWindow = window.open('', '_blank', 'width=400,height=400');
            if (printWindow) {
                printWindow.document.write(`
                    <html><head><title>Print Label</title></head>
                    <body style="display:flex;flex-direction:column;justify-content:center;align-items:center;height:100vh;margin:0;font-family:sans-serif;text-align:center;">
                        <div style="margin-bottom:10px;"><h2 style="margin:0;font-size:18px;">${name}</h2>${subName?`<h3 style="margin:5px 0 0 0;font-size:16px;font-weight:normal;">${subName}</h3>`:''}${sku?`<p style="margin:5px 0 0 0;font-size:12px;color:#555;">SKU: ${sku}</p>`:''}</div>
                        <img src="${url}" style="width:150px;height:150px;" />
                        <div style="margin-top:10px;font-size:10px;color:#888;">Joblogger Inventory</div>
                        <script>window.onload=function(){window.print();setTimeout(function(){window.close();},500);}</script>
                    </body></html>
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
                                            {activeProduct.productLineUrl && (
                                                <a href={activeProduct.productLineUrl} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-xs text-primary mt-1 hover:underline">
                                                    <ExternalLink size={12} /> View Website
                                                </a>
                                            )}
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
                                    {!editingVariantId && (
                                      <div className="flex gap-2">
                                        <button onClick={() => setShowGenerator(true)} className="text-sm flex items-center gap-2 bg-surface hover:bg-surface/80 border border-primary text-primary px-3 py-1.5 rounded transition-colors">
                                            <Calculator size={16} /> Batch
                                        </button>
                                        <button onClick={handleAddRow} className="text-sm flex items-center gap-2 bg-secondary hover:bg-secondary-hover text-on-secondary px-3 py-1.5 rounded transition-colors">
                                            <Plus size={16} /> Add Variant
                                        </button>
                                      </div>
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
                                                <th className="p-3">Packaging</th>
                                                <th className="p-3 text-right">Cost</th>
                                                <th className="p-3 text-right">Retail</th>
                                                <th className="p-3 text-center">Sample?</th>
                                                <th className="p-3 text-center">Status</th>
                                                <th className="p-3 w-24 text-center">Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-border">
                                            
                                            {/* NEW ROW INPUT (If Adding) */}
                                            {editingVariantId?.startsWith('NEW_') && (
                                                <tr className="bg-primary/5 animate-in fade-in">
                                                    <td className="p-2">
                                                        <button onClick={() => setShowImageModal(true)} className="w-10 h-10 bg-surface border border-dashed border-primary/50 rounded flex items-center justify-center hover:bg-primary/10">
                                                            {pendingImage.preview ? <img src={pendingImage.preview} className="w-full h-full object-cover rounded" /> : <ImageIcon size={14} className="text-primary/50" />}
                                                        </button>
                                                    </td>
                                                    <td className="p-2"><input autoFocus type="text" className="w-full p-1 bg-surface border border-primary rounded text-text-primary" placeholder="Name" value={newVariant.name || ''} onChange={e => setNewVariant({...newVariant, name: e.target.value})} /></td>
                                                    <td className="p-2"><input type="text" className="w-full p-1 bg-surface border border-primary rounded text-text-primary" placeholder="Size" value={newVariant.size || ''} onChange={e => setNewVariant({...newVariant, size: e.target.value})} /></td>
                                                    <td className="p-2"><input type="text" className="w-full p-1 bg-surface border border-primary rounded text-text-primary" placeholder="SKU" value={newVariant.sku || ''} onChange={e => setNewVariant({...newVariant, sku: e.target.value})} /></td>
                                                    <td className="p-2">
                                                        <div className="flex gap-1">
                                                            <input type="number" className="w-16 p-1 bg-surface border border-primary rounded text-text-primary" placeholder="Qty" value={newVariant.cartonSize || ''} onChange={e => setNewVariant({...newVariant, cartonSize: parseFloat(e.target.value)})} />
                                                            <select 
                                                                className="w-16 p-1 bg-surface border border-primary rounded text-text-primary text-xs"
                                                                value={newVariant.uom || 'SF'}
                                                                onChange={e => setNewVariant({...newVariant, uom: e.target.value as any})}
                                                            >
                                                                {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                                                            </select>
                                                        </div>
                                                    </td>
                                                    <td className="p-2"><input type="number" className="w-full p-1 bg-surface border border-primary rounded text-text-primary text-right" placeholder="0.00" value={newVariant.unitCost || ''} onChange={e => handleCostChange(e.target.value)} /></td>
                                                    <td className="p-2"><input type="number" className="w-full p-1 bg-surface border border-primary rounded text-text-primary text-right" placeholder="0.00" value={newVariant.retailPrice || ''} onChange={e => setNewVariant({...newVariant, retailPrice: Number(e.target.value)})} /></td>
                                                    <td className="p-2 text-center">
                                                        <input type="checkbox" className="w-5 h-5 accent-primary" checked={newVariant.hasSample || false} onChange={e => setNewVariant({...newVariant, hasSample: e.target.checked})} />
                                                    </td>
                                                    <td className="p-2 text-center text-xs text-primary font-bold">NEW</td>
                                                    <td className="p-2 flex justify-center gap-1">
                                                        <button onClick={handleSaveVariant} className="p-1 text-green-500 hover:bg-green-500/10 rounded"><Save size={18} /></button>
                                                        <button onClick={handleCancelEdit} className="p-1 text-red-500 hover:bg-red-500/10 rounded"><X size={18} /></button>
                                                    </td>
                                                </tr>
                                            )}

                                            {/* EXISTING ROWS */}
                                            {activeProduct.variants.map(v => (
                                                editingVariantId === v.id ? (
                                                    // --- EDIT MODE ROW ---
                                                    <tr key={v.id} className="bg-primary/5">
                                                        <td className="p-2">
                                                            <button onClick={() => setShowImageModal(true)} className="w-10 h-10 bg-surface border border-dashed border-primary/50 rounded flex items-center justify-center hover:bg-primary/10 relative group">
                                                                {pendingImage.preview ? (
                                                                    <img src={pendingImage.preview} className="w-full h-full object-cover rounded opacity-50 group-hover:opacity-100" />
                                                                ) : (
                                                                    <ImageIcon size={14} className="text-primary/50" />
                                                                )}
                                                                <div className="absolute inset-0 flex items-center justify-center text-[8px] font-bold text-text-primary pointer-events-none">EDIT</div>
                                                            </button>
                                                        </td>
                                                        <td className="p-2"><input type="text" className="w-full p-1 bg-surface border border-primary rounded text-text-primary" value={newVariant.name || ''} onChange={e => setNewVariant({...newVariant, name: e.target.value})} /></td>
                                                        <td className="p-2"><input type="text" className="w-full p-1 bg-surface border border-primary rounded text-text-primary" value={newVariant.size || ''} onChange={e => setNewVariant({...newVariant, size: e.target.value})} /></td>
                                                        <td className="p-2"><input type="text" className="w-full p-1 bg-surface border border-primary rounded text-text-primary" value={newVariant.sku || ''} onChange={e => setNewVariant({...newVariant, sku: e.target.value})} /></td>
                                                        <td className="p-2">
                                                            <div className="flex gap-1">
                                                                <input type="number" className="w-16 p-1 bg-surface border border-primary rounded text-text-primary" value={newVariant.cartonSize || ''} onChange={e => setNewVariant({...newVariant, cartonSize: parseFloat(e.target.value)})} />
                                                                <select 
                                                                    className="w-16 p-1 bg-surface border border-primary rounded text-text-primary text-xs"
                                                                    value={newVariant.uom || 'SF'}
                                                                    onChange={e => setNewVariant({...newVariant, uom: e.target.value as any})}
                                                                >
                                                                    {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                                                                </select>
                                                            </div>
                                                        </td>
                                                        <td className="p-2"><input type="number" className="w-full p-1 bg-surface border border-primary rounded text-text-primary text-right" value={newVariant.unitCost || ''} onChange={e => handleCostChange(e.target.value)} /></td>
                                                        <td className="p-2"><input type="number" className="w-full p-1 bg-surface border border-primary rounded text-text-primary text-right" value={newVariant.retailPrice || ''} onChange={e => setNewVariant({...newVariant, retailPrice: Number(e.target.value)})} /></td>
                                                        <td className="p-2 text-center">
                                                             <input type="checkbox" className="w-5 h-5 accent-primary" checked={newVariant.hasSample ?? v.hasSample} onChange={e => setNewVariant({...newVariant, hasSample: e.target.checked})} />
                                                        </td>
                                                        <td className="p-2 text-center text-xs text-text-secondary">Editing...</td>
                                                        <td className="p-2 flex justify-center gap-1">
                                                            <button onClick={handleSaveVariant} className="p-1 text-green-500 hover:bg-green-500/10 rounded"><Save size={18} /></button>
                                                            <button onClick={handleCancelEdit} className="p-1 text-red-500 hover:bg-red-500/10 rounded"><X size={18} /></button>
                                                        </td>
                                                    </tr>
                                                ) : (
                                                    // --- READ MODE ROW ---
                                                    <tr key={v.id} className="hover:bg-surface/50 transition-colors">
                                                        <td className="p-2">
                                                            <div className="w-10 h-10 bg-black/20 rounded overflow-hidden">
                                                                {v.imageUrl ? <img src={resolveImageUrl(v.imageUrl)!} className="w-full h-full object-cover"/> : null}
                                                            </div>
                                                        </td>
                                                        <td className="p-3 font-medium text-text-primary">{v.name}</td>
                                                        <td className="p-3 text-text-secondary">{v.size || '-'}</td>
                                                        <td className="p-3 text-text-secondary">{v.sku || '-'}</td>
                                                        <td className="p-3 text-text-secondary text-xs font-mono">
                                                            {v.cartonSize ? `${v.cartonSize} ${v.uom}` : '-'}
                                                        </td>
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
                                                )
                                            ))}
                                            {activeProduct.variants.length === 0 && !editingVariantId && (
                                                <tr><td colSpan={9} className="p-6 text-center text-text-tertiary">No variants added yet.</td></tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* MODALS */}
                
                {showGenerator && activeProduct.id && (
                    <VariantGeneratorModal 
                        productId={activeProduct.id}
                        manufacturerId={activeProduct.manufacturerId}
                        pricingSettings={pricingSettings}
                        onClose={() => setShowGenerator(false)}
                        onSuccess={handleGeneratorSuccess}
                    />
                )}

                {showImageModal && (
                    <VariantImageModal 
                        currentPreview={pendingImage.preview}
                        onClose={() => setShowImageModal(false)}
                        onSave={handleImageUpdate}
                    />
                )}
            </div>
        </div>
    );
};

export default ProductDetailModal;