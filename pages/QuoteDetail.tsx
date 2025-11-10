import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useData } from '../context/DataContext';
import { Quote, Project, Customer, Installer, QuoteStatus } from '../types';
import { FileText, DollarSign, User, Calendar } from 'lucide-react';

const QuoteDetail: React.FC = () => {
  const { quoteId } = useParams<{ quoteId: string }>();
  const { projects, customers, installers } = useData(); 
  
  const [quote, setQuote] = useState<Quote | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Derived state, calculated after data is loaded
  const project = projects.find(p => p.id === quote?.projectId);
  const customer = customers.find(c => c.id === project?.customerId);
  const installer = installers.find(i => i.id === quote?.installerId);

  useEffect(() => {
    const fetchQuote = async () => {
      if (!quoteId) return;
      setIsLoading(true);
      try {
        const response = await fetch(`/api/quotes/${quoteId}`);
        if (!response.ok) throw new Error('Quote not found');
        const data = await response.json();
        setQuote(data);
      } catch (error) {
        console.error("Failed to fetch quote:", error);
        setQuote(null);
      } finally {
        setIsLoading(false);
      }
    };

    fetchQuote();
  }, [quoteId]);
  
  const getStatusInfo = (status: QuoteStatus) => {
    if (status === QuoteStatus.ACCEPTED) return { color: 'border-green-500 bg-green-500/10 text-green-400', text: 'Accepted' };
    if (status === QuoteStatus.REJECTED) return { color: 'border-red-500 bg-red-500/10 text-red-400', text: 'Rejected' };
    return { color: 'border-blue-500 bg-blue-500/10 text-blue-400', text: 'Sent' };
  };

  if (isLoading) {
    return <div className="text-center">Loading quote details...</div>;
  }

  if (!quote) {
    return <div className="text-center">Quote not found.</div>;
  }

  const statusInfo = getStatusInfo(quote.status);

  return (
    <div className="container mx-auto p-4">
      {/* Header */}
      <div className="bg-surface p-6 rounded-lg shadow-lg mb-8">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold text-text-primary flex items-center">
              <FileText className="w-8 h-8 mr-4 text-accent"/>
              Quote Details
            </h1>
            {project && customer && (
              <p className="text-lg text-text-secondary mt-2">
                For project <Link to={`/projects/${project.id}`} className="font-semibold text-accent hover:underline">{project.projectName}</Link> of customer <Link to={`/customers/${customer.id}`} className="font-semibold text-accent hover:underline">{customer.fullName}</Link>
              </p>
            )}
          </div>
          <div className={`text-lg font-bold px-4 py-2 rounded-lg border-2 ${statusInfo.color}`}>
            {statusInfo.text}
          </div>
        </div>
      </div>

      {/* Details Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-surface p-6 rounded-lg shadow-md">
          <h2 className="text-xl font-semibold mb-4 text-text-primary flex items-center"><DollarSign className="w-6 h-6 mr-3 text-accent"/>Amount</h2>
          <p className="text-5xl font-bold text-text-primary">${parseFloat(quote.amount as any).toFixed(2)}</p>
        </div>
        <div className="bg-surface p-6 rounded-lg shadow-md">
          <h2 className="text-xl font-semibold mb-4 text-text-primary flex items-center"><User className="w-6 h-6 mr-3 text-accent"/>Installer</h2>
          <p className="text-2xl font-semibold text-text-primary">{installer?.installerName || 'Loading...'}</p>
        </div>
        <div className="bg-surface p-6 rounded-lg shadow-md col-span-full">
          <h2 className="text-xl font-semibold mb-4 text-text-primary">Details</h2>
          <p className="text-text-secondary whitespace-pre-wrap">{quote.quoteDetails}</p>
        </div>
        <div className="bg-surface p-6 rounded-lg shadow-md col-span-full">
           <h2 className="text-xl font-semibold mb-4 text-text-primary flex items-center"><Calendar className="w-6 h-6 mr-3 text-accent"/>Timeline</h2>
           <p className="text-text-secondary">Date Sent: {new Date(quote.dateSent).toLocaleDateString()}</p>
        </div>
      </div>
    </div>
  );
};

export default QuoteDetail;