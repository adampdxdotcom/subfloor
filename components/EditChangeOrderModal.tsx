import React, { useState, useEffect } from 'react';
import { ChangeOrder, Quote } from '../types';
import { useData } from '../context/DataContext';
import { useChangeOrderMutations } from '../hooks/useChangeOrderMutations';
import { Trash2, X } from 'lucide-react';
import { toast } from 'react-hot-toast';

interface EditChangeOrderModalProps {
  changeOrder: ChangeOrder;
  acceptedQuotes: Quote[];
  onClose: () => void;
  onSave: (data: { description: string; amount: number; type: 'Materials' | 'Labor'; quoteId?: number | null }) => Promise<void>;
}

const EditChangeOrderModal: React.FC<EditChangeOrderModalProps> = ({ changeOrder, acceptedQuotes, onClose, onSave }) => {
  const { currentUser } = useData();
  const { deleteChangeOrder } = useChangeOrderMutations();

  const [formData, setFormData] = useState({
    description: '',
    amount: '',
    type: 'Materials' as 'Materials' | 'Labor',
    quoteId: undefined as number | undefined | null
  });

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
    <div className="fixed inset-0 bg-scrim/60 flex items-center justify-center z-50 p-4">
      <div className="bg-surface-container-high p-6 rounded-2xl shadow-2xl w-full max-w-lg border border-outline/20">
        <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold text-text-primary">Edit Change Order</h2>
            <button onClick={onClose} className="text-text-secondary hover:text-text-primary p-2 rounded-full hover:bg-surface-container-highest transition-colors">
                <X size={20} />
            </button>
        </div>
        <form onSubmit={handleSubmit} className="flex flex-col">
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
                className="w-full bg-surface-container border border-outline/50 rounded-lg px-4 py-2.5 text-text-primary placeholder:text-text-tertiary focus:ring-2 focus:ring-primary/50 outline-none"
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
                className="w-full bg-surface-container border border-outline/50 rounded-lg px-4 py-2.5 text-text-primary placeholder:text-text-tertiary focus:ring-2 focus:ring-primary/50 outline-none"
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
                className="w-full bg-surface-container border border-outline/50 rounded-lg px-4 py-2.5 text-text-primary placeholder:text-text-tertiary focus:ring-2 focus:ring-primary/50 outline-none"
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
                  className="w-full bg-surface-container border border-outline/50 rounded-lg px-4 py-2.5 text-text-primary placeholder:text-text-tertiary focus:ring-2 focus:ring-primary/50 outline-none"
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

          <div className="flex items-center gap-3 mt-8">
            {currentUser?.roles?.includes('Admin') && (
                <button
                    type="button"
                    onClick={handleDelete}
                    disabled={isSaving || isDeleting}
                    className="py-3 px-6 rounded-full bg-error hover:bg-error-hover text-on-error font-semibold flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed mr-auto transition-all shadow-md"
                >
                    <Trash2 size={16} />
                    {isDeleting ? 'Deleting...' : 'Delete'}
                </button>
            )}
            <div className="flex items-center justify-end gap-3 flex-grow">
                <button
                    type="button"
                    onClick={onClose}
                    disabled={isSaving || isDeleting}
                    className="py-2.5 px-6 rounded-full border border-outline text-text-primary hover:bg-surface-container-highest transition-colors disabled:opacity-50"
                >
                    Cancel
                </button>
                <button
                    type="submit"
                    disabled={isSaving || isDeleting}
                    className="py-3 px-6 rounded-full bg-primary hover:bg-primary-hover text-on-primary font-semibold shadow-md transition-all disabled:opacity-50"
                >
                    {isSaving ? 'Saving...' : 'Save Changes'}
                </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditChangeOrderModal;