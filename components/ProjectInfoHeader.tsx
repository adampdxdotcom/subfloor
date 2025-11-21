import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { CurrentUser, Project, ProjectStatus } from '../types';
import { Edit, Trash2, Save, X, RotateCcw } from 'lucide-react'; // <-- Import new icons

const getStatusColor = (status: ProjectStatus): string => {
    switch (status) {
        case ProjectStatus.SCHEDULED: return 'bg-green-500 text-white';
        case ProjectStatus.ACCEPTED: return 'bg-teal-500 text-white';
        case ProjectStatus.QUOTING: return 'bg-accent text-on-accent'; // Updated to use theme accent
        case ProjectStatus.SAMPLE_CHECKOUT: return 'bg-yellow-500 text-gray-800';
        case ProjectStatus.AWAITING_DECISION: return 'bg-secondary text-on-secondary';
        case ProjectStatus.NEW: return 'bg-gray-500 text-white';
        case ProjectStatus.COMPLETED: return 'bg-indigo-500 text-white';
        case ProjectStatus.CANCELLED: return 'bg-red-700 text-white';
        default: return 'bg-secondary text-on-secondary';
    }
};

// --- MODIFIED: Add new props for Layout Edit Mode ---
interface ProjectInfoHeaderProps {
    project: Project;
    customerName: string;
    currentUser: CurrentUser | null; // <-- NEW
    updateProject: (p: Partial<Project> & { id: number }) => void;
    onEdit: () => void;
    onDeleteProject: () => void; // <-- NEW
    isDeleting: boolean; // <-- NEW
    isLayoutEditMode: boolean;
    onSaveLayout: () => void;
    onCancelLayout: () => void;
    onResetLayout: () => void;
}

const ProjectInfoHeader: React.FC<ProjectInfoHeaderProps> = ({ 
    project, customerName, currentUser, updateProject, onEdit,
    onDeleteProject, isDeleting,
    isLayoutEditMode, onSaveLayout, onCancelLayout, onResetLayout 
}) => {
    const [isEditingStatus, setIsEditingStatus] = useState(false);
    
    const handleStatusChange = (newStatus: ProjectStatus) => {
        updateProject({ id: project.id, status: newStatus });
        setIsEditingStatus(false);
    };

    // NOTE: handleCancelProject function removed as its functionality is superseded
    // by the explicit Delete button (onDeleteProject) or status dropdown (if cancelling status).
    
    const statusOptions = [ ProjectStatus.NEW, ProjectStatus.SAMPLE_CHECKOUT, ProjectStatus.AWAITING_DECISION, ProjectStatus.QUOTING, ProjectStatus.ACCEPTED, ProjectStatus.SCHEDULED, ProjectStatus.COMPLETED, ProjectStatus.CANCELLED, ProjectStatus.CLOSED ];
    
    return (
        <div className="bg-surface p-6 rounded-lg shadow-lg">
            {/* --- MODIFIED: Conditional Rendering for the entire header content --- */}
            {isLayoutEditMode ? (
                // --- VIEW WHEN IN EDIT MODE ---
                <div className="flex justify-between items-center animate-pulse">
                    <div>
                        <h2 className="text-2xl font-bold text-accent">Editing Page Layout...</h2>
                        <p className="text-text-secondary">Drag and resize the panels below.</p>
                    </div>
                    <div className="flex items-center space-x-2">
                        <button onClick={onResetLayout} className="flex items-center text-yellow-400 hover:text-white hover:bg-yellow-600 font-semibold py-2 px-3 rounded-lg transition-colors text-sm">
                            <RotateCcw className="w-4 h-4 mr-2"/> Reset
                        </button>
                        <button onClick={onCancelLayout} className="flex items-center text-red-400 hover:text-white hover:bg-red-600 font-semibold py-2 px-3 rounded-lg transition-colors text-sm">
                            <X className="w-4 h-4 mr-2"/> Cancel
                        </button>
                        <button onClick={onSaveLayout} className="flex items-center bg-primary hover:bg-primary-hover text-on-primary font-bold py-2 px-4 rounded-lg text-sm">
                            <Save className="w-4 h-4 mr-2"/> Save Layout
                        </button>
                    </div>
                </div>
            ) : (
                // --- NORMAL VIEW ---
                <>
                    <div className="flex justify-between items-start">
                        <div>
                            <div className="flex items-center gap-3 mb-1">
                                <h1 className="text-3xl font-bold text-text-primary">{project.projectName}</h1>
                                <button onClick={onEdit} className="p-1 text-text-secondary hover:text-text-primary rounded-full hover:bg-background" title="Edit Project Details">
                                    <Edit size={20}/>
                                </button>
                            </div>
                            <Link to={`/customers/${project.customerId}`} className="text-lg text-accent hover:underline">{customerName}</Link>
                        </div>
                        <div className="flex items-center space-x-4 text-sm">
                            {currentUser?.roles?.includes('Admin') && (
                                <button onClick={onDeleteProject} disabled={isDeleting} className="flex items-center text-red-400 hover:text-white hover:bg-red-600 font-semibold py-2 px-3 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                                    <Trash2 className="w-4 h-4 mr-2"/>
                                    {isDeleting ? 'Deleting...' : 'Delete Project'}
                                </button>
                            )}

                            <div className="relative flex items-center space-x-2">
                                {isEditingStatus ? (
                                    <select value={project.status} onChange={(e) => handleStatusChange(e.target.value as ProjectStatus)} onBlur={() => setIsEditingStatus(false)} className="bg-background border border-border text-text-primary text-sm rounded-lg focus:ring-primary focus:border-primary block w-full p-2.5" autoFocus>
                                        {statusOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                                    </select>
                                ) : (
                                    <span className={`text-sm font-semibold px-3 py-1 rounded-full ${getStatusColor(project.status)}`}>
                                        {project.status}
                                    </span>
                                )}
                                <button onClick={() => setIsEditingStatus(!isEditingStatus)} className="text-text-secondary hover:text-text-primary p-1 rounded-full hover:bg-background" title="Change Status">
                                    <Edit className="w-4 h-4"/>
                                </button>
                            </div>
                        </div>
                    </div>
                    <div className="mt-4 pt-4 border-t border-border text-text-secondary">
                        <p><strong className="text-text-primary">Type:</strong> {project.projectType}</p>
                        <p><strong className="text-text-primary">Created:</strong> {new Date(project.createdAt).toLocaleDateString()}</p>
                    </div>
                </>
            )}
        </div>
    );
};

export default ProjectInfoHeader;