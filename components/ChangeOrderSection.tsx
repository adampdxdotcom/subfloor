import React, { useState } from 'react';
import { Project, ChangeOrder } from '../types';
import { Edit } from 'lucide-react';

interface ChangeOrderSectionProps {
    project: Project;
    projectChangeOrders: ChangeOrder[];
    addChangeOrder: (changeOrder: Omit<ChangeOrder, 'id' | 'createdAt'> & { projectId: number }) => Promise<void>;
    onEditChangeOrder: (changeOrder: ChangeOrder) => void;
}

const ChangeOrderSection: React.FC<ChangeOrderSectionProps> = ({ project, projectChangeOrders, addChangeOrder, onEditChangeOrder }) => {
    const [description, setDescription] = useState('');
    const [amount, setAmount] = useState('');
    const [type, setType] = useState<'Materials' | 'Installer'>('Materials');

    const handleAddChangeOrder = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!description || !amount) {
            alert('Please provide a description and an amount.');
            return;
        }
        await addChangeOrder({ projectId: project.id, description, amount: parseFloat(amount), type });
        setDescription('');
        setAmount('');
    };

    return (
        <div>
            <div className="space-y-3 mb-6">
                {projectChangeOrders.map(order => (
                    <div key={order.id} className={`flex justify-between items-center p-3 rounded-md bg-gray-800 ${Number(order.amount) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        <div>
                            <p>{order.description}</p>
                            <p className="text-xs text-gray-400">{order.type}</p>
                        </div>
                        <div className="flex items-center">
                            <span className="font-bold">{Number(order.amount) >= 0 ? '+' : ''}${Number(order.amount).toFixed(2)}</span>
                            <button onClick={() => onEditChangeOrder(order)} className="ml-4 p-1 text-text-secondary hover:text-white rounded-full hover:bg-gray-700" title="Edit Change Order">
                                <Edit size={16} />
                            </button>
                        </div>
                    </div>
                ))}
                {projectChangeOrders.length === 0 && <p className="text-text-secondary text-center py-4">No change orders added yet.</p>}
            </div>
            <form onSubmit={handleAddChangeOrder} className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                <div className="md:col-span-2"><label className="block text-sm font-medium text-text-secondary mb-1">Description</label><input type="text" value={description} onChange={e => setDescription(e.target.value)} className="w-full p-2 bg-gray-800 border-border rounded" required /></div>
                <div><label className="block text-sm font-medium text-text-secondary mb-1">Type</label><select value={type} onChange={e => setType(e.target.value as 'Materials' | 'Installer')} className="w-full p-2 bg-gray-800 border-border rounded h-10"><option>Materials</option><option>Installer</option></select></div>
                <div className="md:col-span-2"><label className="block text-sm font-medium text-text-secondary mb-1">Amount</label><input type="number" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} placeholder="e.g., -50.00" className="w-full p-2 bg-gray-800 border-border rounded" required /></div>
                <button type="submit" className="bg-primary hover:bg-secondary text-white font-bold py-2 px-4 rounded-lg h-10">Add</button>
            </form>
        </div>
    );
};

export default ChangeOrderSection;