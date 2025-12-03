import React, { useState, useMemo, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useData } from '../context/DataContext';
import { Project, ProjectStatus, ProjectType, PROJECT_TYPES, Installer } from '../types';
import { User, Mail, Phone, MapPin, PlusCircle, Edit, Briefcase, ChevronRight, History } from 'lucide-react';
import EditCustomerModal from '../components/EditCustomerModal';
import CollapsibleSection from '../components/CollapsibleSection'; // <-- NEW IMPORT
import ActivityHistory from '../components/ActivityHistory';     // <-- NEW IMPORT
import { formatDate } from '../utils/dateUtils';

const CustomerDetail: React.FC = () => {
  const { customerId } = useParams<{ customerId: string }>();
  // vvvvvvvvvvvv ADD NEW ITEMS FROM CONTEXT vvvvvvvvvvvv
  const { customers, projects, addProject, installers, addInstaller, customerHistory, fetchCustomerHistory, systemBranding } = useData();
  // ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
  const navigate = useNavigate();
  
  // State for the "Add Project" modal
  const [isProjectModalOpen, setIsProjectModalOpen] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectType, setNewProjectType] = useState<ProjectType>(PROJECT_TYPES[0]);
  
  // State for the installer "search-or-add" feature
  const [selectedInstaller, setSelectedInstaller] = useState<Installer | null>(null);
  const [installerSearchTerm, setInstallerSearchTerm] = useState('');
  const [isAddingNewInstaller, setIsAddingNewInstaller] = useState(false);
  const [newInstallerForm, setNewInstallerForm] = useState({ installerName: '', contactEmail: '', contactPhone: '' });
  
  const [isEditCustomerModalOpen, setIsEditCustomerModalOpen] = useState(false);
  
  const installerSearchResults = useMemo(() => {
    if (!installerSearchTerm) return [];
    return installers.filter(i => i.installerName.toLowerCase().includes(installerSearchTerm.toLowerCase()));
  }, [installers, installerSearchTerm]);

  const customer = customers.find(c => c.id === parseInt(customerId || ''));
  const customerProjects = projects.filter(p => p.customerId === customer?.id);
  
  // =================================================================
  //  NEW EFFECT TO FETCH HISTORY
  // =================================================================
  useEffect(() => {
    if (customerId) {
      fetchCustomerHistory(parseInt(customerId));
    }
  }, [customerId, fetchCustomerHistory]);
  // =================================================================

  if (!customer) {
    return <div className="text-center text-text-secondary">Customer not found.</div>;
  }

  const resetProjectModal = () => {
    setNewProjectName('');
    setNewProjectType(PROJECT_TYPES[0]);
    setSelectedInstaller(null);
    setInstallerSearchTerm('');
    setIsAddingNewInstaller(false);
    setNewInstallerForm({ installerName: '', contactEmail: '', contactPhone: '' });
    setIsProjectModalOpen(false);
  };
  
  const handleAddProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newProjectName) {
      try {
        const projectData = {
          projectName: newProjectName,
          projectType: newProjectType,
          customerId: customer.id,
          status: ProjectStatus.NEW,
          finalChoice: null,
          installerId: selectedInstaller ? selectedInstaller.id : undefined
        };

        const createdProject = await addProject(projectData);
        resetProjectModal();
        navigate(`/projects/${createdProject.id}`);
      } catch (error) {
        console.error("Failed to create project:", error);
        alert("There was an error creating the project.");
      }
    }
  };

  const handleSelectInstaller = (installer: Installer) => {
    setSelectedInstaller(installer);
    setInstallerSearchTerm(installer.installerName);
  };

  const handleShowAddNewInstaller = () => {
    setNewInstallerForm({ installerName: installerSearchTerm, contactEmail: '', contactPhone: '' });
    setIsAddingNewInstaller(true);
  };

  const handleSaveNewInstaller = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newInstallerForm.installerName) return;
    try {
      const newlyAddedInstaller = await addInstaller(newInstallerForm);
      setIsAddingNewInstaller(false);
      handleSelectInstaller(newlyAddedInstaller);
    } catch (error) {
      console.error("Failed to add new installer:", error);
    }
  };

  return (
    <div>
      {/* Customer Header Section */}
      <div className="bg-surface p-6 rounded-lg shadow-md mb-8">
        <div className="flex flex-col md:flex-row justify-between items-start">
          <div className="flex items-center mb-4 md:mb-0">
             <div className="w-16 h-16 bg-accent rounded-full flex items-center justify-center mr-6">
                  <User className="w-8 h-8 text-white"/>
              </div>
            <div>
              <h1 className="text-3xl font-bold text-text-primary">{customer.fullName}</h1>
              <p className="text-text-secondary">Customer since {formatDate(customer.createdAt, systemBranding?.systemTimezone)}</p>
            </div>
          </div>
          <button 
            onClick={() => setIsEditCustomerModalOpen(true)}
            className="flex items-center bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded-lg transition-colors"
          >
            <Edit className="w-4 h-4 mr-2" />
            Edit Customer
          </button>
        </div>
        <div className="border-t border-border my-6"></div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-text-secondary">
          <p className="flex items-center"><Mail className="w-5 h-5 mr-3 text-accent"/> {customer.email}</p>
          <p className="flex items-center"><Phone className="w-5 h-5 mr-3 text-accent"/> {customer.phoneNumber}</p>
          <p className="flex items-center col-span-full"><MapPin className="w-5 h-5 mr-3 text-accent"/> {customer.address}</p>
        </div>
      </div>
      
      {/* Projects Section */}
      <div className="mb-8">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-text-primary flex items-center"><Briefcase className="w-6 h-6 mr-3"/> Projects</h2>
          <button onClick={() => setIsProjectModalOpen(true)} className="flex items-center bg-primary hover:bg-secondary text-white font-bold py-2 px-4 rounded-lg transition-colors">
            <PlusCircle className="w-5 h-5 mr-2" />
            New Project
          </button>
        </div>
        <div className="space-y-4">
          {customerProjects.length > 0 ? customerProjects.map(project => (
            <Link to={`/projects/${project.id}`} key={project.id} className="flex justify-between items-center bg-surface p-4 rounded-lg shadow-sm hover:shadow-lg hover:bg-gray-700 transition-all">
              <div>
                <h3 className="font-semibold text-lg text-text-primary">{project.projectName}</h3>
                <p className="text-sm text-text-secondary">{project.status}</p>
              </div>
              <ChevronRight className="w-6 h-6 text-text-secondary"/>
            </Link>
          )) : (
            <p className="text-center text-text-secondary py-4">No projects for this customer yet.</p>
          )}
        </div>
      </div>
      
      {/* =========================================================== */}
      {/*  NEW HISTORY SECTION                                        */}
      {/* =========================================================== */}
      <div className="mb-8">
        <CollapsibleSection
          title="Change History"
          icon={<History className="w-6 h-6" />}
          defaultOpen={false}
        >
          <ActivityHistory history={customerHistory} />
        </CollapsibleSection>
      </div>
      {/* =========================================================== */}


      {isProjectModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
          <div className="bg-surface p-8 rounded-lg shadow-2xl w-full max-w-md">
            <h2 className="text-2xl font-bold mb-6 text-text-primary">Add New Project</h2>
            {!isAddingNewInstaller ? (
              <form onSubmit={handleAddProject}>
                <div className="space-y-4">
                  <input type="text" placeholder="Project Name (e.g., Kitchen Flooring)" value={newProjectName} onChange={(e) => setNewProjectName(e.target.value)} className="w-full p-2 bg-gray-800 border border-border rounded" required />
                  <select value={newProjectType} onChange={(e) => setNewProjectType(e.target.value as ProjectType)} className="w-full p-2 bg-gray-800 border border-border rounded">
                      {PROJECT_TYPES.map(type => <option key={type} value={type}>{type}</option>)}
                  </select>
                  <div className="relative">
                    <label className="block text-sm font-medium text-text-secondary mb-1">Installer (Optional)</label>
                    <input type="text" placeholder="Search for an installer..." value={installerSearchTerm} onChange={e => { setInstallerSearchTerm(e.target.value); setSelectedInstaller(null); }} className="w-full p-2 bg-gray-800 border-border rounded" />
                    {installerSearchTerm && !selectedInstaller && (
                      <div className="absolute z-10 w-full bg-gray-900 border border-border rounded-b-md mt-1 max-h-40 overflow-y-auto">
                        {installerSearchResults.map(inst => (
                          <div key={inst.id} onClick={() => handleSelectInstaller(inst)} className="p-2 hover:bg-accent cursor-pointer">{inst.installerName}</div>
                        ))}
                        {installerSearchResults.length === 0 && (
                          <div className="p-2 text-center text-text-secondary">
                            No results. <button type="button" onClick={handleShowAddNewInstaller} className="ml-2 text-accent font-semibold hover:underline">Add it?</button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex justify-end space-x-4 mt-8">
                  <button type="button" onClick={resetProjectModal} className="py-2 px-4 bg-gray-600 hover:bg-gray-700 rounded text-white">Cancel</button>
                  <button type="submit" className="py-2 px-4 bg-primary hover:bg-secondary rounded text-white">Create Project</button>
                </div>
              </form>
            ) : (
              <form onSubmit={handleSaveNewInstaller}>
                <p className="text-sm text-text-secondary mb-2">Adding new installer to library...</p>
                <div className="space-y-4">
                  <input type="text" placeholder="Installer Name" value={newInstallerForm.installerName} onChange={(e) => setNewInstallerForm({ ...newInstallerForm, installerName: e.target.value })} className="w-full p-2 bg-gray-800 border border-border rounded" required />
                  <input type="text" placeholder="Contact Phone (optional)" value={newInstallerForm.contactPhone} onChange={(e) => setNewInstallerForm({ ...newInstallerForm, contactPhone: e.target.value })} className="w-full p-2 bg-gray-800 border border-border rounded" />
                  <input type="email" placeholder="Contact Email (optional)" value={newInstallerForm.contactEmail} onChange={(e) => setNewInstallerForm({ ...newInstallerForm, contactEmail: e.target.value })} className="w-full p-2 bg-gray-800 border border-border rounded" />
                </div>
                <div className="flex justify-end space-x-2 mt-8">
                  <button type="button" onClick={() => setIsAddingNewInstaller(false)} className="py-2 px-4 bg-gray-600 rounded">Back to Project</button>
                  <button type="submit" className="py-2 px-4 bg-primary rounded">Save & Select</button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      <EditCustomerModal
        isOpen={isEditCustomerModalOpen}
        onClose={() => setIsEditCustomerModalOpen(false)}
        customer={customer}
      />
    </div>
  );
};

export default CustomerDetail;