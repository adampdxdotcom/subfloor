import React from 'react';
import { useParams, Link } from 'react-router-dom';
import { useProjects } from '../hooks/useProjects';
import { useCustomers } from '../hooks/useCustomers';
import { useInstallers } from '../hooks/useInstallers';
import { useQuotes } from '../hooks/useQuotes';
import { QuoteStatus } from '../types';
import { FileText, DollarSign, Calendar, HardHat } from 'lucide-react';

const QuoteDetail: React.FC = () => {
  const { quoteId } = useParams<{ quoteId: string }>();
  const numericQuoteId = quoteId ? parseInt(quoteId, 10) : undefined;

  // REFACTOR: Use the shared hook and find locally
  const { data: quotes = [], isLoading } = useQuotes();
  const quote = quotes.find(q => q.id === numericQuoteId);

  const { data: projects = [] } = useProjects();
  const { data: customers = [] } = useCustomers();
  const { data: installers = [] } = useInstallers();

  // Derived state, calculated after data is loaded
  const project = projects.find(p => p.id === quote?.projectId);
  const customer = customers.find(c => c.id === project?.customerId);
  const installer = installers.find(i => i.id === quote?.installerId);
  
  const getStatusInfo = (status: QuoteStatus) => {
    if (status === QuoteStatus.ACCEPTED) return { color: 'bg-primary-container text-primary', text: 'Accepted' };
    if (status === QuoteStatus.REJECTED) return { color: 'bg-error-container text-error', text: 'Rejected' };
    return { color: 'bg-secondary-container text-text-secondary', text: 'Sent' };
  };

  if (isLoading) {
    return <div className="text-center p-8 text-text-secondary">Loading quote details...</div>;
  }

  if (!quote) {
    return <div className="text-center p-8 text-text-secondary">Quote not found.</div>;
  }

  const statusInfo = getStatusInfo(quote.status);

  return (
    <div className="space-y-8">
      {/* Header (De-boxed MD3 Style) */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 px-1">
          <div>
            <h1 className="text-4xl font-bold text-text-primary tracking-tight">Quote Details</h1>
            {project && customer && (
              <p className="text-md text-text-secondary mt-2">
                For <Link to={`/projects/${project.id}`} className="font-semibold text-primary hover:underline">{project.projectName}</Link>
              </p>
            )}
          </div>
          <div className={`text-sm font-bold px-4 py-1.5 rounded-full ${statusInfo.color}`}>
            {statusInfo.text}
          </div>
      </div>

      {/* Main Content Card */}
      <div className="bg-surface-container-high rounded-2xl shadow-sm p-6 md:p-8 border border-outline/10">
        {/* Top Row: Amount & Installer */}
        <div className="grid md:grid-cols-2 gap-8">
          <div>
            <h2 className="text-lg font-semibold mb-3 text-text-primary flex items-center gap-3">
                <div className="p-2 bg-primary-container rounded-full text-primary">
                    <DollarSign size={18}/>
                </div>
                Materials Amount
            </h2>
            <p className="text-5xl font-bold text-text-primary tracking-tight">
                ${parseFloat(quote.materialsAmount as any || 0).toFixed(2)}
            </p>
            <h2 className="text-lg font-semibold mt-4 mb-3 text-text-primary flex items-center gap-3">
                <div className="p-2 bg-primary-container rounded-full text-primary">
                    <DollarSign size={18}/>
                </div>
                Labor Amount
            </h2>
            <p className="text-5xl font-bold text-text-primary tracking-tight">
                ${parseFloat(quote.laborAmount as any || 0).toFixed(2)}
            </p>
          </div>
          <div>
            <h2 className="text-lg font-semibold mb-3 text-text-primary flex items-center gap-3">
                <div className="p-2 bg-primary-container rounded-full text-primary">
                    <HardHat size={18}/>
                </div>
                Assigned Installer
            </h2>
            {installer ? (
              <Link to={`/installers/${installer.id}`} className="text-2xl font-bold text-text-primary hover:text-primary transition-colors">
                {installer.installerName}
              </Link>
            ) : (
              <p className="text-2xl font-semibold text-text-secondary">Not Assigned</p>
            )}
          </div>
        </div>

        <div className="border-t border-outline/10 my-8"></div>

        {/* Details Section */}
        <div>
          <h2 className="text-lg font-semibold mb-4 text-text-primary flex items-center gap-3">
             <FileText className="w-5 h-5 text-primary"/> Details
          </h2>
          <div className="bg-surface-container-low p-5 rounded-xl border border-outline/5">
            <p className="text-text-primary whitespace-pre-wrap leading-relaxed">{quote.quoteDetails || 'No details provided.'}</p>
          </div>
        </div>

        <div className="border-t border-outline/10 my-8"></div>

        {/* Timeline Section */}
        <div>
           <h2 className="text-lg font-semibold mb-3 text-text-primary flex items-center gap-3">
             <Calendar className="w-5 h-5 text-primary"/> Timeline
           </h2>
           <p className="text-text-secondary font-medium">
             Sent on: <span className="text-text-primary">{new Date(quote.dateSent).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</span>
           </p>
        </div>

      </div>
    </div>
  );
};

export default QuoteDetail;