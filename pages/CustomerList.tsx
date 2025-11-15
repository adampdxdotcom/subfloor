import React, { useState, useMemo } from 'react';
import { useData } from '../context/DataContext';
import { Link } from 'react-router-dom';
import { PlusCircle, Search, User, Mail, Phone, MapPin, Briefcase } from 'lucide-react';
// --- MODIFIED: Import the correct modal component ---
import EditCustomerModal from '../components/EditCustomerModal';

const formatDateRange = (startDateStr: string, endDateStr: string): string => {
  const startDate = new Date(startDateStr);
  const endDate = new Date(endDateStr);

  const startMonth = startDate.toLocaleString('default', { month: 'short' });
  const startDay = startDate.getDate();
  const endDay = endDate.getDate();

  if (startDay === endDay) {
    return `${startMonth} ${startDay}`;
  }
  return `${startMonth} ${startDay} - ${endDay}`;
};

const CustomerList: React.FC = () => {
  // --- MODIFIED: Removed state that is no longer needed ---
  const { customers } = useData();
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  const filteredCustomers = useMemo(() => {
    if (!customers) return [];
    const lowerCaseSearchTerm = searchTerm.toLowerCase();
    
    return customers.filter(customer => {
      const fullNameMatch = (customer.fullName?.toLowerCase() ?? '').includes(lowerCaseSearchTerm);
      const emailMatch = (customer.email?.toLowerCase() ?? '').includes(lowerCaseSearchTerm);
      return fullNameMatch || emailMatch;
    });
  }, [customers, searchTerm]);

  // --- REMOVED: The old, incorrect submit handler is no longer needed ---
  // const handleAddCustomer = (e: React.FormEvent) => { ... };

  return (
    <div>
      <div className="flex flex-col md:flex-row justify-between md:items-center mb-6 gap-4">
        <h1 className="text-3xl font-bold text-text-primary">Customers</h1>
        <button onClick={() => setIsModalOpen(true)} className="flex items-center justify-center bg-primary hover:bg-secondary text-white font-bold py-2 px-4 rounded-lg transition-colors md:w-auto w-full">
          <PlusCircle className="w-5 h-5 mr-2" />
          Add Customer
        </button>
      </div>

      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" />
        <input
          type="text"
          placeholder="Search customers..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full bg-surface border border-border rounded-lg py-2 pl-10 pr-4 focus:outline-none focus:ring-2 focus:ring-accent"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {filteredCustomers.map(customer => (
          <Link to={`/customers/${customer.id}`} key={customer.id} className="block bg-surface p-6 rounded-lg shadow-md hover:shadow-xl hover:-translate-y-1 transition-all duration-300">
            <div className="flex items-center mb-4">
              <div className="w-12 h-12 bg-accent rounded-full flex items-center justify-center mr-4 shrink-0">
                  <User className="w-6 h-6 text-white"/>
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
                  {customer.jobs.map(job => (
                    <div key={job.projectId} className="text-xs text-text-secondary grid grid-cols-3 gap-2 items-center">
                      <span className="col-span-1 truncate font-medium text-text-primary">{job.projectName}</span>
                      <span className="col-span-1 truncate text-center">({job.installerName || 'N/A'})</span>
                      <span className="col-span-1 truncate text-right">{formatDateRange(job.scheduledStartDate, job.scheduledEndDate)}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </Link>
        ))}
      </div>

      {/* --- MODIFIED: Replaced the entire hardcoded modal with our component --- */}
      <EditCustomerModal 
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        customer={null} // Passing null tells the modal to be in "Add" mode
      />
    </div>
  );
};

export default CustomerList;