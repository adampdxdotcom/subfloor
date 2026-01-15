import React, { useState, useEffect } from 'react';
import { Project, PROJECT_TYPES } from '../types';
import { X } from 'lucide-react';

interface EditProjectModalProps {
  project: Project;
  onClose: () => void;
  onSave: (projectData: Partial<Project> & { id: number }) => Promise<void>;
}

const EditProjectModal: React.FC<EditProjectModalProps> = ({ project, onClose, onSave }) => {
  const [formData, setFormData] = useState({
    projectName: '',
    projectType: ''
  });

  useEffect(() => {
    if (project) {
      setFormData({
        projectName: project.projectName,
        projectType: project.projectType
      });
    }
  }, [project]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.projectName.trim()) {
      alert('Project name is required.');
      return;
    }
    
    try {
      await onSave({
        id: project.id,
        ...formData,
      });
      onClose();
    } catch (error) {
      console.error("Failed to update project:", error);
    }
  };

  return (
    <div className="fixed inset-0 bg-scrim/60 flex items-center justify-center z-50 p-4">
      <div className="bg-surface-container-high p-6 rounded-2xl shadow-2xl w-full max-w-lg border border-outline/20" onClick={(e) => e.stopPropagation()}>
        
        {/* Header with Close Button */}
        <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold text-text-primary">Edit Project Details</h2>
            <button 
                onClick={onClose} 
                className="text-text-secondary hover:text-text-primary p-2 rounded-full hover:bg-surface-container-highest transition-colors"
            >
                <X size={20} />
            </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="space-y-5">
            <div>
              <label htmlFor="projectName" className="block text-sm font-medium text-text-secondary mb-1.5 ml-1">
                Project Name
              </label>
              <input
                type="text"
                id="projectName"
                name="projectName"
                value={formData.projectName}
                onChange={handleChange}
                className="w-full bg-surface-container border border-outline/50 rounded-lg px-4 py-2.5 text-text-primary placeholder:text-text-tertiary focus:ring-2 focus:ring-primary/50 outline-none transition-all"
                required
              />
            </div>
            <div>
              <label htmlFor="projectType" className="block text-sm font-medium text-text-secondary mb-1.5 ml-1">
                Project Type
              </label>
              <select
                id="projectType"
                name="projectType"
                value={formData.projectType}
                onChange={handleChange}
                className="w-full bg-surface-container border border-outline/50 rounded-lg px-4 py-2.5 text-text-primary placeholder:text-text-tertiary focus:ring-2 focus:ring-primary/50 outline-none transition-all cursor-pointer"
              >
                {PROJECT_TYPES.map(type => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex justify-end gap-3 mt-8">
            <button
              type="button"
              onClick={onClose}
              className="py-2.5 px-6 rounded-full border border-outline text-text-primary hover:bg-surface-container-highest transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="py-3 px-6 rounded-full bg-primary hover:bg-primary-hover text-on-primary font-semibold shadow-md transition-all active:scale-95"
            >
              Save Changes
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditProjectModal;