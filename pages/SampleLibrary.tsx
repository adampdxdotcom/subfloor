import React, { useState, useMemo, useRef } from 'react'; // Corrected import
import { useData } from '../context/DataContext';
import { PlusCircle, Search, Download, Clock, Undo2 } from 'lucide-react';
import { Sample, Vendor, PRODUCT_TYPES, SAMPLE_FORMATS, ProductType, SampleFormat } from '../types';
import { Link } from 'react-router-dom';
import SampleDetailModal from '../components/SampleDetailModal';
import { toast } from 'react-hot-toast';
import AddEditVendorModal from '../components/AddEditVendorModal';
import SampleCarousel from '../components/SampleCarousel';

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

const formatSampleName = (sample: Sample) => {
  // --- MODIFIED: Make name formatting more robust against null/undefined values ---
  const parts = [];
  if (sample.line) parts.push(sample.line);
  if (sample.style) parts.push(sample.style);
  if (sample.color) parts.push(sample.color);
  
  if (parts.length === 0) {
      // Fallback for old data that hasn't been updated yet
      return `Sample #${sample.id}`; 
  }
  return parts.join(' - ');
};

const SampleLibrary: React.FC = () => {
  const {
    samples, addSample, isLoading, fetchSamples, vendors, addVendor,
    sampleCheckouts, updateSampleCheckout, extendSampleCheckout
  } = useData();

  const [searchTerm, setSearchTerm] = useState('');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newSample, setNewSample] = useState(initialFormState);
  const [hasDifferentSupplier, setHasDifferentSupplier] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [importUrl, setImportUrl] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [selectedSample, setSelectedSample] = useState<Sample | null>(null);

  const [manufacturerSearch, setManufacturerSearch] = useState('');
  const [supplierSearch, setSupplierSearch] = useState('');
  const [isVendorModalOpen, setIsVendorModalOpen] = useState(false);
  const [vendorModalPurpose, setVendorModalPurpose] = useState<'manufacturer' | 'supplier'>('general');

  const selectedManufacturerName = useMemo(() => vendors.find(v => v.id === newSample.manufacturerId)?.name, [vendors, newSample.manufacturerId]);
  const selectedSupplierName = useMemo(() => vendors.find(v => v.id === newSample.supplierId)?.name, [vendors, newSample.supplierId]);

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

  const checkedOutSamples = useMemo(() => {
    const activeCheckouts = new Map(sampleCheckouts.filter(sc => sc.actualReturnDate === null).map(sc => [sc.sampleId, sc]));
    return samples.filter(sample => activeCheckouts.has(sample.id)).sort((a, b) => {
        const checkoutA = activeCheckouts.get(a.id);
        const checkoutB = activeCheckouts.get(b.id);
        if (!checkoutA || !checkoutB) return 0;
        return new Date(checkoutA.expectedReturnDate).getTime() - new Date(checkoutB.expectedReturnDate).getTime();
    });
  }, [samples, sampleCheckouts]);

  // --- MODIFIED: Filtering logic made "defensive" to prevent crashes on null data ---
  const filteredSamples = useMemo(() => {
    const lowercasedTerm = searchTerm.toLowerCase();
    if (!lowercasedTerm) return samples;
    return samples.filter(sample => {
        // Check each field for existence before calling toLowerCase()
        const styleMatch = sample.style && sample.style.toLowerCase().includes(lowercasedTerm);
        const colorMatch = sample.color && sample.color.toLowerCase().includes(lowercasedTerm);
        const manufacturerMatch = sample.manufacturerName && sample.manufacturerName.toLowerCase().includes(lowercasedTerm);
        const typeMatch = sample.productType && sample.productType.toLowerCase().includes(lowercasedTerm);
        const skuMatch = sample.sku && sample.sku.toLowerCase().includes(lowercasedTerm);
        
        return styleMatch || colorMatch || manufacturerMatch || typeMatch || skuMatch;
    });
  }, [samples, searchTerm]);

  const handleExtend = async (sample: Sample, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!sample.checkoutId) return toast.error("Could not find checkout record to extend.");
    const checkoutToExtend = sampleCheckouts.find(sc => sc.id === sample.checkoutId);
    if (checkoutToExtend) await extendSampleCheckout(checkoutToExtend);
  };

  const handleReturn = async (sample: Sample, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm(`Are you sure you want to return "${formatSampleName(sample)}"?`)) {
      const checkoutToReturn = sampleCheckouts.find(sc => sc.id === sample.checkoutId);
      if (checkoutToReturn) await updateSampleCheckout(checkoutToReturn);
    }
  };

  const resetAddModal = () => {
    setNewSample(initialFormState);
    setHasDifferentSupplier(false);
    setSelectedFile(null);
    setPreviewUrl(null);
    setImportUrl('');
    setManufacturerSearch('');
    setSupplierSearch('');
    setIsAddModalOpen(false);
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      const newPreviewUrl = URL.createObjectURL(file);
      setPreviewUrl(newPreviewUrl);
      setImportUrl('');
    }
  };

  const handleSelectManufacturer = (vendor: Vendor) => {
    setNewSample(prev => ({ 
      ...prev, 
      manufacturerId: vendor.id,
      productType: (vendor.defaultProductType as ProductType) || prev.productType || '',
    }));
    setManufacturerSearch(vendor.name);
  };

  const handleSelectSupplier = (vendor: Vendor) => {
    setNewSample(prev => ({ ...prev, supplierId: vendor.id }));
    setSupplierSearch(vendor.name);
  };

  const handleSaveVendor = async (vendorData: Omit<Vendor, 'id'> | Vendor) => {
    try {
      await addVendor(vendorData as Omit<Vendor, 'id'>);
      setIsVendorModalOpen(false);
    } catch (error) {
      toast.error("Failed to save new vendor.");
      console.error(error);
    }
  };

  const handleFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setNewSample(prev => ({ ...prev, [name]: value }));
  };

  const handleAddSample = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSample.style || !newSample.productType) return toast.error('Style and Product Type are required.');
    if (!newSample.manufacturerId) return toast.error('Please select a manufacturer.');
    if (hasDifferentSupplier && !newSample.supplierId) return toast.error('Please select a supplier.');

    setIsSaving(true);
    try {
      const sampleDataToSave = { 
        ...newSample, 
        supplierId: hasDifferentSupplier ? newSample.supplierId : newSample.manufacturerId,
      };

      if (sampleDataToSave.productType !== 'Tile') {
        sampleDataToSave.sampleFormat = null;
        sampleDataToSave.boardColors = '';
      }
      
      const createdSample = await addSample(sampleDataToSave);

      if (selectedFile) {
        const uploadData = new FormData();
        uploadData.append('photo', selectedFile);
        uploadData.append('entityType', 'sample');
        uploadData.append('entityId', String(createdSample.id));
        const res = await fetch('/api/photos', { method: 'POST', body: uploadData });
        if (!res.ok) throw new Error('Photo upload failed');
      } else if (importUrl) {
        const res = await fetch('/api/photos/from-url', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ imageUrl: importUrl, entityType: 'sample', entityId: createdSample.id }),
        });
        if (!res.ok) throw new Error('Photo import failed');
      }

      toast.success('Sample added successfully!');
      await fetchSamples();
      resetAddModal();
    } catch (error) {
      console.error(error);
      toast.error('Failed to add sample.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSampleClick = (sample: Sample) => {
    setSelectedSample(sample);
    setIsDetailModalOpen(true);
  };

  if (isLoading) {
    return <div>Loading samples...</div>;
  }

  return (
    <div className="container mx-auto p-4">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-text-primary">Sample Library</h1>
        <button onClick={() => setIsAddModalOpen(true)} className="flex items-center bg-primary hover:bg-secondary text-white font-bold py-2 px-4 rounded-lg transition-colors">
          <PlusCircle className="w-5 h-5 mr-2" />
          Add New Sample
        </button>
      </div>
      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" />
        <input type="text" placeholder="Search by style, color, manufacturer, type, or SKU..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full bg-surface border border-border rounded-lg py-2 pl-10 pr-4 focus:outline-none focus:ring-2 focus:ring-accent" />
      </div>

      {searchTerm === '' && (
        <>
          <SampleCarousel title="Checked Out - Next Due" samples={checkedOutSamples} onSampleClick={handleSampleClick} />
          <div className="border-t border-border my-8"></div>
          <h2 className="text-2xl font-semibold mb-6 text-text-primary">All Samples</h2>
        </>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {filteredSamples.map(sample => (
          <div key={sample.id} className="bg-surface rounded-lg shadow-md border border-border overflow-hidden group flex flex-col cursor-pointer" onClick={() => handleSampleClick(sample)}>
            <div className="w-full h-40 bg-gray-800 flex items-center justify-center text-text-secondary">{sample.imageUrl ? (<img src={sample.imageUrl} alt={formatSampleName(sample)} className="w-full h-full object-cover" />) : (<span className="text-sm">No Image</span>)}</div>
            <div className="p-4 flex flex-col flex-grow">
              <h3 className="font-bold text-lg text-text-primary truncate" title={formatSampleName(sample)}>{formatSampleName(sample)}</h3>
              <p className="text-sm text-text-secondary truncate" title={sample.manufacturerName || ''}>{sample.manufacturerName || 'N/A'}</p>
              <div className="flex-grow" />
              <div className="flex justify-between items-end mt-4 text-xs">
                <span className="font-semibold bg-gray-700 text-gray-300 px-2 py-1 rounded-full">{sample.productType || 'N/A'}</span>
                {sample.isAvailable ? (<span className="font-bold text-green-400">Available</span>) : (
                  <div className="text-right">
                    <div className="text-yellow-400 mb-2">
                      <span className="font-bold block">Checked Out</span>
                      {sample.checkoutProjectName && sample.checkoutProjectId && (<Link to={`/projects/${sample.checkoutProjectId}`} className="text-accent hover:underline" onClick={(e) => e.stopPropagation()}> to {sample.checkoutProjectName}</Link>)}
                    </div>
                    <div className="flex items-center gap-2 justify-end">
                      <button onClick={(e) => handleExtend(sample, e)} className="text-xs bg-blue-600 hover:bg-blue-700 text-white py-1 px-2 rounded flex items-center gap-1"><Clock size={12} /> Extend</button>
                      <button onClick={(e) => handleReturn(sample, e)} className="text-xs bg-green-600 hover:bg-green-700 text-white py-1 px-2 rounded flex items-center gap-1"><Undo2 size={12} /> Return</button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
        {filteredSamples.length === 0 && (<p className="text-text-secondary col-span-full text-center">{searchTerm ? 'No samples match your search.' : 'No samples found in the library.'}</p>)}
      </div>

      {isAddModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
          <div className="bg-surface p-8 rounded-lg shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-2xl font-bold mb-6 text-text-primary">Add New Sample</h2>
            <form onSubmit={handleAddSample}>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                <div className="md:col-span-1 space-y-4">{/* Image uploader remains the same */}
                  <div className="w-full aspect-square border-2 border-dashed border-border rounded bg-gray-800 flex items-center justify-center">{previewUrl ? <img src={previewUrl} alt="Sample Preview" className="w-full h-full object-cover rounded" /> : <span className="text-sm text-gray-500">No Image</span>}</div>
                  <div className="space-y-2">
                    <input type="file" accept="image/*" ref={fileInputRef} onChange={handleFileChange} className="hidden" />
                    <button type="button" onClick={() => fileInputRef.current?.click()} className="w-full py-2 px-4 bg-gray-600 hover:bg-gray-700 rounded text-white font-semibold">Upload File...</button>
                    <div className="text-center text-xs text-text-secondary">OR</div>
                    <div className="flex gap-2">
                      <input type="url" placeholder="Paste image URL..." value={importUrl} onChange={e => setImportUrl(e.target.value)} className="w-full p-2 bg-gray-800 border border-border rounded text-sm" />
                      <button type="button" onClick={() => setPreviewUrl(importUrl)} disabled={!importUrl} className="p-2 bg-blue-600 hover:bg-blue-700 rounded text-white disabled:bg-gray-500"><Download size={16} /></button>
                    </div>
                  </div>
                </div>
                <div className="md:col-span-2 space-y-4">
                  <div className="relative">
                    <label className="text-sm text-text-secondary">Manufacturer</label>
                    <input type="text" value={manufacturerSearch} onChange={e => { setManufacturerSearch(e.target.value); setNewSample(p => ({ ...p, manufacturerId: null })) }} className="w-full p-2 bg-gray-800 border border-border rounded" required />
                    {manufacturerSearch && manufacturerSearch !== selectedManufacturerName && (
                      <div className="absolute z-10 w-full bg-gray-900 border border-border rounded-b-md mt-1 max-h-40 overflow-y-auto">
                        {manufacturerSearchResults.map(m => <div key={m.id} onClick={() => handleSelectManufacturer(m)} className="p-2 hover:bg-accent cursor-pointer">{m.name}</div>)}
                        {manufacturerSearchResults.length === 0 && <div onClick={() => {setVendorModalPurpose('Manufacturer'); setIsVendorModalOpen(true);}} className="p-2 text-accent font-semibold hover:bg-accent hover:text-white cursor-pointer text-center border-t border-border">+ Add New Manufacturer</div>}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2"><input type="checkbox" id="add-sample-diff-supplier" checked={hasDifferentSupplier} onChange={e => setHasDifferentSupplier(e.target.checked)} className="h-4 w-4 rounded text-primary focus:ring-primary-dark bg-gray-700 border-gray-600" /><label htmlFor="add-sample-diff-supplier" className="text-sm text-text-secondary">Different Supplier?</label></div>
                  {hasDifferentSupplier && (
                    <div className="relative">
                      <label className="text-sm text-text-secondary">Supplier</label>
                      <input type="text" value={supplierSearch} onChange={e => { setSupplierSearch(e.target.value); setNewSample(p => ({ ...p, supplierId: null })) }} className="w-full p-2 bg-gray-800 border border-border rounded" required />
                      {supplierSearch && supplierSearch !== selectedSupplierName && (
                        <div className="absolute z-10 w-full bg-gray-900 border border-border rounded-b-md mt-1 max-h-40 overflow-y-auto">
                          {supplierSearchResults.map(s => <div key={s.id} onClick={() => handleSelectSupplier(s)} className="p-2 hover:bg-accent cursor-pointer">{s.name}</div>)}
                          {supplierSearchResults.length === 0 && <div onClick={() => {setVendorModalPurpose('Supplier'); setIsVendorModalOpen(true);}} className="p-2 text-accent font-semibold hover:bg-accent hover:text-white cursor-pointer text-center border-t border-border">+ Add New Supplier</div>}
                        </div>
                      )}
                    </div>
                  )}
                  <div><label className="text-sm text-text-secondary">Product Type</label><select name="productType" value={newSample.productType} onChange={handleFormChange} className="w-full p-2 bg-gray-800 border border-border rounded" required><option value="" disabled>-- Select a Type --</option>{PRODUCT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}</select></div>
                  <div><label className="text-sm text-text-secondary">Style</label><input type="text" name="style" value={newSample.style} onChange={handleFormChange} className="w-full p-2 bg-gray-800 border border-border rounded" required /></div>
                  <div><label className="text-sm text-text-secondary">Color</label><input type="text" name="color" value={newSample.color} onChange={handleFormChange} className="w-full p-2 bg-gray-800 border border-border rounded" /></div>
                  
                  {newSample.productType === 'Tile' && (
                    <div className="p-3 bg-gray-800 rounded border border-border space-y-3">
                      <fieldset>
                        <legend className="text-sm font-medium text-text-secondary mb-2">Tile Format</legend>
                        <div className="flex items-center gap-4">
                            {SAMPLE_FORMATS.map(format => (
                                <label key={format} className="flex items-center gap-2 text-sm">
                                    <input type="radio" name="sampleFormat" value={format} checked={newSample.sampleFormat === format} onChange={handleFormChange} className="h-4 w-4 text-primary focus:ring-primary-dark bg-gray-700 border-gray-600"/>
                                    {format} Sample
                                </label>
                            ))}
                        </div>
                      </fieldset>
                      {newSample.sampleFormat === 'Board' && (
                        <div><label className="text-sm text-text-secondary">Other Colors on Board</label><input type="text" name="boardColors" value={newSample.boardColors} onChange={handleFormChange} placeholder="e.g., Taupe, Grey" className="w-full p-2 bg-gray-900 border border-border rounded text-sm"/></div>
                      )}
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-4">
                    <div><label className="text-sm text-text-secondary">Line</label><input type="text" name="line" value={newSample.line} onChange={handleFormChange} className="w-full p-2 bg-gray-800 border border-border rounded" /></div>
                    <div><label className="text-sm text-text-secondary">Size</label><input type="text" name="size" value={newSample.size} onChange={handleFormChange} className="w-full p-2 bg-gray-800 border border-border rounded" /></div>
                    <div><label className="text-sm text-text-secondary">Finish</label><input type="text" name="finish" value={newSample.finish} onChange={handleFormChange} className="w-full p-2 bg-gray-800 border border-border rounded" /></div>
                    <div><label className="text-sm text-text-secondary">SKU</label><input type="text" name="sku" value={newSample.sku} onChange={handleFormChange} className="w-full p-2 bg-gray-800 border border-border rounded" /></div>
                  </div>
                  <div><label className="text-sm text-text-secondary">Product URL</label><input type="url" name="productUrl" value={newSample.productUrl} onChange={handleFormChange} className="w-full p-2 bg-gray-800 border border-border rounded" /></div>
                </div>
              </div>
              <div className="flex justify-end space-x-4 mt-8 pt-6 border-t border-border">
                <button type="button" onClick={resetAddModal} className="py-2 px-4 bg-gray-600 hover:bg-gray-700 rounded text-white">Cancel</button>
                <button type="submit" className="py-2 px-4 bg-primary hover:bg-secondary rounded text-white" disabled={isSaving}>{isSaving ? 'Adding...' : 'Add Sample'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isDetailModalOpen && selectedSample && (<SampleDetailModal isOpen={isDetailModalOpen} onClose={() => setIsDetailModalOpen(false)} sample={selectedSample} />)}

      <AddEditVendorModal 
        isOpen={isVendorModalOpen} 
        onClose={() => setIsVendorModalOpen(false)} 
        onSave={handleSaveVendor} 
        initialVendorType={vendorModalPurpose} 
      />
    </div>
  );
};

export default SampleLibrary;