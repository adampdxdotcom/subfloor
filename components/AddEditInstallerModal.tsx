import React, { useState, useEffect } from 'react';
import { useData } from '../context/DataContext';
import { Installer } from '../types';
import { toast } from 'react-hot-toast';
import { Trash2, X, HardHat } from 'lucide-react';

interface EditInstallerModalProps {
  isOpen: boolean;
  onClose: () => void;
  installer: Installer | null;
  initialData?: Partial<Installer>; 
}

const initialFormState = {
  installerName: '',
  contactEmail: '',
  contactPhone: '',
  color: '#ffffff',
  type: 'Managed' as 'Managed' | 'Unmanaged'
};

const AddEditInstallerModal: React.FC<EditInstallerModalProps> = ({ isOpen, onClose, installer, initialData }) => {
  const { addInstaller, updateInstaller, deleteInstaller } = useData();
  const [formData, setFormData] = useState(initialFormState);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    if (isOpen && installer) {
      setFormData({
        installerName: installer.installerName || '',
        contactEmail: installer.contactEmail || '',
        contactPhone: installer.contactPhone || '',
        color: installer.color || '#ffffff',
        type: (installer.type as 'Managed' | 'Unmanaged') || 'Managed',
      });
    } else if (isOpen && !installer) {
      setFormData({ ...initialFormState, ...initialData }); 
    }
    setIsSaving(false);
    setIsDeleting(false);
  }, [isOpen, installer, initialData]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    let finalValue = value;

    if (name === 'contactPhone') {
        const digits = value.replace(/\D/g, '').slice(0, 10);
        if (digits.length <= 3) finalValue = digits;
        else if (digits.length <= 6) finalValue = `${digits.slice(0, 3)}-${digits.slice(3)}`;
        else finalValue = `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
    }

    setFormData(prev => ({ ...prev, [name]: finalValue }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    setIsSaving(true);
    try {
      if (installer) {
          await updateInstaller({ ...installer, ...formData });
          toast.success("Installer updated.");
      } else {
          await addInstaller(formData);
          toast.success("Installer created.");
      }
      onClose();
    } catch (error) {
      console.error("Failed to submit installer update:", error);
      toast.error("Failed to save installer.");
    } finally {
      setIsSaving(false);
    }
  };
  
  const handleDelete = async () => {
    if (!installer) return;

    if (window.confirm(`Are you sure you want to permanently delete ${installer.installerName}? This action cannot be undone.`)) {
      setIsDeleting(true);
      try {
        await deleteInstaller(installer.id);
        toast.success('Installer deleted successfully.');
        onClose();
      } catch (error) {
        toast.error((error as Error).message);
        console.error("Failed to delete installer:", error);
      } finally {
        setIsDeleting(false);
      }
    }
  };

  if (!isOpen) {
    return null;
  }

  const inputClasses = "w-full p-3 bg-surface-container-highest border-b-2 border-transparent rounded-t-md text-text-primary placeholder-text-secondary focus:outline-none focus:border-primary transition-colors";

  return (
    <div className="fixed inset-0 bg-black/75 flex items-center justify-center z-50">
      {/* Mobile: Full Screen, Desktop: Modal Card */}
      <div className="bg-surface-container-high w-full h-full md:h-auto md:max-w-md md:rounded-2xl shadow-2xl flex flex-col border border-outline/10">
        
        {/* Header */}
        <div className="p-4 border-b border-outline/10 flex justify-between items-center bg-surface-container-low md:rounded-t-2xl">
            <h2 className="text-xl font-bold text-text-primary flex items-center gap-2">
                <HardHat className="text-primary" />
                {installer ? 'Edit Installer' : 'New Installer'}
            </h2>
            <button onClick={onClose} className="p-2 hover:bg-surface-container-highest rounded-full text-text-secondary hover:text-text-primary transition-colors">
              <X size={24} />
            </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col h-full md:h-auto">
          <div className="p-6 space-y-4 flex-grow overflow-y-auto">
            <input 
                type="text" 
                name="installerName" 
                placeholder="Installer Name" 
                value={formData.installerName} 
                onChange={handleInputChange} 
                className={inputClasses} 
                required 
            />
            
            {/* Type Selector */}
            <select
                name="type"
                value={formData.type}
                onChange={handleInputChange}
                className={`${inputClasses} cursor-pointer`}
            >
                <option value="Managed">Managed Installer (Employee)</option>
                <option value="Unmanaged">Unmanaged Installer (Sub)</option>
            </select>

            {/* Contact Info */}
            <div className="space-y-4 pt-2">
              <input 
                  type="email" 
                  name="contactEmail" 
                  placeholder="Contact Email" 
                  value={formData.contactEmail} 
                  onChange={handleInputChange} 
                  className={inputClasses} 
              />
              <input 
                  type="tel" 
                  name="contactPhone" 
                  placeholder="Contact Phone" 
                  value={formData.contactPhone} 
                  onChange={handleInputChange} 
                  className={inputClasses} 
              />
            </div>
            
            <div className="pt-4 border-t border-outline/10 mt-4">
                <div className="flex items-center justify-between">
                    <label htmlFor="color" className="text-sm font-medium text-text-secondary">Calendar Color</label>
                    <input 
                        type="color" 
                        name="color" 
                        value={formData.color} 
                        onChange={handleInputChange} 
                        className="h-10 w-20 p-1 bg-surface-container-highest border border-outline/20 rounded-md cursor-pointer" 
                    />
                </div>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="p-4 border-t border-outline/10 bg-surface-container-low md:rounded-b-2xl flex justify-end gap-3 shrink-0">
            {installer && (
                <button
                  type="button"
                  onClick={handleDelete}
                  className="py-2 px-6 bg-error-container hover:bg-error/20 text-error rounded-full font-semibold flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed mr-auto transition-colors"
                  disabled={isSaving || isDeleting}
                >
                  <Trash2 size={16} />
                  {isDeleting ? 'Deleting...' : 'Delete'}
                </button>
            )}
            <button 
                type="submit" 
                className="py-2 px-6 bg-primary hover:bg-primary-hover rounded-full text-on-primary font-semibold shadow-md transition-all" 
                disabled={isSaving || isDeleting}
            >
              {isSaving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddEditInstallerModal;