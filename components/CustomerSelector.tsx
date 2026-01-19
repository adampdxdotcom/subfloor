import React, { useState, useMemo } from 'react';
import { useCustomers } from '../hooks/useCustomers'; // Replaced useData
import { Customer } from '../types';
import { UserPlus, Loader } from 'lucide-react'; // Added Loader

// --- MODIFIED: Props now include a callback to request a new customer ---
interface CustomerSelectorProps {
  onCustomerSelect: (customer: Customer) => void;
  onRequestNewCustomer: (name: string) => void;
}

const CustomerSelector: React.FC<CustomerSelectorProps> = ({ onCustomerSelect, onRequestNewCustomer }) => {
  const { data: customers = [], isLoading } = useCustomers();
  const [searchTerm, setSearchTerm] = useState('');

  const searchResults = useMemo(() => {
    if (searchTerm.length < 1 || !customers) return []; 
    return customers.filter(c =>
      c.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (c.email && c.email.toLowerCase().includes(searchTerm.toLowerCase()))
    );
  }, [searchTerm, customers]);

  const handleSelect = (customer: Customer) => {
    onCustomerSelect(customer);
    setSearchTerm('');
  };
  
  return (
    <div className="relative">
      <input
        type="text"
        placeholder="Search by name or email..."
        value={searchTerm}
        onChange={e => setSearchTerm(e.target.value)}
        className="w-full bg-surface-container border border-outline/50 rounded-lg px-4 py-2.5 text-text-primary placeholder:text-text-tertiary focus:ring-2 focus:ring-primary/50 outline-none"
      />
      {searchTerm.length > 0 && (
        <div className="absolute z-10 w-full bg-surface-container-high border border-outline/20 rounded-lg mt-1 shadow-xl max-h-60 overflow-y-auto">
          {isLoading && <div className="p-3 text-text-secondary flex items-center gap-2"><Loader size={16} className="animate-spin" /> Searching...</div>}
          
          {!isLoading && searchResults.map(customer => (
            <div
              key={customer.id}
              onClick={() => handleSelect(customer)}
              className="px-4 py-3 hover:bg-primary-container/30 cursor-pointer border-b border-outline/10 text-text-primary"
            >
              <p className="font-semibold">{customer.fullName}</p>
              <p className="text-sm text-text-secondary">{customer.email}</p>
            </div>
          ))}
          <div
            onClick={() => onRequestNewCustomer(searchTerm)}
            className="p-3 hover:bg-primary-container/30 cursor-pointer flex items-center gap-2 text-primary font-semibold"
          >
            <UserPlus size={18} />
            {searchResults.length > 0 
                ? `Or create new customer "${searchTerm}"`
                : `Create new customer "${searchTerm}"`
            }
          </div>
        </div>
      )}
    </div>
  );
};

export default CustomerSelector;