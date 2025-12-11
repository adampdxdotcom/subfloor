import React, { useState, useEffect, useRef } from 'react';
import { Product, ProductVariant, PricingSettings, UNITS } from '../types';
import { X, Edit2, QrCode, Trash2, Plus, Image as ImageIcon, Save, Calculator, CheckSquare, Square, Printer, Copy, ListChecks, Star, Archive, RotateCcw, CopyPlus } from 'lucide-react';
import { useData } from '../context/DataContext';
import { useProductMutations } from '../hooks/useProducts'; 
import { getPricingSettings } from '../services/preferenceService';
import { calculatePrice, getActivePricingRules } from '../utils/pricingUtils';
import { toast } from 'react-hot-toast';
import ProductForm from './ProductForm'; 
import VariantGeneratorModal from './VariantGeneratorModal';
import VariantImageModal from './VariantImageModal';
import { PrintableLabel } from './PrintableLabel';
import { useReactToPrint } from 'react-to-print';
import PrintQueueModal from './PrintQueueModal';

const API_URL = "";

interface ProductDetailModalProps {
    isOpen: boolean;
    onClose: () => void;
    product: Product;
}

const ProductDetailModal: React.FC<ProductDetailModalProps> = ({ isOpen, onClose, product }) => {
    const { products, vendors, updateProduct, deleteProduct, addVariant, updateVariant, deleteVariant } = useData();
    const { batchUpdateVariants, duplicateProduct } = useProductMutations();

    const activeProduct = products.find(p => p.id === product.id) || product;

    const [isEditingParent, setIsEditingParent] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [showGenerator, setShowGenerator] = useState(false);

    // --- Variant Inline Editing State ---
    const [editingVariantId, setEditingVariantId] = useState<string | null>(null);
    const [newVariant, setNewVariant] = useState<Partial<ProductVariant>>({});
    
    // --- BATCH & SELECTION STATE ---
    const [isSelectionMode, setIsSelectionMode] = useState(false);
    const [selectedRowIds, setSelectedRowIds] = useState<Set<string>>(new Set());
    // For batch editing logic
    const [selectedColumns, setSelectedColumns] = useState<Set<string>>(new Set(['unitCost', 'retailPrice'])); 
    
    // --- BATCH PRINT STATE ---
    const [showBatchPrint, setShowBatchPrint] = useState(false);
    const [productsToPrint, setProductsToPrint] = useState<Product[]>([]);

    // --- Image Modal State ---
    const [showImageModal, setShowImageModal] = useState(false);
    const [pendingImage, setPendingImage] = useState<{ file: File | null, url: string | null, preview: string | null }>({ file: null, url: null, preview: null });

    const [pricingSettings, setPricingSettings] = useState<PricingSettings | null>(null);

    // --- SINGLE PRINTING STATE ---
    const printRef = useRef<HTMLDivElement>(null);
    const [printData, setPrintData] = useState<{ data: any, qrUrl: string } | null>(null);

    const triggerPrint = useReactToPrint({
        contentRef: printRef, 
        documentTitle: `Label_${activeProduct.name}`,
        onAfterPrint: () => setPrintData(null)
    });

    useEffect(() => {
        if (isOpen) {
            getPricingSettings().then(setPricingSettings).catch(console.error);
        }
    }, [isOpen]);

    // Trigger print when data is ready
    useEffect(() => {
        if (printData && printRef.current) {
            // FIX: Add delay to allow Image to load and DOM to paint before capturing
            const timer = setTimeout(() => {
                triggerPrint();
            }, 500);
            return () => clearTimeout(timer);
        }
    }, [printData, triggerPrint]);

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
    
    // --- NEW HANDLER FOR DISCONTINUE/RESTORE ---
    const handleToggleDiscontinued = async () => {
        const newStatus = !activeProduct.isDiscontinued;
        const action = newStatus ? "Discontinue" : "Restore";
        
        if (confirm(`Are you sure you want to ${action} this product line?`)) {
            try {
                const formData = new FormData();
                formData.append('isDiscontinued', String(newStatus));
                await updateProduct(activeProduct.id, formData);
                toast.success(`Product ${newStatus ? 'discontinued' : 'restored'}.`);
                // If discontinuing, close the modal as it might disappear from the main list view
                if (newStatus) onClose(); 
            } catch (e) { 
                console.error(e); 
                toast.error(`Failed to ${action.toLowerCase()} product.`); 
            }
        }
    };
    
    const handleDuplicate = async () => {
        if (confirm(`Create a copy of "${activeProduct.name}"?`)) {
            try {
                await duplicateProduct.mutateAsync(activeProduct.id);
                toast.success("Product line duplicated.");
                onClose();
            } catch (e) {
                console.error(e);
                toast.error("Failed to duplicate product.");
            }
        }
    };

    // --- SELECTION HELPERS ---
    const toggleRowSelection = (id: string) => {
        setSelectedRowIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const toggleAllRows = () => {
        const selectableIds = activeProduct.variants.filter(v => v.id !== editingVariantId).map(v => v.id);
        const allSelected = selectableIds.every(id => selectedRowIds.has(id));
        if (allSelected) setSelectedRowIds(new Set());
        else setSelectedRowIds(new Set(selectableIds));
    };

    const toggleColumnSelection = (col: string) => {
        setSelectedColumns(prev => {
            const next = new Set(prev);
            if (next.has(col)) next.delete(col);
            else next.add(col);
            return next;
        });
    };

    // --- PRINT HANDLERS ---
    const handlePrintQr = (id: string, type: 'product' | 'variant', name: string, variantData?: ProductVariant) => {
        const data = {
            id,
            name,
            subName: variantData?.name,
            sku: variantData?.sku,
            size: variantData?.size,
            manufacturer: activeProduct.manufacturerName,
            retailPrice: variantData?.retailPrice,
            uom: variantData?.uom,
            pricingUnit: variantData?.pricingUnit, // PASSED for correct labeling
            cartonSize: variantData?.cartonSize,
            isVariant: type === 'variant'
        };
        const qrUrl = `/api/products/${type === 'product' ? '' : 'variants/'}${id}/qr`;
        setPrintData({ data, qrUrl });
    };

    const handleBatchPrint = () => {
        const filteredProduct = {
            ...activeProduct,
            variants: activeProduct.variants.filter(v => selectedRowIds.has(v.id))
        };
        setProductsToPrint([filteredProduct]);
        setShowBatchPrint(true);
    };

    const handleSetPrimaryImage = async (variantImageUrl: string | null) => {
        if (!variantImageUrl) return;
        
        try {
            const formData = new FormData();
            formData.append('defaultImageUrl', variantImageUrl);
            await updateProduct(activeProduct.id, formData);
            toast.success("Main product image updated!");
        } catch (error) {
            console.error(error);
            toast.error("Failed to update main image.");
        }
    };

    // --- VARIANT HANDLERS ---
    const handleAddRow = () => {
        const tempId = 'NEW_' + Date.now();
        setEditingVariantId(tempId);
        setIsSelectionMode(false); 
        setSelectedRowIds(new Set()); // NEW: Clear selection on Add
        // Default UOM to SF, pricingUnit to SF
        setNewVariant({ 
            name: '', size: '', sku: '', 
            unitCost: 0, retailPrice: 0, 
            hasSample: false, cartonSize: 0, 
            uom: 'SF', pricingUnit: 'SF' 
        });
        setPendingImage({ file: null, url: null, preview: null });
    };

    const handleEditVariant = (variant: ProductVariant) => {
        setNewVariant({
            name: variant.name, size: variant.size, sku: variant.sku,
            unitCost: variant.unitCost, retailPrice: variant.retailPrice,
            hasSample: variant.hasSample, cartonSize: variant.cartonSize, 
            uom: variant.uom, pricingUnit: variant.pricingUnit
        });
        setEditingVariantId(variant.id);
        const initialPreview = resolveImageUrl(variant.imageUrl);
        setPendingImage({ file: null, url: null, preview: initialPreview || null });
        setIsSelectionMode(false); 
        setSelectedRowIds(new Set()); // NEW: Clear selection on Edit
    };

    const handleCancelEdit = () => {
        setEditingVariantId(null);
        setNewVariant({});
        setPendingImage({ file: null, url: null, preview: null });
        setSelectedRowIds(new Set()); // NEW: Clear selection on Cancel
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

    const handleImageUpdate = (file: File | null, url: string | null) => {
        let preview = null;
        if (file) preview = URL.createObjectURL(file);
        else if (url) preview = url;
        setPendingImage({ file, url, preview });
    };

    const handleSaveVariant = async () => {
        if (!newVariant.name) return toast.error("Name is required.");
        const formData = new FormData();
        formData.append('name', newVariant.name);
        if (newVariant.size) formData.append('size', newVariant.size);
        if (newVariant.sku) formData.append('sku', newVariant.sku);
        if (newVariant.unitCost !== undefined) formData.append('unitCost', String(newVariant.unitCost));
        if (newVariant.retailPrice !== undefined) formData.append('retailPrice', String(newVariant.retailPrice));
        if (newVariant.hasSample !== undefined) formData.append('hasSample', String(newVariant.hasSample));
        if (newVariant.cartonSize !== undefined) formData.append('cartonSize', String(newVariant.cartonSize));
        if (newVariant.uom) formData.append('uom', newVariant.uom);
        if (newVariant.pricingUnit) formData.append('pricingUnit', newVariant.pricingUnit); 
        
        if (pendingImage.file) formData.append('image', pendingImage.file);
        else if (pendingImage.url) formData.append('imageUrl', pendingImage.url);

        try {
            if (editingVariantId && !editingVariantId.startsWith('NEW_')) {
                await updateVariant(editingVariantId, formData);
                
                // Reuse selection for Batch Update if editing
                if (isSelectionMode && selectedRowIds.size > 0) {
                    const updates: any = {};
                    const safeVal = (val: any) => (val === undefined ? null : val);
                    if (selectedColumns.has('size')) updates.size = safeVal(newVariant.size);
                    if (selectedColumns.has('sku')) updates.sku = safeVal(newVariant.sku);
                    if (selectedColumns.has('unitCost')) updates.unitCost = safeVal(newVariant.unitCost);
                    if (selectedColumns.has('retailPrice')) updates.retailPrice = safeVal(newVariant.retailPrice);
                    if (selectedColumns.has('cartonSize')) updates.cartonSize = safeVal(newVariant.cartonSize);
                    if (selectedColumns.has('uom')) updates.uom = safeVal(newVariant.uom);
                    if (selectedColumns.has('pricingUnit')) updates.pricingUnit = safeVal(newVariant.pricingUnit);
                    
                    if (Object.keys(updates).length > 0) {
                        await batchUpdateVariants.mutateAsync({ ids: Array.from(selectedRowIds), updates });
                        toast.success(`Updated source + ${selectedRowIds.size} other variants!`);
                    }
                } else { toast.success("Variant updated."); }
            } else {
                await addVariant(activeProduct.id, formData);
                toast.success("Variant created.");
            }
            handleCancelEdit();
            setSelectedRowIds(new Set()); // NEW: Double ensure clear on Save
        } catch (e: any) { console.error(e); toast.error(e.message || "Failed to save."); }
    };

    const handleGeneratorSuccess = (newVariants: any[]) => {
        toast.success(`${newVariants.length} variants created!`);
        setShowGenerator(false);
    };

    const renderColumnHeader = (label: string, fieldKey: string, widthClass?: string) => {
        // Only show copy checkbox if editing AND in selection mode
        if (!editingVariantId || !isSelectionMode) return <th className={`p-3 ${widthClass || ''}`}>{label}</th>;
        
        const isChecked = selectedColumns.has(fieldKey);
        return (
            <th className={`p-3 ${widthClass || ''}`}>
                <div className="flex flex-col gap-1">
                    <span>{label}</span>
                    <label className="flex items-center gap-1 text-[10px] font-normal cursor-pointer bg-black/5 px-1 rounded hover:bg-black/10 w-fit">
                        <input type="checkbox" className="w-3 h-3 accent-primary" checked={isChecked} onChange={() => toggleColumnSelection(fieldKey)} /> Copy
                    </label>
                </div>
            </th>
        );
    };

    return (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
            
            {/* HIDDEN PRINT CONTAINER (Robust Hide) */}
            <div style={{ position: 'absolute', top: -10000, left: -10000 }}>
                <div ref={printRef} className="p-4 w-[3.5in] h-[2in]"> 
                    {printData && <PrintableLabel data={printData.data} qrUrl={printData.qrUrl} />}
                </div>
            </div>

            <div className="bg-surface w-full max-w-5xl max-h-[90vh] rounded-xl shadow-2xl flex flex-col overflow-hidden">
                {/* HEADER */}
                <div className="p-4 border-b border-border flex justify-between items-center bg-background">
                    <h2 className="text-xl font-bold text-text-primary flex items-center gap-2">
                        {isEditingParent ? 'Edit Product Line' : activeProduct.name}
                        {/* APPLYING THE FIX: Changed from bg-red-900/50 to bg-secondary */}
                        {!isEditingParent && activeProduct.isDiscontinued && <span className="text-xs font-bold bg-secondary text-on-secondary px-2 py-0.5 rounded">DISCONTINUED</span>}
                    </h2>
                    <div className="flex items-center gap-2">
                        {isEditingParent ? (
                            <>
                                {/* Toggle Discontinued Status */}
                                <button 
                                    onClick={handleToggleDiscontinued}
                                    className={`p-2 rounded border transition-colors ${
                                        activeProduct.isDiscontinued 
                                        ? 'bg-green-900/30 text-green-400 border-green-800 hover:bg-green-900/50' 
                                        : 'bg-surface hover:bg-red-900/20 text-text-secondary hover:text-red-400 border-border'
                                    }`}
                                    title={activeProduct.isDiscontinued ? "Restore to Active Library" : "Archive / Discontinue"}
                                >
                                    {activeProduct.isDiscontinued ? <RotateCcw size={20} /> : <Archive size={20} />}
                                </button>

                                <button onClick={handleDuplicate} className="p-2 hover:bg-surface rounded text-text-secondary hover:text-primary" title="Duplicate Product Line">
                                    <CopyPlus size={20} />
                                </button>

                                <button onClick={handleDeleteParent} className="p-2 hover:bg-surface rounded text-text-secondary hover:text-red-500" title="Permanently Delete">
                                    <Trash2 size={24} />
                                </button>
                            </>
                        ) : (
                            <button onClick={() => setIsEditingParent(true)} className="p-2 hover:bg-surface rounded text-text-secondary hover:text-primary"><Edit2 size={24} /></button>
                        )}
                        
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
                                            {/* PARENT PRINT BUTTON */}
                                            <button onClick={() => handlePrintQr(activeProduct.id, 'product', activeProduct.name)} className="p-2 bg-surface hover:bg-background border border-border rounded text-text-secondary" title="Print Line Label"><QrCode size={16} /></button>
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
                                        {/* BATCH PRINT BUTTON - Visible if items selected */}
                                        {selectedRowIds.size > 0 && (
                                            <button 
                                                onClick={handleBatchPrint}
                                                className="text-sm flex items-center gap-2 bg-primary text-on-primary px-3 py-1.5 rounded font-bold animate-in fade-in"
                                            >
                                                <Printer size={16} /> Print Labels ({selectedRowIds.size})
                                            </button>
                                        )}
                                        
                                        <div className="w-px h-6 bg-border mx-2"></div>

                                        <button onClick={() => setShowGenerator(true)} className="text-sm flex items-center gap-2 bg-surface border border-primary text-primary px-3 py-1.5 rounded"><Calculator size={16} /> Batch Generator</button>
                                        <button onClick={handleAddRow} className="text-sm flex items-center gap-2 bg-secondary text-on-secondary px-3 py-1.5 rounded"><Plus size={16} /> Add Variant</button>
                                      </div>
                                    )}
                                </div>

                                <div className="bg-background rounded-lg border border-border overflow-hidden">
                                    <table className="w-full text-sm text-left">
                                        <thead className="bg-surface text-text-secondary border-b border-border">
                                            <tr>
                                                <th className="p-3 w-12 text-center">Img</th>
                                                <th className="p-3">Variant / Color</th>
                                                {renderColumnHeader("Size", "size")}
                                                {renderColumnHeader("SKU", "sku")}
                                                {renderColumnHeader("Packaging", "cartonSize")}
                                                {renderColumnHeader("Cost", "unitCost", "text-right")}
                                                {/* Reordered: Pricing Unit after Cost */}
                                                {renderColumnHeader("Pricing Unit", "pricingUnit", "text-center w-24")}
                                                {renderColumnHeader("Retail", "retailPrice", "text-right")}
                                                <th className="p-3 text-center">Sample?</th>
                                                <th className="p-3 text-center">Status</th>
                                                
                                                {/* TOGGLE COLUMN: QR vs Checkbox */}
                                                <th className="p-3 w-16 text-center">
                                                    <button 
                                                        onClick={() => {
                                                            setIsSelectionMode(!isSelectionMode);
                                                            if (isSelectionMode) setSelectedRowIds(new Set()); // Clear on exit
                                                        }}
                                                        className={`p-1 rounded transition-colors ${isSelectionMode ? 'text-primary bg-primary/10' : 'text-text-secondary hover:text-primary'}`}
                                                        title={isSelectionMode ? "Cancel Selection" : "Select Multiple"}
                                                    >
                                                        {isSelectionMode ? <CheckSquare size={18} /> : <ListChecks size={18} />}
                                                    </button>
                                                </th>
                                                
                                                <th className="p-3 w-20 text-center">Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-border">
                                            {/* ROWS */}
                                            {activeProduct.variants.map(v => (
                                                editingVariantId === v.id ? (
                                                    // EDIT MODE
                                                    <tr key={v.id} className="bg-primary/5 border-l-4 border-primary">
                                                        <td className="p-2 text-center"><button onClick={() => setShowImageModal(true)} className="w-8 h-8 rounded border bg-white flex items-center justify-center"><ImageIcon size={14}/></button></td>
                                                        <td className="p-2"><input type="text" className="w-full p-1 border border-primary rounded font-bold" value={newVariant.name || ''} onChange={e => setNewVariant({...newVariant, name: e.target.value})} /></td>
                                                        <td className="p-2"><input type="text" className="w-full p-1 border border-primary rounded" value={newVariant.size || ''} onChange={e => setNewVariant({...newVariant, size: e.target.value})} /></td>
                                                        <td className="p-2"><input type="text" className="w-full p-1 border border-primary rounded" value={newVariant.sku || ''} onChange={e => setNewVariant({...newVariant, sku: e.target.value})} /></td>
                                                        
                                                        {/* PACKAGING */}
                                                        <td className="p-2 flex gap-1">
                                                            <input type="number" className="w-16 p-1 border border-primary rounded" value={newVariant.cartonSize || ''} onChange={e => setNewVariant({...newVariant, cartonSize: parseFloat(e.target.value)})} placeholder="Qty" />
                                                            <select className="p-1 border border-primary rounded text-xs bg-white" value={newVariant.uom || 'SF'} onChange={e => setNewVariant({...newVariant, uom: e.target.value as any})}>
                                                                {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                                                            </select>
                                                        </td>
                                                        
                                                        <td className="p-2"><input type="number" className="w-full p-1 border border-primary rounded text-right" value={newVariant.unitCost || ''} onChange={e => handleCostChange(e.target.value)} /></td>
                                                        
                                                        {/* PRICING UNIT (Reordered) */}
                                                        <td className="p-2">
                                                            <select className="w-full p-1 border border-primary rounded text-xs bg-white" value={newVariant.pricingUnit || 'SF'} onChange={e => setNewVariant({...newVariant, pricingUnit: e.target.value as any})}>
                                                                {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                                                            </select>
                                                        </td>
                                                        
                                                        <td className="p-2"><input type="number" className="w-full p-1 border border-primary rounded text-right" value={newVariant.retailPrice || ''} onChange={e => setNewVariant({...newVariant, retailPrice: Number(e.target.value)})} /></td>
                                                        <td className="p-2 text-center"><input type="checkbox" checked={newVariant.hasSample ?? v.hasSample} onChange={e => setNewVariant({...newVariant, hasSample: e.target.checked})} /></td>
                                                        <td className="p-2 text-center text-xs font-bold text-primary">EDITING</td>
                                                        
                                                        {/* EDITING - BATCH TOGGLE */}
                                                        <td className="p-2 text-center">
                                                            <button 
                                                                onClick={() => {
                                                                    setIsSelectionMode(!isSelectionMode);
                                                                    // Don't clear selection in Edit Mode so we can copy
                                                                }} 
                                                                className={`p-1.5 rounded ${isSelectionMode ? 'bg-purple-100 text-purple-600' : 'text-text-tertiary'}`} 
                                                                title="Copy to selected"
                                                            >
                                                                <Copy size={16} />
                                                            </button>
                                                        </td>
                                                        
                                                        <td className="p-2 flex justify-center items-center gap-2">
                                                            <button onClick={handleSaveVariant} className="p-1.5 rounded bg-green-600 text-white"><Save size={16} /></button>
                                                            <button onClick={handleCancelEdit} className="p-1 text-red-500"><X size={16} /></button>
                                                        </td>
                                                    </tr>
                                                ) : (
                                                    <tr key={v.id} className={`hover:bg-surface/50 transition-colors ${selectedRowIds.has(v.id) ? 'bg-primary/5' : ''}`}>
                                                        {/* IMAGE */}
                                                        <td className="p-2 text-center">
                                                            <div className="w-10 h-10 bg-black/20 rounded overflow-hidden mx-auto border border-border">
                                                                {v.imageUrl ? <img src={resolveImageUrl(v.imageUrl)!} className="w-full h-full object-cover"/> : null}
                                                            </div>
                                                        </td>
                                                        
                                                        <td className="p-3 font-medium text-text-primary">{v.name}</td>
                                                        <td className="p-3 text-text-secondary">{v.size || '-'}</td>
                                                        <td className="p-3 text-text-secondary">{v.sku || '-'}</td>
                                                        <td className="p-3 text-text-secondary text-xs font-mono">{v.cartonSize ? `${v.cartonSize} ${v.uom}` : '-'}</td>
                                                        <td className="p-3 text-right text-text-secondary">{v.unitCost ? `$${Number(v.unitCost).toFixed(2)}` : '-'}</td>
                                                        <td className="p-3 text-center text-text-secondary text-xs font-mono bg-black/5 rounded mx-1">/{v.pricingUnit || v.uom || 'Unit'}</td>
                                                        <td className="p-3 text-right text-text-secondary font-medium">{v.retailPrice ? `$${Number(v.retailPrice).toFixed(2)}` : '-'}</td>
                                                        <td className="p-3 text-center"><div className={`w-3 h-3 rounded-full mx-auto ${v.hasSample ? 'bg-green-500' : 'bg-gray-300'}`} /></td>
                                                        <td className="p-3 text-center text-xs text-text-tertiary">{v.hasSample ? 'Available' : 'Order Only'}</td>
                                                        
                                                        {/* QR / SELECT TOGGLE COLUMN */}
                                                        <td className="p-3 text-center">
                                                            {isSelectionMode ? (
                                                                <input 
                                                                    type="checkbox" 
                                                                    className="w-5 h-5 accent-primary cursor-pointer"
                                                                    checked={selectedRowIds.has(v.id)}
                                                                    onChange={() => toggleRowSelection(v.id)}
                                                                />
                                                            ) : (
                                                                <button onClick={() => handlePrintQr(v.id, 'variant', activeProduct.name, v)} className="text-text-secondary hover:text-primary"><QrCode size={18} /></button>
                                                            )}
                                                        </td>
                                                        
                                                        <td className="p-3 flex justify-center gap-2 opacity-50 hover:opacity-100 transition-opacity">
                                                            {v.imageUrl && (
                                                                <button 
                                                                    onClick={() => handleSetPrimaryImage(v.imageUrl)} 
                                                                    className="text-text-secondary hover:text-yellow-500" 
                                                                    title="Set as Main Image"
                                                                >
                                                                    <Star size={16} />
                                                                </button>
                                                            )}
                                                            <button onClick={() => handleEditVariant(v)} className="text-text-secondary hover:text-primary"><Edit2 size={16} /></button>
                                                            <button onClick={() => handleDeleteVariant(v.id)} className="text-text-secondary hover:text-red-500"><Trash2 size={16} /></button>
                                                        </td>
                                                    </tr>
                                                )
                                            ))}
                                            {/* NEW ROW INPUT */}
                                            {editingVariantId?.startsWith('NEW_') && (
                                                <tr className="bg-primary/5 animate-in fade-in">
                                                    <td className="p-2"><button onClick={() => setShowImageModal(true)} className="w-10 h-10 border rounded flex items-center justify-center bg-white"><ImageIcon size={14} /></button></td>
                                                    <td className="p-2"><input autoFocus type="text" className="w-full p-1 border rounded" placeholder="Name" value={newVariant.name || ''} onChange={e => setNewVariant({...newVariant, name: e.target.value})} /></td>
                                                    <td className="p-2"><input type="text" className="w-full p-1 border rounded" value={newVariant.size || ''} onChange={e => setNewVariant({...newVariant, size: e.target.value})} /></td>
                                                    <td className="p-2"><input type="text" className="w-full p-1 border rounded" value={newVariant.sku || ''} onChange={e => setNewVariant({...newVariant, sku: e.target.value})} /></td>
                                                    
                                                    {/* PACKAGING */}
                                                    <td className="p-2 flex gap-1">
                                                        <input type="number" className="w-16 p-1 border rounded" value={newVariant.cartonSize || ''} onChange={e => setNewVariant({...newVariant, cartonSize: parseFloat(e.target.value)})} placeholder="Qty" />
                                                        <select className="p-1 border rounded text-xs bg-white" value={newVariant.uom || 'SF'} onChange={e => setNewVariant({...newVariant, uom: e.target.value as any})}>
                                                            {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                                                        </select>
                                                    </td>

                                                    <td className="p-2"><input type="number" className="w-full p-1 border rounded text-right" value={newVariant.unitCost || ''} onChange={e => handleCostChange(e.target.value)} /></td>

                                                    {/* PRICING UNIT (Reordered) */}
                                                    <td className="p-2">
                                                        <select className="w-full p-1 border rounded text-xs bg-white" value={newVariant.pricingUnit || 'SF'} onChange={e => setNewVariant({...newVariant, pricingUnit: e.target.value as any})}>
                                                            {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                                                        </select>
                                                    </td>

                                                    <td className="p-2"><input type="number" className="w-full p-1 border rounded text-right" value={newVariant.retailPrice || ''} onChange={e => setNewVariant({...newVariant, retailPrice: Number(e.target.value)})} /></td>
                                                    <td className="p-2 text-center"><input type="checkbox" checked={newVariant.hasSample ?? true} onChange={e => setNewVariant({...newVariant, hasSample: e.target.checked})} /></td>
                                                    <td className="p-2 text-center text-xs font-bold text-green-600">NEW</td>
                                                    <td colSpan={2} className="p-2 flex justify-center gap-1"><button onClick={handleSaveVariant} className="p-1 text-green-500"><Save size={18} /></button><button onClick={handleCancelEdit} className="p-1 text-red-500"><X size={18} /></button></td>
                                                </tr>
                                            )}
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
                {showBatchPrint && <PrintQueueModal isOpen={true} onClose={() => setShowBatchPrint(false)} selectedProducts={productsToPrint} />}
            </div>
        </div>
    );
};

export default ProductDetailModal;