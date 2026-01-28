import React, { useState, useEffect, useRef } from 'react';
import { Product, ProductVariant, PricingSettings, UNITS } from '../types';
import { X, Edit2, QrCode, Trash2, Plus, Image as ImageIcon, Save, Calculator, CheckSquare, Square, Printer, Copy, ListChecks, Star, Archive, RotateCcw, CopyPlus, ArrowLeft } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useData } from '../context/DataContext';
import { useProducts, useProductMutations } from '../hooks/useProducts'; 
import { getPricingSettings } from '../services/preferenceService';
import { deleteVariant as deleteVariantService } from '../services/productService';
import { calculatePrice, getActivePricingRules } from '../utils/pricingUtils';
import { toast } from 'react-hot-toast';
import ProductForm from './ProductForm'; 
import VariantGeneratorModal from './VariantGeneratorModal';
import VariantImageModal from './VariantImageModal';
import { PrintableLabel } from './PrintableLabel';
import { useReactToPrint } from 'react-to-print';
import { getImageUrl } from '../utils/apiConfig';
import PrintQueueModal from './PrintQueueModal';
import SimpleLightbox from './SimpleLightbox';

interface ProductDetailModalProps {
    isOpen: boolean;
    onClose: () => void;
    product: Product;
}

const ProductDetailModal: React.FC<ProductDetailModalProps> = ({ isOpen, onClose, product }) => {
    const { vendors, updateProduct, deleteProduct, addVariant, updateVariant } = useData();
    const { data: freshProducts } = useProducts();
    const { batchUpdateVariants, duplicateProduct } = useProductMutations();

    const activeProduct = (freshProducts || []).find(p => p.id === product.id) || product;
    
    // --- DEBUG LOGGING ---
    useEffect(() => {
        if (isOpen) {
            const cacheMatch = (freshProducts || []).find(p => p.id === product.id);
            console.log("🔍 DEBUG: Product Detail Data Source");
            console.log("   ID:", product.id);
            console.log("   1. Props (Stale?):", product.variants[0]?.retailPrice);
            console.log("   2. React Query Cache:", cacheMatch?.variants[0]?.retailPrice);
            console.log("   3. Rendered Active:", activeProduct.variants[0]?.retailPrice);
        }
    }, [isOpen, freshProducts, product, activeProduct]);

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
    
    // --- PRINT STATE (Unified) ---
    const [showPrintModal, setShowPrintModal] = useState(false);
    const [productsToPrint, setProductsToPrint] = useState<Product[]>([]);

    // --- Image Modal State ---
    const [showImageModal, setShowImageModal] = useState(false);
    const [pendingImage, setPendingImage] = useState<{ file: File | null, url: string | null, preview: string | null }>({ file: null, url: null, preview: null });

    const [pricingSettings, setPricingSettings] = useState<PricingSettings | null>(null);

    // --- SINGLE PRINTING STATE ---
    const printRef = useRef<HTMLDivElement>(null);
    const [printData, setPrintData] = useState<{ data: any, qrUrl: string } | null>(null);
    
    // --- LIGHTBOX STATE ---
    const [lightboxImage, setLightboxImage] = useState<{url: string, alt: string} | null>(null);

    const queryClient = useQueryClient();

    const { mutate: deleteVariantMutate } = useMutation({
        mutationFn: deleteVariantService,
        onSuccess: () => {
            toast.success("Variant deleted.");
            queryClient.invalidateQueries({ queryKey: ['products'] });
            queryClient.invalidateQueries({ queryKey: ['discontinuedProducts'] });
        },
        onError: (error: any) => {
            toast.error(error.message || "Failed to delete variant.");
        },
    });

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
            const timer = setTimeout(() => {
                triggerPrint();
            }, 500);
            return () => clearTimeout(timer);
        }
    }, [printData, triggerPrint]);

    // --- SMART LABELS HELPERS ---
    const getVariantLabels = () => {
        const type = activeProduct.productType;
        if (type === 'Carpet' || type === 'Sheet Product') {
            return { color: 'Color / Style', size: 'Width', showPackaging: false, showTechSpecs: false };
        }
        if (type === 'LVP' || type === 'LVT' || type === 'Laminate' || type === 'Hardwood') {
            return { color: 'Color', size: 'Plank Size', showPackaging: true, showTechSpecs: true };
        }
        return { color: 'Color', size: 'Size', showPackaging: true, showTechSpecs: false };
    };

    const labels = getVariantLabels();

    if (!isOpen) return null;
    
    const resolveImageUrl = (path?: string | null) => {
        return getImageUrl(path);
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
    
    const handleToggleDiscontinued = async () => {
        const newStatus = !activeProduct.isDiscontinued;
        const action = newStatus ? "Discontinue" : "Restore";
        
        if (confirm(`Are you sure you want to ${action} this product line?`)) {
            try {
                const formData = new FormData();
                formData.append('isDiscontinued', String(newStatus));
                await updateProduct(activeProduct.id, formData);
                toast.success(`Product ${newStatus ? 'discontinued' : 'restored'}.`);
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

    const handlePrint = (type: 'product' | 'variant' | 'batch', variantId?: string) => {
        let itemsToPrint: Product[] = [];
        if (type === 'product') {
            itemsToPrint = [activeProduct];
        } else if (type === 'variant' && variantId) {
            const variant = activeProduct.variants.find(v => v.id === variantId);
            if (variant) {
                itemsToPrint = [{ ...activeProduct, variants: [variant] }];
            }
        } else if (type === 'batch') {
            itemsToPrint = [{
                ...activeProduct,
                variants: activeProduct.variants.filter(v => selectedRowIds.has(v.id))
            }];
        }
        if (itemsToPrint.length > 0) {
            setProductsToPrint(itemsToPrint);
            setShowPrintModal(true);
        }
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

    const handleAddRow = () => {
        const tempId = 'NEW_' + Date.now();
        setEditingVariantId(tempId);
        setIsSelectionMode(false); 
        setSelectedRowIds(new Set()); 
        setNewVariant({ 
            name: '', size: '', sku: '', 
            unitCost: 0, retailPrice: 0, 
            wearLayer: '', thickness: '', 
            hasSample: false, cartonSize: 0, 
            uom: 'SF', pricingUnit: 'SF' 
        });
        setPendingImage({ file: null, url: null, preview: null });
    };

    const handleEditVariant = (variant: ProductVariant) => {
        setNewVariant({
            name: variant.name, size: variant.size, sku: variant.sku,
            unitCost: variant.unitCost, retailPrice: variant.retailPrice,
            wearLayer: variant.wearLayer, thickness: variant.thickness,
            hasSample: variant.hasSample, cartonSize: variant.cartonSize, 
            uom: variant.uom || 'SF', pricingUnit: variant.pricingUnit || 'SF'
        });
        setEditingVariantId(variant.id);
        const initialPreview = resolveImageUrl(variant.imageUrl);
        setPendingImage({ file: null, url: null, preview: initialPreview || null });
        setIsSelectionMode(false); 
        setSelectedRowIds(new Set()); 
    };

    const handleCancelEdit = () => {
        setEditingVariantId(null);
        setNewVariant({});
        setPendingImage({ file: null, url: null, preview: null });
        setSelectedRowIds(new Set());
    };
    
    const handleDeleteVariant = (variantId: string) => {
        if(!confirm("Delete this variant?")) return;
        deleteVariantMutate(variantId);
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
        if (newVariant.wearLayer) formData.append('wearLayer', newVariant.wearLayer);
        if (newVariant.thickness) formData.append('thickness', newVariant.thickness);
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
                
                if (isSelectionMode && selectedRowIds.size > 0) {
                    const updates: any = {};
                    const safeVal = (val: any) => (val === undefined ? null : val);
                    if (selectedColumns.has('size')) updates.size = safeVal(newVariant.size);
                    if (selectedColumns.has('sku')) updates.sku = safeVal(newVariant.sku);
                    if (selectedColumns.has('wearLayer')) updates.wearLayer = safeVal(newVariant.wearLayer);
                    if (selectedColumns.has('thickness')) updates.thickness = safeVal(newVariant.thickness);
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
            setSelectedRowIds(new Set());
        } catch (e: any) { console.error(e); toast.error(e.message || "Failed to save."); }
    };

    const handleGeneratorSuccess = (newVariants: any[]) => {
        toast.success(`${newVariants.length} variants created!`);
        setShowGenerator(false);
    };

    const renderColumnHeader = (label: string, fieldKey: string, widthClass?: string) => {
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
        <div className="fixed inset-0 z-[60] bg-background flex flex-col lg:static lg:z-0 lg:bg-surface-container-high lg:rounded-2xl lg:border lg:border-outline/20 lg:h-[calc(100vh-140px)]">
            
            <div style={{ position: 'absolute', top: -10000, left: -10000 }}>
                <div ref={printRef} className="p-4 w-[3.5in] h-[2in]"> 
                    {printData && <PrintableLabel data={printData.data} qrUrl={printData.qrUrl} />}
                </div>
            </div>

            <div className="w-full h-full flex flex-col overflow-hidden">
                {/* HEADER */}
                <div className="p-4 border-b border-outline/10 flex items-center">
                    <button onClick={onClose} className="p-2 rounded-full hover:bg-surface-container-highest text-text-secondary hover:text-text-primary mr-2">
                        <ArrowLeft size={24} />
                    </button>
                    <h2 className="text-xl font-bold text-text-primary flex items-center gap-2 flex-grow">
                        {isEditingParent ? 'Edit Product Line' : activeProduct.name}
                        {!isEditingParent && activeProduct.isDiscontinued && <span className="text-xs font-bold bg-error-container text-on-error-container px-2 py-0.5 rounded-full">DISCONTINUED</span>}
                    </h2>
                    <div className="flex items-center gap-2">
                        {isEditingParent ? (
                            <>
                                <button 
                                    onClick={handleToggleDiscontinued}
                                    className={`p-2 rounded border transition-colors ${
                                        activeProduct.isDiscontinued 
                                        ? 'bg-tertiary-container text-on-tertiary-container border-tertiary-container/50' 
                                        : 'bg-surface-container-highest hover:bg-error-container/50 text-text-secondary hover:text-error border-outline/20'
                                    }`}
                                    title={activeProduct.isDiscontinued ? "Restore to Active Library" : "Archive / Discontinue"}
                                >
                                    {activeProduct.isDiscontinued ? <RotateCcw size={20} /> : <Archive size={20} />}
                                </button>

                                <button onClick={handleDuplicate} className="p-2 hover:bg-surface-container-highest rounded-full text-text-secondary hover:text-primary" title="Duplicate Product Line">
                                    <CopyPlus size={20} />
                                </button>

                                <button onClick={handleDeleteParent} className="p-2 hover:bg-surface-container-highest rounded-full text-text-secondary hover:text-error" title="Permanently Delete">
                                    <Trash2 size={24} />
                                </button>
                            </>
                        ) : (
                            <button onClick={() => setIsEditingParent(true)} className="p-2 hover:bg-surface-container-highest rounded-full text-text-secondary hover:text-primary"><Edit2 size={24} /></button>
                        )}
                        
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
                                <div className="w-48 h-48 bg-surface-container rounded-lg flex-shrink-0 overflow-hidden border border-outline/20">
                                    {activeProduct.defaultImageUrl ? (
                                        <div 
                                            className="w-full h-full cursor-zoom-in group relative"
                                            onClick={() => setLightboxImage({
                                                url: resolveImageUrl(activeProduct.defaultImageUrl)!,
                                                alt: activeProduct.name
                                            })}
                                        >
                                            <img src={resolveImageUrl(activeProduct.defaultImageUrl)!} className="w-full h-full object-cover transition-transform group-hover:scale-105" />
                                        </div>
                                    ) : <div className="w-full h-full flex items-center justify-center text-text-tertiary"><ImageIcon size={48} className="opacity-50"/></div>}
                                </div>
                                <div className="flex-1 space-y-2">
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <span className="block text-text-secondary text-xs uppercase tracking-wide">Manufacturer</span>
                                            <span className="font-medium text-text-primary">{activeProduct.manufacturerName}</span>
                                        </div>
                                        <div className="flex gap-2">
                                            <button onClick={() => handlePrint('product')} className="p-2 bg-surface-container-highest hover:bg-surface-variant/30 border border-outline/20 rounded-full text-text-secondary" title="Print Line Label"><QrCode size={16} /></button>
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
                                        {selectedRowIds.size > 0 && (
                                            <button 
                                                onClick={() => handlePrint('batch')} 
                                                className="text-sm flex items-center gap-2 bg-primary text-on-primary px-3 py-1.5 rounded-full font-bold animate-in fade-in"
                                            >
                                                <Printer size={16} /> Print Labels ({selectedRowIds.size})
                                            </button>
                                        )}
                                        
                                        <div className="w-px h-6 bg-outline/20 mx-2"></div>

                                        <button onClick={() => setShowGenerator(true)} className="text-sm flex items-center gap-2 bg-surface-container-highest border border-primary-container text-primary px-3 py-1.5 rounded-full"><Calculator size={16} /> Batch Generator</button>
                                        <button onClick={handleAddRow} className="text-sm flex items-center gap-2 bg-secondary-container text-on-secondary-container px-3 py-1.5 rounded-full"><Plus size={16} /> Add Variant</button>
                                      </div>
                                    )}
                                </div>

                                <div className="bg-surface-container rounded-lg border border-outline/10 overflow-x-auto">
                                    <table className="w-full text-sm text-left whitespace-nowrap">
                                        <thead className="bg-surface-container-highest text-text-secondary border-b border-outline/10">
                                            <tr>
                                                <th className="p-3 w-12 text-center">Img</th>
                                                <th className="p-3">{labels.color}</th>
                                                {renderColumnHeader(labels.size, "size")}
                                                {labels.showTechSpecs && renderColumnHeader("Wear Layer", "wearLayer")}
                                                {labels.showTechSpecs && renderColumnHeader("Thickness", "thickness")}
                                                {renderColumnHeader("SKU", "sku")}
                                                {labels.showPackaging && renderColumnHeader("Carton Qty", "cartonSize")}
                                                {labels.showPackaging && renderColumnHeader("Unit", "uom")}
                                                {renderColumnHeader("Cost", "unitCost", "text-right")}
                                                {renderColumnHeader("Pricing Unit", "pricingUnit", "text-center w-24")}
                                                {renderColumnHeader("Retail", "retailPrice", "text-right")}
                                                <th className="p-3 text-center">Sample?</th>
                                                <th className="p-3 text-center">Status</th>
                                                <th className="p-3 w-24 text-center">
                                                    {isSelectionMode ? (
                                                        <div className="flex justify-center items-center gap-1">
                                                            <button 
                                                                onClick={toggleAllRows}
                                                                className="p-1 rounded-md text-primary hover:bg-primary-container/30"
                                                                title="Select All"
                                                            >
                                                                <CheckSquare size={18} />
                                                            </button>
                                                            <button 
                                                                onClick={() => {
                                                                    setIsSelectionMode(false);
                                                                    setSelectedRowIds(new Set());
                                                                }}
                                                                className="p-1 rounded-md text-text-secondary hover:text-error hover:bg-error-container/30"
                                                                title="Cancel Selection"
                                                            >
                                                                <X size={18} />
                                                            </button>
                                                        </div>
                                                    ) : (
                                                        <button 
                                                            onClick={() => setIsSelectionMode(true)}
                                                            className="p-1 rounded-md text-text-secondary hover:text-primary transition-colors"
                                                            title="Select Multiple"
                                                        >
                                                            <ListChecks size={18} />
                                                        </button>
                                                    )}
                                                </th>
                                                <th className="p-3 w-20 text-center">Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-outline/10">
                                            {activeProduct.variants.map(v => (
                                                editingVariantId === v.id ? (
                                                    <tr key={v.id} className="bg-primary/5 border-l-4 border-primary">
                                                        <td className="p-2 text-center"><button type="button" onClick={() => setShowImageModal(true)} className="w-8 h-8 rounded border bg-white flex items-center justify-center"><ImageIcon size={14}/></button></td>
                                                        <td className="p-2"><input type="text" placeholder={labels.color} className="w-full p-1 border border-primary rounded-md font-bold bg-surface-container" value={newVariant.name || ''} onChange={e => setNewVariant({...newVariant, name: e.target.value})} /></td>
                                                        <td className="p-2"><input type="text" placeholder={labels.size} className="w-full p-1 border border-primary rounded-md bg-surface-container" value={newVariant.size || ''} onChange={e => setNewVariant({...newVariant, size: e.target.value})} /></td>
                                                        {labels.showTechSpecs && (
                                                            <td className="p-2"><input type="text" className="w-full p-1 border border-primary rounded-md bg-surface-container" value={newVariant.wearLayer || ''} onChange={e => setNewVariant({...newVariant, wearLayer: e.target.value})} placeholder="20mil" /></td>
                                                        )}
                                                        {labels.showTechSpecs && (
                                                            <td className="p-2"><input type="text" className="w-full p-1 border border-primary rounded-md bg-surface-container" value={newVariant.thickness || ''} onChange={e => setNewVariant({...newVariant, thickness: e.target.value})} placeholder="5mm" /></td>
                                                        )}
                                                        <td className="p-2"><input type="text" className="w-full p-1 border border-primary rounded-md bg-surface-container" value={newVariant.sku || ''} onChange={e => setNewVariant({...newVariant, sku: e.target.value})} /></td>
                                                        {labels.showPackaging && (
                                                            <td className="p-2">
                                                                <input type="number" className="w-20 p-1 border border-primary rounded-md bg-surface-container" value={newVariant.cartonSize || ''} onChange={e => setNewVariant({...newVariant, cartonSize: parseFloat(e.target.value)})} placeholder="Qty" />
                                                            </td>
                                                        )}
                                                        {labels.showPackaging && (
                                                            <td className="p-2">
                                                                <select className="p-1 border border-primary rounded-md text-xs bg-surface-container w-full" value={newVariant.uom || 'SF'} onChange={e => setNewVariant({...newVariant, uom: e.target.value as any})}>
                                                                    {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                                                                </select>
                                                            </td>
                                                        )}
                                                        <td className="p-2"><input type="number" className="w-full p-1 border border-primary rounded-md text-right bg-surface-container" value={newVariant.unitCost || ''} onChange={e => handleCostChange(e.target.value)} /></td>
                                                        <td className="p-2">
                                                            <select className="w-full p-1 border border-primary rounded-md text-xs bg-surface-container" value={newVariant.pricingUnit || 'SF'} onChange={e => setNewVariant({...newVariant, pricingUnit: e.target.value as any})}>
                                                                {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                                                            </select>
                                                        </td>
                                                        <td className="p-2"><input type="number" className="w-full p-1 border border-primary rounded-md text-right bg-surface-container" value={newVariant.retailPrice || ''} onChange={e => setNewVariant({...newVariant, retailPrice: Number(e.target.value)})} /></td>
                                                        <td className="p-2 text-center"><input type="checkbox" className="form-checkbox h-4 w-4 text-primary bg-surface-container-low border-outline/50 rounded" checked={newVariant.hasSample ?? v.hasSample} onChange={e => setNewVariant({...newVariant, hasSample: e.target.checked})} /></td>
                                                        <td className="p-2 text-center text-xs font-bold text-primary">EDITING</td>
                                                        <td className="p-2 text-center">
                                                            <button 
                                                                type="button"
                                                                onClick={() => {
                                                                    setIsSelectionMode(!isSelectionMode);
                                                                }} 
                                                                className={`p-1.5 rounded-md ${isSelectionMode ? 'bg-secondary-container text-on-secondary-container' : 'text-text-tertiary'}`} 
                                                                title="Copy to selected"
                                                            >
                                                                <Copy size={16} />
                                                            </button>
                                                        </td>
                                                        <td className="p-2 flex justify-center items-center gap-2">
                                                            <button type="button" onClick={handleSaveVariant} className="p-1.5 rounded-md bg-tertiary text-on-tertiary"><Save size={16} /></button>
                                                            <button type="button" onClick={handleCancelEdit} className="p-1.5 rounded-md text-error"><X size={16} /></button>
                                                        </td>
                                                    </tr>
                                                ) : (
                                                    <tr key={v.id} className={`hover:bg-surface-container-highest transition-colors ${selectedRowIds.has(v.id) ? 'bg-primary-container/30' : ''}`}>
                                                        <td className="p-2 text-center">
                                                            <div 
                                                                className={`w-10 h-10 bg-surface-variant rounded overflow-hidden mx-auto border border-outline/10 ${v.imageUrl ? 'cursor-zoom-in hover:ring-2 hover:ring-primary/50' : ''}`}
                                                                onClick={(e) => {
                                                                    if (v.imageUrl) {
                                                                        e.stopPropagation();
                                                                        setLightboxImage({ url: resolveImageUrl(v.imageUrl)!, alt: v.name });
                                                                    }
                                                                }}
                                                            >
                                                                {v.imageUrl ? <img src={resolveImageUrl(v.imageUrl)!} className="w-full h-full object-cover" /> : null}
                                                            </div>
                                                        </td>
                                                        <td className="p-3 font-medium text-text-primary">{v.name}</td>
                                                        <td className="p-3 text-text-secondary">{v.size || '-'}</td>
                                                        {labels.showTechSpecs && <td className="p-3 text-text-secondary">{v.wearLayer || '-'}</td>}
                                                        {labels.showTechSpecs && <td className="p-3 text-text-secondary">{v.thickness || '-'}</td>}
                                                        <td className="p-3 text-text-secondary">{v.sku || '-'}</td>
                                                        {labels.showPackaging && <td className="p-3 text-text-secondary text-xs font-mono">{v.cartonSize || '-'}</td>}
                                                        {labels.showPackaging && <td className="p-3 text-text-secondary text-xs font-mono">{v.uom || '-'}</td>}
                                                        <td className="p-3 text-right text-text-secondary">{v.unitCost ? `$${Number(v.unitCost).toFixed(2)}` : '-'}</td>
                                                        <td className="p-3 text-center text-text-secondary text-xs font-mono bg-black/5 rounded mx-1">/{v.pricingUnit || v.uom || 'Unit'}</td>
                                                        <td className="p-3 text-right text-text-secondary font-medium">{v.retailPrice ? `$${Number(v.retailPrice).toFixed(2)}` : '-'}</td>
                                                        <td className="p-3 text-center"><div className={`w-3 h-3 rounded-full mx-auto ${v.hasSample ? 'bg-green-500' : 'bg-gray-300'}`} /></td>
                                                        <td className="p-3 text-center text-xs text-text-tertiary">{v.hasSample ? 'Available' : 'Order Only'}</td>
                                                        <td className="p-3 text-center">
                                                            {isSelectionMode ? (
                                                                <input 
                                                                    type="checkbox" 
                                                                    className="w-5 h-5 accent-primary cursor-pointer"
                                                                    checked={selectedRowIds.has(v.id)}
                                                                    onChange={() => toggleRowSelection(v.id)}
                                                                />
                                                            ) : (
                                                                <button type="button" onClick={() => handlePrint('variant', v.id)} className="text-text-secondary hover:text-primary"><QrCode size={18} /></button>
                                                            )}
                                                        </td>
                                                        <td className="p-3 flex justify-center gap-2 opacity-50 hover:opacity-100 transition-opacity">
                                                            {v.imageUrl && (
                                                                <button 
                                                                    type="button" onClick={() => handleSetPrimaryImage(v.imageUrl)} 
                                                                    className="text-text-secondary hover:text-yellow-500" 
                                                                    title="Set as Main Image"
                                                                >
                                                                    <Star size={16} />
                                                                </button>
                                                            )}
                                                            <button type="button" onClick={() => handleEditVariant(v)} className="text-text-secondary hover:text-primary"><Edit2 size={16} /></button>
                                                            <button type="button" onClick={() => handleDeleteVariant(v.id)} className="text-text-secondary hover:text-red-500"><Trash2 size={16} /></button>
                                                        </td>
                                                    </tr>
                                                )
                                            ))}
                                            {editingVariantId?.startsWith('NEW_') && (
                                                <tr className="bg-primary/5 animate-in fade-in">
                                                    <td className="p-2"><button type="button" onClick={() => setShowImageModal(true)} className="w-10 h-10 border rounded-md flex items-center justify-center bg-white"><ImageIcon size={14} /></button></td>
                                                    <td className="p-2"><input autoFocus type="text" className="w-full p-1 border rounded-md bg-surface-container" placeholder={labels.color} value={newVariant.name || ''} onChange={e => setNewVariant({...newVariant, name: e.target.value})} /></td>
                                                    <td className="p-2"><input type="text" className="w-full p-1 border rounded-md bg-surface-container" placeholder={labels.size} value={newVariant.size || ''} onChange={e => setNewVariant({...newVariant, size: e.target.value})} /></td>
                                                    {labels.showTechSpecs && <td className="p-2"><input type="text" className="w-full p-1 border rounded-md bg-surface-container" value={newVariant.wearLayer || ''} onChange={e => setNewVariant({...newVariant, wearLayer: e.target.value})} placeholder="Wear Layer" /></td>}
                                                    {labels.showTechSpecs && <td className="p-2"><input type="text" className="w-full p-1 border rounded-md bg-surface-container" value={newVariant.thickness || ''} onChange={e => setNewVariant({...newVariant, thickness: e.target.value})} placeholder="Thickness" /></td>}
                                                    <td className="p-2"><input type="text" className="w-full p-1 border rounded-md bg-surface-container" value={newVariant.sku || ''} onChange={e => setNewVariant({...newVariant, sku: e.target.value})} /></td>
                                                    {labels.showPackaging && (
                                                        <td className="p-2">
                                                            <input type="number" className="w-20 p-1 border rounded-md bg-surface-container" value={newVariant.cartonSize || ''} onChange={e => setNewVariant({...newVariant, cartonSize: parseFloat(e.target.value)})} placeholder="Qty" />
                                                        </td>
                                                    )}
                                                    {labels.showPackaging && (
                                                        <td className="p-2">
                                                            <select className="w-full p-1 border rounded-md text-xs bg-surface-container" value={newVariant.uom || 'SF'} onChange={e => setNewVariant({...newVariant, uom: e.target.value as any})}>
                                                                {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                                                            </select>
                                                        </td>
                                                    )}
                                                    <td className="p-2"><input type="number" className="w-full p-1 border rounded-md text-right bg-surface-container" value={newVariant.unitCost || ''} onChange={e => handleCostChange(e.target.value)} /></td>
                                                    <td className="p-2">
                                                        <select className="w-full p-1 border border-primary rounded-md text-xs bg-surface-container" value={newVariant.pricingUnit || 'SF'} onChange={e => setNewVariant({...newVariant, pricingUnit: e.target.value as any})}>
                                                            {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                                                        </select>
                                                    </td>
                                                    <td className="p-2"><input type="number" className="w-full p-1 border border-primary rounded-md text-right bg-surface-container" value={newVariant.retailPrice || ''} onChange={e => setNewVariant({...newVariant, retailPrice: Number(e.target.value)})} /></td>
                                                    <td className="p-2 text-center"><input type="checkbox" className="form-checkbox h-4 w-4 text-primary bg-surface-container-low border-outline/50 rounded" checked={newVariant.hasSample ?? true} onChange={e => setNewVariant({...newVariant, hasSample: e.target.checked})} /></td>
                                                    <td className="p-2 text-center text-xs font-bold text-green-600">NEW</td>
                                                    <td colSpan={2} className="p-2 flex justify-center gap-1"><button type="button" onClick={handleSaveVariant} className="p-1 text-tertiary"><Save size={18} /></button><button type="button" onClick={handleCancelEdit} className="p-1 text-error"><X size={18} /></button></td>
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
                {lightboxImage && (
                    <SimpleLightbox 
                        imageUrl={lightboxImage.url} 
                        altText={lightboxImage.alt} 
                        onClose={() => setLightboxImage(null)} 
                    />
                )}
                {showGenerator && <VariantGeneratorModal productId={activeProduct.id} productType={activeProduct.productType} manufacturerId={activeProduct.manufacturerId} pricingSettings={pricingSettings} onClose={() => setShowGenerator(false)} onSuccess={handleGeneratorSuccess} />}
                {showImageModal && <VariantImageModal currentPreview={pendingImage.preview} onClose={() => setShowImageModal(false)} onSave={handleImageUpdate} />}
                
                <PrintQueueModal 
                    isOpen={showPrintModal} 
                    onClose={() => setShowPrintModal(false)} 
                    selectedProducts={productsToPrint} 
                />
            </div>
        </div>
    );
};


export default ProductDetailModal;