import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useData } from '../context/DataContext';
import { PlusCircle, Search, Download, Clock, Undo2 } from 'lucide-react';
import { Sample, Vendor, PricingSettings } from '../types';
import { Link } from 'react-router-dom';
import SampleDetailModal from '../components/SampleDetailModal';
import { toast } from 'react-hot-toast';
import AddEditVendorModal from '../components/AddEditVendorModal';
import SampleCarousel from '../components/SampleCarousel';
// --- ADDED: Import the new reusable form component ---
import SampleForm, { SampleFormData } from '../components/SampleForm';
import * as preferenceService from '../services/preferenceService';
import { calculatePrice, getActivePricingRules } from '../utils/pricingUtils';

const formatSampleName = (sample: Sample) => {
  const parts = [];
  if (sample.line) parts.push(sample.line);
  if (sample.style) parts.push(sample.style);
  if (sample.color) parts.push(sample.color);
  if (parts.length === 0) { return `Sample #${sample.id}`; }
  return parts.join(' - ');
};

const SampleLibrary: React.FC = () => {
  const {
    samples, addSample, isLoading, vendors, addVendor,
    sampleCheckouts, updateSampleCheckout, extendSampleCheckout
  } = useData();

  const [searchTerm, setSearchTerm] = useState('');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [pricingSettings, setPricingSettings] = useState<PricingSettings | null>(null);

  useEffect(() => {
      const fetchSettings = async () => {
          try { setPricingSettings(await preferenceService.getPricingSettings()); }
          catch (e) { console.error("Failed to load pricing settings for library view."); }
      };
      fetchSettings();
  }, []);
  
  // --- All form-related state has been REMOVED from this component ---

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [importUrl, setImportUrl] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [selectedSample, setSelectedSample] = useState<Sample | null>(null);

  // This is now only used by the image uploader, can be refactored further if needed
  const resetAddModal = () => {
    setSelectedFile(null);
    setPreviewUrl(null);
    setImportUrl('');
    setIsAddModalOpen(false);
  };

  const checkedOutSamples = useMemo(() => {
    const activeCheckouts = new Map(sampleCheckouts.filter(sc => sc.actualReturnDate === null).map(sc => [sc.sampleId, sc]));
    return samples.filter(sample => activeCheckouts.has(sample.id)).sort((a, b) => {
        const checkoutA = activeCheckouts.get(a.id);
        const checkoutB = activeCheckouts.get(b.id);
        if (!checkoutA || !checkoutB) return 0;
        return new Date(checkoutA.expectedReturnDate).getTime() - new Date(checkoutB.expectedReturnDate).getTime();
    });
  }, [samples, sampleCheckouts]);

  const filteredSamples = useMemo(() => {
    const lowercasedTerm = searchTerm.toLowerCase();
    if (!lowercasedTerm) return samples;
    return samples.filter(sample => {
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

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      const newPreviewUrl = URL.createObjectURL(file);
      setPreviewUrl(newPreviewUrl);
      setImportUrl('');
    }
  };

  // --- MODIFIED: The main save handler is now simplified ---
  // It receives the complete form data from the SampleForm component
  const handleAddSample = async (formData: SampleFormData) => {
    setIsSaving(true);
    try {
      // NOTE: formData contains 'unitCost' now.
      const { supplierId, ...restOfSampleData } = formData;
      const finalSupplierId = formData.supplierId || formData.manufacturerId;

      const sampleDataToSave = { 
        ...restOfSampleData, 
        supplierId: finalSupplierId,
      };

      if (sampleDataToSave.productType !== 'Tile') {
        (sampleDataToSave as any).sampleFormat = null;
        (sampleDataToSave as any).boardColors = '';
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

  // Helper to calculate display price for cards
  const getDisplayPrice = (sample: Sample) => {
      if (!sample.unitCost || !pricingSettings) return null;
      
      // Determine the active vendor ID (Supplier if different, otherwise Manufacturer)
      const vendorId = sample.supplierId || sample.manufacturerId;
      const vendor = vendors.find(v => v.id === vendorId);

      // Get pricing rules (defaults to 'Customer' for retail sale, using global or vendor override)
      const rules = getActivePricingRules(vendor, pricingSettings, 'Customer');
      const price = calculatePrice(Number(sample.unitCost), rules.percentage, rules.method);
      return price;
  };

  if (isLoading) { return <div>Loading samples...</div>; }

  return (
    <div className="container mx-auto p-4">
      <div className="bg-surface p-6 rounded-lg shadow-md mb-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
          <h1 className="text-3xl font-bold text-text-primary">Sample Library</h1>
          <button onClick={() => setIsAddModalOpen(true)} className="flex items-center bg-primary hover:bg-primary-hover text-on-primary font-bold py-2 px-4 rounded-lg transition-colors shadow-md">
            <PlusCircle className="w-5 h-5 mr-2" />
            Add New Sample
          </button>
        </div>
        <div className="relative w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary" size={18} />
          <input type="text" placeholder="Search by style, color, manufacturer, type, or SKU..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-10 pr-4 py-3 bg-background border border-border rounded-lg text-text-primary focus:ring-2 focus:ring-primary outline-none transition-all shadow-inner" />
        </div>
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
            <div className="w-full h-40 bg-background flex items-center justify-center">{sample.imageUrl ? (<img src={sample.imageUrl} alt={formatSampleName(sample)} className="w-full h-full object-cover" />) : (<span className="text-sm text-text-secondary">No Image</span>)}</div>
            <div className="p-4 flex flex-col flex-grow">
              <h3 className="font-bold text-lg text-text-primary truncate" title={formatSampleName(sample)}>{formatSampleName(sample)}</h3>
              <p className="text-sm text-text-secondary truncate" title={sample.manufacturerName || ''}>{sample.manufacturerName || 'N/A'}</p>
              
              {/* --- UPDATED: Price Display (Calculated) --- */}
              {sample.unitCost && (
                  <p className="text-sm font-semibold text-green-400 mt-1">
                      {pricingSettings ? `$${getDisplayPrice(sample)?.toFixed(2)}` : '...'} 
                      <span className="text-text-secondary font-normal"> / {sample.uom}</span>
                  </p>
              )}
              
              <div className="flex-grow" />
              <div className="flex justify-between items-end mt-4 text-xs">
                <span className="font-semibold bg-background text-text-secondary px-2 py-1 rounded-full">{sample.productType || 'N/A'}</span>
                {sample.isAvailable ? (<span className="font-bold text-green-400">Available</span>) : (
                  <div className="text-right">
                    <div className="text-yellow-400 mb-2">
                      <span className="font-bold block">Checked Out</span>
                      {sample.checkoutProjectName && sample.checkoutProjectId && (<Link to={`/projects/${sample.checkoutProjectId}`} className="text-accent hover:underline" onClick={(e) => e.stopPropagation()}> to {sample.checkoutProjectName}</Link>)}
                    </div>
                    <div className="flex items-center gap-2 justify-end">
                      <button onClick={(e) => handleExtend(sample, e)} className="text-xs bg-primary hover:bg-primary-hover text-on-primary py-1 px-2 rounded flex items-center gap-1"><Clock size={12} /> Extend</button>
                      <button onClick={(e) => handleReturn(sample, e)} className="text-xs bg-accent hover:bg-accent-hover text-on-accent py-1 px-2 rounded flex items-center gap-1"><Undo2 size={12} /> Return</button>
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
            {/* --- MODIFIED: The modal body is now much cleaner --- */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                <div className="md:col-span-1 space-y-4">
                  <div className="w-full aspect-square border-2 border-dashed border-border rounded bg-background flex items-center justify-center">{previewUrl ? <img src={previewUrl} alt="Sample Preview" className="w-full h-full object-cover rounded" /> : <span className="text-sm text-text-secondary">No Image</span>}</div>
                  <div className="space-y-2">
                    <input type="file" accept="image/*" ref={fileInputRef} onChange={handleFileChange} className="hidden" />
                    <button type="button" onClick={() => fileInputRef.current?.click()} className="w-full py-2 px-4 bg-secondary hover:bg-secondary-hover rounded text-on-secondary font-semibold">Upload File...</button>
                    <div className="text-center text-xs text-text-secondary">OR</div>
                    <div className="flex gap-2">
                      <input type="url" placeholder="Paste image URL..." value={importUrl} onChange={e => setImportUrl(e.target.value)} className="w-full p-2 bg-background text-text-primary border border-border rounded text-sm" />
                      <button type="button" onClick={() => setPreviewUrl(importUrl)} disabled={!importUrl} className="p-2 bg-primary hover:bg-primary-hover rounded text-on-primary disabled:opacity-50"><Download size={16} /></button>
                    </div>
                  </div>
                </div>
                <div className="md:col-span-2">
                    <SampleForm 
                        onSave={handleAddSample}
                        onCancel={resetAddModal}
                        isSaving={isSaving}
                        saveButtonText="Add Sample"
                    />
                </div>
            </div>
          </div>
        </div>
      )}

      {isDetailModalOpen && selectedSample && (<SampleDetailModal key={selectedSample.id} isOpen={isDetailModalOpen} onClose={() => setIsDetailModalOpen(false)} sample={selectedSample} />)}
      
    
    </div>
  );
};

export default SampleLibrary;