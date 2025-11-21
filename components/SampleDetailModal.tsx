import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useData } from '../context/DataContext';
import { Sample, Vendor, PRODUCT_TYPES, SAMPLE_FORMATS, ProductType, SampleFormat, UNITS, PricingSettings, SampleSizeVariant } from '../types';
import { toast } from 'react-hot-toast';
import { Link } from 'react-router-dom';
import { Edit, X, Calendar, ChevronsRight, Undo2, Link as LinkIcon, Download, Trash2, QrCode, Printer, Clock, History, Archive } from 'lucide-react';
import AddEditVendorModal from './AddEditVendorModal';
import * as preferenceService from '../services/preferenceService';
import { calculatePrice, getActivePricingRules, formatCurrency } from '../utils/pricingUtils';
import ActivityHistory from './ActivityHistory';
import CreatableSelect from 'react-select/creatable';
import * as sampleService from '../services/sampleService';
import { MultiValue } from 'react-select';
// Import SampleForm and its expected data structure
import SampleForm, { SampleFormData } from './SampleForm';


interface SampleDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  sample: Sample | null;
}

const formatSampleName = (sample: Sample | null): string => {
  if (!sample) return 'Sample';
  const parts = [];
  if (sample.line) parts.push(sample.line);
  if (sample.style) parts.push(sample.style);
  if (sample.color) parts.push(sample.color);
  if (parts.length === 0) return `Sample #${sample.id}`;
  return parts.join(' - ');
};

// Define a minimal placeholder matching SampleFormData structure internally
const initialEmptyFormData: SampleFormData = {
  manufacturerId: null,
  supplierId: null,
  productType: '' as ProductType | '',
  style: '',
  line: '',
  sizes: [], // Note: SampleForm expects SampleSizeVariant[], not string[]
  finish: '',
  color: '',
  sampleFormat: 'Loose',
  boardColors: '',
  sku: '',
  productUrl: '',
  unitCost: null, 
  uom: '',
  cartonSize: null,
};


const SampleDetailModal: React.FC<SampleDetailModalProps> = ({ isOpen, onClose, sample }) => {
  const { 
    currentUser,
    vendors, sampleCheckouts, projects, fetchSamples, updateSample, addVendor,
    updateSampleCheckout, deleteSample, extendSampleCheckout, toggleSampleDiscontinued,
    sampleHistory, fetchSampleHistory
  } = useData();
  
  const [isEditing, setIsEditing] = useState(false);
  
  // States related to editing (kept minimal)
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [importUrl, setImportUrl] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const qrCodePrintRef = useRef<HTMLDivElement>(null);
  const [historyView, setHistoryView] = useState<'checkouts' | 'changes'>('checkouts');
  const [pricingSettings, setPricingSettings] = useState<PricingSettings | null>(null);
  const [isVendorModalOpen, setIsVendorModalOpen] = useState(false);
  const [vendorModalPurpose, setVendorModalPurpose] = useState<'manufacturer' | 'supplier'>('general');
  
  const [isTogglingStatus, setIsTogglingStatus] = useState(false);

  useEffect(() => {
      const fetchSettings = async () => {
          try { setPricingSettings(await preferenceService.getPricingSettings()); }
          catch (e) { console.error("Failed to load pricing settings."); }
      };
      fetchSettings();
  }, []);


  const { checkoutHistory, currentCheckout } = useMemo(() => {
    if (!sample) return { checkoutHistory: [], currentCheckout: null };
    const history = sampleCheckouts.filter(sc => sc.sampleId === sample.id).map(checkout => {
        const project = projects.find(p => p.id === checkout.projectId);
        return { ...checkout, projectName: project?.projectName || 'Unknown Project' };
    }).sort((a, b) => new Date(b.checkoutDate).getTime() - new Date(a.checkoutDate).getTime());
    const activeCheckout = history.find(h => !h.actualReturnDate) || null;
    return { checkoutHistory: history, currentCheckout: activeCheckout };
  }, [sample, sampleCheckouts, projects]);


  // Helper to map Sample props to SampleFormData required by the inner form
  const initialFormData: Partial<SampleFormData> = useMemo(() => {
    if (!sample) return initialEmptyFormData;

    // Map the server's variant structure { size: ..., ... } to the form's { value: ..., ... }
    const sizesForForm: SampleSizeVariant[] = (sample.sizes || []).map(sizeItem => {
        if (typeof sizeItem === 'string') {
             // Handle legacy string format if present
            return { value: sizeItem, unitCost: null, cartonSize: null, uom: null };
        }
        // Server sends 'size' field inside the object, we map it to 'value'
        // We use type assertion since the server query ensures these fields exist for variants
        const variant = sizeItem as SampleSizeVariant & { size?: string };
        return {
            value: variant.value || variant.size || '', 
            unitCost: variant.unitCost,
            cartonSize: variant.cartonSize,
            uom: variant.uom,
        };
    });

    return {
        manufacturerId: sample.manufacturerId || null,
        supplierId: sample.supplierId || null,
        productType: (sample.productType as ProductType) || '',
        style: sample.style || '',
        line: sample.line || '',
        sizes: sizesForForm,
        finish: sample.finish || '',
        color: sample.color || '',
        sampleFormat: (sample.sampleFormat as SampleFormat) || 'Loose',
        boardColors: sample.boardColors || '',
        sku: sample.sku || '',
        productUrl: sample.productUrl || '',
        unitCost: sample.unitCost || null,
        uom: sample.uom || '',
        cartonSize: sample.cartonSize || null,
    } as Partial<SampleFormData>;
  }, [sample]);

  // Set up preview image and fetch history when modal opens
  useEffect(() => {
    if (isOpen && sample) {
      setPreviewUrl(sample.imageUrl ? sample.imageUrl : null);
      setSelectedFile(null);
      setImportUrl('');
      setIsEditing(false);
      setHistoryView('checkouts');
      fetchSampleHistory(sample.id);
    }
  }, [sample, isOpen, fetchSampleHistory]);

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

  // Callback function for SampleForm save button
  const handleFormSave = async (formDataFromForm: SampleFormData) => {
    if (!sample) return;
    setIsSaving(true);

    try {
      // Data structure is ready to send to the server
      await updateSample(sample.id, formDataFromForm);

      // Handle image upload separately
      if (selectedFile) {
        const uploadData = new FormData();
        uploadData.append('photo', selectedFile);
        uploadData.append('entityType', 'sample');
        uploadData.append('entityId', String(sample.id));
        const res = await fetch('/api/photos', { method: 'POST', body: uploadData });
        if (!res.ok) throw new Error('Photo upload failed during edit.');
      }
      
      toast.success(`Sample '${formatSampleName(sample)}' updated successfully!`);
      setIsEditing(false);
    } catch (error) {
      console.error('Error updating sample:', error);
      toast.error('Failed to update sample.');
    } finally {
      setIsSaving(false);
    }
  };


  // --- REMAINDER OF UNCHANGED LOGIC ---

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

  const getCalculatedPrices = () => {
      if (!sample || !sample.unitCost || !pricingSettings) return null;
      const vendorId = sample.supplierId || sample.manufacturerId;
      const vendor = vendors.find(v => v.id === vendorId);
      const rules = getActivePricingRules(vendor, pricingSettings, 'Customer');
      const retailPrice = calculatePrice(Number(sample.unitCost), rules.percentage, rules.method);
      const cartonPrice = sample.cartonSize ? retailPrice * Number(sample.cartonSize) : null;
      return { retailPrice, cartonPrice, rules };
  };

  const handleToggleDiscontinued = async () => {
      if (!sample) return;
      const action = sample.isDiscontinued ? 'restore' : 'discontinue';
      if (!confirm(`Are you sure you want to ${action} "${formatSampleName(sample)}"?`)) return;

      setIsTogglingStatus(true);
      try {
          await toggleSampleDiscontinued(sample.id, !sample.isDiscontinued);
          // The toast is handled in DataContext
          onClose(); // Close modal after action
      } catch (err) {
          // Error toast handled in DataContext
      } finally {
          setIsTogglingStatus(false);
      }
  };

  if (!isOpen || !sample) return null;

  return (
    <>
      <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
        <div className="bg-surface p-4 md:p-8 rounded-lg shadow-2xl w-full max-w-5xl max-h-[90vh] overflow-y-auto border border-border" onClick={(e) => e.stopPropagation()}>
          <div className="flex justify-between items-start mb-6">
            <h2 className="text-3xl font-bold text-text-primary">{isEditing ? 'Editing Sample' : formatSampleName(sample)}</h2>
            <button onClick={isEditing ? () => setIsEditing(false) : onClose} className="p-2 rounded-full hover:bg-background text-text-primary"> <X className="w-6 h-6" /> </button>
          </div>
          
          {isEditing ? (
             <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                 <div className="lg:col-span-3 space-y-4">
                    {/* Image Uploader (Keep this outside the form for now as it handles separate API calls) */}
                    <div className="w-full aspect-square border-2 border-dashed border-border rounded bg-background flex items-center justify-center">
                      {previewUrl ? <img src={previewUrl} alt="Sample Preview" className="w-full h-full object-cover rounded" /> : <span className="text-sm text-text-secondary">No Image</span>}
                    </div>
                    <div className="space-y-2">
                        <input type="file" accept="image/*" ref={fileInputRef} onChange={handleFileChange} className="hidden" />
                        <button type="button" onClick={() => fileInputRef.current?.click()} className="w-full py-2 px-4 bg-secondary hover:bg-secondary-hover rounded text-on-secondary font-semibold">Upload File...</button>
                        <div className="text-center text-xs text-text-secondary">OR</div>
                        <div className="flex gap-2">
                          <input type="url" placeholder="Paste image URL..." value={importUrl} onChange={e => setImportUrl(e.target.value)} className="w-full p-2 bg-background border border-border rounded text-sm text-text-primary" />
                          <button type="button" onClick={handleImportFromUrl} disabled={!importUrl || isImporting} className="p-2 bg-primary hover:bg-primary-hover rounded text-on-primary disabled:opacity-50">{isImporting ? '...' : <Download size={16} />}</button>
                        </div>
                    </div>
                 </div>
                 <div className="lg:col-span-9">
                     <SampleForm 
                        initialData={initialFormData}
                        onSave={handleFormSave}
                        onCancel={() => setIsEditing(false)}
                        isSaving={isSaving || isImporting}
                        saveButtonText="Save Changes"
                     />
                     {currentUser?.roles?.includes('Admin') && (
                        <div className="mt-6 pt-6 border-t border-border flex justify-end">
                            <button type="button" onClick={handleDeleteSample} className="py-2 px-4 bg-red-600 hover:bg-red-700 rounded text-white font-semibold flex items-center gap-2 disabled:bg-red-900 disabled:cursor-not-allowed" disabled={isDeleting}><Trash2 size={16} />{isDeleting ? 'Deleting...' : 'Delete Sample'}</button>
                        </div>
                     )}
                 </div>
             </div>
          ) : (
            <>
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
              <div className="lg:col-span-3 space-y-4">
                <div className="w-full aspect-square border-2 border-dashed border-border rounded bg-background flex items-center justify-center">
                  {previewUrl ? <img src={previewUrl} alt="Sample Preview" className="w-full h-full object-cover rounded" /> : <span className="text-sm text-text-secondary">No Image</span>}
                </div>
              </div>
              <div className="lg:col-span-6 space-y-4">
                  <div className="space-y-3 text-text-secondary">
                      <p><strong className="text-text-primary">Manufacturer:</strong> {sample.manufacturerName || 'N/A'}</p>
                      {sample.supplierId !== sample.manufacturerId && sample.supplierName && <p><strong className="text-text-primary">Supplier:</strong> {sample.supplierName}</p>}
                      <p><strong className="text-text-primary">Product Type:</strong> {sample.productType}</p>
                      <p><strong className="text-text-primary">Style:</strong> {sample.style}</p>
                      {sample.color && <p><strong className="text-text-primary">Color:</strong> {sample.color}</p>}
                      {sample.line && <p><strong className="text-text-primary">Line:</strong> {sample.line}</p>}
                      
                      {/* Display sizes/variants */}
                      {sample.sizes && sample.sizes.length > 0 && (
                          <div className="mt-2">
                              <p className="font-bold text-text-primary mb-1">Available Sizes:</p>
                              <ul className="space-y-1 bg-background p-2 rounded border border-border">
                                  {sample.sizes.map((s, idx) => {
                                      const isString = typeof s === 'string';
                                      const val = isString ? s : (s.value || (s as any).size || 'Unknown Size');
                                      let retailDisplay = null;
                                      if (!isString && s.unitCost && pricingSettings) {
                                          const vendorId = sample.supplierId || sample.manufacturerId;
                                          const vendor = vendors.find(v => v.id === vendorId);
                                          const rules = getActivePricingRules(vendor, pricingSettings, 'Customer');
                                          const price = calculatePrice(Number(s.unitCost), rules.percentage, rules.method);
                                          retailDisplay = formatCurrency(price);
                                      } else if (getCalculatedPrices()?.retailPrice) {
                                          retailDisplay = formatCurrency(getCalculatedPrices()!.retailPrice);
                                      }

                                      return (
                                          <li key={idx} className="flex justify-between text-sm">
                                              <span className="font-medium text-text-primary">{val}</span>
                                              {retailDisplay && <span className="text-green-400 font-bold">{retailDisplay} <span className="text-xs text-text-secondary font-normal">/ {(!isString && s.uom) ? s.uom : sample.uom}</span></span>}
                                          </li>
                                      );
                                  })}
                              </ul>
                          </div>
                      )}
                      
                      {sample.finish && <p><strong className="text-text-primary">Finish:</strong> {sample.finish}</p>}
                      {sample.productType === 'Tile' && sample.sampleFormat && <p><strong className="text-text-primary">Format:</strong> {sample.sampleFormat} Sample</p>}
                      {sample.productType === 'Tile' && sample.sampleFormat === 'Board' && sample.boardColors && <p><strong className="text-text-primary">Board Colors:</strong> {sample.boardColors}</p>}
                      
                      {/* --- NEW: Pricing Display (Base Price) --- */}
                      {(sample.unitCost || sample.cartonSize) && (
                          <div className="mt-2 p-3 bg-background rounded border border-border">
                              <h5 className="text-sm font-semibold text-text-primary border-b border-border pb-1 mb-2">Pricing & Packaging</h5>
                              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                                  {sample.unitCost !== null && sample.unitCost !== undefined && <p className="text-text-secondary"><strong className="text-text-primary">Cost:</strong> {formatCurrency(sample.unitCost)} / {sample.uom}</p>}
                                  
                                  {pricingSettings && getCalculatedPrices()?.retailPrice && (
                                      <p className="text-green-400 font-bold">
                                          Retail: {formatCurrency(getCalculatedPrices()!.retailPrice)} / {sample.uom}
                                      </p>
                                  )}
                                  
                                  {sample.cartonSize !== null && sample.cartonSize !== undefined && <p><strong className="text-text-primary">Carton:</strong> {sample.cartonSize} {sample.uom}</p>}

                                  {pricingSettings && getCalculatedPrices()?.cartonPrice && (
                                      <p className="col-span-2 mt-1 pt-1 border-t border-border text-green-400 font-medium">
                                          Retail per Carton: {formatCurrency(getCalculatedPrices()!.cartonPrice!)}
                                      </p>
                                  )}
                              </div>
                          </div>
                      )}

                      <p><strong className="text-text-primary">SKU:</strong> {sample.sku || 'N/A'}</p>
                      <p className="flex items-center gap-2"><strong className="text-text-primary">Product Link:</strong> {sample.productUrl ? <a href={sample.productUrl} target="_blank" rel="noopener noreferrer" className="text-accent hover:underline flex items-center">Visit Site <LinkIcon size={14} className="ml-1"/></a> : 'N/A'}</p>
                      <div className="mt-4 pt-4 border-t border-border">
                          <p className="flex items-center gap-2"><strong className="text-text-primary">Status:</strong> <span className={`font-bold px-2 py-1 rounded-full text-xs ${sample.isAvailable ? 'bg-green-800/50 text-green-300' : 'bg-yellow-800/50 text-yellow-300'}`}>{sample.isAvailable ? 'Available' : 'Checked Out'}</span></p>
                          {sample.isDiscontinued && (
                               <p className="mt-2 flex items-center gap-2"><strong className="text-text-primary">Archived Status:</strong> <span className="font-bold px-2 py-1 rounded-full text-xs bg-red-800/50 text-red-300">Discontinued</span></p>
                          )}
                      </div>
                  </div>
              </div>
              <div className="lg:col-span-3 space-y-4">
                  <div className="bg-background p-4 rounded-lg text-center">
                    <h4 className="font-semibold text-text-primary mb-2 flex items-center justify-center gap-2"><QrCode /> Sample QR Code</h4>
                    <div ref={qrCodePrintRef}>
                      <img src={`/api/samples/${sample.id}/qr`} alt="Sample QR Code" className="w-48 h-48 mx-auto bg-white p-2 rounded-md"/>
                      <p className="text-xs text-text-secondary mt-2 font-mono">ID: {sample.id}</p>
                      <p className="text-sm font-semibold mt-1 text-text-primary">{formatSampleName(sample)}</p>
                    </div>
                    <button type="button" onClick={handlePrintQrCode} className="mt-4 w-full flex items-center justify-center gap-2 py-2 px-4 bg-secondary hover:bg-secondary-hover rounded text-on-secondary font-semibold"><Printer size={16} />Print</button>
                  </div>
              </div>
            </div>
            <div className="mt-8 border-t border-border pt-6">
                  <div className="flex justify-between items-center mb-4">
                    <div className="flex items-center"><h3 className="text-xl font-semibold text-text-primary flex items-center">{historyView === 'checkouts' ? <><Calendar className="w-6 h-6 mr-2 text-accent"/> Checkout History</> : <><History className="w-6 h-6 mr-2 text-accent"/> Change History</>}</h3></div>
                    <button type="button" onClick={() => setHistoryView(prev => prev === 'checkouts' ? 'changes' : 'checkouts')} className="text-sm text-accent hover:underline">{historyView === 'checkouts' ? 'Show Change History' : 'Show Checkout History'}</button>
                  </div>
                  <div className="space-y-3 max-h-48 overflow-y-auto pr-2">
                    {historyView === 'checkouts' ? (
                      checkoutHistory.length > 0 ? checkoutHistory.map(h => (
                          <li key={h.id} className="bg-background p-3 rounded-md flex justify-between items-center list-none">
                            <div><p className="font-semibold text-text-primary">Checked out to <Link to={`/projects/${h.projectId}`} className="text-accent hover:underline">{h.projectName}</Link></p><p className="text-xs text-text-secondary">{new Date(h.checkoutDate).toLocaleDateString()} <ChevronsRight className="inline w-4 h-4 mx-1" /> {h.actualReturnDate ? new Date(h.actualReturnDate).toLocaleDateString() : 'Present'}</p></div>
                            <span className={`px-2 py-1 text-xs rounded-full font-bold ${h.actualReturnDate ? 'bg-secondary text-text-secondary' : 'bg-yellow-500 text-gray-900'}`}>{h.actualReturnDate ? 'Returned' : 'Active'}</span>
                          </li>
                      )) : <p className="text-text-secondary text-center py-4">No checkout history for this sample.</p>
                    ) : (
                      <ActivityHistory history={sampleHistory} />
                    )}
                  </div>
              </div>
            <div className="flex justify-end gap-4 mt-8 border-t border-border pt-6">
              {/* --- NEW: Discontinue / Restore Action (Admin Only) --- */}
              {currentUser?.roles?.includes('Admin') && !isEditing && (
                  <div className="mr-auto">
                      <button 
                        type="button" 
                        onClick={handleToggleDiscontinued}
                        disabled={isTogglingStatus || (!sample.isAvailable && !sample.isDiscontinued)} // If checked out and trying to discontinue, block it. If trying to restore, allow it.
                        className={`flex items-center py-2 px-4 rounded font-semibold text-white transition-colors ${sample.isDiscontinued ? 'bg-green-600 hover:bg-green-700' : 'bg-orange-600 hover:bg-orange-700'}`}
                      >
                          <Archive className="w-4 h-4 mr-2" /> {sample.isDiscontinued ? 'Restore Sample' : 'Discontinue Sample'}
                      </button>
                  </div>
              )}

              {/* --- READ-ONLY FOOTER ACTIONS (Edit mode actions are inside SampleForm) --- */}
              {!isEditing && (
                  <div className="flex items-center gap-4">
                      {!sample.isAvailable && (
                          <>
                            <button type="button" onClick={handleExtendCheckout} className="flex items-center py-2 px-4 bg-primary hover:bg-primary-hover rounded text-on-primary"><Clock className="w-4 h-4 mr-2"/> Extend</button>
                            <button type="button" onClick={handleReturnSample} className="flex items-center py-2 px-4 bg-accent hover:bg-accent-hover rounded text-on-accent"><Undo2 className="w-4 h-4 mr-2"/> Return Sample</button>
                          </>
                      )}
                      <button type="button" onClick={onClose} className="py-2 px-4 bg-secondary hover:bg-secondary-hover rounded text-on-secondary">Close</button>
                      <button type="button" onClick={() => setIsEditing(true)} className="flex items-center py-2 px-4 bg-primary hover:bg-primary-hover rounded text-on-primary"><Edit className="w-4 h-4 mr-2"/> Edit Sample</button>
                  </div>
              )}
            </div>
            </>
          )}
        </div>
      </div>
      <AddEditVendorModal 
        isOpen={isVendorModalOpen} 
        onClose={() => setIsVendorModalOpen(false)} 
        onSave={addVendor} // Use the data context's addVendor directly
        initialVendorType={vendorModalPurpose} 
      />
    </>
  );
};

export default SampleDetailModal;