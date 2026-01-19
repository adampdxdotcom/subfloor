import React, { useState, useEffect } from 'react';
import { Customer, ProjectType, PROJECT_TYPES, Installer } from '../types';
import { useNavigate } from 'react-router-dom';
import { useProjectMutations } from '../hooks/useProjects';
import { useInstallerMutations, useInstallers } from '../hooks/useInstallers';
import { useCustomerMutations } from '../hooks/useCustomers';
import CustomerSelector from './CustomerSelector';
import * as sampleService from '../services/sampleCheckoutService';
import { toast } from 'react-hot-toast';
import { X, ArrowLeft } from 'lucide-react';

interface AddProjectModalProps {
    isOpen: boolean;
    onClose: () => void;
    initialCustomer?: Customer | null;
    initialInstaller?: Installer | null;
    initialProjectName?: string;
    transferSampleId?: number | null;
}

const AddProjectModal: React.FC<AddProjectModalProps> = ({ 
    isOpen, onClose, initialCustomer, initialInstaller, initialProjectName, transferSampleId 
}) => {
    const navigate = useNavigate();
    const { data: installers = [] } = useInstallers();
    
    // Mutations
    const { createProject } = useProjectMutations();
    const { createInstaller } = useInstallerMutations();
    const { createCustomer } = useCustomerMutations();

    // --- VIEW STATE ---
    const [currentView, setCurrentView] = useState<'SELECT_CUSTOMER' | 'CREATE_CUSTOMER' | 'CREATE_PROJECT'>('SELECT_CUSTOMER');

    // --- DATA STATE ---
    const [customer, setCustomer] = useState<Customer | null>(null);
    const [projectName, setProjectName] = useState('');
    const [projectType, setProjectType] = useState<ProjectType>(PROJECT_TYPES[0]);
    
    // Installer Search
    const [selectedInstaller, setSelectedInstaller] = useState<Installer | null>(null);
    const [installerSearchTerm, setInstallerSearchTerm] = useState('');
    const [isAddingNewInstaller, setIsAddingNewInstaller] = useState(false);
    const [newInstallerForm, setNewInstallerForm] = useState({ installerName: '', contactEmail: '', contactPhone: '' });

    // New Customer Form
    const [newCustomerName, setNewCustomerName] = useState('');
    const [newCustomerEmail, setNewCustomerEmail] = useState('');
    const [newCustomerPhone, setNewCustomerPhone] = useState('');

    useEffect(() => {
        if (isOpen) {
            if (initialCustomer) {
                setCustomer(initialCustomer);
                setCurrentView('CREATE_PROJECT');
            } else {
                setCustomer(null);
                setCurrentView('SELECT_CUSTOMER');
            }
            
            setSelectedInstaller(initialInstaller || null);
            setInstallerSearchTerm(initialInstaller?.installerName || '');
            setProjectName(initialProjectName || '');
            setProjectType(PROJECT_TYPES[0]);
            
            setNewCustomerName('');
            setNewCustomerEmail('');
            setNewCustomerPhone('');
        }
    }, [isOpen, initialCustomer, initialInstaller, initialProjectName]);

    const handleCustomerSelect = (c: Customer) => {
        setCustomer(c);
        setCurrentView('CREATE_PROJECT');
    };

    const handleRequestNewCustomer = (name: string) => {
        setNewCustomerName(name);
        setCurrentView('CREATE_CUSTOMER');
    };

    const handleCreateCustomer = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const newCust = await createCustomer.mutateAsync({
                fullName: newCustomerName,
                email: newCustomerEmail || undefined,
                phoneNumber: newCustomerPhone || undefined
            });
            setCustomer(newCust);
            setCurrentView('CREATE_PROJECT');
            toast.success("Customer created!");
        } catch (error) {
            toast.error("Failed to create customer.");
        }
    };

    const handleSubmitProject = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!customer) return;
        if (!projectName) { toast.error("Project name is required."); return; }

        try {
            const projectData = {
                projectName,
                projectType,
                customerId: customer.id,
                status: 'New' as const,
                finalChoice: null,
                installerId: selectedInstaller ? selectedInstaller.id : undefined
            };

            const createdProject = await createProject.mutateAsync(projectData);

            if (transferSampleId) {
                await sampleService.transferCheckoutsToProject([transferSampleId], createdProject.id);
            }

            toast.success("Project created successfully!");
            onClose();
            navigate(`/projects/${createdProject.id}`);
        } catch (error) {
            console.error(error);
            toast.error("Failed to create project.");
        }
    };

    const handleSaveNewInstaller = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const newInst = await createInstaller.mutateAsync(newInstallerForm);
            setSelectedInstaller(newInst);
            setInstallerSearchTerm(newInst.installerName);
            setIsAddingNewInstaller(false);
        } catch (e) { toast.error("Failed to add installer."); }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
            <div className="bg-surface-container-high p-6 rounded-2xl shadow-2xl w-full max-w-xl border border-outline/20 relative">
                
                {/* Header with Title & Close/Back */}
                <div className="flex items-center mb-6">
                     {currentView !== 'SELECT_CUSTOMER' && (
                        <button onClick={() => setCurrentView('SELECT_CUSTOMER')} className="text-text-secondary hover:text-text-primary p-2 rounded-full hover:bg-surface-container-highest mr-2">
                            <ArrowLeft size={20} />
                        </button>
                    )}
                    <h2 className="text-2xl font-bold text-text-primary flex-grow">
                        {currentView === 'CREATE_CUSTOMER' ? 'New Customer' : 'Start New Project'}
                    </h2>
                    <button onClick={onClose} className="text-text-secondary hover:text-text-primary p-2 rounded-full hover:bg-surface-container-highest">
                        <X size={20} />
                    </button>
                </div>

                {/* VIEW 1: SELECT CUSTOMER */}
                {currentView === 'SELECT_CUSTOMER' && (
                    <div>
                        <div className="mb-6">
                            <label className="block text-sm font-medium text-text-secondary mb-1.5">Select Customer</label>
                            <CustomerSelector 
                                onCustomerSelect={handleCustomerSelect} 
                                onRequestNewCustomer={handleRequestNewCustomer}
                            />
                        </div>
                        <div className="flex justify-end">
                            <button onClick={onClose} className="py-2.5 px-6 rounded-full border border-outline text-text-primary hover:bg-surface-container-highest transition-colors">
                                Cancel
                            </button>
                        </div>
                    </div>
                )}

                {/* VIEW 2: CREATE CUSTOMER (INLINE) */}
                {currentView === 'CREATE_CUSTOMER' && (
                    <form onSubmit={handleCreateCustomer} className="space-y-4">
                        <input type="text" placeholder="Full Name" value={newCustomerName} onChange={e => setNewCustomerName(e.target.value)} className="w-full bg-surface-container border border-outline/50 rounded-lg px-4 py-2.5 text-text-primary placeholder:text-text-tertiary focus:ring-2 focus:ring-primary/50 outline-none" required />
                        <input type="email" placeholder="Email (Optional)" value={newCustomerEmail} onChange={e => setNewCustomerEmail(e.target.value)} className="w-full bg-surface-container border border-outline/50 rounded-lg px-4 py-2.5 text-text-primary placeholder:text-text-tertiary focus:ring-2 focus:ring-primary/50 outline-none" />
                        <input type="tel" placeholder="Phone (Optional)" value={newCustomerPhone} onChange={e => setNewCustomerPhone(e.target.value)} className="w-full bg-surface-container border border-outline/50 rounded-lg px-4 py-2.5 text-text-primary placeholder:text-text-tertiary focus:ring-2 focus:ring-primary/50 outline-none" />
                        
                        <div className="flex justify-end gap-3 mt-6">
                            <button type="button" onClick={() => setCurrentView('SELECT_CUSTOMER')} className="py-2.5 px-6 rounded-full border border-outline text-text-primary hover:bg-surface-container-highest transition-colors">Back</button>
                            <button type="submit" className="py-3 px-6 rounded-full bg-primary hover:bg-primary-hover text-on-primary font-semibold shadow-md transition-all">Save & Continue</button>
                        </div>
                    </form>
                )}

                {/* VIEW 3: CREATE PROJECT */}
                {currentView === 'CREATE_PROJECT' && customer && (
                    <form onSubmit={handleSubmitProject} className="space-y-4">
                        {!initialCustomer && (
                            <div className="flex justify-between items-center bg-surface-container p-3 rounded-lg border border-outline/20 text-sm">
                                <span className="text-text-primary font-bold">{customer.fullName}</span>
                                <button type="button" onClick={() => { setCustomer(null); setCurrentView('SELECT_CUSTOMER'); }} className="text-primary hover:underline font-medium">Change</button>
                            </div>
                        )}

                        <div>
                            <label className="block text-sm font-medium text-text-secondary mb-1">Project Name</label>
                            <input type="text" value={projectName} onChange={e => setProjectName(e.target.value)} className="w-full bg-surface-container border border-outline/50 rounded-lg px-4 py-2.5 text-text-primary placeholder:text-text-tertiary focus:ring-2 focus:ring-primary/50 outline-none" required />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-text-secondary mb-1">Project Type</label>
                            <select value={projectType} onChange={(e) => setProjectType(e.target.value as ProjectType)} className="w-full bg-surface-container border border-outline/50 rounded-lg px-4 py-2.5 text-text-primary placeholder:text-text-tertiary focus:ring-2 focus:ring-primary/50 outline-none">
                                {PROJECT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                            </select>
                        </div>

                        {/* Installer Section */}
                        {!isAddingNewInstaller ? (
                            <div className="relative">
                                <label className="block text-sm font-medium text-text-secondary mb-1">Installer (Optional)</label>
                                <input 
                                    type="text" 
                                    placeholder="Search installers..." 
                                    value={installerSearchTerm} 
                                    onChange={e => { setInstallerSearchTerm(e.target.value); setSelectedInstaller(null); }} 
                                    className="w-full bg-surface-container border border-outline/50 rounded-lg px-4 py-2.5 text-text-primary placeholder:text-text-tertiary focus:ring-2 focus:ring-primary/50 outline-none" 
                                    disabled={!!initialInstaller} 
                                />
                                {installerSearchTerm && !selectedInstaller && !initialInstaller && (
                                    <div className="absolute z-10 w-full bg-surface-container-high border border-outline/20 rounded-lg mt-1 max-h-48 overflow-y-auto shadow-xl">
                                        {installers.filter(i => i.installerName.toLowerCase().includes(installerSearchTerm.toLowerCase())).map(inst => (
                                            <div key={inst.id} onClick={() => { setSelectedInstaller(inst); setInstallerSearchTerm(inst.installerName); }} className="px-4 py-2 hover:bg-primary-container/30 cursor-pointer text-text-primary">
                                                {inst.installerName}
                                            </div>
                                        ))}
                                        <div className="p-2 border-t border-outline/20 text-center text-primary text-sm cursor-pointer hover:bg-primary-container/30 font-medium" onClick={() => { setNewInstallerForm(prev => ({...prev, installerName: installerSearchTerm})); setIsAddingNewInstaller(true); }}>
                                            + Add New "{installerSearchTerm}"
                                        </div>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="bg-surface-container p-4 rounded-lg border border-outline/20">
                                <h4 className="font-semibold text-md mb-3 text-text-primary">New Installer</h4>
                                <input type="text" placeholder="Name" value={newInstallerForm.installerName} onChange={e => setNewInstallerForm({...newInstallerForm, installerName: e.target.value})} className="w-full bg-surface-container-low border border-outline/50 rounded-lg px-3 py-2 mb-2 text-sm text-text-primary placeholder:text-text-tertiary focus:ring-2 focus:ring-primary/50 outline-none" />
                                <div className="flex gap-2">
                                    <button type="button" onClick={() => setIsAddingNewInstaller(false)} className="flex-1 py-1.5 px-4 rounded-full border border-outline text-text-primary hover:bg-surface-container-highest text-xs font-medium">Cancel</button>
                                    <button type="button" onClick={handleSaveNewInstaller} className="flex-1 py-1.5 px-4 rounded-full bg-primary text-on-primary text-xs font-semibold">Save</button>
                                </div>
                            </div>
                        )}

                        <div className="flex justify-end gap-3 mt-6">
                            <button type="button" onClick={onClose} className="py-2.5 px-6 rounded-full border border-outline text-text-primary hover:bg-surface-container-highest transition-colors">Cancel</button>
                            <button type="submit" className="py-3 px-6 rounded-full bg-primary hover:bg-primary-hover text-on-primary font-semibold shadow-md transition-all">Create & Transfer</button>
                        </div>
                    </form>
                )}
            </div>
        </div>
    );
};

export default AddProjectModal;