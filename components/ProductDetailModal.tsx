// components/ProductDetailModal.tsx
import React, { useState, useEffect, useMemo } from 'react';
import { Product, ProductVariant, PricingSettings, UNITS } from '../types';
import { X, Edit2, QrCode, Trash2, Plus, Image as ImageIcon, Save, Star, Calculator, ExternalLink, Copy, CheckSquare, Square } from 'lucide-react';
import { useData } from '../context/DataContext';
import { useProductMutations } from '../hooks/useProducts'; // Need new hook for batch
import { getPricingSettings } from '../services/preferenceService';
import { calculatePrice, getActivePricingRules } from '../utils/pricingUtils';
import { toast } from 'react-hot-toast';
import ProductForm from './ProductForm'; 
import VariantGeneratorModal from './VariantGeneratorModal';
import VariantImageModal from './VariantImageModal';

const API_URL = "";

interface ProductDetailModalProps {
    isOpen: boolean;
    onClose: () => void;
    product: Product;
}

const ProductDetailModal: React.FC<ProductDetailModalProps> = ({ isOpen, onClose, product }) => {
    const { products, vendors, updateProduct, deleteProduct, addVariant, updateVariant, deleteVariant } = useData();
    const { batchUpdateVariants } = useProductMutations(); // NEW HOOK

    const activeProduct = products.find(p => p.id === product.id) || product;

    const [isEditingParent, setIsEditingParent] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [showGenerator, setShowGenerator] = useState(false);

    // --- Variant Inline Editing State ---
    const [editingVariantId, setEditingVariantId] = useState<string | null>(null);
    const [newVariant, setNewVariant] = useState<Partial<ProductVariant>>({});
    
    // --- BATCH MODE STATE ---
    const [isBatchMode, setIsBatchMode] = useState(false);
    const [selectedRowIds, setSelectedRowIds] = useState<Set<string>>(new Set());
    const [selectedColumns, setSelectedColumns] = useState<Set<string>>(new Set(['unitCost', 'retailPrice'])); // Default to pricing

    // --- Image Modal State ---
    const [showImageModal, setShowImageModal] = useState(false);
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
        } catch (error) { console.error(error); } finally { setIsSaving(false); }
    };

    const handleDeleteParent = async () => {
        if (confirm(`Delete "${activeProduct.name}" and ALL its variants?`)) {
            try { await deleteProduct(activeProduct.id); onClose(); } catch (e) { console.error(e); }
        }
    };

    // --- BATCH HELPERS ---
    const toggleBatchMode = () => {
        if (isBatchMode) {
            // Cancel Batch
            setIsBatchMode(false);
            setSelectedRowIds(new Set());
        } else {
            // Start Batch - Select All by default logic or none? Let's do none for safety.
            setIsBatchMode(true);
            setSelectedRowIds(new Set()); 
        }
    };

    const toggleRowSelection = (id: string) => {
        setSelectedRowIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const toggleAllRows = () => {
        // If all selected (minus the one being edited), deselect all. Otherwise select all.
        const selectableIds = activeProduct.variants.filter(v => v.id !== editingVariantId).map(v => v.id);
        const allSelected = selectableIds.every(id => selectedRowIds.has(id));
        
        if (allSelected) {
            setSelectedRowIds(new Set());
        } else {
            setSelectedRowIds(new Set(selectableIds));
        }
    };

    const toggleColumnSelection = (col: string) => {
        setSelectedColumns(prev => {
            const next = new Set(prev);
            if (next.has(col)) next.delete(col);
            else next.add(col);
            return next;
        });
    };

    // --- VARIANT HANDLERS ---
    
    const handleAddRow = () => {
        const tempId = 'NEW_' + Date.now();
        setEditingVariantId(tempId);
        setIsBatchMode(false); // Can't batch from a new unsaved row easily
        setNewVariant({ name: '', size: '', sku: '', unitCost: 0, retailPrice: 0, hasSample: false, cartonSize: 0, uom: 'SF' });
        setPendingImage({ file: null, url: null, preview: null });
    };

    const handleEditVariant = (variant: ProductVariant) => {
        setNewVariant({
            name: variant.name, size: variant.size, sku: variant.sku,
            unitCost: variant.unitCost, retailPrice: variant.retailPrice,
            hasSample: variant.hasSample, cartonSize: variant.cartonSize, uom: variant.uom
        });
        setEditingVariantId(variant.id);
        const initialPreview = resolveImageUrl(variant.imageUrl);
        setPendingImage({ file: null, url: null, preview: initialPreview || null });
        
        // Reset Batch Mode when entering edit
        setIsBatchMode(false);
        setSelectedRowIds(new Set());
    };

    const handleCancelEdit = () => {
        setEditingVariantId(null);
        setNewVariant({});
        setPendingImage({ file: null, url: null, preview: null });
        setIsBatchMode(false);
    };
    
    const handleDeleteVariant = async (variantId: string) => {
        if(!confirm("Delete this variant?")) return;
        try { await deleteVariant(variantId); toast.success("Variant deleted."); } 
        catch(e) { toast.error("Failed to delete variant."); }
    };

    const handleCostChange = (costInput: string) => {
        const cost = parseFloat(costInput);
        let newRetail = newVariant.retailPrice || 0;
        if (!isNaN(cost) && pricingSettings) {
            const manufacturer = vendors.find(v => v.id === activeProduct.manufacturerId);
            const rules = getActivePricingRules(manufacturer, pricingSettings, 'Customer');
            newRetail = Number(calculatePrice(cost, rules.percentage, rules.method).toFixed(2));
        } else if (costInput === "") { newRetail = newVariant.retailPrice; }
        setNewVariant(prev => ({ ...prev, unitCost: cost, retailPrice: newRetail }));
    };

    const handleSetHeroImage = async (imageUrl: string) => {
        if (!confirm("Use this image as main product photo?")) return;
        const formData = new FormData();
        formData.append('defaultImageUrl', imageUrl);
        try { await updateProduct(activeProduct.id, formData); toast.success("Main image updated!"); } 
        catch (e) { toast.error("Failed to update."); }
    };

    const handleToggleSampleInventory = async (variant: ProductVariant) => {
        try {
            const formData = new FormData();
            formData.append('hasSample', String(!variant.hasSample));
            await updateVariant(variant.id, formData);
        } catch (e) { console.error(e); }
    };

    const handleImageUpdate = (file: File | null, url: string | null) => {
        let preview = null;
        if (file) preview = URL.createObjectURL(file);
        else if (url) preview = url;
        setPendingImage({ file, url, preview });
    };

    const handleSaveVariant = async () => {
        if (!newVariant.name) return toast.error("Name is required.");
        
        // 1. Single Update (Current Row)
        const formData = new FormData();
        formData.append('name', newVariant.name);
        if (newVariant.size) formData.append('size', newVariant.size);
        if (newVariant.sku) formData.append('sku', newVariant.sku);
        if (newVariant.unitCost !== undefined) formData.append('unitCost', String(newVariant.unitCost));
        if (newVariant.retailPrice !== undefined) formData.append('retailPrice', String(newVariant.retailPrice));
        if (newVariant.hasSample !== undefined) formData.append('hasSample', String(newVariant.hasSample));
        if (newVariant.cartonSize !== undefined) formData.append('cartonSize', String(newVariant.cartonSize));
        if (newVariant.uom) formData.append('uom', newVariant.uom);
        
        if (pendingImage.file) formData.append('image', pendingImage.file);
        else if (pendingImage.url) formData.append('imageUrl', pendingImage.url);

        try {
            if (editingVariantId && !editingVariantId.startsWith('NEW_')) {
                await updateVariant(editingVariantId, formData);
                
                // 2. BATCH UPDATE (If enabled)
                if (isBatchMode && selectedRowIds.size > 0) {
                    const updates: any = {};
                    
                    // Helper to safely set value or null (never undefined)
                    const safeVal = (val: any) => (val === undefined ? null : val);

                    if (selectedColumns.has('size')) updates.size = safeVal(newVariant.size);
                    if (selectedColumns.has('sku')) updates.sku = safeVal(newVariant.sku);
                    if (selectedColumns.has('unitCost')) updates.unitCost = safeVal(newVariant.unitCost);
                    if (selectedColumns.has('retailPrice')) updates.retailPrice = safeVal(newVariant.retailPrice);
                    if (selectedColumns.has('cartonSize')) updates.cartonSize = safeVal(newVariant.cartonSize);
                    if (selectedColumns.has('uom')) updates.uom = safeVal(newVariant.uom);
                    
                    // Ensure we actually have fields to send
                    if (Object.keys(updates).length > 0) {
                        await batchUpdateVariants.mutateAsync({
                            ids: Array.from(selectedRowIds),
                            updates
                        });
                        toast.success(`Updated source + ${selectedRowIds.size} other variants!`);
                    } else {
                        // This handles the case where columns are unchecked
                        console.warn("Batch active but no columns selected.");
                        toast.success("Updated source row only.");
                    }
                } else {
                    toast.success("Variant updated.");
                }
            } else {
                await addVariant(activeProduct.id, formData);
                toast.success("Variant created.");
            }
            handleCancelEdit();
        } catch (e: any) { 
            console.error(e); 
            // Show the actual error message from the server if available
            toast.error(e.message || "Failed to save."); 
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
            if (!response.ok) throw new Error("Failed");
            const blob = await response.blob();
            const url = URL.createObjectURL(blob);
            window.open(url, '_blank', 'width=400,height=400');
        } catch (e) { toast.error("Failed to generate QR."); }
    };

    // --- RENDER HELPERS ---
    const renderColumnHeader = (label: string, fieldKey: string, widthClass?: string) => {
        if (!isBatchMode) return <th className={`p-3 ${widthClass || ''}`}>{label}</th>;
        
        const isChecked = selectedColumns.has(fieldKey);
        return (
            <th className={`p-3 ${widthClass || ''}`}>
                <div className="flex flex-col gap-1">
                    <span>{label}</span>
                    <label className="flex items-center gap-1 text-[10px] font-normal cursor-pointer bg-black/5 px-1 rounded hover:bg-black/10 w-fit">
                        <input 
                            type="checkbox" 
                            className="w-3 h-3 accent-primary"
                            checked={isChecked}
                            onChange={() => toggleColumnSelection(fieldKey)}
                        />
                        Copy
                    </label>
                </div>
            </th>
        );
    };

    return (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
            <div className="bg-surface w-full max-w-5xl max-h-[90vh] rounded-xl shadow-2xl flex flex-col overflow-hidden">
                
                {/* HEADER */}
                <div className="p-4 border-b border-border flex justify-between items-center bg-background">
                    <h2 className="text-xl font-bold text-text-primary flex items-center gap-2">
                        {isEditingParent ? 'Edit Product Line' : activeProduct.name}
                        {!isEditingParent && activeProduct.isDiscontinued && <span className="text-xs bg-red-900/50 text-red-200 px-2 py-0.5 rounded">DISCONTINUED</span>}
                    </h2>
                    <div className="flex items-center gap-2">
                        <button onClick={onClose} className="p-2 hover:bg-surface rounded text-text-secondary hover:text-text-primary"><X size={24} /></button>
                    </div>
                </div>

                {/* BODY */}
                <div className="flex-1 overflow-y-auto p-6">
                    {isEditingParent ? (
                        <ProductForm initialData={activeProduct} onSave={handleSaveParent} onCancel={() => setIsEditingParent(false)} isSaving={isSaving} />
                    ) : (
                        <div className="space-y-8">
                            {/* 1. PARENT INFO CARD */}
                            <div className="flex flex-col md:flex-row gap-6">
                                <div className="w-48 h-48 bg-black/20 rounded-lg flex-shrink-0 overflow-hidden border border-border">
                                    {activeProduct.defaultImageUrl ? (
                                        <img src={resolveImageUrl(activeProduct.defaultImageUrl)!} className="w-full h-full object-cover" />
                                    ) : <div className="w-full h-full flex items-center justify-center text-text-tertiary">No Image</div>}
                                </div>
                                <div className="flex-1 space-y-2">
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <span className="block text-text-secondary text-xs uppercase tracking-wide">Manufacturer</span>
                                            <span className="font-medium text-text-primary">{activeProduct.manufacturerName}</span>
                                        </div>
                                        <div className="flex gap-2">
                                            <button onClick={() => handlePrintQr(activeProduct.id, 'product', activeProduct.name)} className="p-2 bg-surface hover:bg-background border border-border rounded text-text-secondary"><QrCode size={16} /></button>
                                            <button onClick={() => setIsEditingParent(true)} className="p-2 bg-surface hover:bg-background border border-border rounded text-text-secondary"><Edit2 size={16} /></button>
                                        </div>
                                    </div>
                                    <p className="text-text-primary mt-1 text-sm">{activeProduct.description || 'No description provided.'}</p>
                                </div>
                            </div>

                            {/* 2. VARIANTS TABLE */}
                            <div>
                                <div className="flex justify-between items-end mb-4">
                                    <h3 className="text-lg font-bold text-text-primary">Product Variants</h3>
                                    {!editingVariantId && (
                                      <div className="flex gap-2">
                                        <button onClick={() => setShowGenerator(true)} className="text-sm flex items-center gap-2 bg-surface border border-primary text-primary px-3 py-1.5 rounded"><Calculator size={16} /> Batch Generator</button>
                                        <button onClick={handleAddRow} className="text-sm flex items-center gap-2 bg-secondary text-on-secondary px-3 py-1.5 rounded"><Plus size={16} /> Add Variant</button>
                                      </div>
                                    )}
                                </div>

                                <div className="bg-background rounded-lg border border-border overflow-hidden">
                                    <table className="w-full text-sm text-left">
                                        <thead className="bg-surface text-text-secondary border-b border-border">
                                            <tr>
                                                {/* Header Logic: Show 'Select All' if batch mode */}
                                                <th className="p-3 w-16 text-center">
                                                    {isBatchMode ? (
                                                        <button onClick={toggleAllRows} title="Select All" className="text-primary hover:text-primary-hover">
                                                            {selectedRowIds.size > 0 && selectedRowIds.size === (activeProduct.variants.length - 1) 
                                                                ? <CheckSquare size={18} /> 
                                                                : <Square size={18} />}
                                                        </button>
                                                    ) : "Img"}
                                                </th>
                                                <th className="p-3">Variant / Color</th>
                                                {renderColumnHeader("Size", "size")}
                                                {renderColumnHeader("SKU", "sku")}
                                                {renderColumnHeader("Packaging", "cartonSize")}
                                                {renderColumnHeader("Cost", "unitCost", "text-right")}
                                                {renderColumnHeader("Retail", "retailPrice", "text-right")}
                                                <th className="p-3 text-center">Sample?</th>
                                                <th className="p-3 text-center">Status</th>
                                                <th className="p-3 w-24 text-center">Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-border">
                                            {/* NEW ROW INPUT */}
                                            {editingVariantId?.startsWith('NEW_') && (
                                                <tr className="bg-primary/5 animate-in fade-in">
                                                    <td className="p-2"><button onClick={() => setShowImageModal(true)} className="w-10 h-10 border rounded flex items-center justify-center"><ImageIcon size={14} /></button></td>
                                                    <td className="p-2"><input autoFocus type="text" className="w-full p-1 border rounded" placeholder="Name" value={newVariant.name || ''} onChange={e => setNewVariant({...newVariant, name: e.target.value})} /></td>
                                                    <td colSpan={7} className="p-2 text-center text-xs text-text-tertiary">Basic Info Only (Edit after create for details)</td>
                                                    <td className="p-2 flex justify-center gap-1">
                                                        <button onClick={handleSaveVariant} className="p-1 text-green-500"><Save size={18} /></button>
                                                        <button onClick={handleCancelEdit} className="p-1 text-red-500"><X size={18} /></button>
                                                    </td>
                                                </tr>
                                            )}

                                            {/* EXISTING ROWS */}
                                            {activeProduct.variants.map(v => (
                                                editingVariantId === v.id ? (
                                                    // --- EDIT MODE ROW ---
                                                    <tr key={v.id} className="bg-primary/5 border-l-4 border-primary">
                                                        <td className="p-2 text-center">
                                                            <button onClick={() => setShowImageModal(true)} className="w-10 h-10 border border-primary/30 rounded flex items-center justify-center bg-white"><ImageIcon size={14} className="text-primary" /></button>
                                                        </td>
                                                        <td className="p-2"><input type="text" className="w-full p-1 border border-primary rounded font-bold" value={newVariant.name || ''} onChange={e => setNewVariant({...newVariant, name: e.target.value})} /></td>
                                                        <td className="p-2"><input type="text" className="w-full p-1 border border-primary rounded" value={newVariant.size || ''} onChange={e => setNewVariant({...newVariant, size: e.target.value})} /></td>
                                                        <td className="p-2"><input type="text" className="w-full p-1 border border-primary rounded" value={newVariant.sku || ''} onChange={e => setNewVariant({...newVariant, sku: e.target.value})} /></td>
                                                        <td className="p-2">
                                                            <div className="flex gap-1">
                                                                <input type="number" className="w-16 p-1 border border-primary rounded" value={newVariant.cartonSize || ''} onChange={e => setNewVariant({...newVariant, cartonSize: parseFloat(e.target.value)})} />
                                                                <span className="text-xs self-center">{newVariant.uom}</span>
                                                            </div>
                                                        </td>
                                                        <td className="p-2"><input type="number" className="w-full p-1 border border-primary rounded text-right" value={newVariant.unitCost || ''} onChange={e => handleCostChange(e.target.value)} /></td>
                                                        <td className="p-2"><input type="number" className="w-full p-1 border border-primary rounded text-right" value={newVariant.retailPrice || ''} onChange={e => setNewVariant({...newVariant, retailPrice: Number(e.target.value)})} /></td>
                                                        <td className="p-2 text-center"><input type="checkbox" checked={newVariant.hasSample ?? v.hasSample} onChange={e => setNewVariant({...newVariant, hasSample: e.target.checked})} /></td>
                                                        <td className="p-2 text-center text-xs font-bold text-primary">EDITING</td>
                                                        <td className="p-2 flex justify-center items-center gap-2">
                                                            
                                                            {/* BATCH TOGGLE */}
                                                            <button 
                                                                onClick={toggleBatchMode} 
                                                                className={`p-1.5 rounded transition-colors ${isBatchMode ? 'bg-purple-100 text-purple-600' : 'text-text-tertiary hover:text-purple-600'}`}
                                                                title="Copy values to other rows"
                                                            >
                                                                <Copy size={16} />
                                                            </button>

                                                            {/* SAVE BUTTON */}
                                                            <button 
                                                                onClick={handleSaveVariant} 
                                                                className={`p-1.5 rounded text-white shadow-sm transition-all ${isBatchMode && selectedRowIds.size > 0 ? 'bg-purple-600 hover:bg-purple-700 w-full' : 'bg-green-600 hover:bg-green-700'}`}
                                                                title={isBatchMode ? `Save & Copy to ${selectedRowIds.size} rows` : "Save Changes"}
                                                            >
                                                                {isBatchMode && selectedRowIds.size > 0 ? <span className="text-[10px] font-bold px-1">APPLY ({selectedRowIds.size})</span> : <Save size={16} />}
                                                            </button>
                                                            
                                                            <button onClick={handleCancelEdit} className="p-1 text-red-500 hover:bg-red-50 rounded"><X size={16} /></button>
                                                        </td>
                                                    </tr>
                                                ) : (
                                                    // --- READ MODE ROW ---
                                                    <tr key={v.id} className={`hover:bg-surface/50 transition-colors ${isBatchMode && selectedRowIds.has(v.id) ? 'bg-purple-50' : ''}`}>
                                                        <td className="p-2 text-center">
                                                            {isBatchMode ? (
                                                                <input 
                                                                    type="checkbox" 
                                                                    className="w-4 h-4 accent-purple-600 cursor-pointer"
                                                                    checked={selectedRowIds.has(v.id)}
                                                                    onChange={() => toggleRowSelection(v.id)}
                                                                />
                                                            ) : (
                                                                <div className="w-10 h-10 bg-black/20 rounded overflow-hidden mx-auto">
                                                                    {v.imageUrl ? <img src={resolveImageUrl(v.imageUrl)!} className="w-full h-full object-cover"/> : null}
                                                                </div>
                                                            )}
                                                        </td>
                                                        <td className="p-3 font-medium text-text-primary">{v.name}</td>
                                                        <td className="p-3 text-text-secondary">{v.size || '-'}</td>
                                                        <td className="p-3 text-text-secondary">{v.sku || '-'}</td>
                                                        <td className="p-3 text-text-secondary text-xs font-mono">{v.cartonSize ? `${v.cartonSize} ${v.uom}` : '-'}</td>
                                                        <td className="p-3 text-right text-text-secondary">{v.unitCost ? `$${Number(v.unitCost).toFixed(2)}` : '-'}</td>
                                                        <td className="p-3 text-right text-green-400 font-medium">{v.retailPrice ? `$${Number(v.retailPrice).toFixed(2)}` : '-'}</td>
                                                        <td className="p-3 text-center">
                                                            <div className={`w-3 h-3 rounded-full mx-auto ${v.hasSample ? 'bg-green-500' : 'bg-gray-300'}`} />
                                                        </td>
                                                        <td className="p-3 text-center text-xs text-text-tertiary">{v.hasSample ? 'Available' : 'Order Only'}</td>
                                                        <td className="p-3 flex justify-center gap-2 opacity-50 hover:opacity-100 transition-opacity">
                                                            <button onClick={() => handlePrintQr(v.id, 'variant', activeProduct.name, v.name, v.sku || undefined)} disabled={isBatchMode} className="text-text-secondary hover:text-primary disabled:opacity-30"><QrCode size={16} /></button>
                                                            <button onClick={() => handleEditVariant(v)} disabled={isBatchMode} className="text-text-secondary hover:text-primary disabled:opacity-30"><Edit2 size={16} /></button>
                                                            <button onClick={() => handleDeleteVariant(v.id)} disabled={isBatchMode} className="text-text-secondary hover:text-red-500 disabled:opacity-30"><Trash2 size={16} /></button>
                                                        </td>
                                                    </tr>
                                                )
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* MODALS */}
                {showGenerator && <VariantGeneratorModal productId={activeProduct.id} manufacturerId={activeProduct.manufacturerId} pricingSettings={pricingSettings} onClose={() => setShowGenerator(false)} onSuccess={handleGeneratorSuccess} />}
                {showImageModal && <VariantImageModal currentPreview={pendingImage.preview} onClose={() => setShowImageModal(false)} onSave={handleImageUpdate} />}
            </div>
        </div>
    );
};

export default ProductDetailModal;