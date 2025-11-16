// components/SampleForm.tsx

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { Sample, Vendor, PRODUCT_TYPES, SAMPLE_FORMATS, ProductType, SampleFormat } from '../types';
import { useData } from '../context/DataContext';
import CreatableSelect from 'react-select/creatable';
import { MultiValue } from 'react-select';
import * as sampleService from '../services/sampleService';
import { toast } from 'react-hot-toast';
import AddEditVendorModal from './AddEditVendorModal';

// This is the data shape the form will manage internally
export type SampleFormData = {
  manufacturerId: number | null;
  supplierId: number | null;
  productType: ProductType | '';
  style: string;
  line: string;
  sizes: string[];
  finish: string;
  color: string;
  sampleFormat: SampleFormat | null;
  boardColors: string;
  sku: string;
  productUrl: string;
};

// These are the props the form component will accept
interface SampleFormProps {
  initialData?: Partial<SampleFormData>;
  onSave: (formData: SampleFormData) => void;
  onCancel: () => void;
  isSaving: boolean;
  saveButtonText?: string;
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

  // Fetch size options when the component mounts
  useEffect(() => {
    const fetchSizes = async () => {
      try {
        const uniqueSizes = await sampleService.getUniqueSizes();
        setSizeOptions(uniqueSizes.map(size => ({ label: size, value: size })));
      } catch (error) {
        console.error("Failed to fetch unique sizes:", error);
        toast.error("Could not load size suggestions.");
      }
    };
    fetchSizes();
  }, []);

  // Pre-populate search fields and checkbox when initialData changes
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
    return vendors.filter(v => 
        (v.vendorType === 'Manufacturer' || v.vendorType === 'Both') && 
        v.name.toLowerCase().includes(manufacturerSearch.toLowerCase())
    );
  }, [vendors, manufacturerSearch, selectedManufacturerName]);

  const supplierSearchResults = useMemo(() => {
    if (!supplierSearch.trim() || supplierSearch === selectedSupplierName) return [];
    return vendors.filter(v => 
        (v.vendorType === 'Supplier' || v.vendorType === 'Both') && 
        v.name.toLowerCase().includes(supplierSearch.toLowerCase())
    );
  }, [vendors, supplierSearch, selectedSupplierName]);

  const handleSelectManufacturer = (vendor: Vendor) => {
    setFormData(prev => ({ 
      ...prev, 
      manufacturerId: vendor.id,
      productType: (vendor.defaultProductType as ProductType) || prev.productType || '',
    }));
    setManufacturerSearch(vendor.name);
  };

  const handleSelectSupplier = (vendor: Vendor) => {
    setFormData(prev => ({ ...prev, supplierId: vendor.id }));
    setSupplierSearch(vendor.name);
  };
  
  const handleFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSizeChange = useCallback((newValue: MultiValue<SizeOption>) => {
    const sizeValues = newValue ? newValue.map(option => option.value) : [];
    setFormData(prev => ({ ...prev, sizes: sizeValues }));
  }, []);

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

  return (
    <>
      <form onSubmit={handleSubmit}>
        <div className="space-y-4">
            <div className="relative">
                <label className="text-sm text-text-secondary">Manufacturer *</label>
                <input type="text" value={manufacturerSearch} onChange={e => { setManufacturerSearch(e.target.value); setFormData(p => ({ ...p, manufacturerId: null })) }} className="w-full p-2 bg-gray-800 border border-border rounded" required />
                {manufacturerSearchResults.length > 0 && (
                  <div className="absolute z-20 w-full bg-gray-900 border border-border rounded-b-md mt-1 max-h-40 overflow-y-auto">
                      {manufacturerSearchResults.map(m => <div key={m.id} onClick={() => handleSelectManufacturer(m)} className="p-2 hover:bg-accent cursor-pointer">{m.name}</div>)}
                  </div>
                )}
                 {manufacturerSearch.length > 0 && !selectedManufacturerName && manufacturerSearchResults.length === 0 && (
                    <div className="absolute z-20 w-full bg-gray-900 border border-border rounded-b-md mt-1">
                        <div onClick={() => { setVendorModalPurpose('Manufacturer'); setIsVendorModalOpen(true); }} className="p-2 text-accent font-semibold hover:bg-accent hover:text-white cursor-pointer text-center">+ Add New Manufacturer</div>
                    </div>
                 )}
            </div>
            <div className="flex items-center gap-2"><input type="checkbox" id="add-sample-diff-supplier" checked={hasDifferentSupplier} onChange={e => setHasDifferentSupplier(e.target.checked)} className="h-4 w-4 rounded text-primary focus:ring-primary-dark bg-gray-700 border-gray-600" /><label htmlFor="add-sample-diff-supplier" className="text-sm text-text-secondary">Different Supplier?</label></div>
            {hasDifferentSupplier && (
              <div className="relative">
                <label className="text-sm text-text-secondary">Supplier</label>
                <input type="text" value={supplierSearch} onChange={e => { setSupplierSearch(e.target.value); setFormData(p => ({ ...p, supplierId: null })) }} className="w-full p-2 bg-gray-800 border border-border rounded" required />
                {supplierSearchResults.length > 0 && (
                    <div className="absolute z-10 w-full bg-gray-900 border border-border rounded-b-md mt-1 max-h-40 overflow-y-auto">
                        {supplierSearchResults.map(s => <div key={s.id} onClick={() => handleSelectSupplier(s)} className="p-2 hover:bg-accent cursor-pointer">{s.name}</div>)}
                    </div>
                )}
                {supplierSearch.length > 0 && !selectedSupplierName && supplierSearchResults.length === 0 && (
                     <div className="absolute z-10 w-full bg-gray-900 border border-border rounded-b-md mt-1">
                        <div onClick={() => { setVendorModalPurpose('Supplier'); setIsVendorModalOpen(true); }} className="p-2 text-accent font-semibold hover:bg-accent hover:text-white cursor-pointer text-center">+ Add New Supplier</div>
                    </div>
                )}
              </div>
            )}
            <div><label className="text-sm text-text-secondary">Product Type *</label><select name="productType" value={formData.productType} onChange={handleFormChange} className="w-full p-2 bg-gray-800 border border-border rounded" required><option value="" disabled>-- Select a Type --</option>{PRODUCT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}</select></div>
            <div><label className="text-sm text-text-secondary">Style *</label><input type="text" name="style" value={formData.style} onChange={handleFormChange} className="w-full p-2 bg-gray-800 border border-border rounded" required /></div>
            <div><label className="text-sm text-text-secondary">Color</label><input type="text" name="color" value={formData.color} onChange={handleFormChange} className="w-full p-2 bg-gray-800 border border-border rounded" /></div>
            
            {formData.productType === 'Tile' && (
              <div className="p-3 bg-gray-800 rounded border border-border space-y-3">
                <fieldset>
                  <legend className="text-sm font-medium text-text-secondary mb-2">Tile Format</legend>
                  <div className="flex items-center gap-4">
                      {SAMPLE_FORMATS.map(format => (
                          <label key={format} className="flex items-center gap-2 text-sm">
                              <input type="radio" name="sampleFormat" value={format} checked={formData.sampleFormat === format} onChange={handleFormChange} className="h-4 w-4 text-primary focus:ring-primary-dark bg-gray-700 border-gray-600"/>
                              {format} Sample
                          </label>
                      ))}
                  </div>
                </fieldset>
                {formData.sampleFormat === 'Board' && (
                  <div><label className="text-sm text-text-secondary">Other Colors on Board</label><input type="text" name="boardColors" value={formData.boardColors} onChange={handleFormChange} placeholder="e.g., Taupe, Grey" className="w-full p-2 bg-gray-900 border border-border rounded text-sm"/></div>
                )}
              </div>
            )}
            <div className="grid grid-cols-2 gap-4">
              <div><label className="text-sm text-text-secondary">Line</label><input type="text" name="line" value={formData.line} onChange={handleFormChange} className="w-full p-2 bg-gray-800 border border-border rounded" /></div>
              <div><label className="text-sm text-text-secondary">Finish</label><input type="text" name="finish" value={formData.finish} onChange={handleFormChange} className="w-full p-2 bg-gray-800 border border-border rounded" /></div>
            </div>
            <div>
              <label className="text-sm text-text-secondary">Sizes</label>
              <CreatableSelect
                  isMulti
                  name="sizes"
                  options={sizeOptions}
                  value={formData.sizes.map(size => ({ label: size, value: size }))}
                  onChange={handleSizeChange}
                  className="react-select-container mt-1"
                  classNamePrefix="react-select"
                  placeholder="Type or select sizes..."
                  styles={{ control: (base) => ({ ...base, backgroundColor: '#1f2937', borderColor: '#4b5563' }), input: (base) => ({ ...base, color: '#e5e7eb' }), multiValue: (base) => ({ ...base, backgroundColor: '#374151' }), multiValueLabel: (base) => ({ ...base, color: '#e5e7eb' }), multiValueRemove: (base) => ({ ...base, ':hover': { backgroundColor: '#ef4444', color: 'white' } }), menu: (base) => ({ ...base, backgroundColor: '#1f2937' }), option: (base, { isFocused, isSelected }) => ({ ...base, backgroundColor: isSelected ? '#4f46e5' : isFocused ? '#374151' : undefined, ':active': { ...base[':active'], backgroundColor: '#4338ca' } }), }}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><label className="text-sm text-text-secondary">SKU</label><input type="text" name="sku" value={formData.sku} onChange={handleFormChange} className="w-full p-2 bg-gray-800 border border-border rounded" /></div>
              <div><label className="text-sm text-text-secondary">Product URL</label><input type="url" name="productUrl" value={formData.productUrl} onChange={handleFormChange} className="w-full p-2 bg-gray-800 border border-border rounded" /></div>
            </div>
        </div>

        <div className="flex justify-end space-x-4 mt-8 pt-6 border-t border-border">
          <button type="button" onClick={onCancel} className="py-2 px-4 bg-gray-600 hover:bg-gray-700 rounded text-white">Cancel</button>
          <button type="submit" className="py-2 px-4 bg-primary hover:bg-secondary rounded text-white" disabled={isSaving}>{isSaving ? 'Saving...' : saveButtonText}</button>
        </div>
      </form>

       <AddEditVendorModal 
        isOpen={isVendorModalOpen} 
        onClose={() => setIsVendorModalOpen(false)} 
        onSave={handleSaveVendor} 
        initialVendorType={vendorModalPurpose} 
      />
    </>
  );
};

export default SampleForm;