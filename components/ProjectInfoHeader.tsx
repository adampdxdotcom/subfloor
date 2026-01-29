import React, { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { CurrentUser, Project, ProjectStatus, Customer, Installer, User } from '../types';
import { Edit2, Trash2, Save, X, RotateCcw, Calendar, Tag, MapPin, Phone, User as UserIcon, Hammer, Briefcase, Ban, RefreshCw } from 'lucide-react'; 
import { useData } from '../context/DataContext'; 
import { formatDate } from '../utils/dateUtils';
import { getImageUrl } from '../utils/apiConfig';

const getStatusColor = (status: ProjectStatus): string => {
    switch (status) {
        case ProjectStatus.SCHEDULED: return 'bg-green-500 text-white';
        case ProjectStatus.ACCEPTED: return 'bg-teal-500 text-white';
        case ProjectStatus.QUOTING: return 'bg-accent text-on-accent';
        case ProjectStatus.SAMPLE_CHECKOUT: return 'bg-yellow-500 text-gray-800';
        case ProjectStatus.AWAITING_DECISION: return 'bg-secondary text-on-secondary';
        case ProjectStatus.NEW: return 'bg-gray-500 text-white';
        case ProjectStatus.COMPLETED: return 'bg-indigo-500 text-white';
        case ProjectStatus.CANCELLED: return 'bg-red-700 text-white';
        default: return 'bg-secondary text-on-secondary';
    }
};

interface ProjectInfoHeaderProps {
    project: Project;
    customer: Customer | undefined;
    clientInstaller?: Installer | undefined; 
    activeInstaller?: Installer;
    projectLead?: User;
    currentUser: CurrentUser | null;
    updateProject: (p: Partial<Project> & { id: number }) => void;
    onEdit: () => void;
    onDeleteProject: () => void;
    isDeleting: boolean;
    isLayoutEditMode: boolean;
    onSaveLayout: () => void;
    onCancelLayout: () => void;
    onResetLayout: () => void;
}

const ProjectInfoHeader: React.FC<ProjectInfoHeaderProps> = ({ 
    project, customer, clientInstaller, activeInstaller, projectLead, currentUser, updateProject, onEdit,
    onDeleteProject, isDeleting,
    isLayoutEditMode, onSaveLayout, onCancelLayout, onResetLayout 
}) => {
    const { systemBranding } = useData(); 
    
    const [isStatusDropdownOpen, setIsStatusDropdownOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsStatusDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);
    
    const handleStatusChange = (newStatus: ProjectStatus) => {
        updateProject({ id: project.id, status: newStatus });
        setIsStatusDropdownOpen(false);
    };

    const handleToggleCancel = () => {
        if (project.status === ProjectStatus.CANCELLED) {
            if (confirm("Restore this project to Active status?")) {
                updateProject({ id: project.id, status: ProjectStatus.NEW }); 
            }
        } else {
            if (confirm("Are you sure you want to CANCEL this project? It will be hidden from the calendar and locked.")) {
                updateProject({ id: project.id, status: ProjectStatus.CANCELLED });
            }
        }
    };
    
    // Map Address Link
    const googleMapsUrl = customer?.address 
        ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(customer.address)}`
        : '#';

    const owner = customer || clientInstaller;
    const ownerType = customer ? 'Customer' : 'Installer';
        
    // Format Date
    const formattedDate = formatDate(project.createdAt, systemBranding?.systemTimezone);
    
    return (
        <div className="bg-surface rounded-lg shadow-md p-6 border border-border">
            <div className="flex flex-col lg:flex-row justify-between items-start gap-4 mb-6">
                
                {/* LEFT: Title & Meta */}
                <div>
                    <div className="flex items-center gap-3 mb-2">
                        <h1 className="text-3xl font-bold text-text-primary">{project.projectName}</h1>
                        
                        {/* ONLY SHOW EDIT BUTTON IF IN LAYOUT EDIT MODE */}
                        {isLayoutEditMode && (
                            <button 
                                onClick={onEdit} 
                                className="p-1.5 text-text-secondary hover:text-text-primary rounded-md bg-background border border-border hover:border-primary transition-all" 
                                title="Edit Project Details"
                            >
                                <Edit2 size={16} />
                            </button>
                        )}
                    </div>
                    
                    {/* Meta Badges */}
                    <div className="flex flex-wrap items-center gap-3">
                        <span className="flex items-center gap-1 text-xs font-medium px-2.5 py-0.5 rounded bg-background border border-border text-text-secondary">
                            <Tag size={12} /> {project.projectType}
                        </span>
                        <span className="flex items-center gap-1 text-xs font-medium px-2.5 py-0.5 rounded bg-background border border-border text-text-secondary">
                            <Calendar size={12} /> Created: {formattedDate}
                        </span>
                    </div>
                </div>
                
                {/* RIGHT: Actions & Status */}
                <div className="flex items-center gap-3 w-full lg:w-auto">
                    {isLayoutEditMode ? (
                        // --- EDIT MODE CONTROLS ---
                        <>
                            <button onClick={onResetLayout} className="flex items-center px-3 py-2 text-sm font-medium text-yellow-600 bg-yellow-50 hover:bg-yellow-100 rounded-md transition-colors" title="Reset Default Layout">
                                <RotateCcw size={16} className="mr-1" /> Reset
                            </button>
                            <button onClick={onCancelLayout} className="flex items-center px-3 py-2 text-sm font-medium text-red-600 bg-red-50 hover:bg-red-100 rounded-md transition-colors" title="Cancel Changes">
                                <X size={16} className="mr-1" /> Cancel
                            </button>
                            <button onClick={onSaveLayout} className="flex items-center px-3 py-2 text-sm font-medium text-white bg-primary hover:bg-primary-hover rounded-md shadow-sm transition-colors" title="Save Layout Changes">
                                <Save size={16} className="mr-1" /> Save
                            </button>
                        </>
                    ) : (
                        // --- VIEW MODE ACTIONS ---
                        <>
                            {currentUser?.roles?.includes('Admin') && (
                                <>
                                    <button 
                                        onClick={handleToggleCancel} 
                                        className={`flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-md transition-colors border border-transparent ${
                                            project.status === ProjectStatus.CANCELLED 
                                            ? 'text-green-600 hover:bg-green-50 hover:border-green-100' 
                                            : 'text-text-secondary hover:text-orange-600 hover:bg-orange-50 hover:border-orange-100'
                                        }`}
                                    >
                                        {project.status === ProjectStatus.CANCELLED ? <RefreshCw size={16} /> : <Ban size={16} />}
                                        {project.status === ProjectStatus.CANCELLED ? 'Restore' : 'Cancel'}
                                    </button>

                                    <button onClick={onDeleteProject} disabled={isDeleting} className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-text-secondary hover:text-red-600 hover:bg-red-50 rounded-md transition-colors border border-transparent hover:border-red-100">
                                        <Trash2 size={16}/>
                                        {isDeleting ? 'Deleting...' : 'Delete'}
                                    </button>
                                </>
                            )}
                        </>
                    )}

                    {/* Status Dropdown */}
                    <div className="relative" ref={dropdownRef}>
                        <button
                            onClick={() => setIsStatusDropdownOpen(!isStatusDropdownOpen)}
                            className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold uppercase tracking-wide transition-all shadow-sm cursor-pointer hover:ring-2 ring-primary ring-offset-1 ${getStatusColor(project.status)}`}
                        >
                            {project.status.replace(/_/g, ' ')}
                            <Edit2 size={14} className="opacity-70" />
                        </button>

                        {isStatusDropdownOpen && (
                            <div className="absolute right-0 mt-2 w-56 bg-surface border border-border rounded-lg shadow-xl z-50 overflow-hidden">
                                {Object.values(ProjectStatus).map((status) => (
                                    <button
                                        key={status}
                                        onClick={() => handleStatusChange(status)}
                                        className={`w-full text-left px-4 py-3 text-sm hover:bg-background transition-colors ${project.status === status ? 'font-bold text-primary bg-primary/5' : 'text-text-primary'}`}
                                    >
                                        {status}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>
            
            <div className="h-px bg-border my-4" />

            {/* Information Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {/* 1. Customer/Client Info */}
                <div className="space-y-1">
                    <h3 className="text-xs font-bold text-text-tertiary uppercase tracking-wider mb-2 flex items-center gap-1">
                        <UserIcon size={12} /> {ownerType}
                    </h3>
                    <div className="flex items-start gap-2">
                        <Link to={customer ? `/customers/${customer.id}` : `/installers/${clientInstaller?.id}`} className="font-semibold text-text-primary text-lg hover:text-primary transition-colors">
                            {customer?.fullName || clientInstaller?.installerName || 'Unknown Client'}
                        </Link>
                        { (customer?.phoneNumber || clientInstaller?.contactPhone) && (
                            <div className="flex items-center text-text-secondary text-sm pt-1">
                                <span className="mx-2 text-text-tertiary">•</span>
                                <Phone size={14} className="mr-1 text-text-tertiary" />
                                <a href={`tel:${customer?.phoneNumber || clientInstaller?.contactPhone}`} className="hover:underline hover:text-primary">
                                    {customer?.phoneNumber || clientInstaller?.contactPhone}
                                </a>
                            </div>
                        )}
                    </div>
                    {customer?.address ? (
                        <a 
                            href={googleMapsUrl} 
                            target="_blank" 
                            rel="noreferrer" 
                            className="flex items-center gap-1.5 text-text-secondary hover:text-primary transition-colors text-sm group"
                        >
                            <MapPin size={14} className="text-text-tertiary group-hover:text-primary shrink-0" />
                            {customer.address}
                        </a>
                    ) : (
                        <span className="text-text-tertiary text-sm italic pl-5">No address on file</span>
                    )}
                </div>

                {/* 2. Assigned Installer Info */}
                {activeInstaller && (
                    <div className="space-y-1">
                        <h3 className="text-xs font-bold text-text-tertiary uppercase tracking-wider mb-2 flex items-center gap-1">
                            <Hammer size={12} /> Installer
                        </h3>
                        <div className="flex items-center gap-3">
                            <div 
                                className="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-xs shadow-sm"
                                style={{ backgroundColor: activeInstaller.color || '#6b7280' }}
                            >
                                {activeInstaller.installerName.substring(0, 2).toUpperCase()}
                            </div>
                            <div>
                                <div className="font-semibold text-text-primary">
                                    {activeInstaller.installerName}
                                </div>
                                <div className="text-xs text-text-secondary">
                                    {activeInstaller.contactPhone || activeInstaller.contactEmail || 'No contact info'}
                                </div>
                            </div>
                        </div>
                    </div>
                )}
                
                {/* 3. Project Lead */}
                {projectLead && (
                    <div className="space-y-1">
                        <h3 className="text-xs font-bold text-text-tertiary uppercase tracking-wider mb-2 flex items-center gap-1">
                            <Briefcase size={12} /> Project Lead
                        </h3>
                        <div className="flex items-center gap-3">
                            {projectLead.avatarUrl ? (
                                <img src={getImageUrl(projectLead.avatarUrl)} alt="Lead" className="w-8 h-8 rounded-full object-cover shadow-sm" />
                            ) : (
                                <div className="w-8 h-8 rounded-full bg-accent text-on-accent flex items-center justify-center font-bold text-xs">
                                    {projectLead.firstName?.[0]}{projectLead.lastName?.[0]}
                                </div>
                            )}
                            <div>
                                <div className="font-semibold text-text-primary">
                                    {projectLead.firstName} {projectLead.lastName}
                                </div>
                                <div className="text-xs text-text-secondary">
                                    {projectLead.email}
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ProjectInfoHeader;