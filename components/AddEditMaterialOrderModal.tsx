import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useData } from '../context/DataContext';
import { MaterialOrder, Sample, Unit, UNITS, Vendor, PricingSettings, Project } from '../types';
import { X, Package as PackageIcon, History, Calculator, XCircle } from 'lucide-react';
import AddEditVendorModal from './AddEditVendorModal';
import AddSampleInlineModal from './AddSampleInlineModal';
import CollapsibleSection from './CollapsibleSection';
import ActivityHistory from './ActivityHistory';
import GlobalProjectSelector from './GlobalProjectSelector'; // <-- CHANGED
import * as preferenceService from '../services/preferenceService';
import { calculatePrice, getActivePricingRules } from '../utils/pricingUtils';
import { toast } from 'react-hot-toast';

// --- Local Data Structure for Line Items (matches the original component state) ---
interface LineItemState {
    sample: Sample;
    sizeVariant?: string;
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
    initialProjectId?: number | null; // Required for creating a new order
}

const formatSampleName = (sample: Sample) => {
    const parts = [];
    if (sample.style) parts.push(sample.style);
    if (sample.color) parts.push(sample.color);
    if (parts.length === 0) return `Sample #${sample.id}`;
    return parts.join(' - ');
};

const formatDateForInput = (dateString: string | undefined | null) => dateString ? new Date(dateString).toISOString().split('T')[0] : '';


const AddEditMaterialOrderModal: React.FC<AddEditMaterialOrderModalProps> = ({ isOpen, onClose, editingOrder = null, initialProjectId = null }) => {
    
    const { 
        samples, vendors, addVendor, 
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
    
    const [sampleSearchTerm, setSampleSearchTerm] = useState('');
    const [selectedSample, setSelectedSample] = useState<Sample | null>(null);
    const [isAddingNewSample, setIsAddingNewSample] = useState(false);
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

    const sampleSearchResults = useMemo(() => { 
        if (sampleSearchTerm.length < 2) return [];
        const lowercasedTerm = sampleSearchTerm.toLowerCase(); 
        return samples.filter(s => 
            (s.style?.toLowerCase().includes(lowercasedTerm)) || 
            (s.color?.toLowerCase().includes(lowercasedTerm)) ||
            (s.manufacturerName && s.manufacturerName.toLowerCase().includes(lowercasedTerm))
        ); 
    }, [samples, sampleSearchTerm]);


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

            const itemsToEdit = editingOrder.lineItems.map(item => {
                const sample = samples.find(s => s.id === item.sampleId);

                let calculatedSellPrice = item.unitPriceSold !== null && item.unitPriceSold !== undefined
                    ? item.unitPriceSold.toFixed(2)
                    : (item.totalCost && item.quantity) ? (item.totalCost / item.quantity).toFixed(2) : '';

                // We don't currently store the specific 'sizeVariant' string in the order line item,
                // but we can default to the first one if needed, or leave blank.
                const defaultSizeVariant = (sample?.sizes && sample.sizes.length > 0) 
                    ? (typeof sample.sizes[0] === 'string' ? sample.sizes[0] : sample.sizes[0].value) 
                    : undefined;

                return {
                    sample: sample!,
                    sizeVariant: defaultSizeVariant,
                    quantity: String(item.quantity),
                    unit: item.unit as Unit || 'SF',
                    totalCost: item.totalCost != null ? String(item.totalCost) : '',
                    unitSellPrice: calculatedSellPrice,
                };
            }).filter(item => item.sample);
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
    }, [editingOrder, isOpen, initialProjectId, samples, vendors, fetchMaterialOrderHistory]);


    const handleSupplierSelect = (vendorId: number) => {
        setSupplierId(vendorId);
        const selectedVendor = vendors.find(v => v.id === vendorId);
        setSupplierSearch(selectedVendor?.name || '');
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
    
    const handleSelectSample = (sample: Sample) => { 
        setSelectedSample(sample); 
        setSampleSearchTerm(formatSampleName(sample)); 
    };

    // --- Core Line Item Logic (Extracted from old component) ---
    const handleAddLineItem = () => {
        if (selectedSample && pricingSettings && !lineItems.some(item => item.sample.id === selectedSample.id)) {
            
            let initialSellPrice = '';
            let initialUnit: Unit = (selectedSample.uom as Unit) || 'SF';
            let initialSizeVariant: string | undefined = undefined;

            if (selectedSample.sizes && selectedSample.sizes.length > 0) {
                const firstVariant = selectedSample.sizes[0];
                initialSizeVariant = typeof firstVariant === 'string' ? firstVariant : firstVariant.value;
                
                if (typeof firstVariant !== 'string' && firstVariant.unitCost) {
                     const vendor = vendors.find(v => v.id === (selectedSample.supplierId || selectedSample.manufacturerId));
                     const rules = getActivePricingRules(vendor, pricingSettings, purchaserType);
                     initialSellPrice = calculatePrice(Number(firstVariant.unitCost), rules.percentage, rules.method).toFixed(2);
                     if (firstVariant.uom) initialUnit = firstVariant.uom;
                }
            } else if (selectedSample.unitCost) {
                const vendor = vendors.find(v => v.id === (selectedSample.supplierId || selectedSample.manufacturerId));
                const rules = getActivePricingRules(vendor, pricingSettings, purchaserType);
                const price = calculatePrice(Number(selectedSample.unitCost), rules.percentage, rules.method);
                initialSellPrice = price.toFixed(2);
            }

            setLineItems(prev => [...prev, { 
                sample: selectedSample, 
                sizeVariant: initialSizeVariant,
                quantity: '1', 
                unit: initialUnit,
                totalCost: initialSellPrice, 
                unitSellPrice: initialSellPrice 
            }]);
            
            // Auto-select supplier if not already chosen
            if (!supplierId && selectedSample.supplierId) {
                handleSupplierSelect(selectedSample.supplierId);
            } else if (!supplierId && selectedSample.manufacturerId) {
                 const manufacturer = vendors.find(v => v.id === selectedSample.manufacturerId);
                if (manufacturer && (manufacturer.vendorType === 'Supplier' || manufacturer.vendorType === 'Both')) {
                    handleSupplierSelect(manufacturer.id);
                }
            }
            setSampleSearchTerm(''); 
            setSelectedSample(null);
        }
    };

    const updateLineItem = useCallback((index: number, field: keyof LineItemState, value: string|Unit) => { 
        setLineItems(prev => {
            const newItems = [...prev]; 
            (newItems[index] as any)[field] = value;
            const item = newItems[index];

            // If Size Variant changes, update the Price/Carton/UOM
            if (field === 'sizeVariant') {
                const variant = item.sample.sizes?.find(s => (typeof s === 'string' ? s : s.value) === value);
                if (variant && typeof variant !== 'string' && variant.unitCost && pricingSettings) {
                     const vendor = vendors.find(v => v.id === (item.sample.supplierId || item.sample.manufacturerId));
                     const rules = getActivePricingRules(vendor, pricingSettings, purchaserType);
                     const price = calculatePrice(Number(variant.unitCost), rules.percentage, rules.method);
                     newItems[index].unitSellPrice = price.toFixed(2);
                     newItems[index].unit = (variant.uom as Unit) || item.sample.uom as Unit || 'SF';
                }
            }

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
    }, [pricingSettings, purchaserType, vendors]);

    const handleRemoveLineItem = (sampleId: number) => { setLineItems(prev => prev.filter(item => item.sample.id !== sampleId)); };

    const handleConvertToCartons = useCallback((index: number) => {
        const item = lineItems[index];
        
        // --- Helper: Find active variant carton size ---
        let activeVariant = null;
        if (item.sizeVariant && item.sample.sizes) {
            activeVariant = item.sample.sizes.find(s => {
                const val = typeof s === 'string' ? s : (s.value || (s as any).size);
                return val === item.sizeVariant;
            });
        }
        const variantCarton = (activeVariant && typeof activeVariant !== 'string') ? activeVariant.cartonSize : null;
        const baseCarton = item.sample.cartonSize;
        const cartonSize = Number(variantCarton || baseCarton || 0);
        
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

    // --- Modals and Saving ---

    const handleSaveVendor = async (vendorData: Omit<Vendor, 'id'>) => {
        try {
            const newVendor = await addVendor(vendorData);
            setIsVendorModalOpen(false);
            // If manufacturer search was active, automatically select the new vendor as manufacturer
            if (vendorData.vendorType === 'Manufacturer' || vendorData.vendorType === 'Both') {
                setSupplierSearch(newVendor.name);
                setSupplierId(newVendor.id);
            }
        } catch (error) { console.error(error); }
    };
    
    const onSampleCreated = (createdSample: Sample) => {
        setIsAddingNewSample(false);
        setLineItems(prev => [...prev, { 
            sample: createdSample, 
            sizeVariant: (createdSample.sizes && createdSample.sizes.length > 0) 
                ? (typeof createdSample.sizes[0] === 'string' ? createdSample.sizes[0] : createdSample.sizes[0].value) 
                : undefined,
            quantity: '1', 
            unit: (createdSample.uom as Unit) || 'SF', 
            totalCost: '', 
            unitSellPrice: '' 
        }]);
        setSampleSearchTerm('');
        setSelectedSample(null);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedProjectId) { toast.error('Please select a project.'); return; }
        if (!supplierId) { toast.error('Please select a supplier.'); return; }
        if (lineItems.length === 0) { toast.error('Please add at least one line item.'); return; }
        
        setIsSaving(true);

        const lineItemsPayload = lineItems.map(item => ({ 
            sampleId: item.sample.id, 
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
            {/* Increased max-width from 2xl to 4xl for better layout of pricing columns */}
            <div className="bg-surface p-8 rounded-lg shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto border border-border">
                <div className="flex justify-between items-center mb-6 border-b border-border pb-4">
                    <h2 className="text-2xl font-bold text-text-primary flex items-center gap-2">
                        <PackageIcon className="text-primary" />
                        {titleText}
                    </h2>
                    <button onClick={onClose} className="text-text-secondary hover:text-text-primary"><X size={24} /></button>
                </div>

                <form onSubmit={handleSubmit}>
                    {/* Project Selector (Only if not locked) */}
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
                            <label htmlFor="notes" className="block text-sm font-medium text-text-secondary mb-1">Notes (for order/receiving)</label>
                            <textarea id="notes" value={notes} onChange={e => setNotes(e.target.value)} rows={2} className="w-full p-2 bg-background border border-border rounded text-text-primary" placeholder="Delivery instructions, gate code, etc..." />
                        </div>
                    </div>

                    {/* Line Items Section */}
                    <div className="bg-background p-4 rounded-lg border border-border mb-6">
                        <h3 className="font-semibold mb-2 text-text-primary">Line Items</h3>
                        <div className="space-y-2 mb-4">
                            {lineItems.map((item, index) => { 
                                
                                // --- Helper: Find active variant data ---
                                let activeVariant = null;
                                if (item.sizeVariant && item.sample.sizes) {
                                    activeVariant = item.sample.sizes.find(s => {
                                        const val = typeof s === 'string' ? s : (s.value || (s as any).size);
                                        return val === item.sizeVariant;
                                    });
                                }
                                    
                                const variantCarton = (activeVariant && typeof activeVariant !== 'string') ? activeVariant.cartonSize : null;
                                const baseCarton = item.sample.cartonSize;
                                const cartonSize = Number(variantCarton || baseCarton || 0);

                                const uom = (activeVariant && typeof activeVariant !== 'string' && activeVariant.uom) ? activeVariant.uom : (item.sample.uom || 'SF');
                                
                                return (
                                    <div key={item.sample.id} className="bg-surface border border-border p-2 rounded mb-2">
                                        <div className="grid grid-cols-[1.5fr,1fr,auto,auto,auto,auto,auto] items-end gap-2">
                                            {/* Product Name */}
                                            <div className="flex flex-col overflow-hidden">
                                                <label className="text-[9px] text-text-secondary uppercase mb-1">Product</label>
                                                <span className="text-sm text-text-primary truncate font-medium" title={formatSampleName(item.sample)}>{formatSampleName(item.sample)}</span>
                                            </div>

                                            {/* Size Selector (if applicable) */}
                                            <div className="flex flex-col">
                                                <label className="text-[9px] text-text-secondary uppercase mb-1">Size / Variant</label>
                                                {item.sample.sizes && item.sample.sizes.length > 0 ? (
                                                    <select value={item.sizeVariant || ''} onChange={e => updateLineItem(index, 'sizeVariant', e.target.value)} className="w-full p-1 bg-background border-border rounded text-sm text-text-primary">
                                                        {item.sample.sizes.map(s => {
                                                            const val = typeof s === 'string' ? s : (s.value || (s as any).size);
                                                            return <option key={val} value={val}>{val}</option>;
                                                        })}
                                                    </select>
                                                ) : (
                                                    <span className="text-xs text-text-secondary py-1">Standard</span>
                                                )}
                                            </div>

                                            <div className="flex flex-col">
                                                <label className="text-[9px] text-text-secondary uppercase mb-1">Qty</label>
                                                <input type="number" placeholder="Qty" value={item.quantity} onChange={e => updateLineItem(index, 'quantity', e.target.value)} className="w-16 p-1 bg-background border-border rounded text-sm text-text-primary" />
                                            </div>

                                            <div className="flex flex-col">
                                                <label className="text-[9px] text-text-secondary uppercase mb-1">Unit</label>
                                                <select value={item.unit} onChange={e => updateLineItem(index, 'unit', e.target.value as Unit)} className="p-1 bg-background border-border rounded text-sm appearance-none text-center w-16 text-text-primary">{UNITS.map(u => <option key={u} value={u}>{u}</option>)}</select>
                                            </div>
                                            
                                            {/* Unit Sell Price (Calculated/Manual) */}
                                            <div className="flex flex-col">
                                                <label className="text-[9px] text-text-secondary uppercase mb-1">Price</label>
                                                <input type="number" step="0.01" placeholder="Price" value={item.unitSellPrice || ''} onChange={e => updateLineItem(index, 'unitSellPrice', e.target.value)} className="w-20 p-1 bg-background border-border rounded text-sm font-semibold text-green-400" />
                                            </div>

                                            {/* Total Cost (Auto-calculated) */}
                                            <div className="flex flex-col">
                                                <label className="text-[9px] text-text-secondary uppercase mb-1">Total</label>
                                                <input type="number" step="0.01" placeholder="Total" value={item.totalCost} onChange={e => updateLineItem(index, 'totalCost', e.target.value)} className="w-24 p-1 bg-background border-border rounded text-sm text-text-primary" />
                                            </div>
                                            
                                            <button type="button" onClick={() => handleRemoveLineItem(item.sample.id)} className="text-red-400 hover:text-red-600 mb-1"><XCircle size={18}/></button>
                                        </div>

                                        {/* --- HELPER: Carton Calculator --- */}
                                        {item.unit !== 'Carton' && (
                                            <div className="mt-2 flex justify-end">
                                                <button 
                                                    type="button" 
                                                    onClick={() => handleConvertToCartons(index)}
                                                    disabled={!cartonSize || parseFloat(item.quantity) <= 0}
                                                    className={`flex items-center text-xs px-2 py-1 rounded transition-colors ${
                                                        (cartonSize && parseFloat(item.quantity) > 0)
                                                        ? 'text-accent hover:text-on-accent bg-accent/10 hover:bg-accent/20 cursor-pointer' 
                                                        : 'text-text-secondary bg-background cursor-not-allowed opacity-50'
                                                    }`}
                                                    title={cartonSize ? `Click to convert ${item.quantity} ${item.unit} into full cartons` : 'No carton size defined for this item'}
                                                >
                                                    <Calculator size={12} className="mr-1" />
                                                    {cartonSize && parseFloat(item.quantity) > 0 
                                                        ? `Convert to ${Math.ceil(parseFloat(item.quantity) / cartonSize)} Cartons`
                                                        : "Convert to Cartons"
                                                    }
                                                    {cartonSize ? <span className="text-text-secondary ml-1">({cartonSize} {uom}/box)</span> : ''}
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                        <div className="flex gap-2">
                            <div className="relative flex-grow">
                                <input type="text" placeholder="Search for material to add..." value={sampleSearchTerm} onChange={e => { setSampleSearchTerm(e.target.value); setSelectedSample(null); }} className="w-full p-2 bg-background border-border rounded text-text-primary" />
                                {sampleSearchTerm && !selectedSample && (
                                    <div className="absolute z-10 w-full bg-surface border border-border rounded-b-md mt-1 max-h-40 overflow-y-auto">
                                        {sampleSearchResults.map(s => ( <div key={s.id} onClick={() => { setSelectedSample(s); setSampleSearchTerm(formatSampleName(s)); }} className="p-2 hover:bg-background cursor-pointer text-text-primary">{formatSampleName(s)}</div> ))}
                                        {sampleSearchResults.length === 0 && ( <div className="p-2 text-center text-text-secondary">No results. <button type="button" onClick={() => setIsAddingNewSample(true)} className="ml-2 text-accent font-semibold hover:underline">Add it?</button></div> )}
                                    </div>
                                )}
                            </div>
                            <button type="button" onClick={handleAddLineItem} disabled={!selectedSample} className="py-2 px-4 bg-primary hover:bg-primary-hover rounded text-on-primary disabled:opacity-50">Add Item</button>
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
            <AddSampleInlineModal isOpen={isAddingNewSample} onClose={() => setIsAddingNewSample(false)} onSampleCreated={onSampleCreated} initialSearchTerm={sampleSearchTerm} />
        </div>
    );
};

export default AddEditMaterialOrderModal;