import React, { useState, useMemo } from 'react';
import { useData } from '../context/DataContext';
import { Customer, Project, PROJECT_TYPES, ProjectStatus } from '../types'; // Import ProjectStatus
import { PlusCircle } from 'lucide-react';

interface ProjectSelectorProps {
  customer: Customer;
  onProjectSelect: (project: Project) => void;
}

const ProjectSelector: React.FC<ProjectSelectorProps> = ({ customer, onProjectSelect }) => {
  const { projects, addProject } = useData();
  const [isCreating, setIsCreating] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectType, setNewProjectType] = useState(PROJECT_TYPES[0]);

  const customerProjects = useMemo(() => {
    return projects.filter(p => p.customerId === customer.id);
  }, [projects, customer.id]);

  const handleCreateNewProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProjectName) {
      alert("Please provide a name for the new project.");
      return;
    }
    try {
      const newProject = await addProject({
        customerId: customer.id,
        projectName: newProjectName,
        projectType: newProjectType,
        // --- THIS IS THE FIX ---
        // Create it as 'New'. The status will be updated to 'Sample Checkout'
        // only when the checkout is actually completed.
        status: ProjectStatus.NEW,
      });
      onProjectSelect(newProject);
      setIsCreating(false);
    } catch (error) {
      console.error("Failed to create project", error);
    }
  };

  if (isCreating) {
    return (
      <form onSubmit={handleCreateNewProject} className="p-4 bg-gray-800 rounded-lg border border-border space-y-4">
        <h4 className="font-semibold">Create New Project for {customer.fullName}</h4>
        <input 
          type="text" 
          placeholder="Project Name (e.g., 'Master Bedroom')" 
          required 
          value={newProjectName} 
          onChange={e => setNewProjectName(e.target.value)} 
          className="w-full p-2 bg-gray-900 border-border rounded" 
        />
        <select 
          value={newProjectType} 
          onChange={e => setNewProjectType(e.target.value as typeof PROJECT_TYPES[number])} 
          className="w-full p-2 bg-gray-900 border-border rounded"
        >
          {PROJECT_TYPES.map(type => <option key={type} value={type}>{type}</option>)}
        </select>
        <div className="flex justify-end gap-2">
          <button type="button" onClick={() => setIsCreating(false)} className="py-2 px-4 bg-gray-600 rounded">Cancel</button>
          <button type="submit" className="py-2 px-4 bg-primary rounded">Create Project</button>
        </div>
      </form>
    );
  }

  return (
    <div className="space-y-3">
      {customerProjects.length > 0 ? (
        customerProjects.map(project => (
          <div
            key={project.id}
            onClick={() => onProjectSelect(project)}
            className="p-3 bg-gray-800 rounded-lg border border-transparent hover:border-accent cursor-pointer transition-colors"
          >
            <p className="font-semibold">{project.projectName}</p>
            <p className="text-sm text-text-secondary">{project.projectType} - <span className="italic">{project.status}</span></p>
          </div>
        ))
      ) : (
        <p className="text-text-secondary text-center py-4">This customer has no existing projects.</p>
      )}
      <button
        onClick={() => setIsCreating(true)}
        className="w-full p-3 mt-2 bg-gray-700 hover:bg-gray-600 rounded-lg flex items-center justify-center gap-2 text-accent font-semibold transition-colors"
      >
        <PlusCircle size={18} />
        Create New Project
      </button>
    </div>
  );
};

export default ProjectSelector;