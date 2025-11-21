import React, { useState, useEffect } from 'react';
import { Project, PROJECT_TYPES } from '../types';

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
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
      <div className="bg-surface p-8 rounded-lg shadow-2xl w-full max-w-md">
        <h2 className="text-2xl font-bold mb-6 text-text-primary">Edit Project Details</h2>
        <form onSubmit={handleSubmit}>
          <div className="space-y-4">
            <div>
              <label htmlFor="projectName" className="block text-sm font-medium text-text-secondary mb-1">
                Project Name
              </label>
              <input
                type="text"
                id="projectName"
                name="projectName"
                value={formData.projectName}
                onChange={handleChange}
                className="w-full p-2 bg-gray-800 border border-border rounded"
                required
              />
            </div>
            <div>
              <label htmlFor="projectType" className="block text-sm font-medium text-text-secondary mb-1">
                Project Type
              </label>
              <select
                id="projectType"
                name="projectType"
                value={formData.projectType}
                onChange={handleChange}
                className="w-full p-2 bg-gray-800 border border-border rounded"
              >
                {PROJECT_TYPES.map(type => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex justify-end space-x-4 mt-8">
            <button
              type="button"
              onClick={onClose}
              className="py-2 px-4 bg-secondary hover:bg-secondary-hover rounded text-white"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="py-2 px-4 bg-primary hover:bg-primary-hover rounded text-white"
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