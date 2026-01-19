import React, { useState, useEffect } from 'react';
import { useCustomerMutations } from '../hooks/useCustomers';
import { useCurrentUser } from '../hooks/useCurrentUser';
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
  const { data: currentUser } = useCurrentUser();
  const { createCustomer, updateCustomer, deleteCustomer } = useCustomerMutations();
  
  const [formData, setFormData] = useState(initialFormState);
  const [confirmEmail, setConfirmEmail] = useState('');
  const [errors, setErrors] = useState<FormErrors>({});
  
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

    const payload = { ...formData, phoneNumber: formData.phoneNumber.replace(/[^\d]/g, '') };

    try {
        if (isEditMode && customer) {
          await updateCustomer.mutateAsync({ ...customer, ...payload });
          toast.success('Customer updated!');
          onClose();
        } else {
          const newCustomer = await createCustomer.mutateAsync(payload);
          toast.success('Customer created!');
          if (onSaveSuccess) {
            onSaveSuccess(newCustomer);
          }
          onClose();
        }
    } catch (err) {
        // Error toast usually handled by mutation logic
    }
  };

  const handleDelete = async () => {
    if (!customer) return;

    if (window.confirm(`Delete ${customer.fullName}?`)) {
      try {
          await deleteCustomer.mutateAsync(customer.id);
          toast.success('Customer deleted.');
          onClose();
      } catch (err) {
          // Error handled by mutation
      }
    }
  };

  if (!isOpen) return null;

  const isProcessing = createCustomer.isPending || updateCustomer.isPending || deleteCustomer.isPending;
  const isSaveDisabled = isProcessing || Object.keys(errors).length > 0;

  return (
    <div className="fixed inset-0 bg-black/75 flex justify-center z-50 overflow-y-auto">
      <div className="bg-surface-container-high w-full min-h-full md:min-h-0 md:h-auto md:max-h-[90vh] md:max-w-md md:rounded-xl shadow-2xl flex flex-col border border-outline/10 md:my-auto relative">

        <div className="p-4 border-b border-outline/10 flex justify-between items-center bg-surface-container-low md:rounded-t-xl">
            <h2 className="text-xl font-bold text-text-primary flex items-center gap-2">
                <User className="text-primary" />
                {isEditMode ? 'Edit Customer' : 'New Customer'}
            </h2>
            <button onClick={onClose} className="p-2 hover:bg-surface-container-highest rounded-full text-text-secondary hover:text-text-primary"><X size={24} /></button>
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
                className={`w-full p-3 bg-surface-container-highest border-b-2 rounded-t-md text-text-primary placeholder-text-secondary focus:outline-none focus:border-primary transition-colors ${errors.fullName ? 'border-error' : 'border-transparent'}`}
              />
              {errors.fullName && <p className="text-error text-xs mt-1 ml-1 font-medium">{errors.fullName}</p>}
            </div>

            <div>
              <input
                type="email"
                name="email"
                placeholder="Email (Optional)"
                value={formData.email}
                onChange={handleInputChange}
                className={`w-full p-3 bg-surface-container-highest border-b-2 rounded-t-md text-text-primary placeholder-text-secondary focus:outline-none focus:border-primary transition-colors ${errors.email ? 'border-error' : 'border-transparent'}`}
              />
              {errors.email && <p className="text-error text-xs mt-1 ml-1 font-medium">{errors.email}</p>}
            </div>

            {formData.email && (
              <div>
                <input
                  type="email"
                  name="confirmEmail"
                  placeholder="Confirm Email"
                  value={confirmEmail}
                  onChange={(e) => setConfirmEmail(e.target.value)}
                  className={`w-full p-3 bg-surface-container-highest border-b-2 rounded-t-md text-text-primary placeholder-text-secondary focus:outline-none focus:border-primary transition-colors ${errors.confirmEmail ? 'border-error' : 'border-transparent'}`}
                />
                {errors.confirmEmail && <p className="text-error text-xs mt-1 ml-1 font-medium">{errors.confirmEmail}</p>}
              </div>
            )}

            <div>
              <input
                type="tel"
                name="phoneNumber"
                placeholder="Phone Number"
                value={formData.phoneNumber}
                onChange={handleInputChange}
                className={`w-full p-3 bg-surface-container-highest border-b-2 rounded-t-md text-text-primary placeholder-text-secondary focus:outline-none focus:border-primary transition-colors ${errors.phoneNumber ? 'border-error' : 'border-transparent'}`}
                maxLength={14}
              />
              {errors.phoneNumber && <p className="text-error text-xs mt-1 ml-1 font-medium">{errors.phoneNumber}</p>}
            </div>

            <input
              type="text"
              name="address"
              placeholder="Address"
              value={formData.address}
              onChange={handleInputChange}
              className="w-full p-3 bg-surface-container-highest border-b-2 border-transparent rounded-t-md text-text-primary placeholder-text-secondary focus:outline-none focus:border-primary transition-colors"
            />
          </div>

          <div className="p-4 border-t border-outline/10 bg-surface-container-low md:rounded-b-xl flex justify-end gap-3 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="py-2 px-6 bg-surface hover:bg-surface-container-highest border border-outline/20 rounded-full text-text-primary font-medium transition-colors"
              disabled={isProcessing}
            >
              Cancel
            </button>

            {isEditMode && isAdmin && (
              <button
                type="button"
                onClick={handleDelete}
                className="py-2 px-6 bg-error-container hover:bg-error/20 text-error rounded-full font-semibold flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed mr-auto transition-colors"
                disabled={isProcessing}
              >
                <Trash2 size={16} />
                {deleteCustomer.isPending ? 'Deleting...' : 'Delete'}
              </button>
            )}

            <button
              type="submit"
              className="py-2 px-6 bg-primary hover:bg-primary-hover rounded-full text-on-primary font-semibold shadow-md disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              disabled={isSaveDisabled}
            >
              {createCustomer.isPending || updateCustomer.isPending ? 'Saving...' : (isEditMode ? 'Save Changes' : 'Add Customer')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddEditCustomerModal;