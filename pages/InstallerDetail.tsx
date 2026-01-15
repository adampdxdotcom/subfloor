import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { Installer, SampleCheckout } from '../types';
import { useData } from '../context/DataContext';
import { User, Mail, Phone, Briefcase, DollarSign, Calendar as CalendarIcon, Edit, History, Layers } from 'lucide-react';
import AddEditInstallerModal from '../components/AddEditInstallerModal'; 
import CollapsibleSection from '../components/CollapsibleSection';
import ActivityHistory from '../components/ActivityHistory';
import SampleHistoryCard from '../components/SampleHistoryCard'; 
import { toast } from 'react-hot-toast';
import * as sampleService from '../services/sampleCheckoutService';
import AddProjectModal from '../components/AddProjectModal';

interface AssignedProject {
  projectId: number;
  projectName: string;
  customerName: string;
  projectTotal: number;
  scheduledStartDate: string | null; 
  scheduledEndDate: string | null;
}

const formatDateRange = (startDateStr: string | null, endDateStr: string | null): string => {
  if (!startDateStr) {
    return 'Not Scheduled Yet';
  }
  const startDate = new Date(startDateStr);
  const endDate = endDateStr ? new Date(endDateStr) : null;

  if (!endDate || startDate.toDateString() === endDate.toDateString()) {
    return `Scheduled: ${startDate.toLocaleDateString()}`;
  }

  return `Scheduled: ${startDate.toLocaleDateString()} - ${endDate.toLocaleDateString()}`;
};


const InstallerDetail: React.FC = () => {
  const { installerId } = useParams<{ installerId: string }>();
  const navigate = useNavigate();
  
  const { 
    installers, 
    isLoading: isDataLoading, 
    installerHistory, 
    fetchInstallerHistory 
  } = useData();
  
  const [projects, setProjects] = useState<AssignedProject[]>([]);
  const [isLoadingProjects, setIsLoadingProjects] = useState(true);
  const [sampleHistory, setSampleHistory] = useState<SampleCheckout[]>([]);
  
  const [isProjectModalOpen, setIsProjectModalOpen] = useState(false);
  const [transferSample, setTransferSample] = useState<SampleCheckout | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

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
        toast.error("Could not load assigned projects.");
      } finally {
        setIsLoadingProjects(false);
      }
    };

    fetchAssignedProjects();

    if (installerId) {
      fetchInstallerHistory(parseInt(installerId));
      sampleService.getCheckoutsByInstaller(parseInt(installerId)).then(setSampleHistory).catch(console.error);
    }
  }, [installerId, fetchInstallerHistory]);
  
  const handleStartProject = (sample: SampleCheckout) => {
      setTransferSample(sample);
      setIsProjectModalOpen(true);
  };
  
  if (isDataLoading) {
    return <div className="text-center py-12 text-text-secondary">Loading installer details...</div>;
  }

  if (!installer) {
    return <div className="text-center py-12 text-text-secondary">Installer not found.</div>;
  }

  return (
    <div className="space-y-8">
      {/* Header Section - MD3 De-boxed Style */}
      <div className="bg-surface-container-high p-8 rounded-xl shadow-sm border border-outline/10">
        <div className="flex justify-between items-start mb-4">
          <div className="flex items-center">
            <div className="w-16 h-16 rounded-full flex items-center justify-center mr-6 shadow-sm border-2 border-surface" style={{ backgroundColor: installer.color || '#4A5568' }}>
              <User className="w-8 h-8 text-white"/>
            </div>
            <div>
              <h1 className="text-3xl font-bold text-text-primary">{installer.installerName}</h1>
            </div>
          </div>
          <button
            onClick={() => setIsEditModalOpen(true)}
            className="flex items-center gap-2 py-2 px-6 bg-primary-container hover:bg-primary text-primary hover:text-on-primary rounded-full font-semibold transition-all shadow-sm"
          >
            <Edit size={16} />
            Edit
          </button>
        </div>
        <div className="border-t border-outline/10 my-6"></div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-text-secondary">
          <p className="flex items-center"><Mail className="w-5 h-5 mr-3 text-primary opacity-80"/> {installer.contactEmail || 'N/A'}</p>
          <p className="flex items-center"><Phone className="w-5 h-5 mr-3 text-primary opacity-80"/> {installer.contactPhone || 'N/A'}</p>
        </div>
      </div>

      {/* Change History Section */}
      <div>
        <CollapsibleSection
          title="Change History"
          icon={<History className="w-6 h-6" />}
          defaultOpen={false}
        >
          <ActivityHistory history={installerHistory} />
        </CollapsibleSection>
      </div>

      {/* Sample History Section */}
      <div>
        <div className="flex justify-between items-center mb-6 px-1">
            <h2 className="text-2xl font-bold text-text-primary flex items-center gap-3"><Layers className="w-6 h-6"/> Sample History</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {sampleHistory.map(sample => (
                <SampleHistoryCard key={sample.id} sample={sample} onStartProject={handleStartProject} />
            ))}
            {sampleHistory.length === 0 && <p className="col-span-full text-center text-text-secondary py-8 bg-surface-container-low rounded-xl border border-dashed border-outline/20">No active samples for this installer.</p>}
        </div>
      </div>
      
      {/* Assigned Projects Section */}
      <div>
        <div className="flex justify-between items-center mb-6 px-1">
          <h2 className="text-2xl font-bold text-text-primary flex items-center gap-3"><Briefcase className="w-6 h-6"/> Assigned Projects</h2>
        </div>

        <div className="space-y-4">
          {isLoadingProjects ? (
            <p className="text-text-secondary">Loading projects...</p>
          ) : projects.length > 0 ? (
            projects.map(project => (
              <div key={project.projectId} className="bg-surface-container-high p-5 rounded-xl border border-outline/10 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4 hover:shadow-md transition-shadow">
                <div>
                  <Link to={`/projects/${project.projectId}`} className="text-lg font-bold text-text-primary hover:text-primary transition-colors">
                    {project.projectName}
                  </Link>
                  <p className="text-sm text-text-secondary flex items-center mt-1">
                    <User className="w-4 h-4 mr-2"/>
                    {project.customerName}
                  </p>
                </div>
                <div className="text-left md:text-right w-full md:w-auto border-t border-outline/10 md:border-none pt-4 md:pt-0">
                  <p className="text-md font-bold text-success flex items-center md:justify-end">
                    <DollarSign className="w-5 h-5 mr-2"/>
                    {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(project.projectTotal)}
                  </p>
                  <p className="text-sm text-text-secondary flex items-center md:justify-end mt-1">
                    <CalendarIcon className="w-4 h-4 mr-2"/>
                    {formatDateRange(project.scheduledStartDate, project.scheduledEndDate)}
                  </p>
                </div>
              </div>
            ))
          ) : (
            <div className="text-center text-text-secondary bg-surface-container-low p-12 rounded-xl border border-dashed border-outline/20">
              <p>No accepted projects assigned to this installer yet.</p>
            </div>
          )}
        </div>
      </div>
      
      {isEditModalOpen && (
        <AddEditInstallerModal
          isOpen={isEditModalOpen}
          onClose={() => setIsEditModalOpen(false)}
          installer={installer}
        />
      )}
      
      {/* Project Creation Modal */}
      <AddProjectModal
        isOpen={isProjectModalOpen}
        onClose={() => { setIsProjectModalOpen(false); setTransferSample(null); }}
        initialInstaller={installer}
        transferSampleId={transferSample?.id}
        initialProjectName={transferSample ? `Project for Sample #${transferSample.id}` : ''}
      />
    </div>
  );
};

export default InstallerDetail;