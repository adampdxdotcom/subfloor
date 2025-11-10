import React, { useState, useMemo } from 'react';
import { useData } from '../context/DataContext';
import { Link } from 'react-router-dom';
import { PlusCircle, Search, User, Mail, Phone, MapPin, Briefcase } from 'lucide-react';

const formatDateRange = (startDateStr: string, endDateStr: string): string => {
  // ... (no changes in this function)
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
  const { customers, addCustomer } = useData();
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newCustomer, setNewCustomer] = useState({ fullName: '', email: '', phoneNumber: '', address: '' });

  const filteredCustomers = useMemo(() => {
    if (!customers) return [];
    const lowerCaseSearchTerm = searchTerm.toLowerCase();
    
    return customers.filter(customer => {
      const fullNameMatch = (customer.fullName?.toLowerCase() ?? '').includes(lowerCaseSearchTerm);
      const emailMatch = (customer.email?.toLowerCase() ?? '').includes(lowerCaseSearchTerm);
      return fullNameMatch || emailMatch;
    });
  }, [customers, searchTerm]);

  const handleAddCustomer = (e: React.FormEvent) => {
    e.preventDefault();
    if (newCustomer.fullName && newCustomer.email) {
        addCustomer(newCustomer);
        setIsModalOpen(false);
        setNewCustomer({ fullName: '', email: '', phoneNumber: '', address: '' });
    }
  };

  return (
    <div>
      {/* --- MODIFICATION: Header stacks on mobile --- */}
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

      {/* --- MODIFICATION: Grid is now responsive --- */}
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

      {isModalOpen && (
        // ... (no changes to the modal)
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
          <div className="bg-surface p-8 rounded-lg shadow-2xl w-full max-w-md">
            <h2 className="text-2xl font-bold mb-6 text-text-primary">Add New Customer</h2>
            <form onSubmit={handleAddCustomer}>
              <div className="space-y-4">
                <input type="text" placeholder="Full Name" value={newCustomer.fullName} onChange={(e) => setNewCustomer({ ...newCustomer, fullName: e.target.value })} className="w-full p-2 bg-gray-800 border border-border rounded" required />
                <input type="email" placeholder="Email" value={newCustomer.email} onChange={(e) => setNewCustomer({ ...newCustomer, email: e.target.value })} className="w-full p-2 bg-gray-800 border border-border rounded" required />
                <input type="tel" placeholder="Phone Number" value={newCustomer.phoneNumber} onChange={(e) => setNewCustomer({ ...newCustomer, phoneNumber: e.target.value })} className="w-full p-2 bg-gray-800 border border-border rounded" />
                <input type="text" placeholder="Address" value={newCustomer.address} onChange={(e) => setNewCustomer({ ...newCustomer, address: e.target.value })} className="w-full p-2 bg-gray-800 border border-border rounded" />
              </div>
              <div className="flex justify-end space-x-4 mt-6">
                <button type="button" onClick={() => setIsModalOpen(false)} className="py-2 px-4 bg-gray-600 hover:bg-gray-700 rounded text-white">Cancel</button>
                <button type="submit" className="py-2 px-4 bg-primary hover:bg-secondary rounded text-white">Add Customer</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default CustomerList;