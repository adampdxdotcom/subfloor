import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useData } from '../context/DataContext';
import { MaterialOrder, Product, ProductVariant, Unit, UNITS, Vendor, PricingSettings } from '../types';
import { X, Package as PackageIcon, History, Calculator, XCircle, AlertCircle } from 'lucide-react';
import AddEditVendorModal from './AddEditVendorModal';
// Removed AddSampleInlineModal - incompatible with new structure
import CollapsibleSection from './CollapsibleSection';
import ActivityHistory from './ActivityHistory';
import GlobalProjectSelector from './GlobalProjectSelector';
import * as preferenceService from '../services/preferenceService';
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
}

const formatVariantName = (productName: string, variantName: string) => `${productName} - ${variantName}`;
const formatDateForInput = (dateString: string | undefined | null) => dateString ? new Date(dateString).toISOString().split('T')[0] : '';

const AddEditMaterialOrderModal: React.FC<AddEditMaterialOrderModalProps> = ({ isOpen, onClose, editingOrder = null, initialProjectId = null }) => {
    
    const { 
        products, vendors, addVendor, 
        addMaterialOrder, updateMaterialOrder, 
        materialOrderHistory, fetchMaterialOrderHistory,
        projects
    } = useData();

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

    // --- Effect to load/reset form data ---
    useEffect(() => {
        if (!isOpen) return;

        if (editingOrder) {
            fetchMaterialOrderHistory(editingOrder.id);
            setSelectedProjectId(editingOrder.projectId);
            setSupplierId(editingOrder.supplierId || null);
            const currentSupplier = vendors.find(v => v.id === editingOrder.supplierId);
            setSupplierSearch(currentSupplier?.name || '');
            setPurchaserType(editingOrder.purchaserType || 'Customer');
            setEtaDate(formatDateForInput(editingOrder.etaDate));
            setNotes(editingOrder.notes || '');

            // Reconstruct Line Items from History/Legacy Data
            const itemsToEdit = editingOrder.lineItems.map(item => {
                // Find Product/Variant from ID
                let foundProduct: Product | undefined;
                let foundVariant: ProductVariant | undefined;

                // Try to find via sampleId (Legacy) or direct lookup
                // Note: Ideally order_line_items should store variant_id now.
                // Assuming we migrated or have logic to map sampleId -> variantId
                
                // Fallback Search Strategy:
                // 1. If we had a variantId stored, great. (Not yet in type definition but DB has it)
                // 2. If only sampleId, try to match roughly or fail gracefully.
                
                // For this refactor, we assume the user is creating NEW orders mostly.
                // Existing orders might display "Unknown Item" if migration was partial.
                
                // Search all products
                for (const p of products) {
                     // Try to find variant that matches this item's sampleId (if sampleId == variantId concept)
                     // OR if sampleId maps to legacy ID. 
                     // This part depends on how clean the DB migration was.
                     
                     // Simplified: Try to find ANY variant that matches
                     const v = p.variants.find(v => Number(v.id) === item.sampleId || String(v.id) === String(item.sampleId));
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
                    unit: item.unit as Unit || 'SF',
                    totalCost: item.totalCost != null ? String(item.totalCost) : '',
                    unitSellPrice: calculatedSellPrice,
                };
            }).filter(Boolean) as LineItemState[];
            
            setLineItems(itemsToEdit);
        } else {
            // Reset for new order
            setSelectedProjectId(initialProjectId);
            setSupplierId(null);
            setSupplierSearch('');
            setPurchaserType('Customer');
            setEtaDate('');
            setLineItems([]);
            setNotes('');
        }
    }, [editingOrder, isOpen, initialProjectId, products, vendors, fetchMaterialOrderHistory]);


    const handleSupplierSelect = (vendorId: number) => {
        setSupplierId(vendorId);
        const selectedVendor = vendors.find(v => v.id === vendorId);
        setSupplierSearch(selectedVendor?.name || '');
        // Calculate Next Delivery Day logic
        if (selectedVendor?.dedicatedShippingDay !== null && selectedVendor?.dedicatedShippingDay !== undefined) {
            const deliveryDay = selectedVendor.dedicatedShippingDay;
            const today = new Date();
            let daysUntilDelivery = deliveryDay - today.getDay();
            if (daysUntilDelivery <= 0) daysUntilDelivery += 7;
            const nextDeliveryDate = new Date();
            nextDeliveryDate.setDate(today.getDate() + daysUntilDelivery);
            setEtaDate(formatDateForInput(nextDeliveryDate.toISOString()));
        }
    };
    
    const handleSelectSearchItem = (product: Product, variant: ProductVariant) => {
        setSelectedSearchItem({ product, variant });
        setSearchTerm(formatVariantName(product.name, variant.name));
    };

    // --- Add Line Item Logic ---
    const handleAddLineItem = () => {
        if (selectedSearchItem && !lineItems.some(item => item.variant.id === selectedSearchItem.variant.id)) {
            
            let initialSellPrice = '';
            let initialUnit: Unit = selectedSearchItem.variant.uom || 'SF';
            
            // Calculate Price
            if (pricingSettings && selectedSearchItem.variant.unitCost) {
                 // Find relevant vendor for markup rules
                 const vendor = vendors.find(v => v.id === (selectedSearchItem.product.supplierId || selectedSearchItem.product.manufacturerId));
                 const rules = getActivePricingRules(vendor, pricingSettings, purchaserType);
                 const price = calculatePrice(Number(selectedSearchItem.variant.unitCost), rules.percentage, rules.method);
                 initialSellPrice = price.toFixed(2);
            } else if (selectedSearchItem.variant.retailPrice) {
                // Fallback to stored retail price if no calc available
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
            
            // Auto-select supplier if not already chosen
            if (!supplierId && selectedSearchItem.product.supplierId) {
                handleSupplierSelect(selectedSearchItem.product.supplierId);
            } else if (!supplierId && selectedSearchItem.product.manufacturerId) {
                 const manufacturer = vendors.find(v => v.id === selectedSearchItem.product.manufacturerId);
                if (manufacturer && (manufacturer.vendorType === 'Supplier' || manufacturer.vendorType === 'Both')) {
                    handleSupplierSelect(manufacturer.id);
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

            // Auto-calculate Total if Quantity or Unit Price changes
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
        
        // Price per carton = Price/SF * SF/Carton
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

    // --- Modals and Saving ---

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedProjectId) { toast.error('Please select a project.'); return; }
        if (!supplierId) { toast.error('Please select a supplier.'); return; }
        if (lineItems.length === 0) { toast.error('Please add at least one line item.'); return; }
        
        setIsSaving(true);

        // Map new structure back to API payload
        const lineItemsPayload = lineItems.map(item => ({ 
            // For now, we map variant.id to sampleId. 
            // Ideally, the backend should accept `variantId` explicitly.
            sampleId: item.variant.id, // Cast to number if ID is numeric, otherwise we need backend update
            variantId: item.variant.id, // Send both if backend supports it
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

        try { 
            if (editingOrder) { await updateMaterialOrder(editingOrder.id, orderData); } 
            else { await addMaterialOrder({ ...orderData, projectId: selectedProjectId }); }
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
        ? `Edit Material Order for ${currentProject?.projectName || 'Project'}` 
        : `Create Material Order ${currentProject?.projectName ? `for ${currentProject.projectName}` : ''}`;

    return (
        <div className="fixed inset-0 bg-black/75 flex items-center justify-center z-50">
            <div className="bg-surface p-8 rounded-lg shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto border border-border">
                {/* Header */}
                <div className="flex justify-between items-center mb-6 border-b border-border pb-4">
                    <h2 className="text-2xl font-bold text-text-primary flex items-center gap-2">
                        <PackageIcon className="text-primary" />
                        {titleText}
                    </h2>
                    <button onClick={onClose} className="text-text-secondary hover:text-text-primary"><X size={24} /></button>
                </div>

                <form onSubmit={handleSubmit}>
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

                    {/* Top Form Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                        <div className="relative md:col-span-2">
                            <label className="block text-sm font-medium text-text-secondary mb-1">Supplier</label>
                            <input type="text" placeholder="Search for a supplier..." value={supplierSearch} onChange={e => { setSupplierSearch(e.target.value); setSupplierId(null); }} className="w-full p-2 bg-background border border-border rounded text-text-primary" required />
                            {supplierSearch && !supplierId && (
                                <div className="absolute z-20 w-full bg-surface border border-border rounded-b-md mt-1 max-h-40 overflow-y-auto shadow-lg">
                                    {supplierSearchResults.map(vendor => (<div key={vendor.id} onClick={() => handleSupplierSelect(vendor.id)} className="p-2 hover:bg-background cursor-pointer text-text-primary">{vendor.name}</div>))}
                                    <div onClick={() => setIsVendorModalOpen(true)} className="p-2 text-accent font-semibold hover:bg-background hover:text-text-primary cursor-pointer text-center border-t border-border">+ Add New Supplier</div>
                                </div>
                            )}
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-text-secondary mb-1">ETA</label>
                            <input type="date" value={etaDate} onChange={e => setEtaDate(e.target.value)} className="w-full p-2 bg-background border border-border rounded text-text-primary" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-text-secondary mb-1">Purchaser</label>
                            <div className="flex bg-background p-1 rounded-lg border border-border">
                                <button type="button" onClick={() => setPurchaserType('Customer')} className={`flex-1 py-1 px-3 rounded text-sm font-medium transition-colors ${purchaserType === 'Customer' ? 'bg-accent text-on-accent' : 'text-text-secondary hover:text-text-primary'}`}>Customer</button>
                                <button type="button" onClick={() => setPurchaserType('Installer')} className={`flex-1 py-1 px-3 rounded text-sm font-medium transition-colors ${purchaserType === 'Installer' ? 'bg-primary text-on-primary' : 'text-text-secondary hover:text-text-primary'}`}>Installer</button>
                            </div>
                        </div>
                        <div className="md:col-span-2">
                            <label htmlFor="notes" className="block text-sm font-medium text-text-secondary mb-1">Notes</label>
                            <textarea id="notes" value={notes} onChange={e => setNotes(e.target.value)} rows={2} className="w-full p-2 bg-background border border-border rounded text-text-primary" placeholder="Delivery instructions..." />
                        </div>
                    </div>

                    {/* Line Items Section */}
                    <div className="bg-background p-4 rounded-lg border border-border mb-6">
                        <h3 className="font-semibold mb-2 text-text-primary">Line Items</h3>
                        
                        {/* List of Items */}
                        <div className="space-y-2 mb-4">
                            {lineItems.map((item, index) => { 
                                const cartonSize = Number(item.variant.cartonSize || 0);
                                const uom = item.variant.uom || 'SF';
                                
                                return (
                                    <div key={item.variant.id} className="bg-surface border border-border p-2 rounded mb-2">
                                        <div className="grid grid-cols-[1.5fr,1fr,auto,auto,auto,auto,auto] items-end gap-2">
                                            {/* Product Name */}
                                            <div className="flex flex-col overflow-hidden">
                                                <label className="text-[9px] text-text-secondary uppercase mb-1">Product</label>
                                                <span className="text-sm text-text-primary truncate font-medium" title={formatVariantName(item.product.name, item.variant.name)}>
                                                    {formatVariantName(item.product.name, item.variant.name)}
                                                </span>
                                            </div>

                                            {/* SKU Display */}
                                            <div className="flex flex-col">
                                                <label className="text-[9px] text-text-secondary uppercase mb-1">SKU</label>
                                                <span className="text-sm text-text-secondary p-1 bg-background rounded border border-border truncate">
                                                    {item.variant.sku || '-'}
                                                </span>
                                            </div>

                                            <div className="flex flex-col">
                                                <label className="text-[9px] text-text-secondary uppercase mb-1">Qty</label>
                                                <input type="number" placeholder="Qty" value={item.quantity} onChange={e => updateLineItem(index, 'quantity', e.target.value)} className="w-16 p-1 bg-background border-border rounded text-sm text-text-primary" />
                                            </div>

                                            <div className="flex flex-col">
                                                <label className="text-[9px] text-text-secondary uppercase mb-1">Unit</label>
                                                <select value={item.unit} onChange={e => updateLineItem(index, 'unit', e.target.value as Unit)} className="p-1 bg-background border-border rounded text-sm appearance-none text-center w-16 text-text-primary">{UNITS.map(u => <option key={u} value={u}>{u}</option>)}</select>
                                            </div>
                                            
                                            <div className="flex flex-col">
                                                <label className="text-[9px] text-text-secondary uppercase mb-1">Price</label>
                                                <input type="number" step="0.01" placeholder="Price" value={item.unitSellPrice || ''} onChange={e => updateLineItem(index, 'unitSellPrice', e.target.value)} className="w-20 p-1 bg-background border-border rounded text-sm font-semibold text-green-400" />
                                            </div>

                                            <div className="flex flex-col">
                                                <label className="text-[9px] text-text-secondary uppercase mb-1">Total</label>
                                                <input type="number" step="0.01" placeholder="Total" value={item.totalCost} onChange={e => updateLineItem(index, 'totalCost', e.target.value)} className="w-24 p-1 bg-background border-border rounded text-sm text-text-primary" />
                                            </div>
                                            
                                            <button type="button" onClick={() => handleRemoveLineItem(item.variant.id)} className="text-red-400 hover:text-red-600 mb-1"><XCircle size={18}/></button>
                                        </div>

                                        {/* Carton Calc */}
                                        {item.unit !== 'Carton' && cartonSize > 0 && (
                                            <div className="mt-2 flex justify-end">
                                                <button 
                                                    type="button" 
                                                    onClick={() => handleConvertToCartons(index)}
                                                    disabled={parseFloat(item.quantity) <= 0}
                                                    className="flex items-center text-xs px-2 py-1 rounded text-accent hover:text-on-accent bg-accent/10 hover:bg-accent/20 cursor-pointer"
                                                    title={`Click to convert ${item.quantity} ${item.unit} into full cartons`}
                                                >
                                                    <Calculator size={12} className="mr-1" />
                                                    {parseFloat(item.quantity) > 0 
                                                        ? `Convert to ${Math.ceil(parseFloat(item.quantity) / cartonSize)} Cartons`
                                                        : "Convert to Cartons"
                                                    }
                                                    <span className="text-text-secondary ml-1">({cartonSize} {uom}/box)</span>
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                        
                        {/* Search Bar */}
                        <div className="flex gap-2">
                            <div className="relative flex-grow">
                                <input type="text" placeholder="Search for product to add..." value={searchTerm} onChange={e => { setSearchTerm(e.target.value); setSelectedSearchItem(null); }} className="w-full p-2 bg-background border-border rounded text-text-primary" />
                                
                                {searchTerm && !selectedSearchItem && (
                                    <div className="absolute z-10 w-full bg-surface border border-border rounded-b-md mt-1 max-h-60 overflow-y-auto shadow-xl">
                                        {searchResults.map(item => (
                                            <div key={item.variant.id} onClick={() => handleSelectSearchItem(item.product, item.variant)} className="p-2 hover:bg-background cursor-pointer text-text-primary border-b border-border last:border-0">
                                                 <div className="font-medium">{item.product.name} - {item.variant.name}</div>
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
                            <button type="button" onClick={handleAddLineItem} disabled={!selectedSearchItem} className="py-2 px-4 bg-primary hover:bg-primary-hover rounded text-on-primary disabled:opacity-50">Add Item</button>
                        </div>
                    </div>

                    {editingOrder && (
                        <div className="mt-6">
                            <CollapsibleSection title="Change History" icon={<History className="w-6 h-6" />} defaultOpen={false}>
                                <ActivityHistory history={materialOrderHistory} />
                            </CollapsibleSection>
                        </div>
                    )}

                    <div className="flex justify-end space-x-4 mt-8 border-t border-border pt-6">
                        <button type="button" onClick={onClose} className="py-2 px-4 bg-secondary hover:bg-secondary-hover rounded text-on-secondary">Cancel</button>
                        <button type="submit" disabled={isSaving || !selectedProjectId} className="py-2 px-4 bg-primary hover:bg-secondary rounded text-on-primary disabled:opacity-50">{isSaving ? 'Saving...' : (editingOrder ? 'Save Changes' : 'Create Order')}</button>
                    </div>
                </form>
            </div>
            
            <AddEditVendorModal isOpen={isVendorModalOpen} onClose={() => setIsVendorModalOpen(false)} onSave={async (v) => { await addVendor(v); setIsVendorModalOpen(false); }} initialVendorType='Supplier' />
        </div>
    );
};

export default AddEditMaterialOrderModal;