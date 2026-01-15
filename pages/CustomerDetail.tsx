import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useData } from '../context/DataContext';
import { SampleCheckout } from '../types';
import { User, Mail, Phone, MapPin, PlusCircle, Edit, Briefcase, ChevronRight, History, Layers } from 'lucide-react';
import AddEditCustomerModal from '../components/AddEditCustomerModal';
import CollapsibleSection from '../components/CollapsibleSection';
import ActivityHistory from '../components/ActivityHistory';
import { formatDate } from '../utils/dateUtils';
import * as sampleService from '../services/sampleCheckoutService';
import SampleHistoryCard from '../components/SampleHistoryCard';
import AddProjectModal from '../components/AddProjectModal';

const CustomerDetail: React.FC = () => {
  const { customerId } = useParams<{ customerId: string }>();
  const { customers, projects, fetchCustomerHistory, customerHistory, systemBranding } = useData();
  const navigate = useNavigate();
  
  const [isProjectModalOpen, setIsProjectModalOpen] = useState(false);
  const [transferSampleId, setTransferSampleId] = useState<number | null>(null);
  const [initialProjectName, setInitialProjectName] = useState('');
  
  const [sampleHistory, setSampleHistory] = useState<SampleCheckout[]>([]);
  const [isEditCustomerModalOpen, setIsEditCustomerModalOpen] = useState(false);
  
  const customer = customers.find(c => c.id === parseInt(customerId || ''));
  const customerProjects = projects.filter(p => p.customerId === customer?.id);
  
  useEffect(() => {
    if (customerId) {
      const cid = parseInt(customerId);
      fetchCustomerHistory(cid);
      sampleService.getCheckoutsByCustomer(cid).then(setSampleHistory).catch(console.error);
    }
  }, [customerId, fetchCustomerHistory]);

  if (!customer) {
    return <div className="text-center text-text-secondary">Customer not found.</div>;
  }

  const handleStartProjectFromSample = (sample: any) => {
      const productName = sample.productName || 'Flooring';
      setInitialProjectName(`${productName} Project`);
      setTransferSampleId(sample.id);
      setIsProjectModalOpen(true);
  };

  return (
    <div className="space-y-8">
      {/* Customer Header Section - De-boxed MD3 Style */}
      <div className="bg-surface-container-high p-8 rounded-xl shadow-sm border border-outline/10">
        <div className="flex flex-col md:flex-row justify-between items-start">
          <div className="flex items-center mb-4 md:mb-0">
             <div className="w-16 h-16 bg-primary-container rounded-full flex items-center justify-center mr-6 text-primary">
                  <User className="w-8 h-8"/>
              </div>
            <div>
              <h1 className="text-3xl font-bold text-text-primary">{customer.fullName}</h1>
              <p className="text-text-secondary">Customer since {formatDate(customer.createdAt, systemBranding?.systemTimezone)}</p>
            </div>
          </div>
          <button 
            onClick={() => setIsEditCustomerModalOpen(true)}
            className="flex items-center bg-surface-container-highest hover:bg-surface-container border border-outline/20 text-text-primary font-medium py-2 px-4 rounded-lg transition-colors"
          >
            <Edit className="w-4 h-4 mr-2" />
            Edit Customer
          </button>
        </div>
        <div className="border-t border-outline/10 my-6"></div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-text-secondary">
          <p className="flex items-center"><Mail className="w-5 h-5 mr-3 text-primary opacity-80"/> {customer.email}</p>
          <p className="flex items-center"><Phone className="w-5 h-5 mr-3 text-primary opacity-80"/> {customer.phoneNumber}</p>
          <p className="flex items-center col-span-full"><MapPin className="w-5 h-5 mr-3 text-primary opacity-80"/> {customer.address}</p>
        </div>
      </div>
      
      {/* Projects Section */}
      <div>
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-text-primary flex items-center gap-3"><Briefcase className="w-6 h-6"/> Projects</h2>
          <button onClick={() => { setInitialProjectName(''); setTransferSampleId(null); setIsProjectModalOpen(true); }} className="flex items-center bg-primary hover:bg-primary-hover text-on-primary font-semibold py-2 px-4 rounded-full shadow-md transition-colors">
            <PlusCircle className="w-5 h-5 mr-2" />
            New Project
          </button>
        </div>
        <div className="space-y-4">
          {customerProjects.length > 0 ? customerProjects.map(project => (
            <Link to={`/projects/${project.id}`} key={project.id} className="flex justify-between items-center bg-surface-container-high p-5 rounded-xl border border-outline/10 shadow-sm hover:shadow-md hover:bg-surface-container-highest transition-all group">
              <div>
                <h3 className="font-semibold text-lg text-text-primary">{project.projectName}</h3>
                <p className="text-sm text-text-secondary flex items-center gap-2 mt-1">
                    <span className={`w-2 h-2 rounded-full ${project.status === 'Completed' ? 'bg-success' : 'bg-primary'}`}></span>
                    {project.status}
                </p>
              </div>
              <ChevronRight className="w-6 h-6 text-text-secondary group-hover:text-primary transition-colors"/>
            </Link>
          )) : (
            <p className="text-center text-text-secondary py-4">No projects for this customer yet.</p>
          )}
        </div>
      </div>

      {/* Sample History Section */}
      <div>
        <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold text-text-primary flex items-center gap-3"><Layers className="w-6 h-6"/> Sample History</h2>
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
      
      {/* Change History Section */}
      <div>
        <CollapsibleSection
          title="Change History"
          icon={<History className="w-6 h-6" />}
          defaultOpen={false}
        >
          <ActivityHistory history={customerHistory} />
        </CollapsibleSection>
      </div>


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