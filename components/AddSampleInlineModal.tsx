import React, { useState } from 'react';
import { useData } from '../context/DataContext';
import { Sample } from '../types';
import { toast } from 'react-hot-toast';
import { X } from 'lucide-react';
// --- ADDED: Import the new reusable form component ---
import SampleForm, { SampleFormData } from './SampleForm';

interface AddSampleInlineModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSampleCreated: (newSample: Sample) => void;
  initialSearchTerm: string;
}

const AddSampleInlineModal: React.FC<AddSampleInlineModalProps> = ({
  isOpen,
  onClose,
  onSampleCreated,
  initialSearchTerm,
}) => {
  const { addSample } = useData();
  const [isSaving, setIsSaving] = useState(false);

  // --- MODIFIED: This is the new save handler ---
  // It receives the complete data from the SampleForm
  const handleSave = async (formData: SampleFormData) => {
    setIsSaving(true);
    try {
      const { supplierId, ...restOfSampleData } = formData;
      const finalSupplierId = formData.supplierId || formData.manufacturerId;

      const sampleDataToSave = { 
        ...restOfSampleData, 
        supplierId: finalSupplierId,
      };

      if (sampleDataToSave.productType !== 'Tile') {
        // We know sampleFormat exists on the type, so we can safely set it
        (sampleDataToSave as any).sampleFormat = null;
        (sampleDataToSave as any).boardColors = '';
      }
      
      const createdSample = await addSample(sampleDataToSave);
      
      // Pass the newly created sample back up to the parent component (e.g., SampleSelector)
      onSampleCreated(createdSample);
      
      toast.success(`Sample "${createdSample.style}" created!`);
      onClose(); // Close this modal
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
        <div className="bg-surface-container-high p-8 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto border border-outline/10" onClick={e => e.stopPropagation()}>
          <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-text-primary">Create New Sample</h2>
              <button onClick={onClose} className="p-2 rounded-full hover:bg-surface-container-highest text-text-secondary hover:text-text-primary transition-colors">
                  <X className="w-6 h-6" />
              </button>
          </div>
          
          {/* --- MODIFIED: The entire old form is replaced with our reusable component --- */}
          <SampleForm
            initialData={{ style: initialSearchTerm }}
            onSave={handleSave}
            onCancel={onClose}
            isSaving={isSaving}
            saveButtonText="Create & Add"
          />

        </div>
      </div>
    </>
  );
};

export default AddSampleInlineModal;