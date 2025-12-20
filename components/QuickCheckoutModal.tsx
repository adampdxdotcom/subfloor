import React, { useState, useCallback, useEffect } from 'react';
import { useData } from '../context/DataContext';
import { Customer, Project, Product, Installer } from '../types';
import { X, User, Briefcase, CheckCircle, Calendar, Printer, HardHat, Building2 } from 'lucide-react';
import CustomerSelector from './CustomerSelector';
import ProjectSelector from './ProjectSelector';
import SampleSelector, { CheckoutItem } from './SampleSelector'; // Updated
import { toast } from 'react-hot-toast';
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
  const { addSampleCheckout, vendors, installers } = useData(); 

  // --- STATE ---
  const [checkoutTarget, setCheckoutTarget] = useState<CheckoutTarget>('PROJECT');
  
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [selectedInstaller, setSelectedInstaller] = useState<Installer | null>(null);
  
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
     setAutoSelectProduct(newSample); // Auto-select the new product in the picker
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

  // Determine who the printable summary is for
  const printableRecipient = 
    checkoutTarget === 'PROJECT' ? selectedCustomer :
    checkoutTarget === 'CUSTOMER' ? selectedCustomer :
    checkoutTarget === 'INSTALLER' ? selectedInstaller :
    null;

  return (
    <>
      <div className="fixed inset-0 bg-black/75 z-50 overflow-y-auto">
        
        <div className="print-only">
          <PrintableCheckout 
              customer={printableRecipient as Customer} // Casting loosely as we check existence above
              project={selectedProject}
              checkoutItems={checkoutItems} 
              vendors={vendors} 
              returnDate={expectedReturnDate}
              installer={printableRecipient as Installer}
              target={checkoutTarget}
          />
        </div>

        <div className="flex h-full items-center justify-center p-0 lg:p-4">
        <div className="bg-surface w-full h-full lg:h-[90vh] lg:max-w-4xl lg:rounded-lg shadow-2xl flex flex-col border border-border relative">
          
          <div className="p-4 border-b border-border flex justify-between items-center bg-background lg:rounded-t-lg sticky top-0 z-20 no-print">
            <h2 className="text-xl font-bold text-text-primary">New Sample Checkout</h2>
            <button onClick={handleClose} className="p-2 rounded-full hover:bg-surface text-text-secondary hover:text-text-primary">
              <X className="w-6 h-6 text-text-primary" />
            </button>
          </div>

          <fieldset disabled={checkoutComplete} className="flex-1 overflow-y-auto p-4 md:p-8 space-y-8">
            
            {/* 0. TARGET SELECTION */}
            <section>
                <h3 className="text-lg font-semibold mb-4 text-text-primary">Who is this for?</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                    <button 
                        onClick={() => setCheckoutTarget('PROJECT')}
                        className={`p-4 rounded-lg border-2 flex flex-col items-center gap-2 transition-all ${checkoutTarget === 'PROJECT' ? 'border-primary bg-primary/10 text-primary' : 'border-border bg-background text-text-secondary hover:border-primary/50'}`}
                    >
                        <Briefcase size={24} />
                        <span className="font-bold">Project</span>
                    </button>
                    <button 
                        onClick={() => setCheckoutTarget('CUSTOMER')}
                        className={`p-4 rounded-lg border-2 flex flex-col items-center gap-2 transition-all ${checkoutTarget === 'CUSTOMER' ? 'border-primary bg-primary/10 text-primary' : 'border-border bg-background text-text-secondary hover:border-primary/50'}`}
                    >
                        <User size={24} />
                        <span className="font-bold">Customer Only</span>
                    </button>
                    <button 
                        onClick={() => setCheckoutTarget('INSTALLER')}
                        className={`p-4 rounded-lg border-2 flex flex-col items-center gap-2 transition-all ${checkoutTarget === 'INSTALLER' ? 'border-primary bg-primary/10 text-primary' : 'border-border bg-background text-text-secondary hover:border-primary/50'}`}
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
              </>
              )}
            </section>

            {checkoutTarget === 'PROJECT' && selectedCustomer && (
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

            {/* INSTALLER SELECTOR */}
            {checkoutTarget === 'INSTALLER' && (
                <section>
                    <h3 className="text-lg font-semibold mb-2 border-b border-border pb-2 text-text-primary">1. Select Installer</h3>
                    <Select 
                        options={installers.map(i => ({ label: i.installerName, value: i }))}
                        onChange={(opt) => setSelectedInstaller(opt?.value || null)}
                        value={selectedInstaller ? { label: selectedInstaller.installerName, value: selectedInstaller } : null}
                        placeholder="Search installers..."
                        className="text-text-primary"
                        styles={{
                            control: (base) => ({ ...base, backgroundColor: 'var(--color-background)', borderColor: 'var(--color-border)' }),
                            menu: (base) => ({ ...base, backgroundColor: 'var(--color-surface)', zIndex: 100 }),
                            option: (base, { isFocused }) => ({ ...base, backgroundColor: isFocused ? 'var(--color-primary)' : 'transparent', color: isFocused ? 'var(--color-on-primary)' : 'var(--color-text-primary)' }),
                            singleValue: (base) => ({ ...base, color: 'var(--color-text-primary)' }),
                            input: (base) => ({ ...base, color: 'var(--color-text-primary)' })
                        }}
                    />
                </section>
            )}

            {/* SAMPLES & DATE (Show if Valid Selection Made) */}
            {(
                (checkoutTarget === 'PROJECT' && selectedProject) || 
                (checkoutTarget === 'CUSTOMER' && selectedCustomer) || 
                (checkoutTarget === 'INSTALLER' && selectedInstaller)
            ) && (
              <section>
                <h3 className="text-lg font-semibold mb-2 border-b border-border pb-2 text-text-primary">
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

          <div className="p-4 border-t border-border bg-background lg:rounded-b-lg flex justify-end gap-4 no-print sticky bottom-0 z-20 lg:static">
            {checkoutComplete ? (
              <>
                <button type="button" onClick={handleClose} className="py-2 px-4 bg-secondary hover:bg-secondary-hover rounded text-on-secondary font-medium">
                  Close
                </button>
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="py-2 px-6 bg-accent hover:bg-accent-hover rounded text-on-accent flex items-center gap-2 font-medium"
                >
                  <Printer size={18} />
                  Print Summary
                </button>
              </>
            ) : (
              <>
                <button type="button" onClick={handleClose} className="py-2 px-4 bg-secondary hover:bg-secondary-hover rounded text-on-secondary font-medium" disabled={isSubmitting}>
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleFinishCheckout}
                  disabled={!((checkoutTarget === 'PROJECT' && selectedProject) || (checkoutTarget === 'CUSTOMER' && selectedCustomer) || (checkoutTarget === 'INSTALLER' && selectedInstaller)) || checkoutItems.length === 0 || isSubmitting}
                  className="py-2 px-6 bg-primary hover:bg-primary-hover rounded text-on-primary font-bold disabled:opacity-50 disabled-cursor-not-allowed shadow-md"
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
  );
};

export default QuickCheckoutModal;