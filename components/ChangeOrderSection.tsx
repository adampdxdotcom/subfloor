import React, { useState, useEffect } from 'react';
import { Project, ChangeOrder, Quote } from '../types';
import { Edit, PlusCircle, Move } from 'lucide-react';

interface ChangeOrderSectionProps {
    project: Project;
    projectChangeOrders: ChangeOrder[];
    acceptedQuotes: Quote[];
    addChangeOrder: (changeOrder: Omit<ChangeOrder, 'id' | 'createdAt'> & { projectId: number }) => Promise<void>;
    onEditChangeOrder: (changeOrder: ChangeOrder) => void;
}

const ChangeOrderSection: React.FC<ChangeOrderSectionProps> = ({ project, projectChangeOrders, acceptedQuotes, addChangeOrder, onEditChangeOrder }) => {
    const [description, setDescription] = useState('');
    const [amount, setAmount] = useState('');
    const [type, setType] = useState<'Materials' | 'Labor'>('Materials');
    const [selectedQuoteId, setSelectedQuoteId] = useState<string>('');

    useEffect(() => {
        if (acceptedQuotes && acceptedQuotes.length > 0) {
            setSelectedQuoteId(String(acceptedQuotes[0].id));
        }
    }, [acceptedQuotes]);

    const handleAddChangeOrder = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!description || !amount) {
            alert('Please provide a description and an amount.');
            return;
        }

        let finalQuoteId: number | undefined;

        if (selectedQuoteId) {
            finalQuoteId = parseInt(selectedQuoteId, 10);
        } else if (acceptedQuotes.length > 0) {
            finalQuoteId = acceptedQuotes[0].id;
        }

        if (acceptedQuotes.length > 1 && !finalQuoteId) {
            alert('Please select which quote this change order applies to.');
            return;
        }
        
        await addChangeOrder({ 
            projectId: project.id, 
            quoteId: finalQuoteId, 
            description, 
            amount: parseFloat(amount), 
            type 
        });

        setDescription('');
        setAmount('');
    };

    const getQuoteIdentifier = (quoteId: number | null | undefined) => {
        if (!quoteId || acceptedQuotes.length <= 1) return null;
        const quoteIndex = acceptedQuotes.findIndex(q => q.id === quoteId);
        if (quoteIndex === -1) return "For an unknown quote";
        return `For Quote #${quoteIndex + 1}`;
    };

    const formGridCols = acceptedQuotes.length > 1 ? 'md:grid-cols-4' : 'md:grid-cols-3';
    const addButtonColStart = acceptedQuotes.length > 1 ? 'md:col-start-4' : 'md:col-start-3';

    return (
        <div className="flex flex-col h-full">
            {/* CARD HEADER */}
            <div className="p-4 border-b border-outline/10 flex justify-between items-center flex-shrink-0">
                <div className="flex items-center gap-3">
                    {/* Drag Handle */}
                    <Move className="drag-handle cursor-move text-text-secondary hover:text-text-primary transition-colors" size={20} />
                    <PlusCircle className="w-6 h-6 text-primary" />
                    <h3 className="text-xl font-semibold text-text-primary">Change Orders</h3>
                </div>
            </div>

            {/* CARD BODY */}
            <div className="p-4 overflow-y-auto flex-grow">
                <div className="space-y-3">
                    {projectChangeOrders.map(order => (
                        <div key={order.id} className={`flex justify-between items-center p-3 rounded-lg bg-surface-container ${Number(order.amount) >= 0 ? 'text-tertiary' : 'text-error'}`}>
                            <div>
                                <p className="font-medium">{order.description}</p>
                                <p className="text-xs text-text-secondary">
                                    {order.type}
                                    {getQuoteIdentifier(order.quoteId) && <span className="ml-2 pl-2 border-l border-outline/20">{getQuoteIdentifier(order.quoteId)}</span>}
                                </p>
                            </div>
                            <div className="flex items-center">
                                <span className="font-bold">{Number(order.amount) >= 0 ? '+' : ''}${Number(order.amount).toFixed(2)}</span>
                                <button onClick={() => onEditChangeOrder(order)} className="ml-4 p-1 text-text-secondary hover:text-text-primary rounded-full hover:bg-surface-container-highest transition-colors" title="Edit Change Order">
                                    <Edit size={16} />
                                </button>
                            </div>
                        </div>
                    ))}
                    {projectChangeOrders.length === 0 && <p className="text-text-secondary text-center py-4">No change orders added yet.</p>}
                </div>
            </div>
            
            {/* CARD FOOTER */}
            <div className="p-4 border-t border-outline/10 bg-surface-container-low flex-shrink-0">
                <form onSubmit={handleAddChangeOrder} className={`grid grid-cols-1 ${formGridCols} gap-4 items-end`}>
                    <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-text-secondary mb-1">Description</label>
                        <input type="text" value={description} onChange={e => setDescription(e.target.value)} className="w-full bg-surface-container border border-outline/50 rounded-lg px-4 py-2.5 text-text-primary placeholder:text-text-tertiary focus:ring-2 focus:ring-primary/50 outline-none" required />
                    </div>
                    
                    {acceptedQuotes.length > 1 && (
                        <div>
                            <label className="block text-sm font-medium text-text-secondary mb-1">For Quote</label>
                            <select 
                                value={selectedQuoteId} 
                                onChange={e => setSelectedQuoteId(e.target.value)} 
                                className="w-full bg-surface-container border border-outline/50 rounded-lg px-4 py-2.5 text-text-primary placeholder:text-text-tertiary focus:ring-2 focus:ring-primary/50 outline-none"
                            >
                                {acceptedQuotes.map((q, index) => (
                                    <option key={q.id} value={String(q.id)}>
                                        Quote #{index + 1}
                                    </option>
                                ))}
                            </select>
                        </div>
                    )}
                    
                    <div>
                        <label className="block text-sm font-medium text-text-secondary mb-1">Type</label>
                        <select value={type} onChange={e => setType(e.target.value as 'Materials' | 'Labor')} className="w-full bg-surface-container border border-outline/50 rounded-lg px-4 py-2.5 text-text-primary placeholder:text-text-tertiary focus:ring-2 focus:ring-primary/50 outline-none">
                            <option value="Materials">Materials</option>
                            <option value="Labor">Labor</option>
                        </select>
                    </div>
                    
                    <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-text-secondary mb-1">Amount</label>
                        <input type="number" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} placeholder="e.g., -50.00" className="w-full bg-surface-container border border-outline/50 rounded-lg px-4 py-2.5 text-text-primary placeholder:text-text-tertiary focus:ring-2 focus:ring-primary/50 outline-none" required />
                    </div>
                    
                    <button type="submit" className={`bg-primary hover:bg-primary-hover text-on-primary font-bold py-2.5 px-4 rounded-full transition-all shadow-md active:scale-95 ${addButtonColStart}`}>Add</button>
                </form>
            </div>
        </div>
    );
};

export default ChangeOrderSection;