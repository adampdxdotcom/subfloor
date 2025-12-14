import React, { useState, useCallback } from 'react';
import { useData } from '../context/DataContext';
import { Customer, Project, Product } from '../types';
import { X, User, Briefcase, CheckCircle, Calendar, Printer } from 'lucide-react';
import CustomerSelector from './CustomerSelector';
import ProjectSelector from './ProjectSelector';
import SampleSelector, { CheckoutItem } from './SampleSelector'; // Updated
import { toast } from 'react-hot-toast';
import { PrintableCheckout } from './PrintableCheckout';
import EditCustomerModal from './EditCustomerModal';
import AddSampleInlineModal from './AddSampleInlineModal';

const getTwoWeeksFromNowISO = () => {
    const date = new Date();
    date.setDate(date.getDate() + 14);
    return date.toISOString().split('T')[0];
};

interface QuickCheckoutModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const QuickCheckoutModal: React.FC<QuickCheckoutModalProps> = ({ isOpen, onClose }) => {
  const { addSampleCheckout, vendors } = useData(); // FIX: Get vendors from context

  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [checkoutItems, setCheckoutItems] = useState<CheckoutItem[]>([]); // Changed State
  const [expectedReturnDate, setExpectedReturnDate] = useState(getTwoWeeksFromNowISO());
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [checkoutComplete, setCheckoutComplete] = useState(false);

  const [isAddCustomerModalOpen, setIsAddCustomerModalOpen] = useState(false);
  const [customerNameToCreate, setCustomerNameToCreate] = useState('');

  // New Sample Creation State
  const [isAddSampleModalOpen, setIsAddSampleModalOpen] = useState(false);
  const [sampleSearchTerm, setSampleSearchTerm] = useState('');
  const [autoSelectProduct, setAutoSelectProduct] = useState<Product | null>(null);

  const handleItemsChange = useCallback((newItems: CheckoutItem[]) => {
    setCheckoutItems(newItems);
  }, []);

  const handleClose = () => {
    setSelectedCustomer(null);
    setSelectedProject(null);
    setCheckoutItems([]);
    setExpectedReturnDate(getTwoWeeksFromNowISO());
    setCheckoutComplete(false);
    setIsSubmitting(false);
    setIsAddCustomerModalOpen(false);
    setCustomerNameToCreate('');
    setIsAddSampleModalOpen(false);
    setSampleSearchTerm('');
    setAutoSelectProduct(null);
    onClose();
  };
  
  const handleCustomerSelect = (customer: Customer) => {
    setSelectedCustomer(customer);
    setSelectedProject(null);
    setCheckoutItems([]);
  };

  const handleRequestNewCustomer = (name: string) => {
    setCustomerNameToCreate(name);
    setIsAddCustomerModalOpen(true);
  };

  const handleRequestNewSample = (term: string) => {
    setSampleSearchTerm(term);
    setIsAddSampleModalOpen(true);
  };

  const handleSampleCreated = (newSample: any) => {
     setAutoSelectProduct(newSample); // Auto-select the new product in the picker
     setIsAddSampleModalOpen(false);
  };

  const handleFinishCheckout = async () => {
    if (!selectedProject || checkoutItems.length === 0 || !expectedReturnDate) {
      toast.error("Please ensure a project, samples, and a return date are selected.");
      return;
    }
    setIsSubmitting(true);
    const toastId = toast.loading(`Checking out ${checkoutItems.length} item(s)...`);
    try {
        const checkoutPromises = checkoutItems.map(item => 
            addSampleCheckout({
                projectId: selectedProject.id,
                variantId: item.variantId,
                interestVariantId: item.interestVariantId,
                sampleType: item.sampleType,
                quantity: item.quantity,
                expectedReturnDate: new Date(expectedReturnDate).toISOString(),
            })
        );
        await Promise.all(checkoutPromises);
        toast.success(`${checkoutItems.length} item(s) checked out successfully.`, {
            id: toastId,
            icon: <CheckCircle className="text-green-500" />
        });
        setCheckoutComplete(true);
    } catch (error) {
        console.error("Failed to checkout samples:", error);
        toast.error('An error occurred during checkout.', { id: toastId });
    } finally {
        setIsSubmitting(false);
    }
  };

  if (!isOpen) {
    return null;
  }

  return (
    <>
      <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
        
        <div className="print-only">
          <PrintableCheckout 
              customer={selectedCustomer}
              project={selectedProject}
              checkoutItems={checkoutItems} // Changed Prop
              vendors={vendors} 
              returnDate={expectedReturnDate}
          />
        </div>

        <div className="bg-surface p-8 rounded-lg shadow-2xl w-full max-w-4xl h-[90vh] flex flex-col">
          <div className="flex justify-between items-center mb-6 no-print">
            <h2 className="text-2xl font-bold text-text-primary">New Sample Checkout</h2>
            <button onClick={handleClose} className="p-2 rounded-full hover:bg-background">
              <X className="w-6 h-6 text-text-primary" />
            </button>
          </div>

          <fieldset disabled={checkoutComplete} className="flex-1 overflow-y-auto pr-4 space-y-8">
            <section>
              <h3 className="text-lg font-semibold mb-2 border-b border-border pb-2 text-text-primary">1. Customer</h3>
              {!selectedCustomer ? (
                <CustomerSelector 
                  onCustomerSelect={handleCustomerSelect}
                  onRequestNewCustomer={handleRequestNewCustomer} 
                />
              ) : (
                <div className="bg-background p-4 rounded-lg flex justify-between items-center border border-border">
                  <div className="flex items-center gap-3">
                    <User className="w-6 h-6 text-accent" />
                    <div>
                      <p className="font-bold text-lg text-text-primary">{selectedCustomer.fullName}</p>
                      <p className="text-sm text-text-secondary">{selectedCustomer.email}</p>
                    </div>
                  </div>
                  {!checkoutComplete && (
                    <button 
                      onClick={() => {
                        setSelectedCustomer(null);
                        setSelectedProject(null);
                      }}
                      className="text-sm font-semibold text-accent hover:underline no-print"
                    >
                      Change
                    </button>
                  )}
                </div>
              )}
            </section>

            {selectedCustomer && (
              <section>
                <h3 className="text-lg font-semibold mb-2 border-b border-border pb-2 text-text-primary">2. Project</h3>
                {!selectedProject ? (
                  <ProjectSelector 
                      customer={selectedCustomer} 
                      onProjectSelect={(project) => setSelectedProject(project)} 
                  />
                ) : (
                  <div className="bg-background p-4 rounded-lg flex justify-between items-center border border-border">
                      <div className="flex items-center gap-3">
                          <Briefcase className="w-6 h-6 text-accent" />
                          <div>
                              <p className="font-bold text-lg text-text-primary">{selectedProject.projectName}</p>
                              <p className="text-sm text-text-secondary">{selectedProject.projectType}</p>
                          </div>
                      </div>
                      {!checkoutComplete && (
                        <button 
                            onClick={() => setSelectedProject(null)}
                            className="text-sm font-semibold text-accent hover:underline no-print"
                        >
                            Change
                        </button>
                      )}
                  </div>
                )}
              </section>
            )}

            {selectedProject && (
              <section>
                <h3 className="text-lg font-semibold mb-2 border-b border-border pb-2 text-text-primary">3. Samples & Return Date</h3>
                <div className="mb-4">
                  <label htmlFor="returnDate" className="block text-sm font-medium text-text-secondary mb-2">Expected Return Date</label>
                  <div className="relative">
                      <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary w-5 h-5" />
                      <input
                          id="returnDate"
                          type="date"
                          value={expectedReturnDate}
                          onChange={(e) => setExpectedReturnDate(e.target.value)}
                          className="w-full bg-background border border-border rounded-lg py-2 pl-10 pr-4 focus:outline-none focus:ring-2 focus:ring-primary text-text-primary"
                      />
                  </div>
                </div>
                <p className="text-text-secondary mb-4">Search or scan samples to add to the checkout list.</p>
                <SampleSelector 
                    onItemsChange={handleItemsChange} 
                    onRequestNewSample={handleRequestNewSample}
                    externalSelectedProduct={autoSelectProduct}
                />
              </section>
            )}
          </fieldset>

          <div className="mt-8 pt-6 border-t border-border flex justify-end gap-4 no-print">
            {checkoutComplete ? (
              <>
                <button type="button" onClick={handleClose} className="py-2 px-4 bg-secondary hover:bg-secondary-hover rounded text-on-secondary">
                  Close
                </button>
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="py-2 px-6 bg-accent hover:bg-accent-hover rounded text-on-accent flex items-center gap-2"
                >
                  <Printer size={18} />
                  Print Summary
                </button>
              </>
            ) : (
              <>
                <button type="button" onClick={handleClose} className="py-2 px-4 bg-secondary hover:bg-secondary-hover rounded text-on-secondary" disabled={isSubmitting}>
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleFinishCheckout}
                  disabled={!selectedCustomer || !selectedProject || checkoutItems.length === 0 || isSubmitting}
                  className="py-2 px-6 bg-primary hover:bg-primary-hover rounded text-on-primary disabled:opacity-50 disabled-cursor-not-allowed"
                >
                  {isSubmitting ? 'Checking Out...' : `Finish Checkout (${checkoutItems.length})`}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
      
      <EditCustomerModal
        isOpen={isAddCustomerModalOpen}
        onClose={() => setIsAddCustomerModalOpen(false)}
        customer={null}
        initialData={{ fullName: customerNameToCreate }}
      />

      <AddSampleInlineModal
        isOpen={isAddSampleModalOpen}
        onClose={() => setIsAddSampleModalOpen(false)}
        onSampleCreated={handleSampleCreated}
        initialSearchTerm={sampleSearchTerm}
      />
    </>
  );
};

export default QuickCheckoutModal;