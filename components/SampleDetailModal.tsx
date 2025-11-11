import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useData } from '../context/DataContext';
import { Sample } from '../types';
import { toast } from 'react-hot-toast';
import { Link } from 'react-router-dom';
import { Edit, X, Calendar, ChevronsRight, Undo2, Link as LinkIcon, Download, Trash2, QrCode, Printer, Clock } from 'lucide-react';

interface SampleDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  sample: Sample | null;
}

const SampleDetailModal: React.FC<SampleDetailModalProps> = ({ isOpen, onClose, sample }) => {
  const { 
    vendors, sampleCheckouts, projects, fetchSamples, updateSample, 
    updateSampleCheckout, deleteSample, extendSampleCheckout 
  } = useData();
  
  const [isEditing, setIsEditing] = useState(false);
  // Form state now uses IDs
  const [formData, setFormData] = useState({ 
    manufacturerId: null as number | null, 
    supplierId: null as number | null, 
    styleColor: '', sku: '', type: '', productUrl: '' 
  });
  const [hasDifferentSupplier, setHasDifferentSupplier] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [importUrl, setImportUrl] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const qrCodePrintRef = useRef<HTMLDivElement>(null);

  const manufacturerList = useMemo(() => vendors.filter(v => v.isManufacturer), [vendors]);
  const supplierList = useMemo(() => vendors.filter(v => v.isSupplier), [vendors]);

  const { sampleHistory, currentCheckout } = useMemo(() => {
    if (!sample) return { sampleHistory: [], currentCheckout: null };
    
    const history = sampleCheckouts
      .filter(sc => sc.sampleId === sample.id)
      .map(checkout => {
        const project = projects.find(p => p.id === checkout.projectId);
        return { ...checkout, projectName: project?.projectName || 'Unknown Project' };
      })
      .sort((a, b) => new Date(b.checkoutDate).getTime() - new Date(a.checkoutDate).getTime());
      
    const activeCheckout = history.find(h => !h.actualReturnDate) || null;

    return { sampleHistory: history, currentCheckout: activeCheckout };
  }, [sample, sampleCheckouts, projects]);

  useEffect(() => {
    if (isOpen && sample) {
      setFormData({
        manufacturerId: sample.manufacturerId || null,
        supplierId: sample.supplierId || null,
        styleColor: sample.styleColor || '',
        sku: sample.sku || '',
        type: sample.type || '',
        productUrl: sample.productUrl || '',
      });
      setHasDifferentSupplier(!!sample.supplierId);
      setPreviewUrl(sample.imageUrl ? sample.imageUrl : null);
      setSelectedFile(null);
      setImportUrl('');
      setIsEditing(false);
    }
  }, [sample, isOpen]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleIdChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value ? Number(value) : null }));
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
      await fetchSamples(); // Refetch to update the sample object with the new URL
    } catch (error) {
      console.error(error);
      toast.error('Could not import image from URL.');
    } finally {
      setIsImporting(false);
    }
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!sample) return;
    if (!formData.manufacturerId) return toast.error('Please select a manufacturer.');
    if (hasDifferentSupplier && !formData.supplierId) return toast.error('Please select a supplier.');

    setIsSaving(true);
    try {
      const dataToSave = {
        ...formData,
        supplierId: hasDifferentSupplier ? formData.supplierId : null,
      };

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
      toast.success(`Sample '${sample.styleColor}' updated successfully!`);
      setIsEditing(false);
    } catch (error) {
      console.error('Error updating sample:', error);
      toast.error('Failed to update sample.');
    } finally {
      setIsSaving(false);
    }
  };

  // ... (handleReturnSample, handleExtendCheckout, etc. remain unchanged) ...

  const handleReturnSample = async () => {
    if (!sample || !currentCheckout) {
      toast.error("Could not find active checkout record to return.");
      return;
    }
    try {
      await updateSampleCheckout(currentCheckout);
      toast.success(`'${sample.styleColor}' has been returned.`);
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
    if (!window.confirm(`Are you sure you want to permanently delete "${sample.styleColor}"? This cannot be undone.`)) {
        return;
    }
    setIsDeleting(true);
    try {
        await deleteSample(sample.id);
        toast.success(`Sample "${sample.styleColor}" deleted.`);
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
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
      <div className="bg-surface p-4 md:p-8 rounded-lg shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-start mb-6">
          <h2 className="text-3xl font-bold text-text-primary">{isEditing ? 'Editing Sample' : sample.styleColor}</h2>
          <button onClick={isEditing ? () => setIsEditing(false) : onClose} className="p-2 rounded-full hover:bg-gray-700">
            <X className="w-6 h-6" />
          </button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            <div className="lg:col-span-3 space-y-4">
              <div className="w-full aspect-square border-2 border-dashed border-border rounded bg-gray-800 flex items-center justify-center">
                {previewUrl ? <img src={previewUrl} alt="Sample Preview" className="w-full h-full object-cover rounded" /> : <span className="text-sm text-gray-500">No Image</span>}
              </div>
              {isEditing && (
                <div className="space-y-2">
                  <input type="file" accept="image/*" ref={fileInputRef} onChange={handleFileChange} className="hidden" />
                  <button type="button" onClick={() => fileInputRef.current?.click()} className="w-full py-2 px-4 bg-gray-600 hover:bg-gray-700 rounded text-white font-semibold">
                    Upload File...
                  </button>
                  <div className="text-center text-xs text-text-secondary">OR</div>
                  <div className="flex gap-2">
                    <input type="url" placeholder="Paste image URL..." value={importUrl} onChange={e => setImportUrl(e.target.value)} className="w-full p-2 bg-gray-800 border border-border rounded text-sm" />
                    <button type="button" onClick={handleImportFromUrl} disabled={!importUrl || isImporting} className="p-2 bg-blue-600 hover:bg-blue-700 rounded text-white disabled:bg-gray-500">
                      {isImporting ? '...' : <Download size={16} />}
                    </button>
                  </div>
                </div>
              )}
            </div>
            <div className="lg:col-span-5 space-y-4">
              {isEditing ? (
                <>
                  <div><label className="text-sm text-text-secondary">Style / Color</label><input type="text" name="styleColor" value={formData.styleColor} onChange={handleInputChange} className="w-full p-2 bg-gray-800 border border-border rounded" required /></div>
                  
                  <div>
                    <label className="text-sm text-text-secondary">Manufacturer</label>
                    <select name="manufacturerId" value={formData.manufacturerId ?? ''} onChange={handleIdChange} className="w-full p-2 bg-gray-800 border border-border rounded" required>
                      <option value="">-- Select a Manufacturer --</option>
                      {manufacturerList.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                    </select>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <input type="checkbox" id="edit-sample-diff-supplier" checked={hasDifferentSupplier} onChange={(e) => setHasDifferentSupplier(e.target.checked)} className="h-4 w-4 rounded text-primary focus:ring-primary-dark bg-gray-700 border-gray-600" />
                    <label htmlFor="edit-sample-diff-supplier" className="text-sm text-text-secondary">Different Supplier</label>
                  </div>

                  {hasDifferentSupplier && (
                    <div>
                      <label className="text-sm text-text-secondary">Supplier</label>
                      <select name="supplierId" value={formData.supplierId ?? ''} onChange={handleIdChange} className="w-full p-2 bg-gray-800 border border-border rounded" required>
                        <option value="">-- Select a Supplier --</option>
                        {supplierList.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                      </select>
                    </div>
                  )}
                  
                  <div><label className="text-sm text-text-secondary">SKU</label><input type="text" name="sku" value={formData.sku} onChange={handleInputChange} className="w-full p-2 bg-gray-800 border border-border rounded" /></div>
                  <div><label className="text-sm text-text-secondary">Type</label><select name="type" value={formData.type} onChange={handleInputChange} className="w-full p-2 bg-gray-800 border border-border rounded" required><option value="LVP">LVP</option><option value="Carpet">Carpet</option><option value="Tile">Tile</option><option value="Hardwood">Hardwood</option><option value="Catalog">Catalog</option><option value="Other">Other</option></select></div>
                  <div><label className="text-sm text-text-secondary">Product URL</label><input type="url" name="productUrl" value={formData.productUrl} onChange={handleInputChange} className="w-full p-2 bg-gray-800 border border-border rounded" /></div>
                </>
              ) : (
                <div className="space-y-2 text-text-secondary">
                    <p><strong>Manufacturer:</strong> {sample.manufacturerName || 'N/A'}</p>
                    {sample.supplierName && <p><strong>Supplier:</strong> {sample.supplierName}</p>}
                    <p><strong>SKU:</strong> {sample.sku || 'N/A'}</p>
                    <p><strong>Type:</strong> {sample.type}</p>
                    <p className="flex items-center gap-2"><strong>Product Link:</strong> {sample.productUrl ? <a href={sample.productUrl} target="_blank" rel="noopener noreferrer" className="text-accent hover:underline flex items-center">Visit Site <LinkIcon size={14} className="ml-1"/></a> : 'N/A'}</p>
                    <div className="mt-4 pt-4 border-t border-border">
                        <p className="flex items-center gap-2"><strong>Status:</strong> <span className={`font-bold px-2 py-1 rounded-full text-xs ${sample.isAvailable ? 'bg-green-800/50 text-green-300' : 'bg-yellow-800/50 text-yellow-300'}`}>{sample.isAvailable ? 'Available' : 'Checked Out'}</span></p>
                    </div>
                </div>
              )}
            </div>
            {/* ... (QR Code and History sections remain unchanged) ... */}
             {!isEditing && (
              <div className="lg:col-span-4 space-y-4">
                <div className="bg-gray-800 p-4 rounded-lg text-center">
                  <h4 className="font-semibold text-text-primary mb-2 flex items-center justify-center gap-2"><QrCode /> Sample QR Code</h4>
                  <div ref={qrCodePrintRef}>
                    <img src={`/api/samples/${sample.id}/qr`} alt="Sample QR Code" className="w-48 h-48 mx-auto bg-white p-2 rounded-md"/>
                    <p className="text-xs text-text-secondary mt-2 font-mono">ID: {sample.id}</p>
                    <p className="text-sm font-semibold mt-1">{sample.styleColor}</p>
                  </div>
                  <button type="button" onClick={handlePrintQrCode} className="mt-4 w-full flex items-center justify-center gap-2 py-2 px-4 bg-gray-600 hover:bg-gray-700 rounded text-white font-semibold">
                    <Printer size={16} />
                    Print
                  </button>
                </div>
              </div>
            )}
          </div>
          {!isEditing && (
             <div className="mt-8 border-t border-border pt-6">
                <h3 className="text-xl font-semibold mb-4 flex items-center"><Calendar className="w-6 h-6 mr-2 text-accent"/> Checkout History</h3>
                <div className="space-y-3 max-h-48 overflow-y-auto pr-2">
                {sampleHistory.length > 0 ? sampleHistory.map(h => (
                    <li key={h.id} className="bg-gray-800 p-3 rounded-md flex justify-between items-center list-none">
                    <div>
                        <p className="font-semibold text-text-primary">Checked out to <Link to={`/projects/${h.projectId}`} className="text-accent hover:underline">{h.projectName}</Link></p>
                        <p className="text-xs text-text-secondary">
                          {new Date(h.checkoutDate).toLocaleDateString()} <ChevronsRight className="inline w-4 h-4 mx-1" /> {h.actualReturnDate ? new Date(h.actualReturnDate).toLocaleDateString() : 'Present'}
                        </p>
                    </div>
                    <span className={`px-2 py-1 text-xs rounded-full font-bold ${h.actualReturnDate ? 'bg-gray-600 text-gray-300' : 'bg-yellow-500 text-gray-900'}`}>
                        {h.actualReturnDate ? 'Returned' : 'Active'}
                    </span>
                    </li>
                )) : <p className="text-text-secondary">No checkout history for this sample.</p>}
                </div>
            </div>
          )}
          <div className="flex justify-end gap-4 mt-8 border-t border-border pt-6">
            {isEditing ? (
              <>
                <button type="button" onClick={handleDeleteSample} className="py-2 px-4 bg-red-600 hover:bg-red-700 rounded text-white font-semibold flex items-center gap-2 disabled:bg-red-900 disabled:cursor-not-allowed" disabled={isDeleting} style={{ marginRight: 'auto' }}>
                  <Trash2 size={16} />
                  {isDeleting ? 'Deleting...' : 'Delete Sample'}
                </button>
                <button type="button" onClick={() => setIsEditing(false)} className="py-2 px-4 bg-gray-600 hover:bg-gray-700 rounded text-white">Cancel</button>
                <button type="submit" className="py-2 px-4 bg-primary hover:bg-secondary rounded text-white" disabled={isSaving || isDeleting}>{isSaving ? 'Saving...' : 'Save Changes'}</button>
              </>
            ) : (
                <div className="flex items-center gap-4">
                    {!sample.isAvailable && (
                        <>
                          <button type="button" onClick={handleExtendCheckout} className="flex items-center py-2 px-4 bg-blue-600 hover:bg-blue-700 rounded text-white">
                            <Clock className="w-4 h-4 mr-2"/> Extend
                          </button>
                          <button type="button" onClick={handleReturnSample} className="flex items-center py-2 px-4 bg-green-600 hover:bg-green-700 rounded text-white">
                            <Undo2 className="w-4 h-4 mr-2"/> Return Sample
                          </button>
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
  );
};

export default SampleDetailModal;