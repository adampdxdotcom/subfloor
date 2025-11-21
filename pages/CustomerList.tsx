import React, { useState, useMemo } from 'react';
import { useData } from '../context/DataContext';
import { Link } from 'react-router-dom';
import { PlusCircle, Search, User, Mail, Phone, MapPin, Briefcase } from 'lucide-react';
import EditCustomerModal from '../components/EditCustomerModal';
import ProjectCarousel from '../components/ProjectCarousel'; 
import { Project, ProjectStatus } from '../types';

const formatDateRange = (startDateStr: string | null | undefined, endDateStr: string | null | undefined): string => {
  // --- MODIFIED: Make function robust against null/undefined dates ---
  if (!startDateStr) {
    return 'Not Scheduled';
  }
  const startDate = new Date(startDateStr);
  // If no end date, or end date is same as start, show single day
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
  const { customers, projects, sampleCheckouts } = useData();
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
            const earliestB = Math.min(...sampleCheckouts.filter(sc => sc.projectId === b.id && !sc.actualReturnDate).map(sc => new Date(sc.expectedReturnDate).getTime()));
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
    <div>
      <div className="bg-surface p-6 rounded-lg shadow-md mb-8">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
          <h1 className="text-3xl font-bold text-text-primary">Customers</h1>
          <button onClick={() => setIsModalOpen(true)} className="flex items-center justify-center bg-primary hover:bg-primary-hover text-on-primary font-bold py-2 px-4 rounded-lg transition-colors md:w-auto w-full shadow-md">
            <PlusCircle className="w-5 h-5 mr-2" />
            Add Customer
          </button>
        </div>

        <div className="relative w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary" size={18} />
          <input
            type="text"
            placeholder="Search customers..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-3 bg-background border border-border rounded-lg text-text-primary focus:ring-2 focus:ring-primary outline-none transition-all shadow-inner"
          />
        </div>
      </div>

      {searchTerm === '' && (
        <>
          <ProjectCarousel title="Projects with Samples Out" projects={samplesOutProjects} />
          <ProjectCarousel title="Projects in Active Pipeline" projects={activePipelineProjects} />
          <div className="border-t border-border my-8"></div>
          <h2 className="text-2xl font-semibold mb-6 text-text-primary">All Customers</h2>
        </>
      )}
      
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {filteredCustomers.map(customer => (
          <Link to={`/customers/${customer.id}`} key={customer.id} className="block bg-surface p-6 rounded-lg shadow-md border border-border hover:shadow-xl hover:-translate-y-1 transition-all duration-300">
            <div className="flex items-center mb-4">
              <div className="w-12 h-12 bg-accent rounded-full flex items-center justify-center mr-4 shrink-0 text-on-accent">
                  <User className="w-6 h-6"/>
              </div>
              <div>
                <h2 className="text-xl font-bold text-text-primary truncate">{customer.fullName}</h2>
              </div>
            </div>
            <div className="space-y-2 text-sm text-text-secondary">
                <p className="flex items-center"><Mail className="w-4 h-4 mr-2 shrink-0"/> <span className="truncate">{customer.email || 'N/A'}</span></p>
                <p className="flex items-center"><Phone className="w-4 h-4 mr-2 shrink-0"/> <span className="truncate">{customer.phoneNumber || 'N/A'}</span></p>
                <p className="flex items-center"><MapPin className="w-4 h-4 mr-2 shrink-0"/> <span className="truncate">{customer.address || 'N/A'}</span></p>
            </div>
            {customer.jobs && customer.jobs.length > 0 && (
              <>
                <div className="border-t border-border my-4"></div>
                <div className="space-y-2">
                  <h3 className="text-sm font-semibold text-text-secondary flex items-center mb-2">
                    <Briefcase className="w-4 h-4 mr-2" />
                    Scheduled Jobs
                  </h3>
                  {/* --- MODIFIED: The mapping logic is now fixed --- */}
                  {customer.jobs.map(job => (
                    <div key={job.projectId} className="text-xs text-text-secondary grid grid-cols-3 gap-2 items-center">
                      <span className="col-span-1 truncate font-medium text-text-primary">{job.projectName}</span>
                      <span className="col-span-1 truncate text-center">({job.installerName || 'N/A'})</span>
                      <span className="col-span-1 truncate text-right">
                        {/* Use the correct camelCase properties and the robust formatDateRange function */}
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

      <EditCustomerModal 
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        customer={null}
      />
    </div>
  );
};

export default CustomerList;