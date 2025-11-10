import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Project, ProjectStatus } from '../types';
import { Edit, Trash2 } from 'lucide-react';

const getStatusColor = (status: ProjectStatus): string => {
    switch (status) {
        case ProjectStatus.SCHEDULED: return 'bg-green-500 text-white';
        case ProjectStatus.ACCEPTED: return 'bg-teal-500 text-white';
        case ProjectStatus.QUOTING: return 'bg-blue-500 text-white';
        case ProjectStatus.SAMPLE_CHECKOUT: return 'bg-yellow-500 text-gray-800';
        case ProjectStatus.AWAITING_DECISION: return 'bg-gray-500 text-white';
        case ProjectStatus.NEW: return 'bg-gray-600 text-white';
        case ProjectStatus.COMPLETED: return 'bg-indigo-500 text-white';
        case ProjectStatus.CANCELLED: return 'bg-red-700 text-white';
        default: return 'bg-gray-700 text-white';
    }
};

interface ProjectInfoHeaderProps {
    project: Project;
    customerName: string;
    updateProject: (p: Partial<Project> & { id: number }) => void;
    onEdit: () => void;
}

const ProjectInfoHeader: React.FC<ProjectInfoHeaderProps> = ({ project, customerName, updateProject, onEdit }) => {
    const [isEditingStatus, setIsEditingStatus] = useState(false);
    
    const handleStatusChange = (newStatus: ProjectStatus) => {
        updateProject({ id: project.id, status: newStatus });
        setIsEditingStatus(false);
    };

    const handleCancelProject = () => {
        if (confirm("Are you sure you want to cancel this project? This will mark it as 'Cancelled' and cannot be easily undone.")) {
            updateProject({ id: project.id, status: ProjectStatus.CANCELLED });
        }
    };
    
    const statusOptions = [ ProjectStatus.NEW, ProjectStatus.SAMPLE_CHECKOUT, ProjectStatus.AWAITING_DECISION, ProjectStatus.QUOTING, ProjectStatus.ACCEPTED, ProjectStatus.SCHEDULED, ProjectStatus.COMPLETED, ProjectStatus.CANCELLED, ProjectStatus.CLOSED ];
    
    return (
        <div className="bg-surface p-6 rounded-lg shadow-lg">
            <div className="flex justify-between items-start">
                <div>
                    <div className="flex items-center gap-3 mb-1">
                        <h1 className="text-3xl font-bold text-text-primary">{project.projectName}</h1>
                        <button onClick={onEdit} className="p-1 text-text-secondary hover:text-white rounded-full hover:bg-gray-700" title="Edit Project Details">
                            <Edit size={20}/>
                        </button>
                    </div>
                    <Link to={`/customers/${project.customerId}`} className="text-lg text-accent hover:underline">{customerName}</Link>
                </div>
                <div className="flex items-center space-x-4">
                    <button onClick={handleCancelProject} className="flex items-center text-red-400 hover:text-white hover:bg-red-600 font-semibold py-2 px-3 rounded-lg transition-colors text-sm" title="Cancel Project">
                        <Trash2 className="w-4 h-4 mr-2"/> Cancel
                    </button>
                    <div className="relative flex items-center space-x-2">
                        {isEditingStatus ? (
                            <select value={project.status} onChange={(e) => handleStatusChange(e.target.value as ProjectStatus)} onBlur={() => setIsEditingStatus(false)} className="bg-gray-700 border border-border text-white text-sm rounded-lg focus:ring-accent focus:border-accent block w-full p-2.5" autoFocus>
                                {statusOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                            </select>
                        ) : (
                            <span className={`text-sm font-semibold px-3 py-1 rounded-full ${getStatusColor(project.status)}`}>
                                {project.status}
                            </span>
                        )}
                        <button onClick={() => setIsEditingStatus(!isEditingStatus)} className="text-text-secondary hover:text-text-primary p-1 rounded-full hover:bg-gray-700" title="Change Status">
                            <Edit className="w-4 h-4"/>
                        </button>
                    </div>
                </div>
            </div>
             <div className="mt-4 pt-4 border-t border-border text-text-secondary">
                <p><strong>Type:</strong> {project.projectType}</p>
                <p><strong>Created:</strong> {new Date(project.createdAt).toLocaleDateString()}</p>
            </div>
        </div>
    );
};

export default ProjectInfoHeader;