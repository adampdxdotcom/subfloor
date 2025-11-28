import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useData } from '../context/DataContext';
import { Project, Quote, Installer, QuoteStatus, Job, InstallationType, INSTALLATION_TYPES } from '../types';
import { Edit, Check, X, History, FileText, Move } from 'lucide-react';
import ActivityHistory from './ActivityHistory';
import ModalPortal from './ModalPortal'; // NEW

interface QuotesSectionProps {
    project: Project;
    projectQuotes: Quote[];
    installers: Installer[];
    addQuote: (quote: Omit<Quote, 'id' | 'dateSent'>) => Promise<void>;
    updateQuote: (quote: Partial<Quote> & { id: number }) => Promise<void>;
    updateProject: (p: Partial<Project> & { id: number }) => void;
    addInstaller: (installer: Omit<Installer, 'id' | 'jobs'>) => Promise<Installer>;
    saveJobDetails: (job: Partial<Job> & { projectId: number }) => Promise<void>;
    isModalOpen: boolean;
    onCloseModal: () => void;
    onOpenEditModal: (quote: Quote) => void;
    editingQuoteForModal: Quote | null;
}

const QuotesSection: React.FC<QuotesSectionProps> = ({ 
    project, projectQuotes, installers, addQuote, updateQuote, 
    addInstaller, isModalOpen, onCloseModal, onOpenEditModal, 
    editingQuoteForModal 
}) => {
    const { acceptQuote, quotesHistory, fetchQuotesHistory } = useData();
    
    const [editingQuote, setEditingQuote] = useState<Quote | null>(null);
    const [newQuote, setNewQuote] = useState({
        installationType: 'Managed Installation' as InstallationType,
        materialsAmount: '',
        laborAmount: '',
        laborDepositPercentage: '50',
        quoteDetails: ''
    });
    const [installerSearchTerm, setInstallerSearchTerm] = useState('');
    const [selectedInstaller, setSelectedInstaller] = useState<Installer | null>(null);
    const [isAddingNewInstaller, setIsAddingNewInstaller] = useState(false);
    const [newInstallerForm, setNewInstallerForm] = useState({ installerName: '', contactEmail: '', contactPhone: '' });
    const [showHistory, setShowHistory] = useState(false);
    
    const installerSearchResults = useMemo(() => { if (!installerSearchTerm) return []; return installers.filter(i => i.installerName.toLowerCase().includes(installerSearchTerm.toLowerCase())); }, [installers, installerSearchTerm]);
    const calculatedDeposit = useMemo(() => {
        const materials = parseFloat(newQuote.materialsAmount) || 0;
        if (newQuote.installationType === 'Managed Installation') {
            const labor = parseFloat(newQuote.laborAmount) || 0;
            const percent = parseFloat(newQuote.laborDepositPercentage) || 0;
            return materials + (labor * (percent / 100));
        }
        return materials;
    }, [newQuote]);

    useEffect(() => {
        if (project.id) {
            fetchQuotesHistory(project.id);
        }
    }, [project.id, fetchQuotesHistory]);
    
    useEffect(() => {
        if (isModalOpen) {
            if (editingQuoteForModal) {
                setEditingQuote(editingQuoteForModal);
                const installer = installers.find(i => i.id === editingQuoteForModal.installerId);
                if (installer) {
                    setSelectedInstaller(installer);
                    setInstallerSearchTerm(installer.installerName);
                } else {
                    setSelectedInstaller(null);
                    setInstallerSearchTerm('');
                }
                setNewQuote({
                    installationType: editingQuoteForModal.installationType || 'Managed Installation',
                    materialsAmount: String(editingQuoteForModal.materialsAmount || ''),
                    laborAmount: String(editingQuoteForModal.laborAmount || ''),
                    laborDepositPercentage: String(editingQuoteForModal.laborDepositPercentage || '50'),
                    quoteDetails: editingQuoteForModal.quoteDetails || ''
                });
            } else {
                setEditingQuote(null);
                setNewQuote({ installationType: 'Managed Installation', materialsAmount: '', laborAmount: '', laborDepositPercentage: '50', quoteDetails: '' });
                setSelectedInstaller(null);
                setInstallerSearchTerm('');
            }
            setIsAddingNewInstaller(false);
        }
    }, [isModalOpen, editingQuoteForModal, installers]);
    
    const handleSaveQuote = async (e: React.FormEvent) => {
        e.preventDefault();
        const requiresInstaller = newQuote.installationType === 'Managed Installation' || newQuote.installationType === 'Unmanaged Installer';
        if (requiresInstaller && !selectedInstaller) {
            alert("Please select an installer for this installation type.");
            return;
        }

        const quoteData = {
            projectId: project.id,
            installerId: selectedInstaller?.id || null,
            installationType: newQuote.installationType,
            materialsAmount: parseFloat(newQuote.materialsAmount) || 0,
            laborAmount: newQuote.installationType === 'Managed Installation' ? (parseFloat(newQuote.laborAmount) || 0) : null,
            laborDepositPercentage: newQuote.installationType === 'Managed Installation' ? (parseFloat(newQuote.laborDepositPercentage) || 50) : null,
            quoteDetails: newQuote.quoteDetails,
            status: editingQuote ? editingQuote.status : QuoteStatus.SENT
        };

        if (editingQuote) {
            await updateQuote({ ...quoteData, id: editingQuote.id });
        } else {
            await addQuote(quoteData);
        }
        onCloseModal();
    };
    
    const handleSelectInstaller = (installer: Installer) => { setSelectedInstaller(installer); setInstallerSearchTerm(installer.installerName); };
    const handleShowAddNewInstaller = () => { setNewInstallerForm({ installerName: installerSearchTerm, contactEmail: '', contactPhone: '' }); setIsAddingNewInstaller(true); };
    const handleSaveNewInstaller = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newInstallerForm.installerName) return;
        try {
            const newlyAddedInstaller = await addInstaller(newInstallerForm);
            setIsAddingNewInstaller(false);
            handleSelectInstaller(newlyAddedInstaller);
        } catch (error) {
            console.error("Failed to add new installer:", error);
        }
    };
    
    const handleQuoteStatusChange = async (e: React.MouseEvent, quote: Quote, status: QuoteStatus) => { 
        e.preventDefault(); 
        e.stopPropagation(); 
        
        if (status === QuoteStatus.ACCEPTED) { 
            await acceptQuote({ id: quote.id, status: status }); 
        } else {
            await updateQuote({ id: quote.id, status: status }); 
        } 
    };

    return (
        <div className="bg-surface rounded-lg shadow-md flex flex-col h-full">
            <div className="p-4 border-b border-border flex justify-between items-center flex-shrink-0">
                <div className="flex items-center gap-3">
                    <Move className="drag-handle cursor-move text-text-secondary hover:text-text-primary transition-colors" size={20} />
                    <FileText className="w-6 h-6 text-accent" />
                    <h3 className="text-xl font-semibold text-text-primary">Quotes</h3>
                </div>
                <div>
                    <button
                        onClick={() => { setEditingQuote(null); onOpenEditModal(null as any); }}
                        className="bg-primary hover:bg-primary-hover text-on-primary font-bold py-1 px-3 text-sm rounded-lg"
                    >
                        Add Quote
                    </button>
                    <button
                        onClick={() => setShowHistory(!showHistory)}
                        className="ml-2 p-2 text-text-secondary hover:text-text-primary"
                        title="Toggle Quote History"
                    >
                        <History size={18} />
                    </button>
                </div>
            </div>

            <div className="p-4 overflow-y-auto flex-grow">
                {showHistory ? (
                    <ActivityHistory history={quotesHistory} />
                ) : (
                    <div className="space-y-3">
                        {projectQuotes.map(quote => {
                            const installer = installers.find(i => i.id === quote.installerId);
                            const totalAmount = (Number(quote.materialsAmount) || 0) + (Number(quote.laborAmount) || 0);
                            return (
                                <div key={quote.id} className={`block bg-background p-3 rounded-md border-l-4 hover:bg-surface transition-colors ${quote.status === QuoteStatus.ACCEPTED ? 'border-green-500' : quote.status === QuoteStatus.REJECTED ? 'border-red-500' : 'border-blue-500'}`}>
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <p className="font-bold text-lg text-text-primary">${totalAmount.toFixed(2)}</p>
                                            <p className="text-sm text-text-secondary">{installer?.installerName || quote.installationType}</p>
                                            <p className="text-xs text-text-secondary mt-2">Materials: ${Number(quote.materialsAmount || 0).toFixed(2)}, Labor: ${Number(quote.laborAmount || 0).toFixed(2)}</p>
                                            <span className="text-xs font-semibold bg-surface text-text-secondary px-2 py-1 rounded-full mt-2 inline-block">{quote.installationType}</span>
                                        </div>
                                        <div className="text-right">
                                            <p className="font-semibold text-sm text-text-primary">{quote.status}</p>
                                            {quote.status === QuoteStatus.SENT && (
                                                <div className="flex space-x-2 mt-2 items-center">
                                                    <button onClick={() => onOpenEditModal(quote)} className="p-2 text-text-secondary hover:text-text-primary hover:bg-surface rounded-full" title="Edit Quote"><Edit className="w-4 h-4" /></button>
                                                    <button onClick={(e) => handleQuoteStatusChange(e, quote, QuoteStatus.ACCEPTED)} className="p-2 bg-green-600 rounded-full hover:bg-green-700" title="Accept Quote"><Check className="w-4 h-4 text-white" /></button>
                                                    <button onClick={(e) => handleQuoteStatusChange(e, quote, QuoteStatus.REJECTED)} className="p-2 bg-red-600 rounded-full hover:bg-red-700" title="Reject Quote"><X className="w-4 h-4 text-white" /></button>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                        {projectQuotes.length === 0 && <p className="text-text-secondary text-center py-4">No quotes created yet.</p>}
                    </div>
                )}
            </div>
            
            {isModalOpen && (
                <ModalPortal>
                    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
                        <div className="bg-surface p-8 rounded-lg w-full max-w-lg border border-border">
                            <h3 className="text-xl font-bold mb-4 text-text-primary">{editingQuote ? 'Edit Quote' : 'Add New Quote'}</h3>
                            {!isAddingNewInstaller ? (
                                <form onSubmit={handleSaveQuote}>
                                    <div className="mb-4">
                                        <label className="block text-sm font-medium text-text-secondary mb-2">Installation Type</label>
                                        <div className="flex flex-wrap gap-x-4 gap-y-2">
                                            {INSTALLATION_TYPES.map(type => (
                                                <label key={type} className="flex items-center space-x-2 cursor-pointer">
                                                    <input
                                                        type="radio" name="installationType" value={type}
                                                        checked={newQuote.installationType === type}
                                                        onChange={e => setNewQuote({ ...newQuote, installationType: e.target.value as InstallationType })}
                                                        className="form-radio h-4 w-4 text-primary bg-background border-border focus:ring-primary"
                                                    />
                                                    <span className="text-text-primary">{type}</span>
                                                </label>
                                            ))}
                                        </div>
                                    </div>
                                    {(newQuote.installationType === 'Managed Installation' || newQuote.installationType === 'Unmanaged Installer') && (
                                        <div className="relative mb-4">
                                            <label className="block text-sm font-medium text-text-secondary mb-1">Installer</label>
                                            <input type="text" placeholder="Search for an installer..." value={installerSearchTerm} onChange={e => { setInstallerSearchTerm(e.target.value); setSelectedInstaller(null); }} className="w-full p-2 bg-background border-border rounded text-text-primary" />
                                            {installerSearchTerm && !selectedInstaller && (
                                                <div className="absolute z-10 w-full bg-surface border border-border rounded-b-md mt-1 max-h-40 overflow-y-auto">
                                                    {installerSearchResults.map(inst => (
                                                        <div key={inst.id} onClick={() => handleSelectInstaller(inst)} className="p-2 hover:bg-background cursor-pointer text-text-primary">{inst.installerName}</div>
                                                    ))}
                                                    {installerSearchResults.length === 0 && (
                                                        <div className="p-2 text-center text-text-secondary">No results. <button type="button" onClick={handleShowAddNewInstaller} className="ml-2 text-accent font-semibold hover:underline">Add it?</button></div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                    <div className="grid grid-cols-2 gap-4 mb-4">
                                        <div>
                                            <label className="block text-sm font-medium text-text-secondary mb-1">Materials Cost</label>
                                            <input type="number" step="0.01" placeholder="0.00" value={newQuote.materialsAmount} onChange={e => setNewQuote({ ...newQuote, materialsAmount: e.target.value })} className="w-full p-2 bg-background border-border rounded text-text-primary" required />
                                        </div>
                                        {newQuote.installationType === 'Managed Installation' && (
                                            <div>
                                                <label className="block text-sm font-medium text-text-secondary mb-1">Labor Cost</label>
                                                <input type="number" step="0.01" placeholder="0.00" value={newQuote.laborAmount} onChange={e => setNewQuote({ ...newQuote, laborAmount: e.target.value })} className="w-full p-2 bg-background border-border rounded text-text-primary" required />
                                            </div>
                                        )}
                                    </div>
                                    <div className="grid grid-cols-2 gap-4 mb-4 items-center">
                                        {newQuote.installationType === 'Managed Installation' && (
                                            <div className="relative">
                                                <label className="block text-sm font-medium text-text-secondary mb-1">Installer Deposit %</label>
                                                <input type="number" value={newQuote.laborDepositPercentage} onChange={e => setNewQuote({ ...newQuote, laborDepositPercentage: e.target.value })} className="w-full p-2 bg-background border-border rounded text-text-primary" />
                                                <span className="absolute right-3 top-1/2 mt-3 -translate-y-1/2 text-text-secondary">%</span>
                                            </div>
                                        )}
                                        <div className="bg-background p-2 rounded text-center self-end">
                                            <span className="text-sm text-text-secondary">Required Deposit: </span>
                                            <span className="font-bold text-text-primary">${calculatedDeposit.toFixed(2)}</span>
                                        </div>
                                    </div>
                                    <textarea placeholder="Quote details..." value={newQuote.quoteDetails} onChange={e => setNewQuote({ ...newQuote, quoteDetails: e.target.value })} className="w-full p-2 mb-4 bg-background border-border rounded text-text-primary" rows={3}></textarea>
                                    <div className="flex justify-end space-x-2">
                                        <button type="button" onClick={onCloseModal} className="py-2 px-4 bg-secondary hover:bg-secondary-hover rounded text-on-secondary">Cancel</button>
                                        <button type="submit" disabled={(newQuote.installationType === 'Managed Installation' || newQuote.installationType === 'Unmanaged Installer') && !selectedInstaller} className="py-2 px-4 bg-primary hover:bg-primary-hover text-on-primary rounded disabled:opacity-50 disabled:cursor-not-allowed">{editingQuote ? 'Save Changes' : 'Add Quote'}</button>
                                    </div>
                                </form>
                            ) : (
                            <form onSubmit={handleSaveNewInstaller}>
                                    <h4 className="text-lg font-semibold mb-2 text-text-primary">Add New Installer</h4>
                                    <div className="space-y-3">
                                        <input type="text" placeholder="Installer Name" value={newInstallerForm.installerName} onChange={e => setNewInstallerForm({...newInstallerForm, installerName: e.target.value})} className="w-full p-2 bg-background border-border rounded text-text-primary" required />
                                        <input type="email" placeholder="Contact Email" value={newInstallerForm.contactEmail} onChange={e => setNewInstallerForm({...newInstallerForm, contactEmail: e.target.value})} className="w-full p-2 bg-background border-border rounded text-text-primary" />
                                        <input type="tel" placeholder="Contact Phone" value={newInstallerForm.contactPhone} onChange={e => setNewInstallerForm({...newInstallerForm, contactPhone: e.target.value})} className="w-full p-2 bg-background border-border rounded text-text-primary" />
                                    </div>
                                    <div className="flex justify-end space-x-2 mt-4">
                                        <button type="button" onClick={() => setIsAddingNewInstaller(false)} className="py-2 px-4 bg-secondary hover:bg-secondary-hover rounded text-on-secondary">Back</button>
                                        <button type="submit" className="py-2 px-4 bg-primary hover:bg-primary-hover rounded text-on-primary">Save Installer</button>
                                    </div>
                            </form>
                            )}
                        </div>
                    </div>
                </ModalPortal>
            )}
        </div>
    );
};

export default QuotesSection;