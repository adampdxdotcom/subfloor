import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { MaterialOrder, Product, ProductVariant, Unit, UNITS, Vendor, PricingSettings } from '../types';
import { X, Package as PackageIcon, History, Calculator, XCircle, AlertCircle } from 'lucide-react';
import AddEditVendorModal from './AddEditVendorModal';
import CollapsibleSection from './CollapsibleSection';
import ActivityHistory from './ActivityHistory';
import GlobalProjectSelector from './GlobalProjectSelector';
import * as preferenceService from '../services/preferenceService';
import { getMaterialOrderHistory } from '../services/materialOrderService';
import { useMaterialOrderMutations } from '../hooks/useMaterialOrderMutations';
import { useVendorMutations } from '../hooks/useVendorMutations';
import { useProducts } from '../hooks/useProducts';
import { useVendors } from '../hooks/useVendors';
import { useProjects } from '../hooks/useProjects';
import { useQuery } from '@tanstack/react-query';
import { calculatePrice, getActivePricingRules } from '../utils/pricingUtils';
import { toast } from 'react-hot-toast';

// --- Updated Local Data Structure ---
interface LineItemState {
    product: Product;
    variant: ProductVariant;
    quantity: string;
    unit: Unit;
    totalCost: string;
    unitSellPrice?: string;
    isManualPrice?: boolean;
}

// --- Component Props ---
interface AddEditMaterialOrderModalProps {
    isOpen: boolean;
    onClose: () => void;
    editingOrder?: MaterialOrder | null;
    initialProjectId?: number | null;
    // Data to start the order with (from Sample Selection)
    prefillData?: {
        product: Product;
        variant: ProductVariant;
        projectId: number;
    } | null;
}

const formatVariantName = (productName: string, variantName: string, size?: string | null) => 
    `${productName} - ${variantName}${size ? ` (${size})` : ''}`;

const formatDateForInput = (dateString: string | undefined | null) => dateString ? new Date(dateString).toISOString().split('T')[0] : '';

const AddEditMaterialOrderModal: React.FC<AddEditMaterialOrderModalProps> = ({ isOpen, onClose, editingOrder = null, initialProjectId = null, prefillData = null }) => {
    
    // REFACTOR: Hooks
    const { data: products = [] } = useProducts();
    const { data: vendors = [] } = useVendors();
    const { data: projects = [] } = useProjects();
    const { addVendor } = useVendorMutations();
    const { addMaterialOrder, updateMaterialOrder } = useMaterialOrderMutations();
    
    // --- DEBUG LOGGING ---
    console.log('AddEditMaterialOrderModal Render:', { 
        addMaterialOrderType: typeof addMaterialOrder,
        addMaterialOrderValue: addMaterialOrder
    });

    // New: Fetch history directly
    const { data: materialOrderHistory = [] } = useQuery({
        queryKey: ['material_orders', 'history', editingOrder?.id],
        queryFn: () => getMaterialOrderHistory(editingOrder!.id),
        enabled: !!editingOrder,
    });

    const [selectedProjectId, setSelectedProjectId] = useState<number | null>(initialProjectId);
    const [supplierId, setSupplierId] = useState<number | null>(null);
    const [supplierSearch, setSupplierSearch] = useState('');
    const [etaDate, setEtaDate] = useState('');
    const [purchaserType, setPurchaserType] = useState<'Customer' | 'Installer'>('Customer');
    const [lineItems, setLineItems] = useState<LineItemState[]>([]);
    
    // Search State
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedSearchItem, setSelectedSearchItem] = useState<{product: Product, variant: ProductVariant} | null>(null);
    
    const [isVendorModalOpen, setIsVendorModalOpen] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [notes, setNotes] = useState('');

    const currentProject = projects.find(p => p.id === selectedProjectId);

    const supplierList = useMemo(() => vendors.filter(v => v.vendorType === 'Supplier' || v.vendorType === 'Both'), [vendors]);
    const [pricingSettings, setPricingSettings] = useState<PricingSettings | null>(null);

    useEffect(() => {
        const fetchSettings = async () => {
            try { setPricingSettings(await preferenceService.getPricingSettings()); }
            catch (e) { console.error("Failed to load pricing settings."); }
        };
        fetchSettings();
    }, []);

    const supplierSearchResults = useMemo(() => {
        if (!supplierSearch.trim() || supplierId) return [];
        return supplierList.filter(s => s.name.toLowerCase().includes(supplierSearch.toLowerCase()));
    }, [supplierList, supplierSearch, supplierId]);

    // --- Search Logic ---
    const searchResults = useMemo(() => {
        if (searchTerm.length < 2) return [];
        const lowercasedTerm = searchTerm.toLowerCase();
        const results: {product: Product, variant: ProductVariant}[] = [];

        products.forEach(p => {
            const parentMatch = (p.name || '').toLowerCase().includes(lowercasedTerm) || 
                                (p.manufacturerName || '').toLowerCase().includes(lowercasedTerm);
            p.variants.forEach(v => {
                const variantMatch = (v.name || '').toLowerCase().includes(lowercasedTerm) || 
                                     (v.sku || '').toLowerCase().includes(lowercasedTerm);
                if (parentMatch || variantMatch) {
                    results.push({ product: p, variant: v });
                }
            });
        });
        return results;
    }, [products, searchTerm]); 

    const handleSupplierSelect = (vendorId: number) => {
        setSupplierId(vendorId);
        const selectedVendor = vendors.find(v => v.id === vendorId);
        setSupplierSearch(selectedVendor?.name || '');
        
        if (selectedVendor?.dedicatedShippingDay !== null && selectedVendor?.dedicatedShippingDay !== undefined) {
            const deliveryDay = selectedVendor.dedicatedShippingDay;
            const today = new Date();
            let daysUntilDelivery = deliveryDay - today.getDay();
            if (daysUntilDelivery <= 0) daysUntilDelivery += 7;
            
            if (daysUntilDelivery < 7) {
                daysUntilDelivery += 7;
            }
            
            const nextDeliveryDate = new Date();
            nextDeliveryDate.setDate(today.getDate() + daysUntilDelivery);
            setEtaDate(formatDateForInput(nextDeliveryDate.toISOString()));
        } else {
            setEtaDate('');
        }
    };

    // --- Effect to load/reset form data ---
    useEffect(() => {
        if (!isOpen) return;

        if (editingOrder) {
            setSelectedProjectId(editingOrder.projectId);
            setSupplierId(editingOrder.supplierId || null);
            const currentSupplier = vendors.find(v => v.id === editingOrder.supplierId);
            setSupplierSearch(currentSupplier?.name || '');
            setPurchaserType(editingOrder.purchaserType || 'Customer');
            setEtaDate(formatDateForInput(editingOrder.etaDate));
            setNotes(editingOrder.notes || '');

            const itemsToEdit = editingOrder.lineItems.map(item => {
                let foundProduct: Product | undefined;
                let foundVariant: ProductVariant | undefined;

                for (const p of products) {
                     const v = p.variants.find(v => Number(v.id) === item.variantId || String(v.id) === String(item.variantId));
                     if (v) {
                         foundProduct = p;
                         foundVariant = v;
                         break;
                     }
                }

                if (!foundProduct || !foundVariant) return null;

                let calculatedSellPrice = item.unitPriceSold !== null && item.unitPriceSold !== undefined
                    ? item.unitPriceSold.toFixed(2)
                    : (item.totalCost && item.quantity) ? (item.totalCost / item.quantity).toFixed(2) : '';

                return {
                    product: foundProduct,
                    variant: foundVariant,
                    quantity: String(item.quantity),
                    unit: item.unit as Unit || foundVariant.pricingUnit || foundVariant.uom || 'SF',
                    totalCost: item.totalCost != null ? String(item.totalCost) : '',
                    unitSellPrice: calculatedSellPrice,
                };
            }).filter(Boolean) as LineItemState[];
            
            setLineItems(itemsToEdit);
        
        } else if (prefillData) {
            setSelectedProjectId(prefillData.projectId);
            
            const supplierId = prefillData.product.supplierId || prefillData.product.manufacturerId;
            const vendor = vendors.find(v => v.id === supplierId);

            if (vendor) {
                handleSupplierSelect(vendor.id);
            } else {
                setSupplierId(null);
                setSupplierSearch('');
            }

            let initialSellPrice = '';
            
            if (pricingSettings && prefillData.variant.unitCost) {
                 const rules = getActivePricingRules(vendor, pricingSettings, purchaserType);
                 const price = calculatePrice(Number(prefillData.variant.unitCost), rules.percentage, rules.method);
                 initialSellPrice = price.toFixed(2);
            } else if (prefillData.variant.retailPrice) {
                initialSellPrice = Number(prefillData.variant.retailPrice).toFixed(2);
            }

            setLineItems([{
                product: prefillData.product,
                variant: prefillData.variant,
                quantity: '1',
                unit: prefillData.variant.pricingUnit || prefillData.variant.uom || 'SF',
                totalCost: initialSellPrice,
                unitSellPrice: initialSellPrice
            }]);

        } else {
            setSelectedProjectId(initialProjectId);
            setSupplierId(null);
            setSupplierSearch('');
            setPurchaserType('Customer');
            setEtaDate('');
            setLineItems([]);
            setNotes('');
        }
    }, [editingOrder, isOpen, initialProjectId, products, vendors, prefillData, pricingSettings]);

    
    const handleSelectSearchItem = (product: Product, variant: ProductVariant) => {
        setSelectedSearchItem({ product, variant });
        setSearchTerm(formatVariantName(product.name, variant.name, variant.size));
    };

    const handlePurchaserChange = (type: 'Customer' | 'Installer') => {
        setPurchaserType(type);

        if (pricingSettings && lineItems.length > 0) {
            setLineItems(prev => prev.map(item => {
                if (item.variant.unitCost) {
                    const vendorId = item.product.supplierId || item.product.manufacturerId;
                    const vendor = vendors.find(v => v.id === vendorId);
                    
                    const rules = getActivePricingRules(vendor, pricingSettings, type);
                    const newPrice = calculatePrice(Number(item.variant.unitCost), rules.percentage, rules.method);
                    const newPriceStr = newPrice.toFixed(2);
                    const qty = parseFloat(item.quantity) || 0;

                    return { ...item, unitSellPrice: newPriceStr, totalCost: (qty * newPrice).toFixed(2) };
                }
                return item;
            }));
        }
    };

    const handleAddLineItem = () => {
        if (selectedSearchItem && !lineItems.some(item => item.variant.id === selectedSearchItem.variant.id)) {
            
            let initialSellPrice = '';
            let initialUnit: Unit = selectedSearchItem.variant.pricingUnit || selectedSearchItem.variant.uom || 'SF';
            
            if (pricingSettings && selectedSearchItem.variant.unitCost) {
                 const vendor = vendors.find(v => v.id === (selectedSearchItem.product.supplierId || selectedSearchItem.product.manufacturerId));
                 const rules = getActivePricingRules(vendor, pricingSettings, purchaserType);
                 const price = calculatePrice(Number(selectedSearchItem.variant.unitCost), rules.percentage, rules.method);
                 initialSellPrice = price.toFixed(2);
            } else if (selectedSearchItem.variant.retailPrice) {
                initialSellPrice = Number(selectedSearchItem.variant.retailPrice).toFixed(2);
            }

            setLineItems(prev => [...prev, { 
                product: selectedSearchItem.product,
                variant: selectedSearchItem.variant,
                quantity: '1', 
                unit: initialUnit,
                totalCost: initialSellPrice, 
                unitSellPrice: initialSellPrice 
            }]);
            
            if (!supplierId && selectedSearchItem.product.supplierId) {
                handleSupplierSelect(selectedSearchItem.product.supplierId);
            } else if (!supplierId && selectedSearchItem.product.manufacturerId) {
                 const manufacturer = vendors.find(v => v.id === selectedSearchItem.product.manufacturerId);
                if (manufacturer && (manufacturer.vendorType === 'Supplier' || manufacturer.vendorType === 'Both')) {
                    handleSupplierSelect(manufacturer.id);
                }
                else if (manufacturer && manufacturer.defaultSupplierId) {
                    handleSupplierSelect(manufacturer.defaultSupplierId);
                }
            }
            
            setSearchTerm(''); 
            setSelectedSearchItem(null);
        }
    };

    const updateLineItem = useCallback((index: number, field: keyof LineItemState, value: string|Unit) => { 
        setLineItems(prev => {
            const newItems = [...prev]; 
            (newItems[index] as any)[field] = value;
            const item = newItems[index];

            if (field === 'quantity' || field === 'unitSellPrice') {
                const qty = field === 'quantity' ? parseFloat(value as string) : parseFloat(item.quantity);
                const price = field === 'unitSellPrice' ? parseFloat(value as string) : parseFloat(item.unitSellPrice || '0');
                if (!isNaN(qty) && !isNaN(price)) {
                    newItems[index].totalCost = (qty * price).toFixed(2);
                } else {
                    newItems[index].totalCost = '';
                }
            }
            return newItems; 
        });
    }, []);

    const handleRemoveLineItem = (variantId: string) => { setLineItems(prev => prev.filter(item => item.variant.id !== variantId)); };

    const handleConvertToCartons = useCallback((index: number) => {
        const item = lineItems[index];
        const cartonSize = Number(item.variant.cartonSize || 0);
        const qtySF = parseFloat(item.quantity);
        
        if (!qtySF || !cartonSize) return;

        const numCartons = Math.ceil(qtySF / cartonSize);
        const currentPriceSF = parseFloat(item.unitSellPrice || '0');
        const newPriceCarton = (currentPriceSF * cartonSize).toFixed(2);
        const newTotal = (numCartons * parseFloat(newPriceCarton)).toFixed(2);

        setLineItems(prev => {
            const newItems = [...prev];
            newItems[index] = {
                ...newItems[index],
                quantity: String(numCartons),
                unit: 'Carton',
                unitSellPrice: newPriceCarton,
                totalCost: newTotal
            };
            return newItems;
        });
    }, [lineItems]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedProjectId) { toast.error('Please select a project.'); return; }
        if (!supplierId) { toast.error('Please select a supplier.'); return; }
        if (lineItems.length === 0) { toast.error('Please add at least one line item.'); return; }
        
        setIsSaving(true);

        const lineItemsPayload = lineItems.map(item => ({ 
            sampleId: item.variant.id, 
            variantId: item.variant.id,
            quantity: parseFloat(item.quantity) || 0, 
            unit: item.unit, 
            totalCost: item.totalCost ? parseFloat(item.totalCost) : null, 
            unitPriceSold: item.unitSellPrice ? parseFloat(item.unitSellPrice) : null 
        }));

        const orderData = { 
            supplierId, 
            etaDate: etaDate || null, 
            purchaserType, 
            lineItems: lineItemsPayload,
            notes: notes
        };

        console.log('Submitting Order:', { editingOrder: !!editingOrder, orderData });

        try { 
            if (editingOrder) { 
                console.log('Calling updateMaterialOrder...');
                await updateMaterialOrder({ id: editingOrder.id, data: orderData }); 
                toast.success('Order updated successfully');
            } else { 
                console.log('Calling addMaterialOrder...');
                await addMaterialOrder({ ...orderData, projectId: selectedProjectId }); 
                toast.success('Order created successfully');
            }
            onClose(); 
        } 
        catch (error) { 
            console.error("Failed to save order:", error); 
            toast.error("Failed to save order.");
        } finally {
            setIsSaving(false);
        }
    };

    if (!isOpen) return null;
    
    const titleText = editingOrder 
        ? `Edit Material Order` 
        : `Create Material Order`;

    return (
        <div className="fixed inset-0 z-[60] bg-black/75 overflow-y-auto">
            <div className="block w-full h-full lg:flex lg:items-center lg:justify-center lg:p-4 lg:min-h-full">
            <div className="bg-surface-container-high w-full min-h-full lg:min-h-0 lg:h-auto lg:max-h-[90vh] lg:max-w-4xl lg:rounded-2xl shadow-2xl flex flex-col border border-outline/10 relative">
                {/* Header */}
                <div className="p-4 md:p-6 border-b border-outline/10 flex justify-between items-center bg-surface-container-low lg:rounded-t-2xl sticky top-0 z-10">
                    <h2 className="text-2xl font-bold text-text-primary flex items-center gap-2">
                        <PackageIcon className="text-primary" />
                        {titleText}
                    </h2>
                    <button onClick={onClose} className="p-2 hover:bg-surface-container-highest rounded-full text-text-secondary hover:text-text-primary transition-colors"><X size={24} /></button>
                </div>

                <form onSubmit={handleSubmit} className="flex flex-col flex-grow">
                    <div className="p-6 overflow-y-auto flex-grow">
                    {/* Project Selector */}
                    {!initialProjectId && !editingOrder && (
                        <div className="mb-6">
                            <label className="block text-sm font-medium text-text-secondary mb-1">Project</label>
                            <GlobalProjectSelector 
                                onProjectSelect={(p) => setSelectedProjectId(p.id)} 
                                selectedProjectId={selectedProjectId} 
                            />
                        </div>
                    )}
                    
                    {prefillData && selectedProjectId && (
                        <div className="mb-6 p-4 bg-primary-container/20 border border-primary-container rounded-xl text-sm text-primary flex items-center gap-2">
                            <AlertCircle size={18} />
                            Order initiated from selected sample in project <strong>{currentProject?.projectName}</strong>.
                        </div>
                    )}


                    {/* Top Form Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                        <div className="relative md:col-span-2">
                            <label className="block text-sm font-medium text-text-secondary mb-1">Supplier</label>
                            <input type="text" placeholder="Search for a supplier..." value={supplierSearch} onChange={e => { setSupplierSearch(e.target.value); setSupplierId(null); }} className="w-full p-3 bg-surface-container-highest border-b-2 border-transparent rounded-t-md text-text-primary focus:outline-none focus:border-primary transition-colors" required />
                            {supplierSearch && !supplierId && (
                                <div className="absolute z-20 w-full bg-surface-container-highest border border-outline/10 rounded-b-md mt-1 max-h-40 overflow-y-auto shadow-xl">
                                    {supplierSearchResults.map(vendor => (<div key={vendor.id} onClick={() => handleSupplierSelect(vendor.id)} className="p-2 hover:bg-background cursor-pointer text-text-primary">{vendor.name}</div>))}
                                    <div onClick={() => setIsVendorModalOpen(true)} className="p-2 text-accent font-semibold hover:bg-background hover:text-text-primary cursor-pointer text-center border-t border-border">+ Add New Supplier</div>
                                </div>
                            )}
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-text-secondary mb-1">ETA</label>
                            <input type="date" value={etaDate} onChange={e => setEtaDate(e.target.value)} className="w-full p-3 bg-surface-container-highest border-b-2 border-transparent rounded-t-md text-text-primary focus:outline-none focus:border-primary transition-colors" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-text-secondary mb-1">Purchaser</label>
                            <div className="flex bg-surface-container-highest p-1 rounded-lg border border-outline/10">
                                <button type="button" onClick={() => handlePurchaserChange('Customer')} className={`flex-1 py-2 px-3 rounded-md text-sm font-medium transition-colors ${purchaserType === 'Customer' ? 'bg-surface shadow-sm text-primary' : 'text-text-secondary hover:text-text-primary'}`}>Customer</button>
                                <button type="button" onClick={() => handlePurchaserChange('Installer')} className={`flex-1 py-2 px-3 rounded-md text-sm font-medium transition-colors ${purchaserType === 'Installer' ? 'bg-surface shadow-sm text-primary' : 'text-text-secondary hover:text-text-primary'}`}>Installer</button>
                            </div>
                        </div>
                        <div className="md:col-span-2">
                            <label htmlFor="notes" className="block text-sm font-medium text-text-secondary mb-1">Notes</label>
                            <textarea id="notes" value={notes} onChange={e => setNotes(e.target.value)} rows={2} className="w-full p-3 bg-surface-container-highest border-b-2 border-transparent rounded-t-md text-text-primary focus:outline-none focus:border-primary transition-colors" placeholder="Delivery instructions..." />
                        </div>
                    </div>

                    {/* Line Items Section */}
                    <div className="bg-surface-container-low p-4 rounded-xl border border-outline/10 mb-6">
                        <h3 className="font-semibold mb-3 text-text-primary">Line Items</h3>
                        
                        <div className="space-y-2 mb-4">
                            {lineItems.map((item, index) => { 
                                const cartonSize = Number(item.variant.cartonSize || 0);
                                const uom = item.variant.uom || 'SF';
                                
                                return (
                                    <div key={item.variant.id} className="bg-surface-container-highest border border-outline/5 p-4 rounded-xl mb-3 relative">
                                        <div className="grid grid-cols-2 md:grid-cols-[1.5fr,1fr,auto,auto,auto,auto,auto] items-end gap-3 md:gap-2">
                                            <div className="flex flex-col overflow-hidden col-span-2 md:col-span-1 pr-6 md:pr-0">
                                                <label className="text-[9px] text-text-secondary uppercase mb-1">Product</label>
                                                <span className="text-sm text-text-primary md:truncate font-medium leading-tight" title={formatVariantName(item.product.name, item.variant.name, item.variant.size)}>
                                                    {formatVariantName(item.product.name, item.variant.name, item.variant.size)}
                                                </span>
                                            </div>

                                            <div className="flex flex-col col-span-2 md:col-span-1">
                                                <label className="text-[9px] text-text-secondary uppercase mb-1">SKU</label>
                                                <span className="text-sm text-text-secondary p-1.5 bg-surface-container rounded-md border border-outline/10 truncate">
                                                    {item.variant.sku || '-'}
                                                </span>
                                            </div>

                                            <div className="flex flex-col">
                                                <label className="text-[9px] text-text-secondary uppercase mb-1">Qty</label>
                                                <input type="number" placeholder="Qty" value={item.quantity} onChange={e => updateLineItem(index, 'quantity', e.target.value)} className="w-full md:w-20 p-1.5 bg-surface-container rounded-md border-transparent text-sm text-text-primary text-center font-bold" />
                                            </div>

                                            <div className="flex flex-col">
                                                <label className="text-[9px] text-text-secondary uppercase mb-1">Unit</label>
                                                <select value={item.unit} onChange={e => updateLineItem(index, 'unit', e.target.value as Unit)} className="w-full md:w-16 p-1.5 bg-surface-container rounded-md border-transparent text-sm appearance-none text-center text-text-primary cursor-pointer font-medium">{UNITS.map(u => <option key={u} value={u}>{u}</option>)}</select>
                                            </div>
                                            
                                            <div className="flex flex-col">
                                                <label className="text-[9px] text-text-secondary uppercase mb-1">Price</label>
                                                <input type="number" step="0.01" placeholder="Price" value={item.unitSellPrice || ''} onChange={e => updateLineItem(index, 'unitSellPrice', e.target.value)} className="w-full md:w-24 p-1.5 bg-surface-container rounded-md border-transparent text-sm font-semibold text-success text-right" />
                                            </div>

                                            <div className="flex flex-col">
                                                <label className="text-[9px] text-text-secondary uppercase mb-1">Total</label>
                                                <input type="number" step="0.01" placeholder="Total" value={item.totalCost} onChange={e => updateLineItem(index, 'totalCost', e.target.value)} className="w-full md:w-28 p-1.5 bg-surface-container rounded-md border-transparent text-sm text-text-primary font-bold text-right" />
                                            </div>
                                            
                                            <button type="button" onClick={() => handleRemoveLineItem(item.variant.id)} className="absolute top-2 right-2 md:static md:mb-1 text-red-400 hover:text-red-600"><XCircle size={20}/></button>
                                        </div>

                                        {item.unit !== 'Carton' && cartonSize > 0 && (
                                            <div className="mt-2 flex justify-end">
                                                <button 
                                                    type="button" 
                                                    onClick={() => handleConvertToCartons(index)}
                                                    disabled={parseFloat(item.quantity) <= 0}
                                                    className="flex items-center text-xs px-3 py-1.5 rounded-full font-bold text-on-secondary bg-secondary hover:bg-secondary-hover shadow-sm transition-colors mt-2 md:mt-0"
                                                    title={`Click to convert ${item.quantity} ${item.unit} into full cartons`}
                                                >
                                                    <Calculator size={12} className="mr-1" />
                                                    {parseFloat(item.quantity) > 0 
                                                        ? `Convert to ${Math.ceil(parseFloat(item.quantity) / cartonSize)} Cartons`
                                                        : "Convert to Cartons"
                                                    }
                                                    <span className="opacity-80 font-normal ml-1">({cartonSize} {uom}/box)</span>
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                        
                        <div className="flex gap-2">
                            <div className="relative flex-grow">
                                <input type="text" placeholder="Search for product to add..." value={searchTerm} onChange={e => { setSearchTerm(e.target.value); setSelectedSearchItem(null); }} className="w-full p-3 bg-surface-container-highest border-b-2 border-transparent rounded-t-md text-text-primary focus:outline-none focus:border-primary transition-colors" />
                                
                                {searchTerm && !selectedSearchItem && (
                                    <div className="absolute z-10 w-full bg-surface-container-highest border border-outline/10 rounded-b-md mt-1 max-h-60 overflow-y-auto shadow-xl">
                                        {searchResults.map(item => (
                                            <div key={item.variant.id} onClick={() => handleSelectSearchItem(item.product, item.variant)} className="p-2 hover:bg-background cursor-pointer text-text-primary border-b border-border last:border-0">
                                                 <div className="font-medium">{formatVariantName(item.product.name, item.variant.name, item.variant.size)}</div>
                                                 <div className="text-xs text-text-secondary flex justify-between">
                                                     <span>{item.product.manufacturerName}</span>
                                                     <span>{item.variant.sku || 'No SKU'}</span>
                                                 </div>
                                            </div>
                                        ))}
                                        {searchResults.length === 0 && (
                                             <div className="p-4 text-center text-text-secondary text-sm">No products found.</div>
                                        )}
                                    </div>
                                )}
                            </div>
                            <button type="button" onClick={handleAddLineItem} disabled={!selectedSearchItem} className="py-2 px-6 bg-primary hover:bg-primary-hover rounded-full text-on-primary font-semibold disabled:opacity-50 shadow-md">Add Item</button>
                        </div>
                    </div>

                    {editingOrder && (
                        <div className="mt-6">
                            <CollapsibleSection title="Change History" icon={<History className="w-6 h-6" />} defaultOpen={false}>
                                <ActivityHistory history={materialOrderHistory} />
                            </CollapsibleSection>
                        </div>
                    )}
                    </div>

                    <div className="p-4 md:p-6 border-t border-outline/10 bg-surface-container-low lg:rounded-b-2xl flex justify-end gap-4 shrink-0 sticky bottom-0 z-10 lg:static">
                        <button type="button" onClick={onClose} className="py-2 px-6 bg-surface hover:bg-surface-container-highest border border-outline/20 rounded-full text-text-secondary font-medium transition-colors">Cancel</button>
                        <button type="submit" disabled={isSaving || !selectedProjectId} className="py-2 px-6 bg-primary hover:bg-primary-hover rounded-full text-on-primary font-semibold shadow-md disabled:opacity-50 transition-all">{isSaving ? 'Saving...' : (editingOrder ? 'Save Changes' : 'Create Order')}</button>
                    </div>
                </form>
            </div>
            </div>
            
            <AddEditVendorModal isOpen={isVendorModalOpen} onClose={() => setIsVendorModalOpen(false)} vendorToEdit={null} initialVendorType='Supplier' />
        </div>
    );
};

export default AddEditMaterialOrderModal;