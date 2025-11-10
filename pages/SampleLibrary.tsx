import React, { useState, useMemo, useRef } from 'react';
import { useData } from '../context/DataContext';
import { PlusCircle, Search, Download } from 'lucide-react';
import { Sample } from '../types';
import { Link } from 'react-router-dom';
import SampleDetailModal from '../components/SampleDetailModal';
import { toast } from 'react-hot-toast';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

const initialFormState: Omit<Sample, 'id' | 'isAvailable' | 'imageUrl' | 'checkoutProjectId' | 'checkoutProjectName' | 'checkoutCustomerName'> = {
  manufacturer: '',
  styleColor: '',
  sku: '',
  type: 'LVP',
  productUrl: '',
};

const SampleLibrary: React.FC = () => {
  const { samples, addSample, isLoading, fetchSamples } = useData();
  const [searchTerm, setSearchTerm] = useState('');
  
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newSample, setNewSample] = useState(initialFormState);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [importUrl, setImportUrl] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [selectedSample, setSelectedSample] = useState<Sample | null>(null);

  const filteredSamples = useMemo(() => {
    const lowercasedTerm = searchTerm.toLowerCase();
    if (!lowercasedTerm) return samples;

    return samples.filter(sample => 
      sample.styleColor.toLowerCase().includes(lowercasedTerm) ||
      (sample.manufacturer && sample.manufacturer.toLowerCase().includes(lowercasedTerm)) ||
      sample.type.toLowerCase().includes(lowercasedTerm) ||
      (sample.sku && sample.sku.toLowerCase().includes(lowercasedTerm))
    );
  }, [samples, searchTerm]);

  const resetAddModal = () => {
    setNewSample(initialFormState);
    setSelectedFile(null);
    setPreviewUrl(null);
    setImportUrl('');
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

  const handleAddSample = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSample.styleColor || !newSample.type) {
      toast.error('Style/Color and Type are required.');
      return;
    }
    
    setIsSaving(true);
    try {
      // Step 1: Create the sample with text data
      const createdSample = await addSample(newSample);
      
      // Step 2 (Conditional): If there's a photo, upload it now that we have an ID
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
      await fetchSamples(); // Refresh all sample data
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
        <button 
          onClick={() => setIsAddModalOpen(true)}
          className="flex items-center bg-primary hover:bg-secondary text-white font-bold py-2 px-4 rounded-lg transition-colors"
        >
          <PlusCircle className="w-5 h-5 mr-2" />
          Add New Sample
        </button>
      </div>

      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" />
        <input
          type="text"
          placeholder="Search by style, manufacturer, type, or SKU..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full bg-surface border border-border rounded-lg py-2 pl-10 pr-4 focus:outline-none focus:ring-2 focus:ring-accent"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {filteredSamples.map(sample => (
          <div 
            key={sample.id} 
            className="bg-surface rounded-lg shadow-md border border-border overflow-hidden group cursor-pointer"
            onClick={() => handleSampleClick(sample)}
          >
            <div className="w-full h-40 bg-gray-800 flex items-center justify-center text-text-secondary">
              {sample.imageUrl ? (
                <img src={sample.imageUrl} alt={sample.styleColor} className="w-full h-full object-cover" />
              ) : (
                <span className="text-sm">No Image</span>
              )}
            </div>
            
            <div className="p-4">
              <h3 className="font-bold text-lg text-text-primary truncate" title={sample.styleColor}>{sample.styleColor}</h3>
              <p className="text-sm text-text-secondary truncate" title={sample.manufacturer || ''}>{sample.manufacturer || 'N/A'}</p>
              <div className="flex justify-between items-center mt-4 text-xs">
                <span className="font-semibold bg-gray-700 text-gray-300 px-2 py-1 rounded-full">{sample.type}</span>
                
                {sample.isAvailable ? (
                  <span className="font-bold text-green-400">Available</span>
                ) : (
                  <div className="text-yellow-400 text-right">
                    <span className="font-bold block">Checked Out</span>
                    {sample.checkoutProjectName && sample.checkoutProjectId && (
                      <Link 
                        to={`/projects/${sample.checkoutProjectId}`} 
                        className="text-accent hover:underline"
                        onClick={(e) => e.stopPropagation()}
                      >
                         to {sample.checkoutProjectName}
                      </Link>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
         {filteredSamples.length === 0 && (
          <p className="text-text-secondary col-span-full text-center">
            {searchTerm ? 'No samples match your search.' : 'No samples found in the library.'}
          </p>
        )}
      </div>
      
      {isAddModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
          <div className="bg-surface p-8 rounded-lg shadow-2xl w-full max-w-2xl" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-2xl font-bold mb-6 text-text-primary">Add New Sample</h2>
            <form onSubmit={handleAddSample}>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    <div className="md:col-span-1 space-y-4">
                        <div className="w-full aspect-square border-2 border-dashed border-border rounded bg-gray-800 flex items-center justify-center">
                            {previewUrl ? <img src={previewUrl} alt="Sample Preview" className="w-full h-full object-cover rounded" /> : <span className="text-sm text-gray-500">No Image</span>}
                        </div>
                        <div className="space-y-2">
                            <input type="file" accept="image/*" ref={fileInputRef} onChange={handleFileChange} className="hidden" />
                            <button type="button" onClick={() => fileInputRef.current?.click()} className="w-full py-2 px-4 bg-gray-600 hover:bg-gray-700 rounded text-white font-semibold">
                                Upload File...
                            </button>
                            <div className="text-center text-xs text-text-secondary">OR</div>
                            <div className="flex gap-2">
                                <input type="url" placeholder="Paste image URL..." value={importUrl} onChange={e => setImportUrl(e.target.value)} className="w-full p-2 bg-gray-800 border border-border rounded text-sm" />
                                <button type="button" onClick={() => setPreviewUrl(importUrl)} disabled={!importUrl} className="p-2 bg-blue-600 hover:bg-blue-700 rounded text-white disabled:bg-gray-500">
                                    <Download size={16} />
                                </button>
                            </div>
                        </div>
                    </div>
                    <div className="md:col-span-2 space-y-4">
                        <div><label className="text-sm text-text-secondary">Style / Color</label><input type="text" value={newSample.styleColor} onChange={(e) => setNewSample({ ...newSample, styleColor: e.target.value })} className="w-full p-2 bg-gray-800 border border-border rounded" required /></div>
                        <div><label className="text-sm text-text-secondary">Manufacturer</label><input type="text" value={newSample.manufacturer || ''} onChange={(e) => setNewSample({ ...newSample, manufacturer: e.target.value })} className="w-full p-2 bg-gray-800 border border-border rounded" /></div>
                        <div><label className="text-sm text-text-secondary">SKU</label><input type="text" value={newSample.sku || ''} onChange={(e) => setNewSample({ ...newSample, sku: e.target.value })} className="w-full p-2 bg-gray-800 border border-border rounded" /></div>
                        <div><label className="text-sm text-text-secondary">Type</label><select value={newSample.type} onChange={(e) => setNewSample({ ...newSample, type: e.target.value })} className="w-full p-2 bg-gray-800 border border-border rounded" required><option value="LVP">LVP</option><option value="Carpet">Carpet</option><option value="Tile">Tile</option><option value="Hardwood">Hardwood</option><option value="Catalog">Catalog</option><option value="Other">Other</option></select></div>
                        <div><label className="text-sm text-text-secondary">Product URL</label><input type="url" value={newSample.productUrl || ''} onChange={(e) => setNewSample({ ...newSample, productUrl: e.target.value })} className="w-full p-2 bg-gray-800 border border-border rounded" /></div>
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

      {isDetailModalOpen && selectedSample && (
        <SampleDetailModal 
          isOpen={isDetailModalOpen}
          onClose={() => setIsDetailModalOpen(false)}
          sample={selectedSample}
        />
      )}
    </div>
  );
};

export default SampleLibrary;