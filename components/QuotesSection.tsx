import React, { useState, useEffect, useMemo } from 'react';
import { useData } from '../context/DataContext';
import { Project, Quote, Installer, QuoteStatus, Job, InstallationType, INSTALLATION_TYPES } from '../types';
import { Edit, Check, X, History, FileText, Move, Save, Plus } from 'lucide-react';
import ActivityHistory from './ActivityHistory';
import ModalPortal from './ModalPortal'; 
import { formatDate } from '../utils/dateUtils';
import AddEditInstallerModal from './AddEditInstallerModal';

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
    isModalOpen, onCloseModal, onOpenEditModal, 
    editingQuoteForModal 
}) => {
    const { acceptQuote, quotesHistory, fetchQuotesHistory, systemBranding } = useData();
    
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
    const [isInstallerModalOpen, setIsInstallerModalOpen] = useState(false);
    const [showHistory, setShowHistory] = useState(false);
    
    const installerSearchResults = useMemo(() => { 
        if (!installerSearchTerm) return []; 
        let allowedType = 'Managed';
        if (newQuote.installationType === 'Unmanaged Installer') {
            allowedType = 'Unmanaged';
        }
        return installers.filter(i => 
            i.installerName.toLowerCase().includes(installerSearchTerm.toLowerCase()) && 
            (i.type === allowedType || !i.type)
        ); 
    }, [installers, installerSearchTerm, newQuote.installationType]);

    useEffect(() => {
        if (selectedInstaller) {
            let requiredType = 'Managed';
            if (newQuote.installationType === 'Unmanaged Installer') requiredType = 'Unmanaged';
            if (selectedInstaller.type && selectedInstaller.type !== requiredType) {
                setSelectedInstaller(null);
                setInstallerSearchTerm('');
            }
        }
    }, [newQuote.installationType, selectedInstaller]);

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
        if (project.id) fetchQuotesHistory(project.id);
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
        }
    }, [isModalOpen, editingQuoteForModal, installers]);
    
    const handleSaveQuote = async (e: React.FormEvent) => {
        e.preventDefault();
        const requiresInstaller = newQuote.installationType === 'Managed Installation' || newQuote.installationType === 'Unmanaged Installer';
        if (requiresInstaller && !selectedInstaller) {
            toast.error("Please select an installer.");
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
            poNumber: editingQuote ? editingQuote.poNumber : null,
            status: editingQuote ? editingQuote.status : QuoteStatus.SENT
        };

        if (editingQuote) await updateQuote({ ...quoteData, id: editingQuote.id });
        else await addQuote(quoteData);
        onCloseModal();
    };
    
    const handleSelectInstaller = (installer: Installer) => { setSelectedInstaller(installer); setInstallerSearchTerm(installer.installerName); };
    const handleShowAddNewInstaller = () => { setIsInstallerModalOpen(true); };
    
    const handleQuoteStatusChange = async (e: React.MouseEvent, quote: Quote, status: QuoteStatus) => { 
        e.preventDefault(); 
        e.stopPropagation(); 
        if (status === QuoteStatus.ACCEPTED) await acceptQuote({ id: quote.id, status: status }); 
        else await updateQuote({ id: quote.id, status: status }); 
    };

    const handlePoUpdate = async (quoteId: number, poNumber: string) => {
        const quote = projectQuotes.find(q => q.id === quoteId);
        if (quote && quote.poNumber !== poNumber) {
            await updateQuote({ id: quoteId, poNumber });
        }
    };

    return (
        <div className="flex flex-col h-full">
            <div className="p-4 border-b border-outline/10 flex justify-between items-center flex-shrink-0">
                <div className="flex items-center gap-3">
                    <Move className="drag-handle cursor-move text-text-secondary hover:text-text-primary transition-colors" size={20} />
                    <FileText className="w-6 h-6 text-primary" />
                    <h3 className="text-xl font-semibold text-text-primary">Quotes</h3>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => { setEditingQuote(null); onOpenEditModal(null as any); }}
                        className="bg-primary hover:bg-primary-hover text-on-primary font-semibold py-1 px-4 text-sm rounded-full flex items-center gap-1 transition-all shadow-sm"
                    >
                        <Plus size={16}/> Add
                    </button>
                    <button
                        onClick={() => setShowHistory(!showHistory)}
                        className={`p-2 rounded-full transition-colors ${showHistory ? 'bg-primary-container text-primary font-bold' : 'text-text-secondary hover:text-text-primary hover:bg-surface-container-highest'}`}
                        title="Toggle Quote History"
                    >
                        <History size={18} />
                    </button>
                </div>
            </div>

            <div className="p-4 overflow-y-auto flex-grow scrollbar-thin scrollbar-thumb-surface-container-highest">
                {showHistory ? (
                    <ActivityHistory history={quotesHistory} />
                ) : (
                    <div className="space-y-3">
                        {projectQuotes.map(quote => {
                            const installer = installers.find(i => i.id === quote.installerId);
                            const totalAmount = (Number(quote.materialsAmount) || 0) + (Number(quote.laborAmount) || 0);
                            return (
                                <div key={quote.id} className={`block bg-surface-container p-3 rounded-xl border-l-4 hover:bg-surface-container-high transition-colors ${quote.status === QuoteStatus.ACCEPTED ? 'border-tertiary' : quote.status === QuoteStatus.REJECTED ? 'border-error' : 'border-secondary'}`}>
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <p className="font-bold text-lg text-text-primary">${totalAmount.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</p>
                                            <p className="text-sm text-text-secondary font-medium">{installer?.installerName || quote.installationType}</p>
                                            <p className="text-xs text-text-secondary mt-2 opacity-80">M: ${Number(quote.materialsAmount || 0).toLocaleString()}, L: ${Number(quote.laborAmount || 0).toLocaleString()}</p>
                                            <span className="text-[10px] font-bold uppercase tracking-wider bg-surface-container-highest text-text-secondary px-2 py-1 rounded-full mt-2 inline-block border border-outline/5">{quote.installationType}</span>
                                        </div>
                                        <div className="text-right">
                                            <p className="font-bold text-xs uppercase tracking-widest text-text-primary">{quote.status}</p>
                                            <p className="text-[10px] text-text-tertiary mt-1">{formatDate(quote.dateSent, systemBranding?.systemTimezone)}</p>
                                            {quote.status === QuoteStatus.SENT && (
                                                <div className="flex space-x-2 mt-3 items-center">
                                                    <button onClick={() => onOpenEditModal(quote)} className="p-2 text-text-secondary hover:text-text-primary hover:bg-surface-container-highest rounded-full transition-colors" title="Edit Quote"><Edit className="w-4 h-4" /></button>
                                                    <button onClick={(e) => handleQuoteStatusChange(e, quote, QuoteStatus.ACCEPTED)} className="p-2 bg-tertiary text-on-tertiary rounded-full hover:bg-tertiary-hover shadow-sm transition-colors" title="Accept Quote"><Check className="w-4 h-4" /></button>
                                                    <button onClick={(e) => handleQuoteStatusChange(e, quote, QuoteStatus.REJECTED)} className="p-2 bg-error text-on-error rounded-full hover:bg-error-hover shadow-sm transition-colors" title="Reject Quote"><X className="w-4 h-4" /></button>
                                                </div>
                                            )}
                                            {quote.status === QuoteStatus.ACCEPTED && (
                                                <div className="mt-3 flex items-center">
                                                    <input 
                                                        type="text" 
                                                        placeholder="Add PO #" 
                                                        defaultValue={quote.poNumber || ''}
                                                        onKeyDown={(e) => { if(e.key === 'Enter') handlePoUpdate(quote.id, e.currentTarget.value); }}
                                                        className="text-xs w-24 p-1.5 bg-surface-container-low border border-outline/50 rounded-lg text-text-primary focus:ring-2 focus:ring-primary/50 outline-none"
                                                        id={`po-input-${quote.id}`}
                                                    />
                                                    <button onClick={() => { const val = (document.getElementById(`po-input-${quote.id}`) as HTMLInputElement).value; handlePoUpdate(quote.id, val); }} className="p-1.5 bg-primary text-on-primary rounded-lg hover:bg-primary-hover ml-1 shadow-sm transition-colors" title="Save PO">
                                                        <Save className="w-3.5 h-3.5" />
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                        {projectQuotes.length === 0 && <p className="text-text-tertiary text-center py-8 italic text-sm">No quotes created yet.</p>}
                    </div>
                )}
            </div>
            
            {isModalOpen && (
                <ModalPortal>
                    <div className="fixed inset-0 bg-scrim/60 flex items-center justify-center z-50 p-4">
                        <div className="bg-surface-container-high p-6 rounded-2xl w-full max-w-2xl border border-outline/20 shadow-2xl">
                            <div className="flex justify-between items-center mb-6">
                                <h3 className="text-2xl font-bold text-text-primary">{editingQuote ? 'Edit Quote' : 'Add New Quote'}</h3>
                                <button onClick={onCloseModal} className="text-text-secondary hover:text-text-primary p-2 rounded-full hover:bg-surface-container-highest transition-colors">
                                    <X size={20} />
                                </button>
                            </div>
                            
                                <form onSubmit={handleSaveQuote}>
                                    <div className="mb-6">
                                        <label className="block text-sm font-semibold text-text-secondary mb-3">Installation Type</label>
                                        <div className="flex flex-wrap gap-x-4 gap-y-2">
                                            {INSTALLATION_TYPES.map(type => (
                                                <label key={type} className="flex items-center space-x-2 cursor-pointer group">
                                                    <input
                                                        type="radio" name="installationType" value={type}
                                                        checked={newQuote.installationType === type}
                                                        onChange={e => setNewQuote({ ...newQuote, installationType: e.target.value as InstallationType })}
                                                        className="form-radio h-5 w-5 text-primary bg-surface-container border-outline/50 focus:ring-primary"
                                                    />
                                                    <span className="text-text-primary group-hover:text-primary transition-colors">{type}</span>
                                                </label>
                                            ))}
                                        </div>
                                    </div>
                                    {(newQuote.installationType === 'Managed Installation' || newQuote.installationType === 'Unmanaged Installer') && (
                                        <div className="relative mb-6">
                                            <label className="block text-sm font-semibold text-text-secondary mb-1.5 ml-1">Installer</label>
                                            <input type="text" placeholder="Search for an installer..." value={installerSearchTerm} onChange={e => { setInstallerSearchTerm(e.target.value); setSelectedInstaller(null); }} className="w-full bg-surface-container border border-outline/50 rounded-lg px-4 py-2.5 text-text-primary placeholder:text-text-tertiary focus:ring-2 focus:ring-primary/50 outline-none" />
                                            {installerSearchTerm && !selectedInstaller && (
                                                <div className="absolute z-10 w-full bg-surface-container-high border border-outline/20 rounded-lg mt-1 max-h-48 overflow-y-auto shadow-xl">
                                                    {installerSearchResults.map(inst => (
                                                        <div key={inst.id} onClick={() => handleSelectInstaller(inst)} className="px-4 py-2.5 hover:bg-primary-container/30 cursor-pointer text-text-primary transition-colors">{inst.installerName}</div>
                                                    ))}
                                                    {installerSearchResults.length === 0 && (
                                                        <div className="p-4 text-center text-text-secondary text-sm">No results. <button type="button" onClick={handleShowAddNewInstaller} className="ml-2 text-primary font-bold hover:underline">Add New</button></div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                                        <div>
                                            <label className="block text-sm font-semibold text-text-secondary mb-1.5 ml-1">Materials Cost</label>
                                            <input type="number" step="0.01" placeholder="0.00" value={newQuote.materialsAmount} onChange={e => setNewQuote({ ...newQuote, materialsAmount: e.target.value })} className="w-full bg-surface-container border border-outline/50 rounded-lg px-4 py-2.5 text-text-primary focus:ring-2 focus:ring-primary/50 outline-none" required />
                                        </div>
                                        {newQuote.installationType === 'Managed Installation' && (
                                            <div>
                                                <label className="block text-sm font-semibold text-text-secondary mb-1.5 ml-1">Labor Cost</label>
                                                <input type="number" step="0.01" placeholder="0.00" value={newQuote.laborAmount} onChange={e => setNewQuote({ ...newQuote, laborAmount: e.target.value })} className="w-full bg-surface-container border border-outline/50 rounded-lg px-4 py-2.5 text-text-primary focus:ring-2 focus:ring-primary/50 outline-none" required />
                                            </div>
                                        )}
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6 items-center">
                                        {newQuote.installationType === 'Managed Installation' && (
                                            <div className="relative">
                                                <label className="block text-sm font-semibold text-text-secondary mb-1.5 ml-1">Installer Deposit %</label>
                                                <input type="number" value={newQuote.laborDepositPercentage} onChange={e => setNewQuote({ ...newQuote, laborDepositPercentage: e.target.value })} className="w-full bg-surface-container border border-outline/50 rounded-lg px-4 py-2.5 text-text-primary focus:ring-2 focus:ring-primary/50 outline-none" />
                                                <span className="absolute right-4 top-1/2 mt-3 -translate-y-1/2 text-text-tertiary font-bold">%</span>
                                            </div>
                                        )}
                                        <div className="bg-surface-container p-4 rounded-xl text-center self-end border border-outline/20 shadow-inner">
                                            <span className="text-xs text-text-secondary uppercase font-bold tracking-wider block mb-1">Required Deposit</span>
                                            <span className="text-2xl font-bold text-text-primary">${calculatedDeposit.toFixed(2)}</span>
                                        </div>
                                    </div>
                                    <textarea placeholder="Scope of work and specific terms..." value={newQuote.quoteDetails} onChange={e => setNewQuote({ ...newQuote, quoteDetails: e.target.value })} className="w-full bg-surface-container border border-outline/50 rounded-xl px-4 py-3 text-text-primary placeholder:text-text-tertiary focus:ring-2 focus:ring-primary/50 outline-none transition-all" rows={4}></textarea>
                                    <div className="flex justify-end gap-3 mt-8">
                                        <button type="button" onClick={onCloseModal} className="py-2.5 px-6 rounded-full border border-outline text-text-primary hover:bg-surface-container-highest transition-colors font-medium">Cancel</button>
                                        <button type="submit" disabled={(newQuote.installationType === 'Managed Installation' || newQuote.installationType === 'Unmanaged Installer') && !selectedInstaller} className="py-3 px-8 rounded-full bg-primary hover:bg-primary-hover text-on-primary font-bold shadow-lg transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed">{editingQuote ? 'Save Changes' : 'Add Quote'}</button>
                                    </div>
                                </form>
                        </div>
                    </div>
                </ModalPortal>
            )}
            {isInstallerModalOpen && (
                <ModalPortal>
                    <AddEditInstallerModal 
                        isOpen={isInstallerModalOpen} 
                        onClose={() => {
                            setIsInstallerModalOpen(false);
                            setInstallerSearchTerm(''); 
                        }} 
                        installer={null} 
                        initialData={{ 
                            installerName: installerSearchTerm,
                            type: newQuote.installationType === 'Unmanaged Installer' ? 'Unmanaged' : 'Managed'
                        }} 
                    />
                </ModalPortal>
            )}
        </div>
    );
};

export default QuotesSection;