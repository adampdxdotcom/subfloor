// pages/InstallerDetail.tsx

import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom'; // MODIFIED: Added useNavigate
import { Installer } from '../types';
import { useData } from '../context/DataContext';
import { User, Mail, Phone, Briefcase, DollarSign, Calendar as CalendarIcon, Edit, History, Trash2 } from 'lucide-react'; // MODIFIED: Added Trash2
import EditInstallerModal from '../components/EditInstallerModal';
import CollapsibleSection from '../components/CollapsibleSection';
import ActivityHistory from '../components/ActivityHistory';
import { toast } from 'react-hot-toast'; // MODIFIED: Added toast

interface AssignedProject {
  projectId: number;
  projectName: string;
  customerName: string;
  installerLaborAmount: number;
  scheduledStartDate: string | null;
}

const InstallerDetail: React.FC = () => {
  const { installerId } = useParams<{ installerId: string }>();
  const navigate = useNavigate(); // MODIFIED: Initialize navigate
  
  // vvvvvvvvvvvv MODIFIED: Destructured currentUser and deleteInstaller vvvvvvvvvvvv
  const { 
    currentUser, 
    installers, 
    deleteInstaller, 
    isLoading: isDataLoading, 
    installerHistory, 
    fetchInstallerHistory 
  } = useData();
  // ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
  
  const [projects, setProjects] = useState<AssignedProject[]>([]);
  const [isLoadingProjects, setIsLoadingProjects] = useState(true);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false); // MODIFIED: Added deleting state

  const installer = installers.find(i => i.id === parseInt(installerId || ''));

  useEffect(() => {
    const fetchAssignedProjects = async () => {
      if (!installerId) return;
      setIsLoadingProjects(true);
      try {
        const projectsRes = await fetch(`/api/projects?installerId=${installerId}`);
        if (!projectsRes.ok) throw new Error('Failed to fetch projects');
        const projectsData = await projectsRes.json();
        setProjects(projectsData);
      } catch (error) {
        console.error("Failed to fetch installer projects:", error);
      } finally {
        setIsLoadingProjects(false);
      }
    };

    fetchAssignedProjects();

    if (installerId) {
      fetchInstallerHistory(parseInt(installerId));
    }
  }, [installerId, fetchInstallerHistory]);
  
  // vvvvvvvvvvvv MODIFIED: Added handler for deletion vvvvvvvvvvvv
  const handleDeleteInstaller = async () => {
    if (!installer) return;
    if (window.confirm(`Are you sure you want to permanently delete installer "${installer.installerName}"? This cannot be undone.`)) {
        setIsDeleting(true);
        try {
            await deleteInstaller(installer.id);
            toast.success('Installer deleted successfully.');
            navigate('/installers');
        } catch (error) {
            toast.error((error as Error).message || 'Failed to delete installer.');
            console.error(error);
        } finally {
            setIsDeleting(false);
        }
    }
  };
  // ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^

  if (isDataLoading) {
    return <div className="text-center">Loading installer details...</div>;
  }

  if (!installer) {
    return <div className="text-center">Installer not found.</div>;
  }

  return (
    <div>
      <div className="bg-surface p-6 rounded-lg shadow-md mb-8">
        <div className="flex justify-between items-start mb-4">
          <div className="flex items-center">
            <div className="w-16 h-16 rounded-full flex items-center justify-center mr-6" style={{ backgroundColor: installer.color || '#4A5568' }}>
              <User className="w-8 h-8 text-white"/>
            </div>
            <div>
              <h1 className="text-3xl font-bold text-text-primary">{installer.installerName}</h1>
            </div>
          </div>
          <button
            onClick={() => setIsEditModalOpen(true)}
            className="flex items-center gap-2 py-2 px-4 bg-blue-600 hover:bg-blue-700 rounded text-white font-semibold transition-colors"
          >
            <Edit size={16} />
            Edit
          </button>
        </div>
        <div className="border-t border-border my-6"></div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-text-secondary">
          <p className="flex items-center"><Mail className="w-5 h-5 mr-3 text-accent"/> {installer.contactEmail || 'N/A'}</p>
          <p className="flex items-center"><Phone className="w-5 h-5 mr-3 text-accent"/> {installer.contactPhone || 'N/A'}</p>
        </div>
      </div>

      <div className="mb-8">
        <CollapsibleSection
          title="Change History"
          icon={<History className="w-6 h-6" />}
          defaultOpen={false}
        >
          <ActivityHistory history={installerHistory} />
        </CollapsibleSection>
      </div>
      
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-text-primary flex items-center"><Briefcase className="w-6 h-6 mr-3"/> Assigned Projects</h2>
      </div>

      <div className="space-y-4">
        {isLoadingProjects ? (
          <p className="text-text-secondary">Loading projects...</p>
        ) : projects.length > 0 ? (
          projects.map(project => (
            <div key={project.projectId} className="bg-surface p-4 rounded-lg shadow-md flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div>
                <Link to={`/projects/${project.projectId}`} className="text-lg font-bold text-text-primary hover:text-accent transition-colors">
                  {project.projectName}
                </Link>
                <p className="text-sm text-text-secondary flex items-center mt-1">
                  <User className="w-4 h-4 mr-2"/>
                  {project.customerName}
                </p>
              </div>
              <div className="text-left md:text-right w-full md:w-auto border-t border-border md:border-none pt-4 md:pt-0">
                <p className="text-md font-semibold text-green-400 flex items-center md:justify-end">
                  <DollarSign className="w-5 h-5 mr-2"/>
                  {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(project.installerLaborAmount)}
                </p>
                <p className="text-sm text-text-secondary flex items-center md:justify-end mt-1">
                  <CalendarIcon className="w-4 h-4 mr-2"/>
                  {project.scheduledStartDate 
                    ? `Scheduled: ${new Date(project.scheduledStartDate).toLocaleDateString()}`
                    : 'Not Scheduled Yet'
                  }
                </p>
              </div>
            </div>
          ))
        ) : (
          <div className="text-center text-text-secondary bg-surface p-8 rounded-lg">
            <p>No accepted projects assigned to this installer yet.</p>
          </div>
        )}
      </div>
      
      {/* vvvvvvvvvvvv MODIFIED: Added admin-only Danger Zone vvvvvvvvvvvv */}
      {currentUser?.roles?.includes('Admin') && (
        <div className="mt-12 p-6 border-t-4 border-red-500 bg-surface rounded-lg shadow-md">
          <h3 className="text-xl font-bold text-red-400 mb-4">Danger Zone</h3>
          <p className="text-text-secondary mb-4">Deleting this installer is a permanent action. You can only delete an installer if they are not assigned to any existing quotes.</p>
          <button
              onClick={handleDeleteInstaller}
              disabled={isDeleting}
              className="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded-lg flex items-center gap-2 disabled:bg-red-900 disabled:cursor-not-allowed"
          >
              <Trash2 size={18} />
              {isDeleting ? 'Deleting...' : 'Delete This Installer'}
          </button>
        </div>
      )}
      {/* ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^ */}

      {isEditModalOpen && (
        <EditInstallerModal
          isOpen={isEditModalOpen}
          onClose={() => setIsEditModalOpen(false)}
          installer={installer}
        />
      )}
    </div>
  );
};

export default InstallerDetail;