// components/CustomerCarousel.tsx

import React from 'react';
import { Link } from 'react-router-dom';
import { Customer } from '../types'; // Make sure to import the Customer type
import { ChevronRight, User } from 'lucide-react';

// A simple card component specifically for displaying a customer.
const CustomerCard = ({ customer }: { customer: Customer }) => {
    return (
        <Link 
            to={`/customers/${customer.id}`} 
            className="block bg-surface-container-high p-4 rounded-xl shadow-sm border border-outline/10 hover:shadow-md hover:-translate-y-1 transition-all duration-300 w-80 flex-shrink-0"
        >
            <div className="flex justify-between items-center">
                <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-primary-container rounded-full flex items-center justify-center mr-2 shrink-0 text-primary">
                        <User className="w-5 h-5"/>
                    </div>
                    <div>
                        <h3 className="font-bold text-md text-text-primary truncate">{customer.fullName}</h3>
                        <p className="text-sm text-text-secondary truncate">{customer.phoneNumber || 'No phone number'}</p>
                    </div>
                </div>
                <ChevronRight className="w-5 h-5 text-text-secondary flex-shrink-0"/>
            </div>
        </Link>
    );
};

// The carousel container, modeled directly after ProjectCarousel.
const CustomerCarousel = ({ title, customers }: { title: string, customers: Customer[] }) => {
    return (
        <div>
            <h2 className="text-2xl font-semibold mb-4 text-text-primary px-1">{title}</h2>
            {customers.length > 0 ? (
                <div className="flex gap-6 overflow-x-auto pb-4 -mx-4 px-4">
                    {customers.map(customer => (
                        <CustomerCard key={customer.id} customer={customer} />
                    ))}
                </div>
            ) : (
                <p className="text-text-secondary italic">No customers in this category.</p>
            )}
        </div>
    );
};

export default CustomerCarousel;