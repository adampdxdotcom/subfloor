import React, { useState, useEffect } from 'react';
import { useData } from '../../context/DataContext'; // Need vendors
import { ImportProfile, ImportField, PRODUCT_TYPES } from '../../types';
import { ArrowRight, Save, ArrowLeft, X, RefreshCw } from 'lucide-react'; // Added RefreshCw icon
import { toast } from 'react-hot-toast';
import axios from 'axios';

interface ColumnMapperProps {
    rawData: any[][];
    fileName: string;
    onBack: () => void;
    onComplete: (mappedData: any[], strategy: string) => void;
    isGeneratingPreview: boolean; // Added for loading state
    onDefaultsChange: (defaults: any) => void; // New callback
}

// The fields we want to extract
const TARGET_FIELDS: { key: ImportField; label: string; required: boolean }[] = [
    { key: 'manufacturer', label: 'Manufacturer', required: false },
    { key: 'productName', label: 'Product Name (Line)', required: true },
    { key: 'variantName', label: 'Variant Name (Color)', required: false },
    { key: 'sku', label: 'SKU', required: false },
    { key: 'size', label: 'Size', required: false },
    { key: 'cartonSize', label: 'Carton Size', required: false },
    { key: 'unitCost', label: 'Unit Cost', required: true },
    { key: 'retailPrice', label: 'Retail Price', required: false },
];

// Helper to clean strings on the frontend
const cleanValue = (val: any) => {
    if (typeof val !== 'string') return val;
    return val.replace(/[\u0000-\u001F\u007F-\u009F]/g, "").trim(); // Remove control chars
};

const ColumnMapper: React.FC<ColumnMapperProps> = ({ rawData, fileName, onBack, onComplete, isGeneratingPreview, onDefaultsChange }) => {
    const { vendors } = useData();

    // State
    const [mapping, setMapping] = useState<Record<string, string>>({}); 
    const [strategy, setStrategy] = useState<'variant_match' | 'product_line_match'>('variant_match');
    
    // Profile State
    const [profiles, setProfiles] = useState<ImportProfile[]>([]);
    const [selectedProfileId, setSelectedProfileId] = useState<string>('');
    const [newProfileName, setNewProfileName] = useState('');
    const [isSavingProfile, setIsSavingProfile] = useState(false);

    // Global Defaults State
    const [defaultManufId, setDefaultManufId] = useState<string>('');
    const [defaultProductType, setDefaultProductType] = useState<string>('');

    // --- CRITICAL FIX: Determine Columns by scanning the WHOLE file ---
    // Find the row with the most columns to ensure we offer A, B, C... F, etc.
    const maxCols = rawData.reduce((max, row) => Math.max(max, row.length), 0);
    const columnIndices = Array.from({ length: maxCols }, (_, i) => i);
    
    // Get a representative sample row (first non-empty row) for preview text
    const sampleRow = rawData.find(r => r.length > 0) || [];

    // --- LOAD PROFILES ON MOUNT ---
    useEffect(() => {
        axios.get('/api/import/profiles')
            .then(res => setProfiles(res.data))
            .catch(err => console.error("Failed to load profiles", err));
    }, []);

    // --- HANDLERS ---
    
    const handleMappingChange = (field: string, columnIndex: string) => {
        setMapping(prev => ({ ...prev, [field]: columnIndex }));
    };

    const handleDefaultManufChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const id = e.target.value;
        setDefaultManufId(id);
        // Auto-select product type if vendor has one
        const vendor = vendors.find(v => v.id === Number(id));
        if (vendor?.defaultProductType) {
            setDefaultProductType(vendor.defaultProductType);
        }
    };

    const handleProfileChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const id = e.target.value;
        setSelectedProfileId(id);
        if (id) {
            const profile = profiles.find(p => p.id === Number(id));
            if (profile) {
                // Handle legacy profiles (just mapping) vs new profiles (mapping + defaults)
                const rules = profile.mappingRules as any;
                setMapping(rules.mapping || rules); // Fallback for old format
                
                if (rules.defaults) {
                    setDefaultManufId(rules.defaults.manufacturerId || '');
                    setDefaultProductType(rules.defaults.productType || '');
                }
            }
        } else {
            setMapping({});
            setDefaultManufId('');
            setDefaultProductType('');
        }
    };

    const handleSaveProfile = async (isUpdate = false) => {
        const name = isUpdate ? profiles.find(p => p.id === Number(selectedProfileId))?.profileName : newProfileName;
        if (!name) return toast.error("Enter a profile name first.");
        
        try {
            const res = await axios.post('/api/import/profiles', {
                profileName: name,
                mappingRules: {
                    mapping,
                    defaults: {
                        manufacturerId: defaultManufId,
                        productType: defaultProductType
                    }
                }
            });
            toast.success(isUpdate ? "Profile updated!" : "Profile saved!");
            
            // Update local list
            setProfiles(prev => {
                const filtered = prev.filter(p => p.id !== res.data.id);
                return [...filtered, res.data].sort((a, b) => a.profileName.localeCompare(b.profileName));
            });
            
            if (!isUpdate) {
                setSelectedProfileId(String(res.data.id));
                setIsSavingProfile(false);
            }
        } catch (error) {
            console.error(error);
            toast.error("Failed to save profile.");
        }
    };

    const handleNext = () => {
        // Validation
        // 1. Check Mapping
        const missingRequired = TARGET_FIELDS.filter(f => f.required && !mapping[f.key]);
        if (missingRequired.length > 0) {
            toast.error(`Missing required fields: ${missingRequired.map(f => f.label).join(', ')}`);
            return;
        }

        // 2. Check Defaults (Optional but recommended)
        // We pass defaults separate from rows so backend can apply them where data is missing
        const defaults = {
            manufacturerId: defaultManufId ? Number(defaultManufId) : null,
            productType: defaultProductType || null
        };
        
        // Pass defaults up to parent
        onDefaultsChange(defaults);

        // Convert raw data to Mapped Objects
        const mappedRows = rawData.map((row, index) => {
            const mappedObj: any = { originalRowIndex: index };
            
            Object.entries(mapping).forEach(([fieldKey, colIndex]) => {
                if (colIndex !== "") {
                    const idx = parseInt(colIndex);
                    // Safety check
                    if (idx >= row.length) return;

                    let value = row[idx];
                    
                    // Basic cleanup
                    if (typeof value === 'string') {
                        value = cleanValue(value); // Apply the heavy cleaner
                        if (value === '') value = null;
                    }
                    
                    // Numeric conversion for price fields
                    if (['unitCost', 'retailPrice', 'cartonSize'].includes(fieldKey) && value !== null) {
                         // Remove currency symbols ($) and commas
                         if (typeof value === 'string') {
                             // Remove everything that isn't a digit, decimal point, or negative sign
                             value = value.replace(/[^0-9.-]+/g, "");
                         }
                         const num = parseFloat(value);
                         value = isNaN(num) ? null : num;
                    }

                    mappedObj[fieldKey] = value;
                }
            });
            return mappedObj;
        })
        // --- FILTER: Remove rows that don't have a Product Name ---
        // This removes empty lines and "junk" rows automatically
        .filter(row => row.productName);

        onComplete(mappedRows, strategy);
    };

    return (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            
            {/* TOOLBAR: PROFILES */}
            <div className="p-6 border-b border-gray-200 bg-gray-50 flex flex-wrap justify-between items-center gap-4">
                <div>
                    <h2 className="text-lg font-bold text-gray-900">Map Columns</h2>
                    <p className="text-sm text-gray-500">Match your Excel columns to Joblogger fields.</p>
                </div>
                
                <div className="flex items-center gap-2 bg-white p-2 rounded-lg border border-gray-200 shadow-sm">
                    <span className="text-sm font-medium text-gray-700 pl-2">Load Profile:</span>
                    <select 
                        className="border-none text-sm focus:ring-0 text-indigo-600 font-bold bg-transparent"
                        value={selectedProfileId}
                        onChange={handleProfileChange}
                    >
                        <option value="">-- None --</option>
                        {profiles.map(p => (
                            <option key={p.id} value={p.id}>{p.profileName}</option>
                        ))}
                    </select>
                </div>
            </div>

            <div className="p-8 grid grid-cols-1 lg:grid-cols-2 gap-12">
                
                {/* LEFT: MAPPING FORM */}
                <div className="space-y-6">
                    {TARGET_FIELDS.map(field => (
                        <div key={field.key} className="flex items-center justify-between group">
                            <label className={`text-sm ${field.required ? 'font-bold text-gray-900' : 'text-gray-500'}`}>
                                {field.label} {field.required && <span className="text-red-500">*</span>}
                            </label>
                            
                            <select 
                                className={`w-64 text-sm rounded-md shadow-sm border ${mapping[field.key] ? 'border-indigo-300 bg-indigo-50 text-indigo-900' : 'border-gray-300'}`}
                                value={mapping[field.key] || ""}
                                onChange={(e) => handleMappingChange(field.key, e.target.value)}
                            >
                                <option value="">(Skip)</option>
                                {columnIndices.map((idx) => (
                                    <option key={idx} value={String(idx)}>
                                        Col {String.fromCharCode(65 + idx)}
                                        {sampleRow[idx] ? `: ${String(sampleRow[idx]).substring(0, 20)}` : ''}
                                    </option>
                                ))}
                            </select>
                        </div>
                    ))}

                    {/* STRATEGY SELECTOR */}
                    <div className="pt-6 border-t border-gray-100 mt-6">
                        <label className="block text-sm font-bold text-gray-900 mb-2">Import Strategy</label>
                        <div className="grid grid-cols-2 gap-4">
                            <label className={`border p-4 rounded-lg cursor-pointer transition-all ${strategy === 'variant_match' ? 'border-indigo-500 bg-indigo-50 ring-1 ring-indigo-500' : 'border-gray-200 hover:border-gray-300'}`}>
                                <input type="radio" name="strategy" className="hidden" checked={strategy === 'variant_match'} onChange={() => setStrategy('variant_match')} />
                                <div className="font-bold text-sm text-gray-900 mb-1">Variant Match</div>
                                <p className="text-xs text-gray-500">Update specific colors/sizes. Best for detailed price lists.</p>
                            </label>
                            <label className={`border p-4 rounded-lg cursor-pointer transition-all ${strategy === 'product_line_match' ? 'border-indigo-500 bg-indigo-50 ring-1 ring-indigo-500' : 'border-gray-200 hover:border-gray-300'}`}>
                                <input type="radio" name="strategy" className="hidden" checked={strategy === 'product_line_match'} onChange={() => setStrategy('product_line_match')} />
                                <div className="font-bold text-sm text-gray-900 mb-1">Line Match</div>
                                <p className="text-xs text-gray-500">Update ALL variants of a product to this price. Best for generic price lists.</p>
                            </label>
                        </div>
                    </div>
                </div>

                {/* RIGHT: DEFAULTS & PROFILE */}
                <div className="space-y-6">
                    
                    {/* GLOBAL DEFAULTS PANEL */}
                    <div className="bg-indigo-50 rounded-xl p-6 border border-indigo-100">
                        <h3 className="font-bold text-indigo-900 mb-2">Global Defaults</h3>
                        <p className="text-xs text-indigo-700 mb-4">
                            If the CSV is missing this data, use these values for <strong>New Products</strong>.
                        </p>
                        
                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-indigo-800 uppercase mb-1">Manufacturer</label>
                                <select 
                                    className="w-full text-sm rounded border-indigo-200"
                                    value={defaultManufId}
                                    onChange={handleDefaultManufChange}
                                >
                                    <option value="">-- None (Use CSV) --</option>
                                    {vendors.sort((a,b) => a.name.localeCompare(b.name)).map(v => (
                                        <option key={v.id} value={v.id}>{v.name}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-indigo-800 uppercase mb-1">Product Type</label>
                                <select 
                                    className="w-full text-sm rounded border-indigo-200"
                                    value={defaultProductType}
                                    onChange={(e) => setDefaultProductType(e.target.value)}
                                >
                                    <option value="">-- None --</option>
                                    {PRODUCT_TYPES.map(t => (
                                        <option key={t} value={t}>{t}</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    </div>

                    {/* SAVE PROFILE PANEL */}
                    <div className="bg-gray-50 rounded-xl p-6 border border-gray-200 h-fit">
                    <h3 className="font-bold text-gray-900 mb-4">Save this Mapping</h3>
                    <p className="text-sm text-gray-600 mb-4">
                        If you receive this file format regularly, save it as a profile to auto-fill these fields next time.
                    </p>
                    
                    {/* UPDATE EXISTING BUTTON */}
                    {selectedProfileId && !isSavingProfile && (
                        <button 
                            onClick={() => handleSaveProfile(true)}
                            className="w-full mb-3 text-sm font-bold text-indigo-700 bg-indigo-100 hover:bg-indigo-200 py-2 rounded flex items-center justify-center gap-2 transition-colors"
                        >
                            <RefreshCw size={16} /> Update "{profiles.find(p => p.id === Number(selectedProfileId))?.profileName}"
                        </button>
                    )}

                    {!isSavingProfile ? (
                         <button 
                            onClick={() => setIsSavingProfile(true)}
                            className="text-sm font-medium text-indigo-600 hover:text-indigo-800 flex items-center gap-2"
                         >
                            <Save size={16} /> Save as New Profile
                         </button>
                    ) : (
                        <div className="flex gap-2">
                            <input 
                                type="text" 
                                placeholder="Profile Name" 
                                className="flex-1 text-sm rounded border-gray-300"
                                value={newProfileName}
                                onChange={(e) => setNewProfileName(e.target.value)}
                            />
                            <button onClick={() => handleSaveProfile(false)} className="bg-indigo-600 text-white px-3 rounded text-xs font-bold">Save</button>
                            <button onClick={() => setIsSavingProfile(false)} className="text-gray-500 px-2"><X size={16} /></button>
                        </div>
                    )}

                    <div className="mt-8 pt-8 border-t border-gray-200">
                        <h4 className="font-bold text-xs text-gray-400 uppercase tracking-wide mb-2">Sample Data (First Data Row)</h4>
                        <div className="space-y-2 text-xs font-mono text-gray-600">
                            {columnIndices.slice(0, 8).map((idx) => (
                                <div key={idx} className="flex gap-2">
                                    <span className="font-bold text-gray-400 w-8">Col {String.fromCharCode(65 + idx)}</span>
                                    <span className="truncate">{sampleRow[idx] || <i className="text-gray-300">(empty)</i>}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                    </div>
                </div>
            </div>

            {/* FOOTER ACTIONS */}
            <div className="p-6 border-t border-gray-200 bg-gray-50 flex justify-between">
                <button onClick={onBack} className="text-gray-600 hover:text-gray-900 font-medium flex items-center gap-2">
                    <ArrowLeft size={16} /> Back
                </button>
                <button 
                    onClick={handleNext} 
                    disabled={isGeneratingPreview}
                    className="bg-indigo-600 text-white px-6 py-2 rounded-lg shadow-sm hover:bg-indigo-700 font-bold flex items-center gap-2 disabled:bg-indigo-400 disabled:cursor-not-allowed"
                >
                    {isGeneratingPreview ? (
                        <>Processing...</>
                    ) : (
                        <>Preview Updates <ArrowRight size={16} /></>
                    )}
                </button>
            </div>
        </div>
    );
};

export default ColumnMapper;