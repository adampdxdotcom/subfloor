import React, { useState, useMemo, useEffect } from 'react';
import { useData } from '../context/DataContext';
import { Sample, Vendor } from '../types';
import { toast } from 'react-hot-toast';
import { X } from 'lucide-react';
import AddEditVendorModal from './AddEditVendorModal';

interface AddSampleInlineModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSampleCreated: (newSample: Sample) => void;
  initialStyleColor: string;
}

const AddSampleInlineModal: React.FC<AddSampleInlineModalProps> = ({
  isOpen,
  onClose,
  onSampleCreated,
  initialStyleColor,
}) => {
  const { vendors, addSample, addVendor } = useData();
  const [styleColor, setStyleColor] = useState(initialStyleColor);
  const [manufacturerId, setManufacturerId] = useState<number | null>(null);
  const [manufacturerSearch, setManufacturerSearch] = useState('');
  const [supplierId, setSupplierId] = useState<number | null>(null);
  const [supplierSearch, setSupplierSearch] = useState('');
  const [hasDifferentSupplier, setHasDifferentSupplier] = useState(false);
  const [type, setType] = useState('LVP');
  const [isSaving, setIsSaving] = useState(false);
  const [isVendorModalOpen, setIsVendorModalOpen] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setStyleColor(initialStyleColor);
      setManufacturerId(null);
      setManufacturerSearch('');
      setSupplierId(null);
      setSupplierSearch('');
      setHasDifferentSupplier(false);
      setType('LVP');
    }
  }, [isOpen, initialStyleColor]);

  const manufacturerList = useMemo(() => vendors.filter(v => v.isManufacturer), [vendors]);
  const supplierList = useMemo(() => vendors.filter(v => v.isSupplier), [vendors]);
  
  const manufacturerSearchResults = useMemo(() => {
    if (!manufacturerSearch.trim() || manufacturerId) return [];
    return manufacturerList.filter(m => m.name.toLowerCase().includes(manufacturerSearch.toLowerCase()));
  }, [manufacturerList, manufacturerSearch, manufacturerId]);
  
  const supplierSearchResults = useMemo(() => {
    if (!supplierSearch.trim() || supplierId) return [];
    return supplierList.filter(s => s.name.toLowerCase().includes(supplierSearch.toLowerCase()));
  }, [supplierList, supplierSearch, supplierId]);


  const handleSelectManufacturer = (vendorId: number) => {
    setManufacturerId(vendorId);
    const vendor = vendors.find(v => v.id === vendorId);
    setManufacturerSearch(vendor?.name || '');
  };

  const handleSelectSupplier = (vendorId: number) => {
    setSupplierId(vendorId);
    const vendor = vendors.find(v => v.id === vendorId);
    setSupplierSearch(vendor?.name || '');
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!styleColor.trim()) return toast.error('Style / Color is required.');
    if (!manufacturerId) return toast.error('Please select a manufacturer.');
    if (hasDifferentSupplier && !supplierId) return toast.error('Please select a supplier.');

    setIsSaving(true);
    try {
      const newSampleData = {
        manufacturerId,
        supplierId: hasDifferentSupplier ? supplierId : null,
        styleColor, sku: null, type, productUrl: null
      };
      
      const createdSample = await addSample(newSampleData);
      onSampleCreated(createdSample);
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
        <div className="bg-surface p-8 rounded-lg shadow-2xl w-full max-w-md" onClick={e => e.stopPropagation()}>
          <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-text-primary">Create New Sample</h2>
              <button onClick={onClose} className="p-2 rounded-full hover:bg-gray-700">
                  <X className="w-6 h-6" />
              </button>
          </div>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-sm text-text-secondary">Style / Color</label>
              <input type="text" value={styleColor} onChange={(e) => setStyleColor(e.target.value)} className="w-full p-2 bg-gray-800 border border-border rounded" required />
            </div>
            
            <div className="relative">
              <label className="text-sm text-text-secondary">Manufacturer</label>
              <input type="text" value={manufacturerSearch} onChange={(e) => { setManufacturerSearch(e.target.value); setManufacturerId(null); }} className="w-full p-2 bg-gray-800 border border-border rounded" required />
              {manufacturerSearchResults.length > 0 && (
                <div className="absolute z-10 w-full bg-gray-900 border border-border rounded-b-md mt-1 max-h-40 overflow-y-auto">
                    {manufacturerSearchResults.map(m => <div key={m.id} onClick={() => handleSelectManufacturer(m.id)} className="p-2 hover:bg-accent cursor-pointer">{m.name}</div>)}
                    <div onClick={() => setIsVendorModalOpen(true)} className="p-2 text-accent font-semibold hover:bg-accent hover:text-white cursor-pointer text-center border-t border-border">+ Add New Vendor</div>
                </div>
              )}
            </div>

            <div className="flex items-center gap-2">
              <input type="checkbox" id="different-supplier-checkbox" checked={hasDifferentSupplier} onChange={(e) => setHasDifferentSupplier(e.target.checked)} className="h-4 w-4 rounded text-primary focus:ring-primary-dark bg-gray-700 border-gray-600" />
              <label htmlFor="different-supplier-checkbox" className="text-sm text-text-secondary">Different Supplier</label>
            </div>

            {hasDifferentSupplier && (
              <div className="relative">
                <label className="text-sm text-text-secondary">Supplier</label>
                <input type="text" value={supplierSearch} onChange={(e) => { setSupplierSearch(e.target.value); setSupplierId(null); }} className="w-full p-2 bg-gray-800 border border-border rounded" required />
                 {supplierSearchResults.length > 0 && (
                  <div className="absolute z-10 w-full bg-gray-900 border border-border rounded-b-md mt-1 max-h-40 overflow-y-auto">
                      {supplierSearchResults.map(s => <div key={s.id} onClick={() => handleSelectSupplier(s.id)} className="p-2 hover:bg-accent cursor-pointer">{s.name}</div>)}
                      <div onClick={() => setIsVendorModalOpen(true)} className="p-2 text-accent font-semibold hover:bg-accent hover:text-white cursor-pointer text-center border-t border-border">+ Add New Vendor</div>
                  </div>
                )}
              </div>
            )}

            <div>
              <label className="text-sm text-text-secondary">Type</label>
              <select value={type} onChange={(e) => setType(e.target.value)} className="w-full p-2 bg-gray-800 border border-border rounded" required>
                <option value="LVP">LVP</option>
                <option value="Carpet">Carpet</option>
                <option value="Tile">Tile</option>
                <option value="Hardwood">Hardwood</option>
                <option value="Catalog">Catalog</option>
                <option value="Other">Other</option>
              </select>
            </div>
            <div className="flex justify-end space-x-4 pt-4">
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
      />
    </>
  );
};

export default AddSampleInlineModal;