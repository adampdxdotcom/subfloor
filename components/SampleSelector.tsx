import React, { useState, useMemo, useEffect } from 'react';
import { useData } from '../context/DataContext';
import { Sample } from '../types';
import { Layers, ScanLine, X, Search, PlusCircle } from 'lucide-react';
import { toast } from 'react-hot-toast';
import QrScanner from './QrScanner';
import AddSampleInlineModal from './AddSampleInlineModal';

interface SampleSelectorProps {
  onSamplesChange: (samples: Sample[]) => void;
}

// --- ADDED: Local utility for consistent naming ---
const formatSampleName = (sample: Sample) => {
  const parts = [];
  if (sample.style) parts.push(sample.style);
  if (sample.color) parts.push(sample.color);
  if (parts.length === 0) return `Sample #${sample.id}`;
  return parts.join(' - ');
};


const SampleSelector: React.FC<SampleSelectorProps> = ({ onSamplesChange }) => {
  const { samples } = useData();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSamples, setSelectedSamples] = useState<Sample[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  // --- MODIFIED: Search logic updated for the new data model ---
  const searchResults = useMemo(() => {
    if (searchTerm.length < 2) return [];
    const lowercasedTerm = searchTerm.toLowerCase();
    
    return samples.filter(sample => 
      !selectedSamples.some(ss => ss.id === sample.id) &&
      !sample.isDiscontinued && // ADDED: Exclude discontinued items
      (
        (sample.style && sample.style.toLowerCase().includes(lowercasedTerm)) ||
        (sample.color && sample.color.toLowerCase().includes(lowercasedTerm)) ||
        (sample.manufacturerName && sample.manufacturerName.toLowerCase().includes(lowercasedTerm)) ||
        (sample.sku && sample.sku.toLowerCase().includes(lowercasedTerm))
      )
    );
  }, [searchTerm, samples, selectedSamples]);

  // --- MODIFIED: Toast message updated ---
  const addSample = (sample: Sample) => {
    if (!sample.isAvailable) {
        toast.error(`"${formatSampleName(sample)}" is currently checked out.`);
        return;
    }
    if (!selectedSamples.some(s => s.id === sample.id)) {
        setSelectedSamples(prev => [...prev, sample]);
    }
    setSearchTerm('');
  };

  const removeSample = (sampleId: number) => {
    setSelectedSamples(prev => prev.filter(s => s.id !== sampleId));
  };

  useEffect(() => {
    onSamplesChange(selectedSamples);
  }, [selectedSamples, onSamplesChange]);
  
  const handleSampleCreated = (newSample: Sample) => {
    addSample(newSample);
    setIsAddModalOpen(false);
  };

  // --- MODIFIED: Scan success logic updated for new data model ---
  const handleScanSuccess = (decodedText: string) => {
    setIsScanning(false); // Close scanner immediately
    if (decodedText.startsWith('joblogger:sample:')) {
      const sampleId = parseInt(decodedText.split(':')[2]);
      if (!isNaN(sampleId)) {
        const foundSample = samples.find(s => s.id === sampleId);
        
        if (foundSample) {
          // ADDED: Guard against discontinued items
          if (foundSample.isDiscontinued) {
            toast.error(`Sample "${formatSampleName(foundSample)}" is discontinued and cannot be used.`);
          } else if (!foundSample.isAvailable) {
            toast.error(`Sample "${formatSampleName(foundSample)}" is already checked out.`);
          } else if (selectedSamples.some(s => s.id === foundSample.id)) {
            toast.error(`Sample "${formatSampleName(foundSample)}" is already in your list.`);
          } else {
            addSample(foundSample);
            toast.success(`Added "${formatSampleName(foundSample)}" to checkout list.`);
          }
        } else {
          toast.error(`Sample with ID ${sampleId} not found.`);
        }
      }
    } else {
        toast.error("Invalid QR code scanned.");
    }
  };

  if (isScanning) {
    return (
      <QrScanner 
        onScanSuccess={handleScanSuccess}
        onClose={() => setIsScanning(false)}
      />
    );
  }

  return (
    <>
      {isAddModalOpen && (
        <AddSampleInlineModal
          isOpen={isAddModalOpen}
          onClose={() => setIsAddModalOpen(false)}
          onSampleCreated={handleSampleCreated}
          // --- MODIFIED: Prop name corrected for clarity ---
          initialSearchTerm={searchTerm}
        />
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Search Column */}
        <div className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-text-secondary" />
            <input type="text" placeholder="Search by style, color, manufacturer..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full p-3 pl-10 bg-background border-2 border-border rounded-lg text-text-primary" />
          </div>
          <button type="button" onClick={() => setIsScanning(true)} className="w-full flex items-center justify-center gap-2 p-3 bg-surface hover:bg-background border border-border rounded-lg text-primary font-semibold transition-colors">
            <ScanLine size={20} />
            Scan QR Code
          </button>
          <div className="max-h-60 overflow-y-auto space-y-2 pr-2">
            {/* --- MODIFIED: Display logic updated --- */}
            {searchTerm.length > 1 && searchResults.map(sample => (
              <div 
                key={sample.id} 
                onClick={() => addSample(sample)} 
                className={`p-3 bg-background rounded-lg border border-transparent transition-colors ${
                  sample.isAvailable 
                    ? 'hover:border-accent cursor-pointer' 
                    : 'opacity-50 cursor-not-allowed'
                }`}
              >
                <div className="flex justify-between items-center">
                    <div>
                        <p className="font-semibold text-text-primary">{formatSampleName(sample)}</p>
                        <p className="text-sm text-text-secondary">{sample.manufacturerName || 'N/A'}</p>
                    </div>
                    {!sample.isAvailable && (
                        <span className="text-xs font-bold text-yellow-400 bg-yellow-900/50 px-2 py-1 rounded-full">
                            Checked Out
                        </span>
                    )}
                </div>
              </div>
            ))}
            
            {searchTerm.length > 1 && searchResults.length === 0 && (
                <button
                    type="button"
                    onClick={() => setIsAddModalOpen(true)}
                    className="w-full flex items-center justify-center gap-2 p-3 bg-surface hover:bg-background border border-border rounded-lg text-primary font-semibold transition-colors"
                >
                    <PlusCircle size={20} />
                    Add "{searchTerm}" as a new sample
                </button>
            )}
          </div>
        </div>

        {/* Checkout List Column */}
        <div className="bg-background p-4 rounded-lg border border-border">
           <h4 className="font-semibold mb-3 text-text-primary">Samples to Check Out ({selectedSamples.length})</h4>
            <div className="space-y-2 max-h-80 overflow-y-auto pr-2">
            {selectedSamples.length > 0 ? (
                // --- MODIFIED: Display logic updated ---
                selectedSamples.map(sample => (
                <div key={sample.id} className="bg-surface p-3 rounded-md flex justify-between items-center border border-border">
                    <div className="flex items-center gap-3">
                    <Layers size={18} className="text-text-secondary" />
                    <div>
                        <p className="font-semibold text-sm text-text-primary">{formatSampleName(sample)}</p>
                        <p className="text-xs text-text-secondary">{sample.manufacturerName}</p>
                    </div>
                    </div>
                    <button onClick={() => removeSample(sample.id)} className="p-1 text-text-secondary hover:text-red-500 rounded-full">
                    <X size={16} />
                    </button>
                </div>
                ))
            ) : (
                <p className="text-sm text-center text-text-secondary py-8">No samples added yet.</p>
            )}
            </div>
        </div>
      </div>
    </>
  );
};

export default SampleSelector;