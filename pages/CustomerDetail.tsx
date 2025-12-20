import React, { useState, useMemo, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useData } from '../context/DataContext';
import { Project, ProjectStatus, ProjectType, PROJECT_TYPES, Installer, SampleCheckout } from '../types';
import { User, Mail, Phone, MapPin, PlusCircle, Edit, Briefcase, ChevronRight, History, Layers } from 'lucide-react';
import AddEditCustomerModal from '../components/AddEditCustomerModal';
import CollapsibleSection from '../components/CollapsibleSection'; // <-- NEW IMPORT
import ActivityHistory from '../components/ActivityHistory';     // <-- NEW IMPORT
import { formatDate } from '../utils/dateUtils';
import * as sampleService from '../services/sampleCheckoutService';
import SampleHistoryCard from '../components/SampleHistoryCard'; // RENAMED IMPORT
import AddProjectModal from '../components/AddProjectModal'; // <-- NEW IMPORT

const CustomerDetail: React.FC = () => {
  const { customerId } = useParams<{ customerId: string }>();
  // vvvvvvvvvvvv ADD NEW ITEMS FROM CONTEXT vvvvvvvvvvvv
  const { customers, projects, addProject, installers, addInstaller, customerHistory, fetchCustomerHistory, systemBranding } = useData();
  // ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
  const navigate = useNavigate();
  
  // State for the "Add Project" modal
  // --- REFACTOR: Using Reusable Modal ---
  const [isProjectModalOpen, setIsProjectModalOpen] = useState(false);
  const [transferSampleId, setTransferSampleId] = useState<number | null>(null);
  const [initialProjectName, setInitialProjectName] = useState('');
  
  const [sampleHistory, setSampleHistory] = useState<SampleCheckout[]>([]);
  const [isEditCustomerModalOpen, setIsEditCustomerModalOpen] = useState(false);
  
  const customer = customers.find(c => c.id === parseInt(customerId || ''));
  const customerProjects = projects.filter(p => p.customerId === customer?.id);
  
  // =================================================================
  //  NEW EFFECT TO FETCH HISTORY & SAMPLES
  // =================================================================
  useEffect(() => {
    if (customerId) {
      const cid = parseInt(customerId);
      fetchCustomerHistory(cid);
      sampleService.getCheckoutsByCustomer(cid).then(setSampleHistory).catch(console.error);
    }
  }, [customerId, fetchCustomerHistory]);
  // =================================================================

  if (!customer) {
    return <div className="text-center text-text-secondary">Customer not found.</div>;
  }

  const handleStartProjectFromSample = (sample: any) => {
      // Pre-fill project modal based on sample info
      const productName = sample.productName || 'Flooring';
      setInitialProjectName(`${productName} Project`);
      setTransferSampleId(sample.id);
      setIsProjectModalOpen(true);
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
          <button onClick={() => { setInitialProjectName(''); setTransferSampleId(null); setIsProjectModalOpen(true); }} className="flex items-center bg-primary hover:bg-secondary text-white font-bold py-2 px-4 rounded-lg transition-colors">
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

      {/* Sample History Section */}
      <div className="mb-8">
        <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold text-text-primary flex items-center"><Layers className="w-6 h-6 mr-3"/> Sample History</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {sampleHistory.map(sample => (
                <SampleHistoryCard 
                    key={sample.id} 
                    sample={sample} 
                    onStartProject={handleStartProjectFromSample} 
                />
            ))}
            {sampleHistory.length === 0 && <p className="col-span-full text-center text-text-secondary py-4">No sample history found.</p>}
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


      <AddProjectModal 
        isOpen={isProjectModalOpen}
        onClose={() => {setIsProjectModalOpen(false); setTransferSampleId(null); setInitialProjectName('');}}
        initialCustomer={customer}
        initialProjectName={initialProjectName}
        transferSampleId={transferSampleId}
      />

      <AddEditCustomerModal
        isOpen={isEditCustomerModalOpen}
        onClose={() => setIsEditCustomerModalOpen(false)}
        customer={customer}
      />
    </div>
  );
};

export default CustomerDetail;