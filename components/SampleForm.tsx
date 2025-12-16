import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { SampleFormData, Vendor, PRODUCT_TYPES, SAMPLE_FORMATS, ProductType, SampleFormat, UNITS, Unit, PricingSettings, SampleSizeVariant, Product } from '../types';
import { useData } from '../context/DataContext';
import CreatableSelect from 'react-select/creatable';
import { MultiValue } from 'react-select';
import * as sampleService from '../services/sampleService';
import * as preferenceService from '../services/preferenceService';
import { toast } from 'react-hot-toast';
import AddEditVendorModal from './AddEditVendorModal';
import { calculatePrice, getActivePricingRules, formatCurrency } from '../utils/pricingUtils';
import { Printer, QrCode } from 'lucide-react'; 
import PrintQueueModal from './PrintQueueModal'; 

interface SampleFormProps {
  initialData?: Partial<SampleFormData>;
  onSave: (formData: SampleFormData) => void;
  onCancel: () => void;
  isSaving: boolean;
  saveButtonText?: string;
  existingProduct?: Product; 
}

interface SizeOption {
  label: string;
  value: string;
}

const SampleForm: React.FC<SampleFormProps> = ({
  initialData = {},
  onSave,
  onCancel,
  isSaving,
  saveButtonText = "Save Changes",
  existingProduct 
}) => {
  const { vendors, addVendor } = useData();

  const [formData, setFormData] = useState<SampleFormData>({
    manufacturerId: null,
    supplierId: null,
    productType: '',
    style: '',
    line: '',
    sizes: [],
    finish: '',
    color: '',
    sampleFormat: 'Loose',
    boardColors: '',
    unitCost: null,
    uom: '',
    cartonSize: null,
    sku: '',
    productUrl: '',
    ...initialData,
  });

  const [manufacturerSearch, setManufacturerSearch] = useState('');
  const [supplierSearch, setSupplierSearch] = useState('');
  const [hasDifferentSupplier, setHasDifferentSupplier] = useState(false);
  const [sizeOptions, setSizeOptions] = useState<SizeOption[]>([]);
  const [isVendorModalOpen, setIsVendorModalOpen] = useState(false);
  const [vendorModalPurpose, setVendorModalPurpose] = useState<'Manufacturer' | 'Supplier'>('Manufacturer');
  const [pricingSettings, setPricingSettings] = useState<PricingSettings | null>(null);

  // Print Modal State
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
  // We need a specific state to hold the "Mock Product" we are about to print
  const [productToPrint, setProductToPrint] = useState<Product[]>([]);

  useEffect(() => {
    const fetchSizes = async () => {
      try {
        const uniqueSizes = await sampleService.getUniqueSizes();
        setSizeOptions(uniqueSizes.map(size => ({ label: size, value: size })));
        const settings = await preferenceService.getPricingSettings();
        setPricingSettings(settings);
      } catch (error) { console.error("Failed to fetch data:", error); }
    };
    fetchSizes();
  }, []);

  useEffect(() => {
    if (initialData.manufacturerId) {
        const mfName = vendors.find(v => v.id === initialData.manufacturerId)?.name;
        setManufacturerSearch(mfName || '');
    }
    if (initialData.supplierId && initialData.supplierId !== initialData.manufacturerId) {
        setHasDifferentSupplier(true);
        const spName = vendors.find(v => v.id === initialData.supplierId)?.name;
        setSupplierSearch(spName || '');
    }
  }, [initialData, vendors]);

  const selectedManufacturerName = useMemo(() => vendors.find(v => v.id === formData.manufacturerId)?.name, [vendors, formData.manufacturerId]);
  const selectedSupplierName = useMemo(() => vendors.find(v => v.id === formData.supplierId)?.name, [vendors, formData.supplierId]);

  const manufacturerSearchResults = useMemo(() => {
    if (!manufacturerSearch.trim() || manufacturerSearch === selectedManufacturerName) return [];
    return vendors.filter(v => (v.vendorType === 'Manufacturer' || v.vendorType === 'Both') && v.name.toLowerCase().includes(manufacturerSearch.toLowerCase()));
  }, [vendors, manufacturerSearch, selectedManufacturerName]);

  const supplierSearchResults = useMemo(() => {
    if (!supplierSearch.trim() || supplierSearch === selectedSupplierName) return [];
    return vendors.filter(v => (v.vendorType === 'Supplier' || v.vendorType === 'Both') && v.name.toLowerCase().includes(supplierSearch.toLowerCase()));
  }, [vendors, supplierSearch, selectedSupplierName]);

  const handleSelectManufacturer = (vendor: Vendor) => {
    setFormData(prev => ({ ...prev, manufacturerId: vendor.id, productType: (vendor.defaultProductType as ProductType) || prev.productType || '' }));
    setManufacturerSearch(vendor.name);
  };

  const handleSelectSupplier = (vendor: Vendor) => {
    setFormData(prev => ({ ...prev, supplierId: vendor.id }));
    setSupplierSearch(vendor.name);
  };
  
  const handleFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    if (name === 'unitCost' || name === 'cartonSize') {
         setFormData(prev => ({ ...prev, [name]: value === '' ? null : parseFloat(value) }));
    } else {
         setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleSizeChange = useCallback((newValue: MultiValue<SizeOption>) => {
    const currentSizes = formData.sizes;
    const newSizeValues = newValue ? newValue.map(option => option.value) : [];
    const mergedSizes: SampleSizeVariant[] = newSizeValues.map(val => {
        const existing = currentSizes.find(s => s.value === val);
        return existing || { value: val, unitCost: null, cartonSize: null, uom: null };
    });
    setFormData(prev => ({ ...prev, sizes: mergedSizes }));
  }, [formData.sizes]);

  const handleVariantChange = (index: number, field: keyof SampleSizeVariant, value: string | number | null) => {
      setFormData(prev => {
          const newSizes = [...prev.sizes];
          if (field === 'unitCost' || field === 'cartonSize') {
               newSizes[index] = { ...newSizes[index], [field]: value === '' ? null : Number(value) };
          } else {
               newSizes[index] = { ...newSizes[index], [field]: value };
          }
          return { ...prev, sizes: newSizes };
      });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.style || !formData.productType) return toast.error('Style and Product Type are required.');
    if (!formData.manufacturerId) return toast.error('Please select a manufacturer.');
    if (hasDifferentSupplier && !formData.supplierId) return toast.error('Please select a supplier.');
    onSave(formData);
  };

  const handleSaveVendor = async (vendorData: Omit<Vendor, 'id'>) => {
    await addVendor(vendorData);
    setIsVendorModalOpen(false);
  };

  // --- NEW: Handle Single Variant Print ---
  // This constructs a temporary "Product" object that contains ONLY the selected variant
  // so the PrintQueueModal displays exactly what we want (1 label).
  const handlePrintSingleVariant = (variantSize: string) => {
      if (!existingProduct) return;

      // Find the real variant object from the existing product
      // We match by name/size because 'id' might not exist in formData yet if it's new
      const realVariant = existingProduct.variants.find(v => v.size === variantSize || v.name === variantSize);
      
      if (!realVariant) {
          toast.error("Save changes before printing new variants.");
          return;
      }

      // Create a "Mock Product" that contains ONLY this variant
      const mockProduct: Product = {
          ...existingProduct,
          variants: [realVariant] 
      };

      setProductToPrint([mockProduct]);
      setIsPrintModalOpen(true);
  };

  const calculatedRetailPrice = useMemo(() => {
      if (!formData.unitCost || !pricingSettings) return null;
      const activeVendorId = hasDifferentSupplier ? formData.supplierId : formData.manufacturerId;
      const activeVendor = vendors.find(v => v.id === activeVendorId);
      const rules = getActivePricingRules(activeVendor, pricingSettings, 'Customer');
      const price = calculatePrice(formData.unitCost, rules.percentage, rules.method);
      return {
          price,
          details: `${rules.method} ${rules.percentage}% (${activeVendor?.defaultMarkup ? 'Vendor Override' : 'Global Default'})`
      };
  }, [formData.unitCost, formData.manufacturerId, formData.supplierId, hasDifferentSupplier, vendors, pricingSettings]);


  return (
    <>
      <form onSubmit={handleSubmit}>
        <div className="space-y-4">
            <div className="relative">
                <label className="text-sm text-text-secondary">Manufacturer *</label>
                <input type="text" value={manufacturerSearch} onChange={e => { setManufacturerSearch(e.target.value); setFormData(p => ({ ...p, manufacturerId: null })) }} className="w-full p-2 bg-background border border-border rounded text-text-primary" required />
                {manufacturerSearchResults.length > 0 && (
                  <div className="absolute z-20 w-full bg-surface border border-border rounded-b-md mt-1 max-h-40 overflow-y-auto">
                      {manufacturerSearchResults.map(m => <div key={m.id} onClick={() => handleSelectManufacturer(m)} className="p-2 hover:bg-background cursor-pointer">{m.name}</div>)}
                  </div>
                )}
                 {manufacturerSearch.length > 0 && !selectedManufacturerName && manufacturerSearchResults.length === 0 && (
                    <div className="absolute z-20 w-full bg-surface border border-border rounded-b-md mt-1">
                        <div onClick={() => { setVendorModalPurpose('Manufacturer'); setIsVendorModalOpen(true); }} className="p-2 text-accent font-semibold hover:bg-accent hover:text-white cursor-pointer text-center">+ Add New Manufacturer</div>
                    </div>
                 )}
            </div>
            <div className="flex items-center gap-2"><input type="checkbox" id="add-sample-diff-supplier" checked={hasDifferentSupplier} onChange={e => setHasDifferentSupplier(e.target.checked)} className="h-4 w-4 rounded text-primary focus:ring-primary bg-background border-border" /><label htmlFor="add-sample-diff-supplier" className="text-sm text-text-secondary">Different Supplier?</label></div>
            {hasDifferentSupplier && (
              <div className="relative">
                <label className="text-sm text-text-secondary">Supplier</label>
                <input type="text" value={supplierSearch} onChange={e => { setSupplierSearch(e.target.value); setFormData(p => ({ ...p, supplierId: null })) }} className="w-full p-2 bg-background border border-border rounded text-text-primary" required />
                {supplierSearchResults.length > 0 && (
                    <div className="absolute z-10 w-full bg-surface border border-border rounded-b-md mt-1 max-h-40 overflow-y-auto">
                        {supplierSearchResults.map(s => <div key={s.id} onClick={() => handleSelectSupplier(s)} className="p-2 hover:bg-background cursor-pointer">{s.name}</div>)}
                    </div>
                )}
                {supplierSearch.length > 0 && !selectedSupplierName && supplierSearchResults.length === 0 && (
                     <div className="absolute z-10 w-full bg-surface border border-border rounded-b-md mt-1">
                        <div onClick={() => { setVendorModalPurpose('Supplier'); setIsVendorModalOpen(true); }} className="p-2 text-accent font-semibold hover:bg-accent hover:text-white cursor-pointer text-center">+ Add New Supplier</div>
                    </div>
                )}
              </div>
            )}
            <div><label className="text-sm text-text-secondary">Product Type *</label><select name="productType" value={formData.productType} onChange={handleFormChange} className="w-full p-2 bg-background border border-border rounded text-text-primary" required><option value="" disabled>-- Select a Type --</option>{PRODUCT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}</select></div>
            <div><label className="text-sm text-text-secondary">Style *</label><input type="text" name="style" value={formData.style} onChange={handleFormChange} className="w-full p-2 bg-background border border-border rounded text-text-primary" required /></div>
            <div><label className="text-sm text-text-secondary">Color</label><input type="text" name="color" value={formData.color} onChange={handleFormChange} className="w-full p-2 bg-background border border-border rounded text-text-primary" /></div>
            
            <div className="grid grid-cols-2 gap-4">
              <div><label className="text-sm text-text-secondary">Line</label><input type="text" name="line" value={formData.line} onChange={handleFormChange} className="w-full p-2 bg-background border border-border rounded text-text-primary" /></div>
              <div><label className="text-sm text-text-secondary">Finish</label><input type="text" name="finish" value={formData.finish} onChange={handleFormChange} className="w-full p-2 bg-background border border-border rounded text-text-primary" /></div>
            </div>

            {/* SIZES */}
            <div>
              <label className="text-sm text-text-secondary">Sizes</label>
              <CreatableSelect
                  isMulti
                  name="sizes"
                  options={sizeOptions}
                  value={formData.sizes.map(s => ({ label: s.value, value: s.value }))}
                  onChange={handleSizeChange}
                  className="react-select-container mt-1"
                  classNamePrefix="react-select"
                  placeholder="Type or select sizes..."
                  styles={{ 
                      control: (base) => ({ ...base, backgroundColor: 'var(--color-background)', borderColor: 'var(--color-border)' }), 
                      input: (base) => ({ ...base, color: 'var(--color-text-primary)' }), 
                      multiValue: (base) => ({ ...base, backgroundColor: 'var(--color-primary)' }), 
                      multiValueLabel: (base) => ({ ...base, color: 'var(--color-on-primary)' }), 
                      multiValueRemove: (base) => ({ ...base, color: 'var(--color-on-primary)', ':hover': { backgroundColor: 'var(--color-primary-hover)', color: 'var(--color-on-primary)' } }), 
                      menu: (base) => ({ ...base, backgroundColor: 'var(--color-surface)' }), 
                      option: (base, { isFocused, isSelected }) => ({ ...base, backgroundColor: isSelected ? 'var(--color-primary)' : isFocused ? 'var(--color-background)' : undefined, color: isSelected ? 'var(--color-on-primary)' : 'var(--color-text-primary)', ':active': { ...base[':active'], backgroundColor: 'var(--color-primary-hover)' } }), 
                  }}
              />
            </div>
            
            {formData.sizes.length > 0 && (
                <div className="bg-surface p-3 rounded border border-border overflow-x-auto">
                    <h4 className="text-xs font-semibold text-text-secondary uppercase mb-2">Size Variants Pricing</h4>
                    <table className="w-full text-sm text-left">
                        <thead>
                            <tr className="text-text-secondary border-b border-border">
                                <th className="pb-2 px-2">Size</th>
                                <th className="pb-2 px-2">Cost</th>
                                <th className="pb-2 px-2">UOM</th>
                                <th className="pb-2 px-2">Carton</th>
                                <th className="pb-2 px-2 text-right">Actions</th> {/* NEW HEADER */}
                            </tr>
                        </thead>
                        <tbody>
                            {formData.sizes.map((variant, idx) => (
                                <tr key={idx} className="border-b border-border last:border-0">
                                    <td className="py-2 px-2 font-medium text-text-primary">{variant.value}</td>
                                    <td className="py-2 px-2"><input type="number" step="0.01" placeholder={formData.unitCost ? `Def: $${formData.unitCost}` : "0.00"} value={variant.unitCost ?? ''} onChange={(e) => handleVariantChange(idx, 'unitCost', e.target.value)} className="w-20 p-1 bg-background border border-border rounded text-xs text-text-primary" /></td>
                                    <td className="py-2 px-2">
                                        <select value={variant.uom ?? ''} onChange={(e) => handleVariantChange(idx, 'uom', e.target.value)} className="p-1 bg-background border border-border rounded text-xs text-text-primary w-16">
                                            <option value="">{formData.uom || 'Def'}</option>
                                            {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                                        </select>
                                    </td>
                                    <td className="py-2 px-2"><input type="number" step="0.0001" placeholder={formData.cartonSize ? `Def: ${formData.cartonSize}` : "Qty"} value={variant.cartonSize ?? ''} onChange={(e) => handleVariantChange(idx, 'cartonSize', e.target.value)} className="w-16 p-1 bg-background border border-border rounded text-xs text-text-primary" /></td>
                                    
                                    {/* --- NEW: Per-Row Print Button --- */}
                                    <td className="py-2 px-2 text-right">
                                        <button 
                                            type="button" 
                                            onClick={() => handlePrintSingleVariant(variant.value)}
                                            className="p-1 text-text-secondary hover:text-primary hover:bg-background rounded"
                                            title="Print Label"
                                            // Disable if we don't have a real ID yet (new product)
                                            disabled={!existingProduct}
                                        >
                                            <QrCode size={16} />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
            
            <div className="p-3 bg-background rounded border border-border space-y-3">
                <h4 className="text-sm font-medium text-text-secondary border-b border-border pb-1 mb-2">Default Pricing</h4>
                <div className="grid grid-cols-3 gap-4">
                    <div>
                        <label className="text-sm text-text-secondary">Unit Cost ($)</label>
                        <input type="number" step="0.01" min="0" name="unitCost" value={formData.unitCost ?? ''} onChange={handleFormChange} className="w-full p-2 bg-surface border border-border rounded text-sm text-text-primary" placeholder="0.00" />
                    </div>
                    <div>
                        <label className="text-sm text-text-secondary">Unit (UOM)</label>
                        <select name="uom" value={formData.uom ?? ''} onChange={handleFormChange} className="w-full p-2 bg-surface border border-border rounded text-sm text-text-primary">
                            <option value="">-- Unit --</option>
                            {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="text-sm text-text-secondary">Carton Size</label>
                        <input type="number" step="0.0001" min="0" name="cartonSize" value={formData.cartonSize ?? ''} onChange={handleFormChange} className="w-full p-2 bg-surface border border-border rounded text-sm text-text-primary" placeholder="Qty per box" />
                    </div>
                </div>
                {calculatedRetailPrice && (
                    <div className="mt-2 p-2 bg-green-900/20 border border-green-800/50 rounded flex justify-between items-center">
                        <span className="text-xs text-green-400">Suggested Retail:</span>
                        <div className="text-right">
                            <span className="font-bold text-green-400 text-sm">{formatCurrency(calculatedRetailPrice.price)}</span>
                            <span className="text-[10px] text-gray-500 block">{calculatedRetailPrice.details}</span>
                        </div>
                    </div>
                )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div><label className="text-sm text-text-secondary">SKU</label><input type="text" name="sku" value={formData.sku} onChange={handleFormChange} className="w-full p-2 bg-background border border-border rounded text-text-primary" /></div>
              <div><label className="text-sm text-text-secondary">Product URL</label><input type="url" name="productUrl" value={formData.productUrl} onChange={handleFormChange} className="w-full p-2 bg-background border border-border rounded text-text-primary" /></div>
            </div>
        </div>

        <div className="flex justify-end space-x-4 mt-8 pt-6 border-t border-border">
          <button type="button" onClick={onCancel} className="py-2 px-4 bg-secondary hover:bg-secondary-hover rounded text-on-secondary">Cancel</button>
          <button type="submit" className="py-2 px-4 bg-primary hover:bg-primary-hover rounded text-on-primary" disabled={isSaving}>{isSaving ? 'Saving...' : saveButtonText}</button>
        </div>
      </form>

       <AddEditVendorModal 
        isOpen={isVendorModalOpen} 
        onClose={() => setIsVendorModalOpen(false)} 
        onSave={handleSaveVendor} 
        initialVendorType={vendorModalPurpose} 
      />

      {/* --- Print Modal Triggered by the Row Buttons --- */}
      {isPrintModalOpen && productToPrint.length > 0 && (
          <PrintQueueModal 
            isOpen={isPrintModalOpen} 
            onClose={() => setIsPrintModalOpen(false)} 
            selectedProducts={productToPrint} 
          />
      )}
    </>
  );
};

export default SampleForm;