import React, { useState, useEffect } from 'react';
import { useData } from '../context/DataContext';
import { Installer } from '../types';
import { toast } from 'react-hot-toast';
import { Trash2 } from 'lucide-react';

interface EditInstallerModalProps {
  isOpen: boolean;
  onClose: () => void;
  installer: Installer | null;
  initialData?: Partial<Installer>; // NEW PROP
}

const initialFormState = {
  installerName: '',
  contactEmail: '',
  contactPhone: '',
  color: '#ffffff' // Default to white
};

const EditInstallerModal: React.FC<EditInstallerModalProps> = ({ isOpen, onClose, installer, initialData }) => {
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
      });
    } else if (isOpen && !installer) {
      // Reset for Add Mode
      setFormData({ ...initialFormState, ...initialData }); // MERGE INITIAL DATA
    }
    setIsSaving(false);
    setIsDeleting(false);
  }, [isOpen, installer, initialData]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
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

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
      <div className="bg-surface p-8 rounded-lg shadow-2xl w-full max-w-md border border-border">
        <h2 className="text-2xl font-bold mb-6 text-text-primary">{installer ? 'Edit Installer' : 'Add Installer'}</h2>
        <form onSubmit={handleSubmit}>
          <div className="space-y-4">
            <input 
                type="text" 
                name="installerName" 
                placeholder="Installer Name" 
                value={formData.installerName} 
                onChange={handleInputChange} 
                className="w-full p-2 bg-background border border-border rounded text-text-primary placeholder-text-secondary" 
                required 
            />
            <input 
                type="email" 
                name="contactEmail" 
                placeholder="Contact Email" 
                value={formData.contactEmail} 
                onChange={handleInputChange} 
                className="w-full p-2 bg-background border border-border rounded text-text-primary placeholder-text-secondary" 
            />
            <input 
                type="tel" 
                name="contactPhone" 
                placeholder="Contact Phone" 
                value={formData.contactPhone} 
                onChange={handleInputChange} 
                className="w-full p-2 bg-background border border-border rounded text-text-primary placeholder-text-secondary" 
            />
            <div className="flex items-center gap-4">
                <label htmlFor="color" className="text-text-secondary">Calendar Color:</label>
                <input 
                    type="color" 
                    name="color" 
                    value={formData.color} 
                    onChange={handleInputChange} 
                    className="h-10 w-16 p-1 bg-background border border-border rounded cursor-pointer" 
                />
            </div>
          </div>
          <div className="flex items-center justify-end space-x-4 mt-6">
            {installer && (
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
                type="button" 
                onClick={onClose} 
                className="py-2 px-4 bg-secondary hover:bg-secondary-hover rounded text-on-secondary" 
                disabled={isSaving || isDeleting}
            >
              Cancel
            </button>
            <button 
                type="submit" 
                className="py-2 px-4 bg-primary hover:bg-primary-hover rounded text-on-primary" 
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

export default EditInstallerModal;