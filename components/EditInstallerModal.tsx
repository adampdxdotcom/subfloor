import React, { useState, useEffect } from 'react';
import { useData } from '../context/DataContext';
import { Installer } from '../types';
import { toast } from 'react-hot-toast';
import { Trash2 } from 'lucide-react';

interface EditInstallerModalProps {
  isOpen: boolean;
  onClose: () => void;
  installer: Installer | null;
}

const initialFormState = {
  installerName: '',
  contactEmail: '',
  contactPhone: '',
  color: '#ffffff' // Default to white
};

const EditInstallerModal: React.FC<EditInstallerModalProps> = ({ isOpen, onClose, installer }) => {
  // deleteInstaller will be added to DataContext and types.ts shortly
  const { updateInstaller, deleteInstaller } = useData();
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
      setIsSaving(false);
      setIsDeleting(false);
    }
  }, [isOpen, installer]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!installer) return;

    setIsSaving(true);
    try {
      await updateInstaller({ ...installer, ...formData });
      onClose();
    } catch (error) {
      console.error("Failed to submit installer update:", error);
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
      <div className="bg-surface p-8 rounded-lg shadow-2xl w-full max-w-md">
        <h2 className="text-2xl font-bold mb-6 text-text-primary">Edit Installer</h2>
        <form onSubmit={handleSubmit}>
          <div className="space-y-4">
            <input type="text" name="installerName" placeholder="Installer Name" value={formData.installerName} onChange={handleInputChange} className="w-full p-2 bg-gray-800 border border-border rounded" required />
            <input type="email" name="contactEmail" placeholder="Contact Email" value={formData.contactEmail} onChange={handleInputChange} className="w-full p-2 bg-gray-800 border border-border rounded" />
            <input type="tel" name="contactPhone" placeholder="Contact Phone" value={formData.contactPhone} onChange={handleInputChange} className="w-full p-2 bg-gray-800 border border-border rounded" />
            <div className="flex items-center gap-4">
                <label htmlFor="color" className="text-text-secondary">Calendar Color:</label>
                <input type="color" name="color" value={formData.color} onChange={handleInputChange} className="h-10 w-16 p-1 bg-gray-800 border border-border rounded cursor-pointer" />
            </div>
          </div>
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

export default EditInstallerModal;