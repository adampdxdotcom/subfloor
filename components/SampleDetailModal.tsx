// components/SampleDetailModal.tsx

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useData } from '../context/DataContext';
// --- MODIFIED: Import new types and constants for the form ---
import { Sample, Vendor, PRODUCT_TYPES, SAMPLE_FORMATS, ProductType, SampleFormat } from '../types';
import { toast } from 'react-hot-toast';
import { Link } from 'react-router-dom';
import { Edit, X, Calendar, ChevronsRight, Undo2, Link as LinkIcon, Download, Trash2, QrCode, Printer, Clock, History } from 'lucide-react';
import AddEditVendorModal from './AddEditVendorModal';
import ActivityHistory from './ActivityHistory';

interface SampleDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  sample: Sample | null;
}

// --- ADDED: Consistent name formatting utility ---
const formatSampleName = (sample: Sample | null): string => {
  if (!sample) return 'Sample';
  const parts = [];
  if (sample.line) parts.push(sample.line);
  if (sample.style) parts.push(sample.style);
  if (sample.color) parts.push(sample.color);
  if (parts.length === 0) return `Sample #${sample.id}`;
  return parts.join(' - ');
};

// --- ADDED: A clear initial state for the new form structure ---
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

const SampleDetailModal: React.FC<SampleDetailModalProps> = ({ isOpen, onClose, sample }) => {
  const { 
    currentUser,
    vendors, sampleCheckouts, projects, fetchSamples, updateSample, addVendor,
    updateSampleCheckout, deleteSample, extendSampleCheckout,
    sampleHistory, fetchSampleHistory
  } = useData();
  
  const [isEditing, setIsEditing] = useState(false);
  // --- MODIFIED: Use the new, structured initial state ---
  const [formData, setFormData] = useState(initialFormState);
  
  const [manufacturerSearch, setManufacturerSearch] = useState('');
  const [supplierSearch, setSupplierSearch] = useState('');
  const [isVendorModalOpen, setIsVendorModalOpen] = useState(false);
  const [vendorModalPurpose, setVendorModalPurpose] = useState<'manufacturer' | 'supplier'>('general');

  const selectedManufacturerName = useMemo(() =>
    vendors.find(v => v.id === formData.manufacturerId)?.name,
  [vendors, formData.manufacturerId]);

  const selectedSupplierName = useMemo(() =>
    vendors.find(v => v.id === formData.supplierId)?.name,
  [vendors, formData.supplierId]);

  // --- MODIFIED: Vendor search logic updated for new 'vendorType' field ---
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
  
  // --- MODIFIED: Manufacturer selection now also sets default product type ---
  const handleSelectManufacturer = (vendor: Vendor) => {
    setFormData(prev => ({ 
        ...prev, 
        manufacturerId: vendor.id,
        // Smartly select default, but don't override an existing value
        productType: (vendor.defaultProductType as ProductType) || prev.productType || ''
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
        toast.error("Failed to save new vendor.");
        console.error(error);
    }
  };

  const openVendorModal = (purpose: 'manufacturer' | 'supplier') => {
    setVendorModalPurpose(purpose);
    setIsVendorModalOpen(true);
  };

  const [hasDifferentSupplier, setHasDifferentSupplier] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [importUrl, setImportUrl] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const qrCodePrintRef = useRef<HTMLDivElement>(null);
  const [historyView, setHistoryView] = useState<'checkouts' | 'changes'>('checkouts');

  const { checkoutHistory, currentCheckout } = useMemo(() => {
    if (!sample) return { checkoutHistory: [], currentCheckout: null };
    
    const history = sampleCheckouts
      .filter(sc => sc.sampleId === sample.id)
      .map(checkout => {
        const project = projects.find(p => p.id === checkout.projectId);
        return { ...checkout, projectName: project?.projectName || 'Unknown Project' };
      })
      .sort((a, b) => new Date(b.checkoutDate).getTime() - new Date(a.checkoutDate).getTime());
      
    const activeCheckout = history.find(h => !h.actualReturnDate) || null;

    return { checkoutHistory: history, currentCheckout: activeCheckout };
  }, [sample, sampleCheckouts, projects]);

  // --- MODIFIED: useEffect completely rewritten to populate the new form state ---
  useEffect(() => {
    if (isOpen && sample) {
      setFormData({
        manufacturerId: sample.manufacturerId || null,
        supplierId: sample.supplierId || null,
        productType: (sample.productType as ProductType) || '',
        style: sample.style || '',
        line: sample.line || '',
        size: sample.size || '',
        finish: sample.finish || '',
        color: sample.color || '',
        sampleFormat: (sample.sampleFormat as SampleFormat) || 'Loose',
        boardColors: sample.boardColors || '',
        sku: sample.sku || '',
        productUrl: sample.productUrl || '',
      });
      setManufacturerSearch(sample.manufacturerName || '');
      setSupplierSearch(sample.supplierName || '');
      // A supplier is different if it exists and isn't the same as the manufacturer
      setHasDifferentSupplier(!!sample.supplierId && sample.supplierId !== sample.manufacturerId);
      setPreviewUrl(sample.imageUrl ? sample.imageUrl : null);
      setSelectedFile(null);
      setImportUrl('');
      setIsEditing(false);
      setHistoryView('checkouts');
      fetchSampleHistory(sample.id);
    }
  }, [sample, isOpen, fetchSampleHistory]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
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
  
  const handleImportFromUrl = async () => {
    if (!importUrl || !sample) return;
    setIsImporting(true);
    try {
      const response = await fetch('/api/photos/from-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageUrl: importUrl, entityType: 'sample', entityId: sample.id }),
      });
      if (!response.ok) throw new Error('Failed to import from URL');
      const newPhoto = await response.json();
      setPreviewUrl(newPhoto.url);
      toast.success('Image imported successfully!');
      setSelectedFile(null);
      await fetchSamples();
    } catch (error) {
      console.error(error);
      toast.error('Could not import image from URL.');
    } finally {
      setIsImporting(false);
    }
  };

  // --- MODIFIED: handleSubmit rewritten to send the new data structure to the API ---
  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!sample) return;
    if (!formData.style || !formData.productType) return toast.error('Style and Product Type are required.');
    if (!formData.manufacturerId) return toast.error('Please select a manufacturer.');
    if (hasDifferentSupplier && !formData.supplierId) return toast.error('Please select a supplier.');

    setIsSaving(true);
    try {
      const dataToSave = {
        ...formData,
        // If supplier isn't different, it's the same as manufacturer. If it IS different, use its ID.
        supplierId: hasDifferentSupplier ? formData.supplierId : formData.manufacturerId,
      };

      // Null out tile-specific fields if product type is not 'Tile'
      if (dataToSave.productType !== 'Tile') {
        dataToSave.sampleFormat = null;
        dataToSave.boardColors = '';
      }

      await updateSample(sample.id, dataToSave);

      if (selectedFile) {
        const uploadData = new FormData();
        uploadData.append('photo', selectedFile);
        uploadData.append('entityType', 'sample');
        uploadData.append('entityId', String(sample.id));
        const res = await fetch('/api/photos', { method: 'POST', body: uploadData });
        if (!res.ok) throw new Error('Photo upload failed during edit.');
      }
      
      await fetchSamples();
      toast.success(`Sample '${formatSampleName(sample)}' updated successfully!`);
      setIsEditing(false);
    } catch (error) {
      console.error('Error updating sample:', error);
      toast.error('Failed to update sample.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleReturnSample = async () => {
    if (!sample || !currentCheckout) {
      toast.error("Could not find active checkout record to return.");
      return;
    }
    try {
      await updateSampleCheckout(currentCheckout);
      toast.success(`'${formatSampleName(sample)}' has been returned.`);
      onClose();
    } catch (error) {
      console.error("Failed to return sample:", error);
      toast.error("An error occurred while returning the sample.");
    }
  };

  const handleExtendCheckout = async () => {
    if (!sample || !currentCheckout) {
        toast.error("Could not find active checkout record to extend.");
        return;
    }
    try {
        await extendSampleCheckout(currentCheckout);
    } catch (error) {
        toast.error("An error occurred while extending the checkout.");
    }
  };
  
  const handleDeleteSample = async () => {
    if (!sample) return;
    if (!window.confirm(`Are you sure you want to permanently delete "${formatSampleName(sample)}"? This cannot be undone.`)) {
        return;
    }
    setIsDeleting(true);
    try {
        await deleteSample(sample.id);
        toast.success(`Sample "${formatSampleName(sample)}" deleted.`);
        onClose();
    } catch (error: any) {
        console.error(error);
        toast.error(error.message || 'Failed to delete sample.');
    } finally {
        setIsDeleting(false);
    }
  };

  const handlePrintQrCode = () => {
    const printWindow = window.open('', '_blank');
    if (printWindow && qrCodePrintRef.current) {
        printWindow.document.write('<html><head><title>Print QR Code</title>');
        printWindow.document.write('<style>body { text-align: center; font-family: sans-serif; } img { width: 250px; height: 250px; } </style>');
        printWindow.document.write('</head><body>');
        printWindow.document.write(qrCodePrintRef.current.innerHTML);
        printWindow.document.write('</body></html>');
        printWindow.document.close();
        printWindow.print();
    }
  };

  if (!isOpen || !sample) return null;

  return (
    <>
      <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
        {/* --- MODIFIED: max-w-5xl to give the form more space --- */}
        <div className="bg-surface p-4 md:p-8 rounded-lg shadow-2xl w-full max-w-5xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
          <div className="flex justify-between items-start mb-6">
            {/* --- MODIFIED: Use formatSampleName for the title --- */}
            <h2 className="text-3xl font-bold text-text-primary">{isEditing ? 'Editing Sample' : formatSampleName(sample)}</h2>
            <button onClick={isEditing ? () => setIsEditing(false) : onClose} className="p-2 rounded-full hover:bg-gray-700">
              <X className="w-6 h-6" />
            </button>
          </div>
          <form onSubmit={handleSubmit}>
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
              {/* Image uploader section remains the same */}
              <div className="lg:col-span-3 space-y-4">
                <div className="w-full aspect-square border-2 border-dashed border-border rounded bg-gray-800 flex items-center justify-center">
                  {previewUrl ? <img src={previewUrl} alt="Sample Preview" className="w-full h-full object-cover rounded" /> : <span className="text-sm text-gray-500">No Image</span>}
                </div>
                {isEditing && (
                  <div className="space-y-2">
                    <input type="file" accept="image/*" ref={fileInputRef} onChange={handleFileChange} className="hidden" />
                    <button type="button" onClick={() => fileInputRef.current?.click()} className="w-full py-2 px-4 bg-gray-600 hover:bg-gray-700 rounded text-white font-semibold">Upload File...</button>
                    <div className="text-center text-xs text-text-secondary">OR</div>
                    <div className="flex gap-2">
                      <input type="url" placeholder="Paste image URL..." value={importUrl} onChange={e => setImportUrl(e.target.value)} className="w-full p-2 bg-gray-800 border border-border rounded text-sm" />
                      <button type="button" onClick={handleImportFromUrl} disabled={!importUrl || isImporting} className="p-2 bg-blue-600 hover:bg-blue-700 rounded text-white disabled:bg-gray-500">{isImporting ? '...' : <Download size={16} />}</button>
                    </div>
                  </div>
                )}
              </div>
              {/* --- MODIFIED: lg:col-span-5 to lg:col-span-6 for better spacing --- */}
              <div className="lg:col-span-6 space-y-4">
                {isEditing ? (
                  // --- MODIFIED: The entire edit form is rebuilt to match the new model ---
                  <>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="relative">
                            <label className="text-sm text-text-secondary">Manufacturer</label>
                            <input type="text" value={manufacturerSearch} onChange={e => { setManufacturerSearch(e.target.value); setFormData(p => ({ ...p, manufacturerId: null })) }} className="w-full p-2 bg-gray-800 border border-border rounded" required />
                            {manufacturerSearch && manufacturerSearch !== selectedManufacturerName && (
                            <div className="absolute z-10 w-full bg-gray-900 border border-border rounded-b-md mt-1 max-h-40 overflow-y-auto">
                                {manufacturerSearchResults.map(m => <div key={m.id} onClick={() => handleSelectManufacturer(m)} className="p-2 hover:bg-accent cursor-pointer">{m.name}</div>)}
                                {manufacturerSearchResults.length === 0 && <div onClick={() => openVendorModal('manufacturer')} className="p-2 text-accent font-semibold hover:bg-accent hover:text-white cursor-pointer text-center border-t border-border">+ Add New Manufacturer</div>}
                            </div>
                            )}
                        </div>
                         <div><label className="text-sm text-text-secondary">Product Type</label><select name="productType" value={formData.productType} onChange={handleInputChange} className="w-full p-2 bg-gray-800 border border-border rounded" required><option value="" disabled>-- Select a Type --</option>{PRODUCT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}</select></div>
                    </div>
                    <div className="flex items-center gap-2 pt-2"><input type="checkbox" id="edit-sample-diff-supplier" checked={hasDifferentSupplier} onChange={(e) => setHasDifferentSupplier(e.target.checked)} className="h-4 w-4 rounded text-primary focus:ring-primary-dark bg-gray-700 border-gray-600" /><label htmlFor="edit-sample-diff-supplier" className="text-sm text-text-secondary">Use a Different Supplier</label></div>
                    {hasDifferentSupplier && (
                      <div className="relative">
                        <label className="text-sm text-text-secondary">Supplier</label>
                        <input type="text" value={supplierSearch} onChange={e => { setSupplierSearch(e.target.value); setFormData(p => ({ ...p, supplierId: null })); }} className="w-full p-2 bg-gray-800 border border-border rounded" required />
                        {supplierSearch && supplierSearch !== selectedSupplierName && (
                          <div className="absolute z-10 w-full bg-gray-900 border border-border rounded-b-md mt-1 max-h-40 overflow-y-auto">
                            {supplierSearchResults.map(s => <div key={s.id} onClick={() => handleSelectSupplier(s)} className="p-2 hover:bg-accent cursor-pointer">{s.name}</div>)}
                            {supplierSearchResults.length === 0 && <div onClick={() => openVendorModal('supplier')} className="p-2 text-accent font-semibold hover:bg-accent hover:text-white cursor-pointer text-center border-t border-border">+ Add New Supplier</div>}
                          </div>
                        )}
                      </div>
                    )}
                    <div className="grid grid-cols-2 gap-4">
                        <div><label className="text-sm text-text-secondary">Style</label><input type="text" name="style" value={formData.style} onChange={handleInputChange} className="w-full p-2 bg-gray-800 border border-border rounded" required /></div>
                        <div><label className="text-sm text-text-secondary">Color</label><input type="text" name="color" value={formData.color} onChange={handleInputChange} className="w-full p-2 bg-gray-800 border border-border rounded" /></div>
                    </div>
                     {formData.productType === 'Tile' && (
                        <div className="p-3 bg-gray-800/50 rounded border border-border space-y-3">
                        <fieldset>
                            <legend className="text-sm font-medium text-text-secondary mb-2">Tile Format</legend>
                            <div className="flex items-center gap-4">
                                {SAMPLE_FORMATS.map(format => (
                                    <label key={format} className="flex items-center gap-2 text-sm">
                                        <input type="radio" name="sampleFormat" value={format} checked={formData.sampleFormat === format} onChange={handleInputChange} className="h-4 w-4 text-primary focus:ring-primary-dark bg-gray-700 border-gray-600"/>
                                        {format} Sample
                                    </label>
                                ))}
                            </div>
                        </fieldset>
                        {formData.sampleFormat === 'Board' && (
                            <div><label className="text-sm text-text-secondary">Other Colors on Board</label><input type="text" name="boardColors" value={formData.boardColors} onChange={handleInputChange} placeholder="e.g., Taupe, Grey" className="w-full p-2 bg-gray-900 border border-border rounded text-sm"/></div>
                        )}
                        </div>
                    )}
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                        <div><label className="text-sm text-text-secondary">Line</label><input type="text" name="line" value={formData.line} onChange={handleInputChange} className="w-full p-2 bg-gray-800 border border-border rounded" /></div>
                        <div><label className="text-sm text-text-secondary">Size</label><input type="text" name="size" value={formData.size} onChange={handleInputChange} className="w-full p-2 bg-gray-800 border border-border rounded" /></div>
                        <div><label className="text-sm text-text-secondary">Finish</label><input type="text" name="finish" value={formData.finish} onChange={handleInputChange} className="w-full p-2 bg-gray-800 border border-border rounded" /></div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div><label className="text-sm text-text-secondary">SKU</label><input type="text" name="sku" value={formData.sku} onChange={handleInputChange} className="w-full p-2 bg-gray-800 border border-border rounded" /></div>
                        <div><label className="text-sm text-text-secondary">Product URL</label><input type="url" name="productUrl" value={formData.productUrl} onChange={handleInputChange} className="w-full p-2 bg-gray-800 border border-border rounded" /></div>
                    </div>
                  </>
                ) : (
                  // --- MODIFIED: The display view is rebuilt for the new data structure ---
                  <div className="space-y-3 text-text-secondary">
                      <p><strong>Manufacturer:</strong> {sample.manufacturerName || 'N/A'}</p>
                      {sample.supplierId !== sample.manufacturerId && sample.supplierName && <p><strong>Supplier:</strong> {sample.supplierName}</p>}
                      <p><strong>Product Type:</strong> {sample.productType}</p>
                      <p><strong>Style:</strong> {sample.style}</p>
                      {sample.color && <p><strong>Color:</strong> {sample.color}</p>}
                      {sample.line && <p><strong>Line:</strong> {sample.line}</p>}
                      {sample.size && <p><strong>Size:</strong> {sample.size}</p>}
                      {sample.finish && <p><strong>Finish:</strong> {sample.finish}</p>}
                      {sample.productType === 'Tile' && sample.sampleFormat && <p><strong>Format:</strong> {sample.sampleFormat} Sample</p>}
                      {sample.productType === 'Tile' && sample.sampleFormat === 'Board' && sample.boardColors && <p><strong>Board Colors:</strong> {sample.boardColors}</p>}
                      <p><strong>SKU:</strong> {sample.sku || 'N/A'}</p>
                      <p className="flex items-center gap-2"><strong>Product Link:</strong> {sample.productUrl ? <a href={sample.productUrl} target="_blank" rel="noopener noreferrer" className="text-accent hover:underline flex items-center">Visit Site <LinkIcon size={14} className="ml-1"/></a> : 'N/A'}</p>
                      <div className="mt-4 pt-4 border-t border-border">
                          <p className="flex items-center gap-2"><strong>Status:</strong> <span className={`font-bold px-2 py-1 rounded-full text-xs ${sample.isAvailable ? 'bg-green-800/50 text-green-300' : 'bg-yellow-800/50 text-yellow-300'}`}>{sample.isAvailable ? 'Available' : 'Checked Out'}</span></p>
                      </div>
                  </div>
                )}
              </div>
              {/* QR Code section */}
               {!isEditing && (
                <div className="lg:col-span-3 space-y-4">
                  <div className="bg-gray-800 p-4 rounded-lg text-center">
                    <h4 className="font-semibold text-text-primary mb-2 flex items-center justify-center gap-2"><QrCode /> Sample QR Code</h4>
                    <div ref={qrCodePrintRef}>
                      <img src={`/api/samples/${sample.id}/qr`} alt="Sample QR Code" className="w-48 h-48 mx-auto bg-white p-2 rounded-md"/>
                      <p className="text-xs text-text-secondary mt-2 font-mono">ID: {sample.id}</p>
                      {/* --- MODIFIED: Use formatSampleName for QR code label --- */}
                      <p className="text-sm font-semibold mt-1">{formatSampleName(sample)}</p>
                    </div>
                    <button type="button" onClick={handlePrintQrCode} className="mt-4 w-full flex items-center justify-center gap-2 py-2 px-4 bg-gray-600 hover:bg-gray-700 rounded text-white font-semibold"><Printer size={16} />Print</button>
                  </div>
                </div>
              )}
            </div>
            {/* History section remains the same */}
            {!isEditing && (
               <div className="mt-8 border-t border-border pt-6">
                  <div className="flex justify-between items-center mb-4">
                    <div className="flex items-center"><h3 className="text-xl font-semibold flex items-center">{historyView === 'checkouts' ? <><Calendar className="w-6 h-6 mr-2 text-accent"/> Checkout History</> : <><History className="w-6 h-6 mr-2 text-accent"/> Change History</>}</h3></div>
                    <button type="button" onClick={() => setHistoryView(prev => prev === 'checkouts' ? 'changes' : 'checkouts')} className="text-sm text-accent hover:underline">{historyView === 'checkouts' ? 'Show Change History' : 'Show Checkout History'}</button>
                  </div>
                  <div className="space-y-3 max-h-48 overflow-y-auto pr-2">
                    {historyView === 'checkouts' ? (
                      checkoutHistory.length > 0 ? checkoutHistory.map(h => (
                          <li key={h.id} className="bg-gray-800 p-3 rounded-md flex justify-between items-center list-none">
                            <div><p className="font-semibold text-text-primary">Checked out to <Link to={`/projects/${h.projectId}`} className="text-accent hover:underline">{h.projectName}</Link></p><p className="text-xs text-text-secondary">{new Date(h.checkoutDate).toLocaleDateString()} <ChevronsRight className="inline w-4 h-4 mx-1" /> {h.actualReturnDate ? new Date(h.actualReturnDate).toLocaleDateString() : 'Present'}</p></div>
                            <span className={`px-2 py-1 text-xs rounded-full font-bold ${h.actualReturnDate ? 'bg-gray-600 text-gray-300' : 'bg-yellow-500 text-gray-900'}`}>{h.actualReturnDate ? 'Returned' : 'Active'}</span>
                          </li>
                      )) : <p className="text-text-secondary text-center py-4">No checkout history for this sample.</p>
                    ) : (
                      <ActivityHistory history={sampleHistory} />
                    )}
                  </div>
              </div>
            )}
            {/* Button controls section remains the same */}
            <div className="flex justify-end gap-4 mt-8 border-t border-border pt-6">
              {isEditing ? (
                <>
                  {currentUser?.roles?.includes('Admin') && (
                    <button type="button" onClick={handleDeleteSample} className="py-2 px-4 bg-red-600 hover:bg-red-700 rounded text-white font-semibold flex items-center gap-2 disabled:bg-red-900 disabled:cursor-not-allowed" disabled={isDeleting} style={{ marginRight: 'auto' }}><Trash2 size={16} />{isDeleting ? 'Deleting...' : 'Delete Sample'}</button>
                  )}
                  <button type="button" onClick={() => setIsEditing(false)} className="py-2 px-4 bg-gray-600 hover:bg-gray-700 rounded text-white">Cancel</button>
                  <button type="submit" className="py-2 px-4 bg-primary hover:bg-secondary rounded text-white" disabled={isSaving || isDeleting}>{isSaving ? 'Saving...' : 'Save Changes'}</button>
                </>
              ) : (
                  <div className="flex items-center gap-4">
                      {!sample.isAvailable && (
                          <>
                            <button type="button" onClick={handleExtendCheckout} className="flex items-center py-2 px-4 bg-blue-600 hover:bg-blue-700 rounded text-white"><Clock className="w-4 h-4 mr-2"/> Extend</button>
                            <button type="button" onClick={handleReturnSample} className="flex items-center py-2 px-4 bg-green-600 hover:bg-green-700 rounded text-white"><Undo2 className="w-4 h-4 mr-2"/> Return Sample</button>
                          </>
                      )}
                      <button type="button" onClick={onClose} className="py-2 px-4 bg-gray-600 hover:bg-gray-700 rounded text-white">Close</button>
                      <button type="button" onClick={() => setIsEditing(true)} className="flex items-center py-2 px-4 bg-blue-600 hover:bg-blue-700 rounded text-white"><Edit className="w-4 h-4 mr-2"/> Edit Sample</button>
                  </div>
              )}
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

export default SampleDetailModal;