import React, { useState, useEffect } from 'react';
import { useData } from '../context/DataContext';
import { Customer } from '../types';
import { toast } from 'react-hot-toast';
import { Trash2 } from 'lucide-react'; // --- ADDED: Import the icon

interface EditCustomerModalProps {
  isOpen: boolean;
  onClose: () => void;
  customer: Customer | null;
}

const initialFormState = {
  fullName: '',
  email: '',
  phoneNumber: '',
  address: ''
};

const EditCustomerModal: React.FC<EditCustomerModalProps> = ({ isOpen, onClose, customer }) => {
  // --- ADDED: Destructure deleteCustomer ---
  const { updateCustomer, deleteCustomer } = useData();
  const [formData, setFormData] = useState(initialFormState);
  const [isSaving, setIsSaving] = useState(false);
  // --- ADDED: State for the delete process ---
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    if (isOpen && customer) {
      setFormData({
        fullName: customer.fullName || '',
        email: customer.email || '',
        phoneNumber: customer.phoneNumber || '',
        address: customer.address || '',
      });
      // Reset states when the modal is opened
      setIsSaving(false);
      setIsDeleting(false);
    }
  }, [isOpen, customer]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customer) return;

    setIsSaving(true);
    try {
      await updateCustomer({ ...customer, ...formData });
      onClose();
    } catch (error) {
      console.error("Failed to submit customer update:", error);
    } finally {
      setIsSaving(false);
    }
  };

  // --- ADDED: Handler function for deleting the customer ---
  const handleDelete = async () => {
    if (!customer) return;

    if (window.confirm(`Are you sure you want to permanently delete ${customer.fullName}? This action cannot be undone.`)) {
      setIsDeleting(true);
      try {
        await deleteCustomer(customer.id);
        toast.success('Customer deleted successfully.');
        onClose();
      } catch (error) {
        // Display the specific error message from the backend
        toast.error((error as Error).message);
        console.error("Failed to delete customer:", error);
      } finally {
        setIsDeleting(false);
      }
    }
  };

  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
      <div className="bg-surface p-8 rounded-lg shadow-2xl w-full max-w-md">
        <h2 className="text-2xl font-bold mb-6 text-text-primary">Edit Customer</h2>
        <form onSubmit={handleSubmit}>
          <div className="space-y-4">
            <input type="text" name="fullName" placeholder="Full Name" value={formData.fullName} onChange={handleInputChange} className="w-full p-2 bg-gray-800 border border-border rounded" required />
            <input type="email" name="email" placeholder="Email" value={formData.email} onChange={handleInputChange} className="w-full p-2 bg-gray-800 border border-border rounded" required />
            <input type="tel" name="phoneNumber" placeholder="Phone Number" value={formData.phoneNumber} onChange={handleInputChange} className="w-full p-2 bg-gray-800 border border-border rounded" />
            <input type="text" name="address" placeholder="Address" value={formData.address} onChange={handleInputChange} className="w-full p-2 bg-gray-800 border border-border rounded" />
          </div>
          {/* --- MODIFIED: Added Delete button and disabled states --- */}
          <div className="flex items-center justify-end space-x-4 mt-6">
            <button
              type="button"
              onClick={handleDelete}
              className="py-2 px-4 bg-red-600 hover:bg-red-700 rounded text-white font-semibold flex items-center gap-2 disabled:bg-red-900 disabled:cursor-not-allowed mr-auto"
              disabled={isSaving || isDeleting}
            >
              <Trash2 size={16} />
              {isDeleting ? 'Deleting...' : 'Delete'}
            </button>
            <button type="button" onClick={onClose} className="py-2 px-4 bg-gray-600 hover:bg-gray-700 rounded text-white" disabled={isSaving || isDeleting}>
              Cancel
            </button>
            <button type="submit" className="py-2 px-4 bg-primary hover:bg-secondary rounded text-white" disabled={isSaving || isDeleting}>
              {isSaving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditCustomerModal;