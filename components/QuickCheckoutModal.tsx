import React, { useState, useCallback } from 'react';
import { useData } from '../context/DataContext';
import { Customer, Project, Product, Installer } from '../types';
import { X, User, Briefcase, CheckCircle, Calendar, Printer, HardHat } from 'lucide-react';
import CustomerSelector from './CustomerSelector';
import ProjectSelector from './ProjectSelector';
import SampleSelector, { CheckoutItem } from './SampleSelector'; 
import { toast } from 'react-hot-toast';
import ModalPortal from './ModalPortal';
import { PrintableCheckout } from './PrintableCheckout';
import AddEditCustomerModal from './AddEditCustomerModal';
import AddSampleInlineModal from './AddSampleInlineModal';
import Select from 'react-select';

const getTwoWeeksFromNowISO = () => {
    const date = new Date();
    date.setDate(date.getDate() + 3);
    return date.toISOString().split('T')[0];
};

type CheckoutTarget = 'PROJECT' | 'CUSTOMER' | 'INSTALLER';

interface QuickCheckoutModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const QuickCheckoutModal: React.FC<QuickCheckoutModalProps> = ({ isOpen, onClose }) => {
  const { addSampleCheckout, installers } = useData(); 

  // --- STATE ---
  const [checkoutTarget, setCheckoutTarget] = useState<CheckoutTarget>('PROJECT');
  
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [selectedInstaller, setSelectedInstaller] = useState<Installer | null>(null);
  
  const [checkoutItems, setCheckoutItems] = useState<CheckoutItem[]>([]);
  const [expectedReturnDate, setExpectedReturnDate] = useState(getTwoWeeksFromNowISO());
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [checkoutComplete, setCheckoutComplete] = useState(false);

  const [isAddCustomerModalOpen, setIsAddCustomerModalOpen] = useState(false);
  const [customerNameToCreate, setCustomerNameToCreate] = useState('');

  const [isAddSampleModalOpen, setIsAddSampleModalOpen] = useState(false);
  const [sampleSearchTerm, setSampleSearchTerm] = useState('');
  const [autoSelectProduct, setAutoSelectProduct] = useState<Product | null>(null);

  const handleItemsChange = useCallback((newItems: CheckoutItem[]) => {
    setCheckoutItems(newItems);
  }, []);

  const handleClose = () => {
    setCheckoutTarget('PROJECT');
    setSelectedCustomer(null);
    setSelectedProject(null);
    setSelectedInstaller(null);
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
     setAutoSelectProduct(newSample);
     setIsAddSampleModalOpen(false);
  };

  const handleFinishCheckout = async () => {
    if (checkoutItems.length === 0) { toast.error("Please add at least one sample."); return; }
    if (!expectedReturnDate) { toast.error("Please select a return date."); return; }

    if (checkoutTarget === 'PROJECT' && !selectedProject) { toast.error("Please select a project."); return; }
    if (checkoutTarget === 'CUSTOMER' && !selectedCustomer) { toast.error("Please select a customer."); return; }
    if (checkoutTarget === 'INSTALLER' && !selectedInstaller) { toast.error("Please select an installer."); return; }

    setIsSubmitting(true);
    const toastId = toast.loading(`Checking out ${checkoutItems.length} item(s)...`);
    try {
        const checkoutPromises = checkoutItems.map(item => 
            addSampleCheckout({
                projectId: checkoutTarget === 'PROJECT' ? selectedProject!.id : undefined,
                customerId: checkoutTarget === 'CUSTOMER' ? selectedCustomer!.id : undefined,
                installerId: checkoutTarget === 'INSTALLER' ? selectedInstaller!.id : undefined,
                
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

  const printableRecipient = 
    checkoutTarget === 'PROJECT' ? selectedCustomer :
    checkoutTarget === 'CUSTOMER' ? selectedCustomer :
    checkoutTarget === 'INSTALLER' ? selectedInstaller :
    null;

  return (
    <ModalPortal>
      <>
        <div className="fixed inset-0 bg-scrim/60 z-50 overflow-y-auto">
          
          <div className="print-only">
            <PrintableCheckout 
                customer={printableRecipient as Customer} 
                project={selectedProject}
                checkoutItems={checkoutItems} 
                returnDate={expectedReturnDate}
            />
          </div>

          <div className="flex min-h-full items-center justify-center p-0 lg:p-4">
          <div className="bg-surface-container-high w-full h-full lg:h-auto lg:max-h-[90vh] lg:max-w-4xl lg:rounded-2xl shadow-2xl flex flex-col border border-outline/20 relative">
            
            <div className="p-4 border-b border-outline/10 flex justify-between items-center lg:rounded-t-2xl sticky top-0 z-20 no-print bg-surface-container-high">
              <h2 className="text-xl font-bold text-text-primary">New Sample Checkout</h2>
              <button onClick={handleClose} className="p-2 rounded-full hover:bg-surface-container-highest text-text-secondary hover:text-text-primary">
                <X className="w-6 h-6" />
              </button>
            </div>

            <fieldset disabled={checkoutComplete} className="flex-1 overflow-y-auto p-4 md:p-8 space-y-8">
              
              {/* 0. TARGET SELECTION */}
              <section>
                  <h3 className="text-lg font-semibold mb-4 text-text-primary px-1">Who is this for?</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                      <button 
                          onClick={() => setCheckoutTarget('PROJECT')}
                          className={`p-4 rounded-xl border-2 flex flex-col items-center gap-2 transition-all ${checkoutTarget === 'PROJECT' ? 'border-primary bg-primary-container/30 text-primary' : 'border-outline/20 bg-surface-container text-text-secondary hover:border-primary/50'}`}
                      >
                          <Briefcase size={24} />
                          <span className="font-bold">Project</span>
                      </button>
                      <button 
                          onClick={() => setCheckoutTarget('CUSTOMER')}
                          className={`p-4 rounded-xl border-2 flex flex-col items-center gap-2 transition-all ${checkoutTarget === 'CUSTOMER' ? 'border-primary bg-primary-container/30 text-primary' : 'border-outline/20 bg-surface-container text-text-secondary hover:border-primary/50'}`}
                      >
                          <User size={24} />
                          <span className="font-bold">Customer Only</span>
                      </button>
                      <button 
                          onClick={() => setCheckoutTarget('INSTALLER')}
                          className={`p-4 rounded-xl border-2 flex flex-col items-center gap-2 transition-all ${checkoutTarget === 'INSTALLER' ? 'border-primary bg-primary-container/30 text-primary' : 'border-outline/20 bg-surface-container text-text-secondary hover:border-primary/50'}`}
                      >
                          <HardHat size={24} />
                          <span className="font-bold">Installer</span>
                      </button>
                  </div>
              </section>

              <section>
                {/* 1. CUSTOMER / PROJECT SELECTOR */}
                {(checkoutTarget === 'PROJECT' || checkoutTarget === 'CUSTOMER') && (
                <>
                <h3 className="text-lg font-semibold mb-3 text-text-primary px-1">1. Customer</h3>
                {!selectedCustomer ? (
                  <CustomerSelector 
                    onCustomerSelect={handleCustomerSelect}
                    onRequestNewCustomer={handleRequestNewCustomer} 
                  />
                ) : (
                  <div className="bg-surface-container p-4 rounded-xl flex justify-between items-center border border-outline/20">
                    <div className="flex items-center gap-4">
                      <User className="w-6 h-6 text-primary" />
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
                        className="text-sm font-semibold text-primary hover:underline no-print"
                      >
                        Change
                      </button>
                    )}
                  </div>
                )}
                </>
                )}
              </section>

              {checkoutTarget === 'PROJECT' && selectedCustomer && (
                <section>
                  <h3 className="text-lg font-semibold mb-3 text-text-primary px-1">2. Project</h3>
                  {!selectedProject ? (
                    <ProjectSelector 
                        customer={selectedCustomer} 
                        onProjectSelect={(project) => setSelectedProject(project)} 
                    />
                  ) : (
                    <div className="bg-surface-container p-4 rounded-xl flex justify-between items-center border border-outline/20">
                        <div className="flex items-center gap-4">
                            <Briefcase className="w-6 h-6 text-primary" />
                            <div>
                                <p className="font-bold text-lg text-text-primary">{selectedProject.projectName}</p>
                                <p className="text-sm text-text-secondary">{selectedProject.projectType}</p>
                            </div>
                        </div>
                        {!checkoutComplete && (
                          <button 
                              onClick={() => setSelectedProject(null)}
                              className="text-sm font-semibold text-primary hover:underline no-print"
                          >
                              Change
                          </button>
                        )}
                    </div>
                  )}
                </section>
              )}

              {/* INSTALLER SELECTOR */}
              {checkoutTarget === 'INSTALLER' && (
                  <section>
                      <h3 className="text-lg font-semibold mb-3 text-text-primary px-1">1. Select Installer</h3>
                      <Select 
                          options={installers.map(i => ({ label: i.installerName, value: i }))}
                          onChange={(opt) => setSelectedInstaller(opt?.value || null)}
                          value={selectedInstaller ? { label: selectedInstaller.installerName, value: selectedInstaller } : null}
                          placeholder="Search installers..."
                          className="react-select-container" classNamePrefix="react-select"
                      />
                  </section>
              )}

              {/* SAMPLES & DATE */}
              {(
                  (checkoutTarget === 'PROJECT' && selectedProject) || 
                  (checkoutTarget === 'CUSTOMER' && selectedCustomer) || 
                  (checkoutTarget === 'INSTALLER' && selectedInstaller)
              ) && (
                <section>
                  <h3 className="text-lg font-semibold mb-3 text-text-primary px-1">
                      {checkoutTarget === 'PROJECT' ? '3.' : '2.'} Samples & Return Date
                  </h3>
                  <div className="mb-4">
                    <label htmlFor="returnDate" className="block text-sm font-medium text-text-secondary mb-2">Expected Return Date</label>
                    <div className="relative">
                        <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary w-5 h-5" />
                        <input
                            id="returnDate"
                            type="date"
                            value={expectedReturnDate}
                            onChange={(e) => setExpectedReturnDate(e.target.value)} 
                            className="w-full bg-surface-container border border-outline/50 rounded-lg py-2.5 pl-10 pr-4 focus:outline-none focus:ring-2 focus:ring-primary/50 text-text-primary"
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

            <div className="p-4 border-t border-outline/10 lg:rounded-b-2xl flex justify-end gap-4 no-print sticky bottom-0 z-20 lg:static bg-surface-container-high">
              {checkoutComplete ? (
                <>
                  <button type="button" onClick={handleClose} className="py-2.5 px-6 rounded-full border border-outline text-text-primary hover:bg-surface-container-highest transition-colors font-medium">
                    Close
                  </button>
                  <button
                    type="button"
                    onClick={() => window.print()}
                    className="py-3 px-6 rounded-full bg-tertiary hover:bg-tertiary-hover text-on-tertiary flex items-center gap-2 font-semibold shadow-md transition-all"
                  >
                    <Printer size={18} />
                    Print Summary
                  </button>
                </>
              ) : (
                <>
                  <button type="button" onClick={handleClose} className="py-2.5 px-6 rounded-full border border-outline text-text-primary hover:bg-surface-container-highest transition-colors font-medium" disabled={isSubmitting}>
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleFinishCheckout}
                    disabled={!((checkoutTarget === 'PROJECT' && selectedProject) || (checkoutTarget === 'CUSTOMER' && selectedCustomer) || (checkoutTarget === 'INSTALLER' && selectedInstaller)) || checkoutItems.length === 0 || isSubmitting}
                    className="py-3 px-6 rounded-full bg-primary hover:bg-primary-hover text-on-primary font-semibold disabled:opacity-50 disabled:cursor-not-allowed shadow-md"
                  >
                    {isSubmitting ? 'Checking Out...' : `Finish Checkout (${checkoutItems.length})`}
                  </button>
                </>
              )}
            </div>
          </div>
          </div>
        </div>
        
        <AddEditCustomerModal
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
    </ModalPortal>
  );
};

export default QuickCheckoutModal;