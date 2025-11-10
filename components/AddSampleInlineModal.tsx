import React, { useState } from 'react';
import { useData } from '../context/DataContext';
import { Sample } from '../types';
import { toast } from 'react-hot-toast';
import { X } from 'lucide-react';

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
  const { addSample } = useData();
  const [styleColor, setStyleColor] = useState(initialStyleColor);
  const [manufacturer, setManufacturer] = useState('');
  const [type, setType] = useState('LVP'); // Default type
  const [isSaving, setIsSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!styleColor.trim()) {
      toast.error('Style / Color is required.');
      return;
    }

    setIsSaving(true);
    try {
      const newSampleData = { manufacturer, styleColor, type };
      const createdSample = await addSample(newSampleData);
      toast.success(`Sample "${createdSample.styleColor}" created!`);
      onSampleCreated(createdSample); // Pass the new sample back to the selector
      onClose(); // Close the modal
    } catch (error) {
      console.error('Failed to create sample:', error);
      toast.error('Could not create sample.');
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
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
            <input
              type="text"
              value={styleColor}
              onChange={(e) => setStyleColor(e.target.value)}
              className="w-full p-2 bg-gray-800 border border-border rounded"
              required
            />
          </div>
          <div>
            <label className="text-sm text-text-secondary">Manufacturer</label>
            <input
              type="text"
              value={manufacturer}
              onChange={(e) => setManufacturer(e.target.value)}
              className="w-full p-2 bg-gray-800 border border-border rounded"
            />
          </div>
          <div>
            <label className="text-sm text-text-secondary">Type</label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="w-full p-2 bg-gray-800 border border-border rounded"
              required
            >
              <option value="LVP">LVP</option>
              <option value="Carpet">Carpet</option>
              <option value="Tile">Tile</option>
              <option value="Hardwood">Hardwood</option>
              <option value="Catalog">Catalog</option>
              <option value="Other">Other</option>
            </select>
          </div>
          <div className="flex justify-end space-x-4 pt-4">
            <button type="button" onClick={onClose} className="py-2 px-4 bg-gray-600 hover:bg-gray-700 rounded text-white">
              Cancel
            </button>
            <button type="submit" className="py-2 px-4 bg-primary hover:bg-secondary rounded text-white" disabled={isSaving}>
              {isSaving ? 'Creating...' : 'Create & Add'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddSampleInlineModal;