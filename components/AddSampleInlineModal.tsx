import React, { useState, useMemo, useEffect } from 'react';
import { useData } from '../context/DataContext';
import { Sample, Vendor, PRODUCT_TYPES, SAMPLE_FORMATS, ProductType, SampleFormat } from '../types';
import { toast } from 'react-hot-toast';
import { X, ChevronDown, ChevronUp } from 'lucide-react';
import AddEditVendorModal from './AddEditVendorModal';

interface AddSampleInlineModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSampleCreated: (newSample: Sample) => void;
  initialSearchTerm: string; // Renamed for clarity: this is the search term
}

const initialFormState = {
  manufacturerId: null as number | null,
  supplierId: null as number | null,
  productType: '' as ProductType | '',
  style: '',
  line: '',
  size: '',
  finish: '',
  color: '',
  sampleFormat: 'Loose' as SampleFormat,
  boardColors: '',
  sku: '',
  productUrl: '',
};

const AddSampleInlineModal: React.FC<AddSampleInlineModalProps> = ({
  isOpen,
  onClose,
  onSampleCreated,
  initialSearchTerm,
}) => {
  const { vendors, addSample, addVendor } = useData();
  const [formData, setFormData] = useState(initialFormState);
  const [manufacturerSearch, setManufacturerSearch] = useState('');
  const [supplierSearch, setSupplierSearch] = useState('');
  const [hasDifferentSupplier, setHasDifferentSupplier] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isVendorModalOpen, setIsVendorModalOpen] = useState(false);
  const [vendorModalPurpose, setVendorModalPurpose] = useState<'Manufacturer' | 'Supplier'>('Manufacturer');
  const [showAdvanced, setShowAdvanced] = useState(false); // State for collapsible section

  // --- MODIFIED: Correctly reset all state in one call ---
  useEffect(() => {
    if (isOpen) {
      setFormData({ ...initialFormState, style: initialSearchTerm });
      setManufacturerSearch('');
      setSupplierSearch('');
      setHasDifferentSupplier(false);
      setShowAdvanced(false);
    }
  }, [isOpen, initialSearchTerm]);
  
  const selectedManufacturerName = useMemo(() => vendors.find(v => v.id === formData.manufacturerId)?.name, [vendors, formData.manufacturerId]);
  const selectedSupplierName = useMemo(() => vendors.find(v => v.id === formData.supplierId)?.name, [vendors, formData.supplierId]);
  
  const manufacturerSearchResults = useMemo(() => {
    if (!manufacturerSearch.trim()) return [];
    return vendors.filter(v => 
        (v.vendorType === 'Manufacturer' || v.vendorType === 'Both') && 
        v.name.toLowerCase().includes(manufacturerSearch.toLowerCase())
    );
  }, [vendors, manufacturerSearch]);

  const supplierSearchResults = useMemo(() => {
    if (!supplierSearch.trim()) return [];
    return vendors.filter(v => 
        (v.vendorType === 'Supplier' || v.vendorType === 'Both') && 
        v.name.toLowerCase().includes(supplierSearch.toLowerCase())
    );
  }, [vendors, supplierSearch]);

  const openVendorModal = (purpose: 'Manufacturer' | 'Supplier') => {
    setVendorModalPurpose(purpose);
    setIsVendorModalOpen(true);
  };

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

  const handleSaveVendor = async (vendorData: Omit<Vendor, 'id'> | Vendor) => {
    try {
        await addVendor(vendorData as Omit<Vendor, 'id'>);
        setIsVendorModalOpen(false);
    } catch (error) {
        console.error('Failed to save vendor', error);
        toast.error('Could not save new vendor.');
    }
  };

  const handleFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.style.trim() || !formData.productType) return toast.error('Style and Product Type are required.');
    if (!formData.manufacturerId) return toast.error('Please select a manufacturer.');
    if (hasDifferentSupplier && !formData.supplierId) return toast.error('Please select a supplier.');

    setIsSaving(true);
    try {
      const newSampleData = {
        ...formData,
        supplierId: hasDifferentSupplier ? formData.supplierId : formData.manufacturerId,
      };

      if (newSampleData.productType !== 'Tile') {
        newSampleData.sampleFormat = null;
        newSampleData.boardColors = '';
      }
      
      const createdSample = await addSample(newSampleData);
      onSampleCreated(createdSample);
      toast.success(`Sample "${createdSample.style}" created!`);
      onClose();
    } catch (error) {
      console.error('Failed to create sample:', error);
      toast.error('Could not create sample.');
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-[60]">
        <div className="bg-surface p-8 rounded-lg shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
          <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-text-primary">Create New Sample</h2>
              <button onClick={onClose} className="p-2 rounded-full hover:bg-gray-700">
                  <X className="w-6 h-6" />
              </button>
          </div>
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Core required fields remain visible */}
            <div className="relative">
              <label className="text-sm text-text-secondary">Manufacturer *</label>
              <input type="text" value={manufacturerSearch} onChange={(e) => { setManufacturerSearch(e.target.value); setFormData(p => ({...p, manufacturerId: null})); }} className="w-full p-2 bg-gray-800 border border-border rounded" required />
              {manufacturerSearch && manufacturerSearch !== selectedManufacturerName && (
                <div className="absolute z-20 w-full bg-gray-900 border border-border rounded-b-md mt-1 max-h-40 overflow-y-auto">
                    {manufacturerSearchResults.map(m => <div key={m.id} onClick={() => handleSelectManufacturer(m)} className="p-2 hover:bg-accent cursor-pointer">{m.name}</div>)}
                    {manufacturerSearchResults.length === 0 && (<div onClick={() => openVendorModal('Manufacturer')} className="p-2 text-accent font-semibold hover:bg-accent hover:text-white cursor-pointer text-center border-t border-border">+ Add New Manufacturer</div>)}
                </div>
              )}
            </div>
            <div className="flex items-center gap-2">
              <input type="checkbox" id="different-supplier-checkbox-inline" checked={hasDifferentSupplier} onChange={(e) => setHasDifferentSupplier(e.target.checked)} className="h-4 w-4 rounded text-primary focus:ring-primary-dark bg-gray-700 border-gray-600" />
              <label htmlFor="different-supplier-checkbox-inline" className="text-sm text-text-secondary">Different Supplier</label>
            </div>
            {hasDifferentSupplier && (
              <div className="relative">
                <label className="text-sm text-text-secondary">Supplier *</label>
                <input type="text" value={supplierSearch} onChange={(e) => { setSupplierSearch(e.target.value); setFormData(p => ({...p, supplierId: null})); }} className="w-full p-2 bg-gray-800 border border-border rounded" required />
                 {supplierSearch && supplierSearch !== selectedSupplierName && (
                  <div className="absolute z-20 w-full bg-gray-900 border border-border rounded-b-md mt-1 max-h-40 overflow-y-auto">
                      {supplierSearchResults.map(s => <div key={s.id} onClick={() => handleSelectSupplier(s)} className="p-2 hover:bg-accent cursor-pointer">{s.name}</div>)}
                      {supplierSearchResults.length === 0 && (<div onClick={() => openVendorModal('Supplier')} className="p-2 text-accent font-semibold hover:bg-accent hover:text-white cursor-pointer text-center border-t border-border">+ Add New Supplier</div>)}
                  </div>
                )}
              </div>
            )}
            <div>
              <label className="text-sm text-text-secondary">Product Type *</label>
              <select name="productType" value={formData.productType} onChange={handleFormChange} className="w-full p-2 bg-gray-800 border border-border rounded" required>
                <option value="" disabled>-- Select a Type --</option>
                {PRODUCT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm text-text-secondary">Style *</label>
                <input name="style" type="text" value={formData.style} onChange={handleFormChange} className="w-full p-2 bg-gray-800 border border-border rounded" required />
              </div>
              <div>
                <label className="text-sm text-text-secondary">Color</label>
                <input name="color" type="text" value={formData.color} onChange={handleFormChange} className="w-full p-2 bg-gray-800 border border-border rounded" />
              </div>
            </div>
            {formData.productType === 'Tile' && (
              <div className="p-3 bg-gray-800/50 rounded border border-border space-y-3">
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
                {/* --- ADDED: Missing conditional board colors input --- */}
                {formData.sampleFormat === 'Board' && (
                  <div><label className="text-sm text-text-secondary">Other Colors on Board</label><input type="text" name="boardColors" value={formData.boardColors} onChange={handleFormChange} placeholder="e.g., Taupe, Grey" className="w-full p-2 bg-gray-900 border border-border rounded text-sm"/></div>
                )}
              </div>
            )}

            {/* --- ADDED: Collapsible section for all optional fields --- */}
            <div className="pt-2">
              <button type="button" onClick={() => setShowAdvanced(!showAdvanced)} className="text-sm text-accent hover:underline flex items-center gap-1">
                {showAdvanced ? <ChevronUp size={14}/> : <ChevronDown size={14} />}
                Advanced Options
              </button>
              {showAdvanced && (
                <div className="mt-4 space-y-4 border-t border-border pt-4">
                   <div className="grid grid-cols-3 gap-4">
                      <div><label className="text-sm text-text-secondary">Line</label><input type="text" name="line" value={formData.line} onChange={handleFormChange} className="w-full p-2 bg-gray-800 border border-border rounded" /></div>
                      <div><label className="text-sm text-text-secondary">Size</label><input type="text" name="size" value={formData.size} onChange={handleFormChange} className="w-full p-2 bg-gray-800 border border-border rounded" /></div>
                      <div><label className="text-sm text-text-secondary">Finish</label><input type="text" name="finish" value={formData.finish} onChange={handleFormChange} className="w-full p-2 bg-gray-800 border border-border rounded" /></div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div><label className="text-sm text-text-secondary">SKU</label><input type="text" name="sku" value={formData.sku} onChange={handleFormChange} className="w-full p-2 bg-gray-800 border border-border rounded" /></div>
                    <div><label className="text-sm text-text-secondary">Product URL</label><input type="url" name="productUrl" value={formData.productUrl} onChange={handleFormChange} className="w-full p-2 bg-gray-800 border border-border rounded" /></div>
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end space-x-4 pt-4 border-t border-border mt-6">
              <button type="button" onClick={onClose} className="py-2 px-4 bg-gray-600 hover:bg-gray-700 rounded text-white">Cancel</button>
              <button type="submit" className="py-2 px-4 bg-primary hover:bg-secondary rounded text-white" disabled={isSaving}>{isSaving ? 'Creating...' : 'Create & Add'}</button>
            </div>
          </form>
        </div>
      </div>

      <AddEditVendorModal
        isOpen={isVendorModalOpen}
        onClose={() => setIsVendorModalOpen(false)}
        onSave={handleSaveVendor}
        initialVendorType={vendorModalPurpose}
      />
    </>
  );
};

export default AddSampleInlineModal;