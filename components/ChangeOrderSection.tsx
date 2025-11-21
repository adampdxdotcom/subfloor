import React, { useState, useEffect } from 'react';
import { Project, ChangeOrder, Quote } from '../types';
import { Edit, PlusCircle, Move } from 'lucide-react'; // <-- IMPORT Move

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
        // --- MODIFIED: Add flexbox structure and h-full ---
        <div className="bg-surface rounded-lg shadow-md flex flex-col h-full">
            {/* --- MODIFIED: CARD HEADER - Make non-shrinkable --- */}
            <div className="p-4 border-b border-border flex justify-between items-center flex-shrink-0">
                <div className="flex items-center gap-3">
                    {/* --- NEW: Drag Handle --- */}
                    <Move className="drag-handle cursor-move text-text-secondary hover:text-text-primary transition-colors" size={20} />
                    <PlusCircle className="w-6 h-6 text-accent" />
                    <h3 className="text-xl font-semibold text-text-primary">Change Orders</h3>
                </div>
            </div>

            {/* --- MODIFIED: CARD BODY - Now scrollable --- */}
            <div className="p-4 overflow-y-auto flex-grow">
                <div className="space-y-3">
                    {projectChangeOrders.map(order => (
                        <div key={order.id} className={`flex justify-between items-center p-3 rounded-md bg-background ${Number(order.amount) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                            <div>
                                <p>{order.description}</p>
                                <p className="text-xs text-text-secondary">
                                    {order.type}
                                    {getQuoteIdentifier(order.quoteId) && <span className="ml-2 pl-2 border-l border-border">{getQuoteIdentifier(order.quoteId)}</span>}
                                </p>
                            </div>
                            <div className="flex items-center">
                                <span className="font-bold">{Number(order.amount) >= 0 ? '+' : ''}${Number(order.amount).toFixed(2)}</span>
                                <button onClick={() => onEditChangeOrder(order)} className="ml-4 p-1 text-text-secondary hover:text-text-primary rounded-full hover:bg-surface" title="Edit Change Order">
                                    <Edit size={16} />
                                </button>
                            </div>
                        </div>
                    ))}
                    {projectChangeOrders.length === 0 && <p className="text-text-secondary text-center py-4">No change orders added yet.</p>}
                </div>
            </div>
            
            {/* --- MODIFIED: CARD FOOTER - Make non-shrinkable --- */}
            <div className="p-4 border-t border-border bg-surface rounded-b-lg flex-shrink-0">
                <form onSubmit={handleAddChangeOrder} className={`grid grid-cols-1 ${formGridCols} gap-4 items-end`}>
                    <div className="md:col-span-2"><label className="block text-sm font-medium text-text-secondary mb-1">Description</label><input type="text" value={description} onChange={e => setDescription(e.target.value)} className="w-full p-2 bg-background border-border rounded text-text-primary" required /></div>
                    
                    {acceptedQuotes.length > 1 && (
                        <div>
                            <label className="block text-sm font-medium text-text-secondary mb-1">For Quote</label>
                            <select 
                                value={selectedQuoteId} 
                                onChange={e => setSelectedQuoteId(e.target.value)} 
                                className="w-full p-2 bg-background border-border rounded h-10 text-text-primary"
                            >
                                {acceptedQuotes.map((q, index) => (
                                    <option key={q.id} value={String(q.id)}>
                                        Quote #{index + 1}
                                    </option>
                                ))}
                            </select>
                        </div>
                    )}
                    
                    <div><label className="block text-sm font-medium text-text-secondary mb-1">Type</label><select value={type} onChange={e => setType(e.target.value as 'Materials' | 'Labor')} className="w-full p-2 bg-background border-border rounded h-10 text-text-primary"><option value="Materials">Materials</option><option value="Labor">Labor</option></select></div>
                    <div className="md:col-span-2"><label className="block text-sm font-medium text-text-secondary mb-1">Amount</label><input type="number" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} placeholder="e.g., -50.00" className="w-full p-2 bg-background border-border rounded text-text-primary" required /></div>
                    
                    <button type="submit" className={`bg-primary hover:bg-primary-hover text-on-primary font-bold py-2 px-4 rounded-lg h-10 ${addButtonColStart}`}>Add</button>
                </form>
            </div>
        </div>
    );
};

export default ChangeOrderSection;