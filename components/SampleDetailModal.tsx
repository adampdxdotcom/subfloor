import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useData } from '../context/DataContext';
import { Sample, Vendor, ProductType, SampleFormat, PricingSettings, SampleSizeVariant } from '../types';
import { toast } from 'react-hot-toast';
import { Link } from 'react-router-dom';
import { Edit, X, Calendar, ChevronsRight, Undo2, Link as LinkIcon, Download, Trash2, QrCode, Printer, Clock, History, Archive } from 'lucide-react';
import AddEditVendorModal from './AddEditVendorModal';
import * as preferenceService from '../services/preferenceService';
import { calculatePrice, getActivePricingRules, formatCurrency } from '../utils/pricingUtils';
import ActivityHistory from './ActivityHistory';
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

const initialEmptyFormData: SampleFormData = {
  manufacturerId: null,
  supplierId: null,
  productType: '' as ProductType | '',
  style: '',
  line: '',
  sizes: [],
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
    vendors, sampleCheckouts, projects, customers, installers, fetchSamples, updateSample, addVendor,
    updateSampleCheckout, deleteSample, extendSampleCheckout, toggleSampleDiscontinued,
    sampleHistory, fetchSampleHistory
  } = useData();
  
  const [isEditing, setIsEditing] = useState(false);
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
        let name = 'Unknown';
        let link = '#';
        if (checkout.projectId) {
             const p = projects.find(p => p.id === checkout.projectId);
             name = p ? p.projectName : 'Unknown Project';
             link = `/projects/${checkout.projectId}`;
        } else if (checkout.customerId) {
             const c = customers.find(c => c.id === checkout.customerId);
             name = c ? c.fullName : 'Unknown Customer';
             link = `/customers/${checkout.customerId}`;
        } else if (checkout.installerId) {
             const i = installers.find(inst => inst.id === checkout.installerId);
             name = i ? i.installerName : 'Unknown Installer';
             link = `/installers/${checkout.installerId}`;
        }
        return { ...checkout, entityName: name, entityLink: link };
    }).sort((a, b) => new Date(b.checkoutDate).getTime() - new Date(a.checkoutDate).getTime());
    const activeCheckout = history.find(h => !h.actualReturnDate) || null;
    return { checkoutHistory: history, currentCheckout: activeCheckout };
  }, [sample, sampleCheckouts, projects, customers, installers]);

  const initialFormData: Partial<SampleFormData> = useMemo(() => {
    if (!sample) return initialEmptyFormData;

    const sizesForForm: SampleSizeVariant[] = (sample.sizes || []).map(sizeItem => {
        if (typeof sizeItem === 'string') {
            return { value: sizeItem, unitCost: null, cartonSize: null, uom: null };
        }
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

  const handleFormSave = async (formDataFromForm: SampleFormData) => {
    if (!sample) return;
    setIsSaving(true);
    try {
      await updateSample(sample.id, formDataFromForm);
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
          onClose(); 
      } catch (err) {
      } finally {
          setIsTogglingStatus(false);
      }
  };

  if (!isOpen || !sample) return null;

  return (
    <>
      <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
        <div className="bg-surface-container-high p-6 md:p-10 rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] overflow-y-auto border border-outline/10" onClick={(e) => e.stopPropagation()}>
          <div className="flex justify-between items-start mb-6">
            <h2 className="text-3xl font-bold text-text-primary">{isEditing ? 'Editing Sample' : formatSampleName(sample)}</h2>
            <button onClick={isEditing ? () => setIsEditing(false) : onClose} className="p-2 rounded-full hover:bg-surface-container-highest text-text-primary transition-colors"> <X className="w-6 h-6" /> </button>
          </div>
          
          {isEditing ? (
             <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                 <div className="lg:col-span-3 space-y-4">
                    <div className="w-full aspect-square border-2 border-dashed border-outline/20 rounded-xl bg-surface-container-low flex items-center justify-center">
                      {previewUrl ? <img src={previewUrl} alt="Sample Preview" className="w-full h-full object-cover rounded" /> : <span className="text-sm text-text-secondary">No Image</span>}
                    </div>
                    <div className="space-y-2">
                        <input type="file" accept="image/*" ref={fileInputRef} onChange={handleFileChange} className="hidden" />
                        <button type="button" onClick={() => fileInputRef.current?.click()} className="w-full py-2 px-4 bg-secondary hover:bg-secondary-hover rounded-full text-on-secondary font-semibold">Upload File...</button>
                        <div className="text-center text-xs text-text-secondary">OR</div>
                        <div className="flex gap-2">
                          <input type="url" placeholder="Paste image URL..." value={importUrl} onChange={e => setImportUrl(e.target.value)} className="w-full p-2 bg-surface-container-highest border-transparent rounded-lg text-sm text-text-primary focus:ring-2 focus:ring-primary" />
                          <button type="button" onClick={handleImportFromUrl} disabled={!importUrl || isImporting} className="p-2 bg-primary hover:bg-primary-hover rounded-full text-on-primary disabled:opacity-50">{isImporting ? '...' : <Download size={16} />}</button>
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
                        <div className="mt-6 pt-6 border-t border-outline/10 flex justify-end">
                            <button type="button" onClick={handleDeleteSample} className="py-2 px-6 bg-error-container hover:bg-error/20 text-error rounded-full font-semibold flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed" disabled={isDeleting}><Trash2 size={16} />{isDeleting ? 'Deleting...' : 'Delete Sample'}</button>
                        </div>
                     )}
                 </div>
             </div>
          ) : (
            <>
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
              <div className="lg:col-span-3 space-y-4">
                <div className="w-full aspect-square border-2 border-dashed border-outline/10 rounded-xl bg-surface-container-low flex items-center justify-center overflow-hidden">
                  {previewUrl ? <img src={previewUrl} alt="Sample Preview" className="w-full h-full object-cover" /> : <span className="text-sm text-text-secondary">No Image</span>}
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
                      
                      {sample.sizes && sample.sizes.length > 0 && (
                          <div className="mt-2">
                              <p className="font-bold text-text-primary mb-1">Available Sizes:</p>
                              <ul className="space-y-1 bg-surface-container-low p-3 rounded-xl border border-outline/10">
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
                                              {retailDisplay && <span className="text-success font-bold">{retailDisplay} <span className="text-xs text-text-secondary font-normal">/ {(!isString && s.uom) ? s.uom : sample.uom}</span></span>}
                                          </li>
                                      );
                                  })}
                              </ul>
                          </div>
                      )}
                      
                      {sample.finish && <p><strong className="text-text-primary">Finish:</strong> {sample.finish}</p>}
                      {sample.productType === 'Tile' && sample.sampleFormat && <p><strong className="text-text-primary">Format:</strong> {sample.sampleFormat} Sample</p>}
                      {sample.productType === 'Tile' && sample.sampleFormat === 'Board' && sample.boardColors && <p><strong className="text-text-primary">Board Colors:</strong> {sample.boardColors}</p>}
                      
                      {(sample.unitCost || sample.cartonSize) && (
                          <div className="mt-2 p-4 bg-surface-container-low rounded-xl border border-outline/10">
                              <h5 className="text-sm font-semibold text-text-primary border-b border-outline/10 pb-2 mb-2">Pricing & Packaging</h5>
                              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                                  {sample.unitCost !== null && sample.unitCost !== undefined && <p className="text-text-secondary"><strong className="text-text-primary">Cost:</strong> {formatCurrency(sample.unitCost)} / {sample.uom}</p>}
                                  
                                  {pricingSettings && getCalculatedPrices()?.retailPrice && (
                                      <p className="text-success font-bold">
                                          Retail: {formatCurrency(getCalculatedPrices()!.retailPrice)} / {sample.uom}
                                      </p>
                                  )}
                                  
                                  {sample.cartonSize !== null && sample.cartonSize !== undefined && <p><strong className="text-text-primary">Carton:</strong> {sample.cartonSize} {sample.uom}</p>}

                                  {pricingSettings && getCalculatedPrices()?.cartonPrice && (
                                      <p className="col-span-2 mt-2 pt-2 border-t border-outline/10 text-success font-medium">
                                          Retail per Carton: {formatCurrency(getCalculatedPrices()!.cartonPrice!)}
                                      </p>
                                  )}
                              </div>
                          </div>
                      )}

                      <p><strong className="text-text-primary">SKU:</strong> {sample.sku || 'N/A'}</p>
                      <p className="flex items-center gap-2"><strong className="text-text-primary">Product Link:</strong> {sample.productUrl ? <a href={sample.productUrl} target="_blank" rel="noopener noreferrer" className="text-accent hover:underline flex items-center">Visit Site <LinkIcon size={14} className="ml-1"/></a> : 'N/A'}</p>
                      <div className="mt-4 pt-4 border-t border-outline/10">
                          <p className="flex items-center gap-2"><strong className="text-text-primary">Status:</strong> <span className={`font-bold px-3 py-1 rounded-full text-xs ${sample.isAvailable ? 'bg-success-container text-success' : 'bg-warning-container text-warning'}`}>{sample.isAvailable ? 'Available' : 'Checked Out'}</span></p>
                          {sample.isDiscontinued && (
                               <p className="mt-2 flex items-center gap-2"><strong className="text-text-primary">Archived Status:</strong> <span className="font-bold px-3 py-1 rounded-full text-xs bg-error-container text-error">Discontinued</span></p>
                          )}
                      </div>
                  </div>
              </div>
              <div className="lg:col-span-3 space-y-4">
                  <div className="bg-surface-container-low p-6 rounded-xl text-center border border-outline/10">
                    <h4 className="font-semibold text-text-primary mb-2 flex items-center justify-center gap-2"><QrCode /> Sample QR Code</h4>
                    <div ref={qrCodePrintRef}>
                      <img src={`/api/samples/${sample.id}/qr`} alt="Sample QR Code" className="w-48 h-48 mx-auto bg-white p-2 rounded-md"/>
                      <p className="text-xs text-text-secondary mt-2 font-mono">ID: {sample.id}</p>
                      <p className="text-sm font-semibold mt-1 text-text-primary">{formatSampleName(sample)}</p>
                    </div>
                    <button type="button" onClick={handlePrintQrCode} className="mt-4 w-full flex items-center justify-center gap-2 py-2 px-6 bg-secondary hover:bg-secondary-hover rounded-full text-on-secondary font-semibold"><Printer size={16} />Print</button>
                  </div>
              </div>
            </div>
            <div className="mt-8 border-t border-outline/10 pt-6">
                  <div className="flex justify-between items-center mb-4">
                    <div className="flex items-center"><h3 className="text-xl font-semibold text-text-primary flex items-center">{historyView === 'checkouts' ? <><Calendar className="w-6 h-6 mr-2 text-accent"/> Checkout History</> : <><History className="w-6 h-6 mr-2 text-accent"/> Change History</>}</h3></div>
                    <button type="button" onClick={() => setHistoryView(prev => prev === 'checkouts' ? 'changes' : 'checkouts')} className="text-sm text-accent hover:underline">{historyView === 'checkouts' ? 'Show Change History' : 'Show Checkout History'}</button>
                  </div>
                  <div className="space-y-3 max-h-48 overflow-y-auto pr-2">
                    {historyView === 'checkouts' ? (
                      checkoutHistory.length > 0 ? checkoutHistory.map(h => (
                          <li key={h.id} className="bg-surface-container-low p-3 rounded-xl flex justify-between items-center list-none border border-outline/5">
                            <div><p className="font-semibold text-text-primary">Checked out to <Link to={h.entityLink} className="text-accent hover:underline">{h.entityName}</Link></p><p className="text-xs text-text-secondary">{new Date(h.checkoutDate).toLocaleDateString()} <ChevronsRight className="inline w-4 h-4 mx-1" /> {h.actualReturnDate ? new Date(h.actualReturnDate).toLocaleDateString() : 'Present'}</p></div>
                            <span className={`px-3 py-1 text-xs rounded-full font-bold ${h.actualReturnDate ? 'bg-surface-container text-text-secondary' : 'bg-warning-container text-warning'}`}>{h.actualReturnDate ? 'Returned' : 'Active'}</span>
                          </li>
                      )) : <p className="text-text-secondary text-center py-4">No checkout history for this sample.</p>
                    ) : (
                      <ActivityHistory history={sampleHistory} />
                    )}
                  </div>
              </div>
            <div className="flex justify-end gap-4 mt-8 border-t border-outline/10 pt-6">
              {currentUser?.roles?.includes('Admin') && !isEditing && (
                  <div className="mr-auto">
                      <button 
                        type="button" 
                        onClick={handleToggleDiscontinued}
                        disabled={isTogglingStatus || (!sample.isAvailable && !sample.isDiscontinued)}
                        className={`flex items-center py-2 px-6 rounded-full font-semibold transition-colors ${sample.isDiscontinued ? 'bg-success-container text-success hover:bg-success/20' : 'bg-warning-container text-warning hover:bg-warning/20'}`}
                      >
                          <Archive className="w-4 h-4 mr-2" /> {sample.isDiscontinued ? 'Restore Sample' : 'Discontinue Sample'}
                      </button>
                  </div>
              )}

              {!isEditing && (
                  <div className="flex items-center gap-4">
                      {!sample.isAvailable && (
                          <>
                            <button type="button" onClick={handleExtendCheckout} className="flex items-center py-2 px-6 bg-primary-container hover:bg-primary text-primary hover:text-on-primary font-medium rounded-full transition-colors"><Clock className="w-4 h-4 mr-2"/> Extend</button>
                            <button type="button" onClick={handleReturnSample} className="flex items-center py-2 px-6 bg-secondary hover:bg-secondary-hover text-on-secondary font-medium rounded-full shadow-sm transition-colors"><Undo2 className="w-4 h-4 mr-2"/> Return Sample</button>
                          </>
                      )}
                      <button type="button" onClick={onClose} className="py-2 px-6 bg-surface hover:bg-surface-container-highest border border-outline/20 text-text-secondary rounded-full font-medium transition-colors">Close</button>
                      <button type="button" onClick={() => setIsEditing(true)} className="flex items-center py-2 px-6 bg-primary hover:bg-primary-hover rounded-full text-on-primary font-semibold shadow-md transition-all"><Edit className="w-4 h-4 mr-2"/> Edit Sample</button>
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
        onSave={addVendor}
        initialVendorType={vendorModalPurpose} 
      />
    </>
  );
};

export default SampleDetailModal;