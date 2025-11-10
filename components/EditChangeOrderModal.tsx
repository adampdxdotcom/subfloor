import React, { useState, useEffect } from 'react';
import { ChangeOrder } from '../types';

interface EditChangeOrderModalProps {
  changeOrder: ChangeOrder;
  onClose: () => void;
  onSave: (data: { description: string; amount: number; type: 'Materials' | 'Installer' }) => Promise<void>;
}

const EditChangeOrderModal: React.FC<EditChangeOrderModalProps> = ({ changeOrder, onClose, onSave }) => {
  const [formData, setFormData] = useState({
    description: '',
    amount: '',
    type: 'Materials' as 'Materials' | 'Installer'
  });

  useEffect(() => {
    if (changeOrder) {
      setFormData({
        description: changeOrder.description,
        amount: String(changeOrder.amount),
        type: changeOrder.type === 'Labor' ? 'Installer' : changeOrder.type // Handle 'Labor' type from old data if needed
      });
    }
  }, [changeOrder]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.description.trim() || !formData.amount.trim()) {
      alert('Description and amount are required.');
      return;
    }
    
    try {
      await onSave({
        description: formData.description,
        amount: parseFloat(formData.amount),
        type: formData.type,
      });
      onClose(); // This is called from the ProjectDetail page to close the modal
    } catch (error) {
      console.error("Failed to update change order:", error);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
      <div className="bg-surface p-8 rounded-lg shadow-2xl w-full max-w-md">
        <h2 className="text-2xl font-bold mb-6 text-text-primary">Edit Change Order</h2>
        <form onSubmit={handleSubmit}>
          <div className="space-y-4">
            <div>
              <label htmlFor="description" className="block text-sm font-medium text-text-secondary mb-1">
                Description
              </label>
              <input
                type="text"
                id="description"
                name="description"
                value={formData.description}
                onChange={handleChange}
                className="w-full p-2 bg-gray-800 border border-border rounded"
                required
              />
            </div>
             <div>
              <label htmlFor="amount" className="block text-sm font-medium text-text-secondary mb-1">
                Amount
              </label>
              <input
                type="number"
                step="0.01"
                id="amount"
                name="amount"
                value={formData.amount}
                onChange={handleChange}
                placeholder="e.g., -50.00"
                className="w-full p-2 bg-gray-800 border border-border rounded"
                required
              />
            </div>
            <div>
              <label htmlFor="type" className="block text-sm font-medium text-text-secondary mb-1">
                Type
              </label>
              <select
                id="type"
                name="type"
                value={formData.type}
                onChange={handleChange}
                className="w-full p-2 bg-gray-800 border border-border rounded"
              >
                <option value="Materials">Materials</option>
                <option value="Installer">Installer</option>
              </select>
            </div>
          </div>
          <div className="flex justify-end space-x-4 mt-8">
            <button
              type="button"
              onClick={onClose}
              className="py-2 px-4 bg-gray-600 hover:bg-gray-700 rounded text-white"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="py-2 px-4 bg-primary hover:bg-secondary rounded text-white"
            >
              Save Changes
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditChangeOrderModal;