import React, { useState, useMemo } from 'react';
import { useData } from '../context/DataContext';
import { Customer } from '../types';
import { UserPlus } from 'lucide-react';

// --- MODIFIED: Props now include a callback to request a new customer ---
interface CustomerSelectorProps {
  onCustomerSelect: (customer: Customer) => void;
  onRequestNewCustomer: (name: string) => void;
}

const CustomerSelector: React.FC<CustomerSelectorProps> = ({ onCustomerSelect, onRequestNewCustomer }) => {
  const { customers } = useData();
  const [searchTerm, setSearchTerm] = useState('');

  const searchResults = useMemo(() => {
    if (searchTerm.length < 1) return []; // Show results even on 1 character
    return customers.filter(c =>
      c.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.email?.toLowerCase().includes(searchTerm.toLowerCase())
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
        className="w-full p-3 bg-background text-text-primary border-2 border-border rounded-lg"
      />
      {searchTerm.length > 0 && (
        <div className="absolute z-10 w-full bg-surface border border-border rounded-b-lg mt-1 shadow-lg max-h-60 overflow-y-auto">
          {searchResults.map(customer => (
            <div
              key={customer.id}
              onClick={() => handleSelect(customer)}
              className="p-3 hover:bg-background cursor-pointer border-b border-border text-text-primary"
            >
              <p className="font-semibold">{customer.fullName}</p>
              <p className="text-sm text-text-secondary">{customer.email}</p>
            </div>
          ))}
          {/* --- MODIFIED: This now calls the parent component with the search term --- */}
          <div
            onClick={() => onRequestNewCustomer(searchTerm)}
            className="p-3 hover:bg-background cursor-pointer flex items-center gap-2 text-accent font-semibold"
          >
            <UserPlus size={18} />
            Create New Customer "{searchTerm}"
          </div>
        </div>
      )}
    </div>
  );
};

export default CustomerSelector;