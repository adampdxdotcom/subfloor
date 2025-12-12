import React, { useState, useEffect } from 'react';
import { X, Calculator, Plus, Trash2, ArrowRight } from 'lucide-react';
import { toast } from 'react-hot-toast';
import CreatableSelect from 'react-select/creatable';
import * as sampleService from '../services/sampleService';
import { useData } from '../context/DataContext';
import { calculatePrice, getActivePricingRules } from '../utils/pricingUtils';
import { PricingSettings, UNITS, ProductType } from '../types';

interface VariantGeneratorModalProps {
    productId: string;
    productType: ProductType; // NEW PROP
    manufacturerId?: number | null; // Passed from parent to look up vendor rules
    pricingSettings: PricingSettings | null; // Passed from parent
    onClose: () => void;
    onSuccess: (newVariants: any[]) => void;
}

// Helper to define options for react-select
interface Option {
    label: string;
    value: string;
}

const VariantGeneratorModal: React.FC<VariantGeneratorModalProps> = ({ productId, productType, manufacturerId, pricingSettings, onClose, onSuccess }) => {
    const { vendors, addVariantsBatch } = useData(); // Get the new function

    // --- 1. Common Data State (Applies to all) ---
    const [commonData, setCommonData] = useState({
        unitCost: '',
        retailPrice: '',
        cartonSize: '',
        uom: 'SF',
        pricingUnit: 'SF', // NEW: Defaults to SF
        sku: '', // New Field
        style: '',
        finish: '',
        hasSample: false // Default to Order Only (User Request)
    });

    // --- 2. The Lists State ---
    const [names, setNames] = useState<readonly Option[]>([]); // e.g. Colors
    const [sizes, setSizes] = useState<readonly Option[]>([]); // e.g. Sizes

    // --- 3. Preview State ---
    const [preview, setPreview] = useState<any[]>([]);
    
    // Size Options for autocomplete
    const [sizeOptions, setSizeOptions] = useState<Option[]>([]);

    useEffect(() => {
        loadSizeOptions();
    }, []);

    // --- SMART LABELS HELPERS ---
    const getLabels = () => {
        if (productType === 'Carpet' || productType === 'Sheet Product') {
            return { color: 'Colors / Styles', size: 'Roll Widths', showPackaging: false };
        }
        if (productType === 'LVP' || productType === 'LVT' || productType === 'Laminate' || productType === 'Hardwood') {
            return { color: 'Colors', size: 'Plank Sizes', showPackaging: true };
        }
        return { color: 'Colors', size: 'Sizes', showPackaging: true };
    };

    const labels = getLabels();

    const loadSizeOptions = async () => {
        try {
            // Note: Using a different endpoint than the product form to avoid confusion, 
            // assuming the product form is using /api/products/sizes/stats now.
            const stats = await sampleService.getUniqueSizeStats();
            setSizeOptions(stats.map(s => ({ label: s.value, value: s.value })));
        } catch (err) {
            console.error(err);
        }
    };

    // --- Auto-Calculate Retail Price on Cost Change ---
    const handleCostChange = (costInput: string) => {
        const cost = parseFloat(costInput);
        
        let newRetail = commonData.retailPrice;

        if (!isNaN(cost) && pricingSettings && cost > 0) {
            // 1. Find Vendor
            const manufacturer = vendors.find(v => v.id === manufacturerId);
            // 2. Get Rules
            const rules = getActivePricingRules(manufacturer, pricingSettings, 'Customer');
            // 3. Calculate
            const calculated = calculatePrice(cost, rules.percentage, rules.method);
            newRetail = calculated.toFixed(2);
        } else if (costInput === "") {
            newRetail = '';
        }

        setCommonData({ ...commonData, unitCost: costInput, retailPrice: newRetail });
    };

    // --- Generate Preview Logic ---
    useEffect(() => {
        if (names.length === 0 && sizes.length === 0) {
            setPreview([]);
            return;
        }

        const newPreview: any[] = [];
        
        // If one list is empty, treat it as having one "blank" item so we still generate rows
        const nameList = names.length > 0 ? names : [{ label: '', value: '' }];
        const sizeList = sizes.length > 0 ? sizes : [{ label: '', value: '' }];

        nameList.forEach(nameOpt => {
            sizeList.forEach(sizeOpt => {
                // Don't generate if both are empty (prevent 1 blank row)
                if (!nameOpt.value && !sizeOpt.value) return;

                newPreview.push({
                    name: nameOpt.value,
                    size: sizeOpt.value,
                    // Copy common data
                    ...commonData,
                    sku: commonData.sku, // Pass it through
                    // Ensure numbers are parsed for backend consistency
                    unitCost: parseFloat(commonData.unitCost) || 0,
                    retailPrice: parseFloat(commonData.retailPrice) || 0,
                    cartonSize: parseFloat(commonData.cartonSize) || 0,
                    hasSample: commonData.hasSample
                });
            });
        });

        setPreview(newPreview);
    }, [names, sizes, commonData]);


    const handleSave = async () => {
        if (preview.length === 0) return;
        try {
            // Use Context instead of Service
            await addVariantsBatch(productId, preview);
            
            // We don't have the 'created' array return from the context wrapper easily available
            // unless we modify the wrapper to return it. 
            // But onSuccess() was just for the toast mostly. 
            // Let's just call onSuccess with empty array or update signature if needed.
            onSuccess([]); 
            onClose();
        } catch (error: any) {
            // Toast is handled in context
            console.error(error);
        }
    };

    // React-Select Styles
    const selectStyles = {
        control: (base: any) => ({ ...base, backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)', color: 'var(--color-text-primary)' }),
        menu: (base: any) => ({ ...base, backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)', zIndex: 9999 }),
        option: (base: any, state: any) => ({
            ...base,
            backgroundColor: state.isFocused ? 'var(--color-background)' : 'var(--color-surface)',
            color: 'var(--color-text-primary)',
            cursor: 'pointer'
        }),
        multiValue: (base: any) => ({ ...base, backgroundColor: 'var(--color-primary)', color: 'var(--color-on-primary)' }),
        multiValueLabel: (base: any) => ({ ...base, color: 'var(--color-on-primary)' }),
        multiValueRemove: (base: any) => ({ ...base, color: 'var(--color-on-primary)', ':hover': { backgroundColor: 'var(--color-primary-hover)', color: 'var(--color-on-primary)' } }),
        input: (base: any) => ({ ...base, color: 'var(--color-text-primary)' }),
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 overflow-y-auto">
            <div className="bg-surface rounded-lg shadow-xl w-full max-w-5xl flex flex-col max-h-[90vh]">
                
                {/* HEADER */}
                <div className="flex justify-between items-center p-6 border-b border-border">
                    <div>
                        <h2 className="text-2xl font-bold text-text-primary flex items-center gap-2">
                            <Calculator size={24} className="text-primary" />
                            Variant Generator
                        </h2>
                        <p className="text-text-secondary text-sm mt-1">Cross-multiply lists to create variants in bulk.</p>
                    </div>
                    <button onClick={onClose} className="text-text-secondary hover:text-text-primary transition-colors">
                        <X size={24} />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-6 grid grid-cols-1 lg:grid-cols-3 gap-8">
                    
                    {/* LEFT COL: INPUTS */}
                    <div className="lg:col-span-1 space-y-6">
                        
                        {/* 1. Common Data */}
                        <div className="bg-background p-4 rounded-lg border border-border">
                            <h3 className="font-semibold text-text-primary mb-4 text-sm uppercase tracking-wider">1. Common Pricing & Specs</h3>
                            <div className="grid grid-cols-2 gap-3">
                                <div className="col-span-2">
                                    <label className="block text-xs font-medium text-text-secondary mb-1">Common SKU (Optional)</label>
                                    <input type="text" value={commonData.sku} onChange={e => setCommonData({...commonData, sku: e.target.value})} className="w-full p-2 bg-surface border border-border rounded text-text-primary" placeholder="e.g. Base SKU" />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-text-secondary mb-1">Unit Cost</label>
                                    <input type="number" step="0.01" value={commonData.unitCost} onChange={e => handleCostChange(e.target.value)} className="w-full p-2 bg-surface border border-border rounded text-text-primary" />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-text-secondary mb-1">Retail Price</label>
                                    <input type="number" step="0.01" value={commonData.retailPrice} onChange={e => setCommonData({...commonData, retailPrice: e.target.value})} className="w-full p-2 bg-surface border border-border rounded text-text-primary" />
                                </div>
                                <div className="col-span-2">
                                    <label className="block text-xs font-medium text-text-secondary mb-1">Pricing Unit</label>
                                    <select value={commonData.pricingUnit} onChange={e => setCommonData({...commonData, pricingUnit: e.target.value})} className="w-full p-2 bg-surface border border-border rounded text-text-primary">
                                        {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                                    </select>
                                </div>
                                
                                {labels.showPackaging && (
                                    <>
                                        <div className="col-span-2 border-t border-border my-1"></div>
                                        <div>
                                            <label className="block text-xs font-medium text-text-secondary mb-1">Carton Size</label>
                                            <input type="number" step="0.01" value={commonData.cartonSize} onChange={e => setCommonData({...commonData, cartonSize: e.target.value})} className="w-full p-2 bg-surface border border-border rounded text-text-primary" />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-medium text-text-secondary mb-1">Packaging UOM</label>
                                            <select value={commonData.uom} onChange={e => setCommonData({...commonData, uom: e.target.value})} className="w-full p-2 bg-surface border border-border rounded text-text-primary">
                                                {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                                            </select>
                                        </div>
                                    </>
                                )}

                                <div className="col-span-2">
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input type="checkbox" checked={commonData.hasSample} onChange={e => setCommonData({...commonData, hasSample: e.target.checked})} className="rounded border-border bg-surface text-primary focus:ring-primary" />
                                        <span className="text-sm text-text-primary">We carry samples for these</span>
                                    </label>
                                </div>
                            </div>
                        </div>

                        {/* 2. Lists */}
                        <div className="bg-background p-4 rounded-lg border border-border">
                            <h3 className="font-semibold text-text-primary mb-4 text-sm uppercase tracking-wider">2. Define Lists</h3>
                            
                            <div className="mb-4">
                                <label className="block text-sm font-medium text-text-secondary mb-1">{labels.color}</label>
                                <p className="text-xs text-text-secondary mb-2">Type a name and press Enter</p>
                                <CreatableSelect
                                    isMulti
                                    placeholder={`e.g. ${labels.color.includes('Style') ? 'Berber, Plush...' : 'Oak, Maple...'}`}
                                    styles={selectStyles}
                                    onChange={(newValue) => setNames(newValue)}
                                    value={names}
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-text-secondary mb-1">{labels.size}</label>
                                <p className="text-xs text-text-secondary mb-2">Select existing or type new</p>
                                <CreatableSelect
                                    isMulti
                                    placeholder={`e.g. ${labels.size.includes('Width') ? "12', 15'..." : '12x24, Mosaic...'}`}
                                    options={sizeOptions}
                                    styles={selectStyles}
                                    onChange={(newValue) => setSizes(newValue)}
                                    value={sizes}
                                />
                            </div>
                        </div>

                    </div>

                    {/* RIGHT COL: PREVIEW */}
                    <div className="lg:col-span-2 flex flex-col h-full">
                        <h3 className="font-semibold text-text-primary mb-4 text-sm uppercase tracking-wider flex justify-between items-center">
                            <span>3. Preview ({preview.length} items)</span>
                            {preview.length > 0 && <span className="text-xs text-primary font-normal">Ready to generate</span>}
                        </h3>
                        
                        <div className="flex-1 bg-background border border-border rounded-lg overflow-hidden flex flex-col">
                            {preview.length === 0 ? (
                                <div className="flex-1 flex flex-col items-center justify-center text-text-secondary p-8 text-center opacity-50">
                                    <ArrowRight size={48} className="mb-4" />
                                    <p className="text-lg">Enter Data & Lists to see preview</p>
                                </div>
                            ) : (
                                <div className="overflow-auto flex-1">
                                    <table className="w-full text-left border-collapse">
                                        <thead className="bg-surface sticky top-0">
                                            <tr>
                                                <th className="p-3 text-xs font-medium text-text-secondary border-b border-border">{labels.color}</th>
                                                <th className="p-3 text-xs font-medium text-text-secondary border-b border-border">SKU</th>
                                                <th className="p-3 text-xs font-medium text-text-secondary border-b border-border">{labels.size}</th>
                                                <th className="p-3 text-xs font-medium text-text-secondary border-b border-border text-right">Cost</th>
                                                <th className="p-3 text-xs font-medium text-text-secondary border-b border-border text-right">Retail</th>
                                                {labels.showPackaging && <th className="p-3 text-xs font-medium text-text-secondary border-b border-border">Carton</th>}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {preview.map((item, idx) => (
                                                <tr key={idx} className="border-b border-border hover:bg-surface/50">
                                                    <td className="p-3 text-sm text-text-primary font-medium">{item.name || <span className="italic text-text-secondary">--</span>}</td>
                                                    <td className="p-3 text-sm text-text-secondary">{item.sku || <span className="italic text-text-secondary">--</span>}</td>
                                                    <td className="p-3 text-sm text-text-primary">{item.size || <span className="italic text-text-secondary">--</span>}</td>
                                                    <td className="p-3 text-sm text-text-primary text-right">${item.unitCost.toFixed(2)} / {item.pricingUnit}</td>
                                                    <td className="p-3 text-sm text-text-primary text-right">${item.retailPrice.toFixed(2)} / {item.pricingUnit}</td>
                                                    {labels.showPackaging && <td className="p-3 text-sm text-text-primary">{item.cartonSize} {item.uom}</td>}
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    </div>

                </div>

                {/* FOOTER */}
                <div className="p-6 border-t border-border flex justify-end gap-3 bg-surface">
                    <button onClick={onClose} className="px-4 py-2 text-text-primary hover:bg-background rounded-md transition-colors">
                        Cancel
                    </button>
                    <button 
                        onClick={handleSave} 
                        disabled={preview.length === 0}
                        className="px-6 py-2 bg-primary text-on-primary font-medium rounded-md hover:bg-primary-hover disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                        <Plus size={18} />
                        Generate {preview.length} Variants
                    </button>
                </div>
            </div>
        </div>
    );
};

export default VariantGeneratorModal;