import React, { useState, useEffect } from 'react';
import { useData } from '../context/DataContext';
import { Customer, ProjectType, PROJECT_TYPES, Installer } from '../types';
import { useNavigate } from 'react-router-dom';
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
    const { addProject, installers, addInstaller, addCustomer } = useData();
    const navigate = useNavigate();

    // --- VIEW STATE ---
    // 'SELECT_CUSTOMER' | 'CREATE_CUSTOMER' | 'CREATE_PROJECT'
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
            // Reset logic
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
            
            // Reset Customer Form
            setNewCustomerName('');
            setNewCustomerEmail('');
            setNewCustomerPhone('');
        }
    }, [isOpen, initialCustomer, initialInstaller, initialProjectName]);

    // --- ACTIONS ---

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
            const newCust = await addCustomer({
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

            const createdProject = await addProject(projectData);

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

    // Installer Logic
    const handleSaveNewInstaller = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const newInst = await addInstaller(newInstallerForm);
            setSelectedInstaller(newInst);
            setInstallerSearchTerm(newInst.installerName);
            setIsAddingNewInstaller(false);
        } catch (e) { toast.error("Failed to add installer."); }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
            <div className="bg-surface p-8 rounded-lg shadow-2xl w-full max-w-md border border-border relative">
                
                {/* Header with Title & Close/Back */}
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-2xl font-bold text-text-primary">
                        {currentView === 'CREATE_CUSTOMER' ? 'New Customer' : 'Start New Project'}
                    </h2>
                    {currentView === 'CREATE_CUSTOMER' && (
                        <button onClick={() => setCurrentView('SELECT_CUSTOMER')} className="text-text-secondary hover:text-text-primary">
                            <ArrowLeft size={24} />
                        </button>
                    )}
                </div>

                {/* VIEW 1: SELECT CUSTOMER */}
                {currentView === 'SELECT_CUSTOMER' && (
                    <div>
                        <div className="mb-6">
                            <label className="block text-sm font-medium text-text-secondary mb-2">Select Customer</label>
                            <CustomerSelector 
                                onCustomerSelect={handleCustomerSelect} 
                                onRequestNewCustomer={handleRequestNewCustomer}
                            />
                        </div>
                        <div className="flex justify-end">
                            <button onClick={onClose} className="py-2 px-4 bg-secondary hover:bg-secondary-hover rounded text-on-secondary">
                                Cancel
                            </button>
                        </div>
                    </div>
                )}

                {/* VIEW 2: CREATE CUSTOMER (INLINE) */}
                {currentView === 'CREATE_CUSTOMER' && (
                    <form onSubmit={handleCreateCustomer} className="space-y-4">
                        <input type="text" placeholder="Full Name" value={newCustomerName} onChange={e => setNewCustomerName(e.target.value)} className="w-full p-2 bg-background border border-border rounded text-text-primary" required />
                        <input type="email" placeholder="Email (Optional)" value={newCustomerEmail} onChange={e => setNewCustomerEmail(e.target.value)} className="w-full p-2 bg-background border border-border rounded text-text-primary" />
                        <input type="tel" placeholder="Phone (Optional)" value={newCustomerPhone} onChange={e => setNewCustomerPhone(e.target.value)} className="w-full p-2 bg-background border border-border rounded text-text-primary" />
                        
                        <div className="flex justify-end gap-3 mt-6">
                            <button type="button" onClick={() => setCurrentView('SELECT_CUSTOMER')} className="py-2 px-4 bg-secondary hover:bg-secondary-hover rounded text-on-secondary">Back</button>
                            <button type="submit" className="py-2 px-4 bg-primary hover:bg-primary-hover rounded text-on-primary font-bold">Save & Continue</button>
                        </div>
                    </form>
                )}

                {/* VIEW 3: CREATE PROJECT */}
                {currentView === 'CREATE_PROJECT' && customer && (
                    <form onSubmit={handleSubmitProject} className="space-y-4">
                        {!initialCustomer && (
                            <div className="flex justify-between items-center bg-background p-2 rounded border border-border text-sm">
                                <span className="text-text-primary font-bold">{customer.fullName}</span>
                                <button type="button" onClick={() => { setCustomer(null); setCurrentView('SELECT_CUSTOMER'); }} className="text-accent hover:underline">Change</button>
                            </div>
                        )}

                        <div>
                            <label className="block text-sm font-medium text-text-secondary mb-1">Project Name</label>
                            <input type="text" value={projectName} onChange={e => setProjectName(e.target.value)} className="w-full p-2 bg-background border border-border rounded text-text-primary" required />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-text-secondary mb-1">Project Type</label>
                            <select value={projectType} onChange={(e) => setProjectType(e.target.value as ProjectType)} className="w-full p-2 bg-background border border-border rounded text-text-primary">
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
                                    className="w-full p-2 bg-background border border-border rounded text-text-primary" 
                                    disabled={!!initialInstaller} 
                                />
                                {installerSearchTerm && !selectedInstaller && !initialInstaller && (
                                    <div className="absolute z-10 w-full bg-surface border border-border rounded-b-md mt-1 max-h-40 overflow-y-auto shadow-lg">
                                        {installers.filter(i => i.installerName.toLowerCase().includes(installerSearchTerm.toLowerCase())).map(inst => (
                                            <div key={inst.id} onClick={() => { setSelectedInstaller(inst); setInstallerSearchTerm(inst.installerName); }} className="p-2 hover:bg-background cursor-pointer text-text-primary">
                                                {inst.installerName}
                                            </div>
                                        ))}
                                        <div className="p-2 text-center text-text-secondary text-sm cursor-pointer hover:text-accent" onClick={() => { setNewInstallerForm(prev => ({...prev, installerName: installerSearchTerm})); setIsAddingNewInstaller(true); }}>
                                            + Add New "{installerSearchTerm}"
                                        </div>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="bg-background p-3 rounded border border-border">
                                <h4 className="font-bold text-sm mb-2 text-text-primary">New Installer</h4>
                                <input type="text" placeholder="Name" value={newInstallerForm.installerName} onChange={e => setNewInstallerForm({...newInstallerForm, installerName: e.target.value})} className="w-full p-2 mb-2 bg-surface border border-border rounded text-xs text-text-primary" />
                                <div className="flex gap-2">
                                    <button type="button" onClick={() => setIsAddingNewInstaller(false)} className="flex-1 py-1 bg-secondary text-on-secondary text-xs rounded">Cancel</button>
                                    <button type="button" onClick={handleSaveNewInstaller} className="flex-1 py-1 bg-primary text-on-primary text-xs rounded">Save</button>
                                </div>
                            </div>
                        )}

                        <div className="flex justify-end gap-3 mt-6">
                            <button type="button" onClick={onClose} className="py-2 px-4 bg-secondary hover:bg-secondary-hover rounded text-on-secondary">Cancel</button>
                            <button type="submit" className="py-2 px-4 bg-primary hover:bg-primary-hover rounded text-on-primary font-bold">Create & Transfer</button>
                        </div>
                    </form>
                )}
            </div>
        </div>
    );
};

export default AddProjectModal;