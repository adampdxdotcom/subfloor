import React, { useState, useMemo } from 'react';
import { useData } from '../context/DataContext';
import { Customer } from '../types';
import { UserPlus } from 'lucide-react';

interface CustomerSelectorProps {
  onCustomerSelect: (customer: Customer) => void;
}

const CustomerSelector: React.FC<CustomerSelectorProps> = ({ onCustomerSelect }) => {
  const { customers, addCustomer } = useData();
  const [searchTerm, setSearchTerm] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [newCustomerForm, setNewCustomerForm] = useState({ fullName: '', email: '', phoneNumber: '', address: '' });

  const searchResults = useMemo(() => {
    if (searchTerm.length < 2) return [];
    return customers.filter(c =>
      c.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.email?.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [searchTerm, customers]);

  const handleCreateNewCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCustomerForm.fullName || !newCustomerForm.email) {
        alert("Full Name and Email are required to create a new customer.");
        return;
    }
    try {
      // addCustomer now lives in DataContext and doesn't return the new customer directly
      // So we will add it and then find it in the updated list. This is a bit of a workaround.
      // A better long-term solution would be for addCustomer to return the new customer.
      await addCustomer(newCustomerForm);
      // For now, let's assume the last customer in the list is the one we just added.
      // This is not robust, but will work for now. We can refine this later.
      // Let's refetch and find.
      const response = await fetch('/api/customers');
      const allCustomers = await response.json();
      const newCustomer = allCustomers.find((c: Customer) => c.email === newCustomerForm.email);

      if (newCustomer) {
        handleSelect(newCustomer);
      }

    } catch (error) {
      console.error("Failed to create customer", error);
    }
  };

  const handleSelect = (customer: Customer) => {
    onCustomerSelect(customer);
    setSearchTerm('');
    setIsCreating(false);
  };
  
  if (isCreating) {
    return (
      <form onSubmit={handleCreateNewCustomer} className="p-4 bg-gray-800 rounded-lg border border-border space-y-4">
        <h4 className="font-semibold">Create New Customer</h4>
        <input type="text" placeholder="Full Name*" required value={newCustomerForm.fullName} onChange={e => setNewCustomerForm({...newCustomerForm, fullName: e.target.value})} className="w-full p-2 bg-gray-900 border-border rounded" />
        <input type="email" placeholder="Email*" required value={newCustomerForm.email} onChange={e => setNewCustomerForm({...newCustomerForm, email: e.target.value})} className="w-full p-2 bg-gray-900 border-border rounded" />
        <input type="tel" placeholder="Phone Number" value={newCustomerForm.phoneNumber} onChange={e => setNewCustomerForm({...newCustomerForm, phoneNumber: e.target.value})} className="w-full p-2 bg-gray-900 border-border rounded" />
        <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setIsCreating(false)} className="py-2 px-4 bg-gray-600 rounded">Back to Search</button>
            <button type="submit" className="py-2 px-4 bg-primary rounded">Save Customer</button>
        </div>
      </form>
    )
  }

  return (
    <div className="relative">
      <input
        type="text"
        placeholder="Search by name or email..."
        value={searchTerm}
        onChange={e => setSearchTerm(e.target.value)}
        className="w-full p-3 bg-gray-800 border-2 border-border rounded-lg"
      />
      {searchTerm.length > 1 && (
        <div className="absolute z-10 w-full bg-surface border border-border rounded-b-lg mt-1 shadow-lg max-h-60 overflow-y-auto">
          {searchResults.map(customer => (
            <div
              key={customer.id}
              onClick={() => handleSelect(customer)}
              className="p-3 hover:bg-accent cursor-pointer border-b border-border"
            >
              <p className="font-semibold">{customer.fullName}</p>
              <p className="text-sm text-text-secondary">{customer.email}</p>
            </div>
          ))}
          <div
            onClick={() => setIsCreating(true)}
            className="p-3 hover:bg-accent cursor-pointer flex items-center gap-2 text-accent font-semibold"
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