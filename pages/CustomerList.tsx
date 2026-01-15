import React, { useState, useMemo } from 'react';
import { useCustomers } from '../hooks/useCustomers';
import { useProjects } from '../hooks/useProjects';
import { useSampleCheckouts } from '../hooks/useSampleCheckouts';
import { Link } from 'react-router-dom';
import { PlusCircle, Search, User, Mail, Phone, MapPin, Briefcase } from 'lucide-react';
import AddEditCustomerModal from '../components/AddEditCustomerModal';
import ProjectCarousel from '../components/ProjectCarousel'; 
import { Project, ProjectStatus } from '../types';

const formatDateRange = (startDateStr: string | null | undefined, endDateStr: string | null | undefined): string => {
  if (!startDateStr) {
    return 'Not Scheduled';
  }
  const startDate = new Date(startDateStr);
  if (!endDateStr || startDate.toDateString() === new Date(endDateStr).toDateString()) {
    return startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  const endDate = new Date(endDateStr);
  const startMonth = startDate.toLocaleString('default', { month: 'short' });
  const startDay = startDate.getDate();
  const endDay = endDate.getDate();

  return `${startMonth} ${startDay} - ${endDay}`;
};

const CustomerList: React.FC = () => {
  const { data: customers = [] } = useCustomers();
  const { data: projects = [] } = useProjects();
  const { data: sampleCheckouts = [] } = useSampleCheckouts();
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  const samplesOutProjects = useMemo(() => {
    const projectsWithActiveCheckouts = new Set<number>();
    sampleCheckouts.forEach(sc => {
        if (sc.actualReturnDate === null) {
            projectsWithActiveCheckouts.add(sc.projectId);
        }
    });

    return projects
        .filter(p => projectsWithActiveCheckouts.has(p.id))
        .sort((a, b) => {
            const earliestA = Math.min(...sampleCheckouts.filter(sc => sc.projectId === a.id && !sc.actualReturnDate).map(sc => new Date(sc.expectedReturnDate).getTime()));
            const earliestB = Math.min(...sampleCheckouts.filter(sc => sc.projectId === b.id && !sc.actualReturnDate).map(sc => new Date(b.expectedReturnDate).getTime()));
            return earliestA - earliestB;
        });
  }, [projects, sampleCheckouts]);

  const activePipelineProjects = useMemo(() => {
    const statusOrder = {
        [ProjectStatus.QUOTING]: 1,
        [ProjectStatus.ACCEPTED]: 2,
        [ProjectStatus.SCHEDULED]: 3,
    };

    return projects
        .filter(p => 
            p.status === ProjectStatus.QUOTING || 
            p.status === ProjectStatus.ACCEPTED ||
            p.status === ProjectStatus.SCHEDULED
        )
        .sort((a, b) => {
            const orderA = statusOrder[a.status as keyof typeof statusOrder];
            const orderB = statusOrder[b.status as keyof typeof statusOrder];

            if (orderA !== orderB) {
                return orderA - orderB;
            }
            const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
            const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
            return (isNaN(dateB) ? 0 : dateB) - (isNaN(dateA) ? 0 : dateA);
        });
  }, [projects]);

  const filteredCustomers = useMemo(() => {
    if (!customers) return [];
    const lowerCaseSearchTerm = searchTerm.toLowerCase();
    
    return customers.filter(customer => {
      const fullNameMatch = (customer.fullName?.toLowerCase() ?? '').includes(lowerCaseSearchTerm);
      const emailMatch = (customer.email?.toLowerCase() ?? '').includes(lowerCaseSearchTerm);
      return fullNameMatch || emailMatch;
    }).sort((a,b) => a.fullName.localeCompare(b.fullName));
  }, [customers, searchTerm]);

  return (
    <div className="space-y-8">
      {/* Header & Controls - De-boxed */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 px-1">
          <h1 className="text-4xl font-bold text-text-primary tracking-tight">Customers</h1>
          <button onClick={() => setIsModalOpen(true)} className="flex items-center justify-center bg-primary hover:bg-primary-hover text-on-primary font-semibold py-3 px-6 rounded-full transition-all shadow-lg hover:shadow-xl md:w-auto w-full">
            <PlusCircle className="w-5 h-5 mr-2" />
            Add Customer
          </button>
      </div>

      {/* Search Bar - Floating Style */}
      <div className="relative w-full max-w-2xl">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-text-secondary" size={20} />
          <input
            type="text"
            placeholder="Search customers..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-12 pr-6 py-4 bg-surface-container-high border-none rounded-full text-text-primary focus:ring-2 focus:ring-primary/50 outline-none transition-shadow shadow-sm hover:shadow-md placeholder:text-text-tertiary"
          />
      </div>

      {searchTerm === '' && (
        <>
          <ProjectCarousel title="Projects with Samples Out" projects={samplesOutProjects} />
          <ProjectCarousel title="Projects in Active Pipeline" projects={activePipelineProjects} />
          <div className="border-t border-outline/10 my-8"></div>
          <h2 className="text-2xl font-semibold mb-6 text-text-primary pl-1">All Customers</h2>
        </>
      )}
      
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {filteredCustomers.map(customer => (
          <Link to={`/customers/${customer.id}`} key={customer.id} className="block bg-surface-container-high p-6 rounded-xl shadow-sm border border-outline/10 hover:shadow-md hover:-translate-y-1 transition-all duration-300 group">
            <div className="flex items-center mb-4">
              <div className="w-12 h-12 bg-primary-container rounded-full flex items-center justify-center mr-4 shrink-0 text-primary">
                  <User className="w-6 h-6"/>
              </div>
              <div>
                <h2 className="text-xl font-bold text-text-primary truncate">{customer.fullName}</h2>
              </div>
            </div>
            <div className="space-y-2 text-sm text-text-secondary">
                <p className="flex items-center"><Mail className="w-4 h-4 mr-3 shrink-0 opacity-70"/> <span className="truncate">{customer.email || 'N/A'}</span></p>
                <p className="flex items-center"><Phone className="w-4 h-4 mr-3 shrink-0 opacity-70"/> <span className="truncate">{customer.phoneNumber || 'N/A'}</span></p>
                <p className="flex items-center"><MapPin className="w-4 h-4 mr-3 shrink-0 opacity-70"/> <span className="truncate">{customer.address || 'N/A'}</span></p>
            </div>
            {customer.jobs && customer.jobs.length > 0 && (
              <>
                <div className="border-t border-outline/10 my-4"></div>
                <div className="space-y-2">
                  <h3 className="text-sm font-semibold text-text-secondary flex items-center mb-2">
                    <Briefcase className="w-4 h-4 mr-2" />
                    Scheduled Jobs
                  </h3>
                  {customer.jobs.map(job => (
                    <div key={job.projectId} className="text-xs text-text-secondary grid grid-cols-3 gap-2 items-center">
                      <span className="col-span-1 truncate font-medium text-text-primary">{job.projectName}</span>
                      <span className="col-span-1 truncate text-center">({job.installerName || 'N/A'})</span>
                      <span className="col-span-1 truncate text-right">
                        {formatDateRange(job.scheduledStartDate, job.scheduledEndDate)}
                      </span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </Link>
        ))}
        
        {searchTerm !== '' && filteredCustomers.length === 0 && (
            <p className="text-text-secondary col-span-full text-center py-8">No customers match your search.</p>
        )}
      </div>

      <AddEditCustomerModal 
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        customer={null}
      />
    </div>
  );
};

export default CustomerList;