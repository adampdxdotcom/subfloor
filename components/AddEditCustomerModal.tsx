import React, { useState, useEffect } from 'react';
import { useData } from '../context/DataContext';
import { Customer } from '../types';
import { toast } from 'react-hot-toast';
import { Trash2, X, User } from 'lucide-react';

interface FormErrors {
  fullName?: string;
  email?: string;
  confirmEmail?: string;
  phoneNumber?: string;
}

interface EditCustomerModalProps {
  isOpen: boolean;
  onClose: () => void;
  customer: Customer | null;
  initialData?: Partial<Pick<Customer, 'fullName'>>;
  onSaveSuccess?: (newCustomer: Customer) => void;
}

const initialFormState = {
  fullName: '',
  email: '',
  phoneNumber: '',
  address: ''
};

const formatPhoneNumber = (value: string): string => {
  if (!value) return value;
  const phoneNumber = value.replace(/[^\d]/g, '');
  const len = phoneNumber.length;
  if (len < 4) return phoneNumber;
  if (len < 7) return `(${phoneNumber.slice(0, 3)}) ${phoneNumber.slice(3)}`;
  return `(${phoneNumber.slice(0, 3)}) ${phoneNumber.slice(3, 6)}-${phoneNumber.slice(6, 10)}`;
};

const validateForm = (
  formData: typeof initialFormState,
  confirmEmail: string
): FormErrors => {
  const newErrors: FormErrors = {};

  if (!formData.fullName.trim()) newErrors.fullName = 'Full name is required.';

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

  if (formData.email && !emailRegex.test(formData.email)) {
    newErrors.email = 'Must be a valid format (e.g., user@domain.com).';
  }

  if (formData.email && formData.email !== confirmEmail) {
    newErrors.confirmEmail = 'Emails do not match.';
  }

  const digits = formData.phoneNumber.replace(/[^\d]/g, '');
  if (formData.phoneNumber && digits.length !== 10) {
    newErrors.phoneNumber = 'Phone number must be exactly 10 digits.';
  }

  return newErrors;
};

const AddEditCustomerModal: React.FC<EditCustomerModalProps> = ({ isOpen, onClose, customer, initialData, onSaveSuccess }) => {
  const { addCustomer, updateCustomer, deleteCustomer, currentUser } = useData();
  const [formData, setFormData] = useState(initialFormState);
  const [confirmEmail, setConfirmEmail] = useState('');
  const [errors, setErrors] = useState<FormErrors>({});
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  
  // --- ADDED: Admin check for deletion rights ---
  const isAdmin = currentUser?.roles.includes('Admin');

  const isEditMode = customer !== null;

  useEffect(() => {
    if (isOpen) {
        if (isEditMode && customer) {
            const initialEmail = customer.email || '';
            setFormData({
                fullName: customer.fullName || '',
                email: initialEmail,
                phoneNumber: customer.phoneNumber ? formatPhoneNumber(customer.phoneNumber) : '',
                address: customer.address || '',
            });
            setConfirmEmail(initialEmail);
        } else {
            setFormData({ ...initialFormState, fullName: initialData?.fullName || '' });
            setConfirmEmail('');
        }
        setErrors({});
        setIsSaving(false);
        setIsDeleting(false);
    }
  }, [isOpen, customer, isEditMode, initialData]);

  useEffect(() => {
    if (isOpen) {
        setErrors(validateForm(formData, confirmEmail));
    }
  }, [formData, confirmEmail, isOpen]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;

    if (name === 'phoneNumber') {
      setFormData(prev => ({ ...prev, phoneNumber: formatPhoneNumber(value) }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const finalErrors = validateForm(formData, confirmEmail);
    if (Object.keys(finalErrors).length > 0) {
      setErrors(finalErrors);
      toast.error('Please fix the errors before submitting.');
      return;
    }

    setIsSaving(true);

    try {
      const payload = { ...formData, phoneNumber: formData.phoneNumber.replace(/[^\d]/g, '') };

      if (isEditMode && customer) {
        await updateCustomer({ ...customer, ...payload });
      } else {
        const newCustomer = await addCustomer(payload);
        if (onSaveSuccess) {
          onSaveSuccess(newCustomer);
        }
      }

      onClose();
    } catch (err) {
      console.error(err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!customer) return;

    if (window.confirm(`Delete ${customer.fullName}?`)) {
      setIsDeleting(true);
      try {
        await deleteCustomer(customer.id);
        toast.success('Customer deleted.');
        onClose();
      } catch (err) {
        toast.error((err as Error).message);
      } finally {
        setIsDeleting(false);
      }
    }
  };

  if (!isOpen) return null;

  const isSaveDisabled = isSaving || isDeleting || Object.keys(errors).length > 0;

  return (
    <div className="fixed inset-0 bg-black/75 flex justify-center z-50 overflow-y-auto">
      <div className="bg-surface w-full min-h-full md:min-h-0 md:h-auto md:max-h-[90vh] md:max-w-md md:rounded-lg shadow-2xl flex flex-col border border-border md:my-auto relative">

        <div className="p-4 border-b border-border flex justify-between items-center bg-background md:rounded-t-lg">
            <h2 className="text-xl font-bold text-text-primary flex items-center gap-2">
                <User className="text-primary" />
                {isEditMode ? 'Edit Customer' : 'New Customer'}
            </h2>
            <button onClick={onClose} className="p-2 hover:bg-surface rounded-full text-text-secondary hover:text-text-primary"><X size={24} /></button>
        </div>

        <form onSubmit={handleSubmit} noValidate className="flex flex-col h-full md:h-auto">
          <div className="p-6 space-y-4 flex-grow overflow-y-auto">
            <div>
              <input
                type="text"
                name="fullName"
                placeholder="Full Name"
                value={formData.fullName}
                onChange={handleInputChange}
                className={`w-full p-2 bg-background border rounded text-text-primary placeholder-text-secondary ${errors.fullName ? 'border-red-500' : 'border-border'}`}
              />
              {errors.fullName && <p className="text-red-500 text-sm mt-1">{errors.fullName}</p>}
            </div>

            <div>
              <input
                type="email"
                name="email"
                placeholder="Email (Optional)"
                value={formData.email}
                onChange={handleInputChange}
                className={`w-full p-2 bg-background border rounded text-text-primary placeholder-text-secondary ${errors.email ? 'border-red-500' : 'border-border'}`}
              />
              {errors.email && <p className="text-red-500 text-sm mt-1">{errors.email}</p>}
            </div>

            {formData.email && (
              <div>
                <input
                  type="email"
                  name="confirmEmail"
                  placeholder="Confirm Email"
                  value={confirmEmail}
                  onChange={(e) => setConfirmEmail(e.target.value)}
                  className={`w-full p-2 bg-background border rounded text-text-primary placeholder-text-secondary ${errors.confirmEmail ? 'border-red-500' : 'border-border'}`}
                />
                {errors.confirmEmail && <p className="text-red-500 text-sm mt-1">{errors.confirmEmail}</p>}
              </div>
            )}

            <div>
              <input
                type="tel"
                name="phoneNumber"
                placeholder="Phone Number"
                value={formData.phoneNumber}
                onChange={handleInputChange}
                className={`w-full p-2 bg-background border rounded text-text-primary placeholder-text-secondary ${errors.phoneNumber ? 'border-red-500' : 'border-border'}`}
                maxLength={14}
              />
              {errors.phoneNumber && <p className="text-red-500 text-sm mt-1">{errors.phoneNumber}</p>}
            </div>

            <input
              type="text"
              name="address"
              placeholder="Address"
              value={formData.address}
              onChange={handleInputChange}
              className="w-full p-2 bg-background border border-border rounded text-text-primary placeholder-text-secondary"
            />
          </div>

          <div className="p-4 border-t border-border bg-background md:rounded-b-lg flex justify-end gap-3 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="py-2 px-4 bg-secondary hover:bg-secondary-hover rounded text-on-secondary font-medium"
              disabled={isSaving || isDeleting}
            >
              Cancel
            </button>

            {/* DELETE Button - Now conditionally rendered for Admins only */}
            {isEditMode && isAdmin && (
              <button
                type="button"
                onClick={handleDelete}
                className="py-2 px-4 bg-red-600 hover:bg-red-700 rounded text-white font-semibold flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed mr-auto"
                disabled={isSaving || isDeleting}
              >
                <Trash2 size={16} />
                {isDeleting ? 'Deleting...' : 'Delete'}
              </button>
            )}

            <button
              type="submit"
              className="py-2 px-4 bg-primary hover:bg-primary-hover rounded text-on-primary disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={isSaveDisabled}
            >
              {isSaving ? 'Saving...' : (isEditMode ? 'Save Changes' : 'Add Customer')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddEditCustomerModal;