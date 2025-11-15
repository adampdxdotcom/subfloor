import React, { useState, useEffect } from 'react';
import { ChangeOrder, Quote } from '../types';
// --- MODIFIED: Import useData hook and Trash2 icon ---
import { useData } from '../context/DataContext';
import { Trash2 } from 'lucide-react';
import { toast } from 'react-hot-toast';

interface EditChangeOrderModalProps {
  changeOrder: ChangeOrder;
  acceptedQuotes: Quote[];
  onClose: () => void;
  onSave: (data: { description: string; amount: number; type: 'Materials' | 'Labor'; quoteId?: number | null }) => Promise<void>;
}

const EditChangeOrderModal: React.FC<EditChangeOrderModalProps> = ({ changeOrder, acceptedQuotes, onClose, onSave }) => {
  // --- MODIFIED: Destructure currentUser and deleteChangeOrder ---
  const { currentUser, deleteChangeOrder } = useData();

  const [formData, setFormData] = useState({
    description: '',
    amount: '',
    type: 'Materials' as 'Materials' | 'Labor',
    quoteId: undefined as number | undefined | null
  });

  // --- ADDED: State for delete and save operations ---
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    if (changeOrder) {
      setFormData({
        description: changeOrder.description,
        amount: String(changeOrder.amount),
        type: changeOrder.type,
        quoteId: changeOrder.quoteId
      });
    }
  }, [changeOrder]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    const newValue = name === 'quoteId' ? (value ? parseInt(value, 10) : null) : value;
    setFormData(prev => ({ ...prev, [name]: newValue }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.description.trim() || !formData.amount.trim()) {
      alert('Description and amount are required.');
      return;
    }
    
    setIsSaving(true);
    try {
      await onSave({
        description: formData.description,
        amount: parseFloat(formData.amount),
        type: formData.type,
        quoteId: formData.quoteId,
      });
    } catch (error) {
      console.error("Failed to update change order:", error);
    } finally {
      setIsSaving(false);
    }
  };

  // --- ADDED: Handler function for deleting the change order ---
  const handleDelete = async () => {
    if (window.confirm('Are you sure you want to permanently delete this change order?')) {
        setIsDeleting(true);
        try {
            await deleteChangeOrder(changeOrder.id);
            toast.success('Change order deleted successfully.');
            onClose();
        } catch (error) {
            toast.error((error as Error).message);
            console.error('Failed to delete change order:', error);
        } finally {
            setIsDeleting(false);
        }
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
                <option value="Labor">Labor</option>
              </select>
            </div>
            
            {acceptedQuotes && acceptedQuotes.length > 1 && (
              <div>
                <label htmlFor="quoteId" className="block text-sm font-medium text-text-secondary mb-1">
                  For Quote
                </label>
                <select
                  id="quoteId"
                  name="quoteId"
                  value={formData.quoteId || ''}
                  onChange={handleChange}
                  className="w-full p-2 bg-gray-800 border border-border rounded"
                >
                  {acceptedQuotes.map((q, index) => (
                    <option key={q.id} value={q.id}>
                      Quote #{index + 1}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
          {/* --- MODIFIED: Added Delete button and disabled states for all buttons --- */}
          <div className="flex items-center justify-end space-x-4 mt-8">
            {currentUser?.roles?.includes('Admin') && (
                <button
                    type="button"
                    onClick={handleDelete}
                    disabled={isSaving || isDeleting}
                    className="py-2 px-4 bg-red-600 hover:bg-red-700 rounded text-white font-semibold flex items-center gap-2 disabled:bg-red-900 disabled:cursor-not-allowed mr-auto"
                >
                    <Trash2 size={16} />
                    {isDeleting ? 'Deleting...' : 'Delete'}
                </button>
            )}
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving || isDeleting}
              className="py-2 px-4 bg-gray-600 hover:bg-gray-700 rounded text-white"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving || isDeleting}
              className="py-2 px-4 bg-primary hover:bg-secondary rounded text-white"
            >
              {isSaving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditChangeOrderModal;