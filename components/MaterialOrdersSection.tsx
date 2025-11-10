import React, { useState, useEffect, useMemo } from 'react';
import { useData } from '../context/DataContext';
import { Project, MaterialOrder, Sample } from '../types';
import { Edit, XCircle } from 'lucide-react';

interface MaterialOrdersSectionProps {
    project: Project;
    orders: MaterialOrder[];
    samples: Sample[];
    isModalOpen: boolean;
    onCloseModal: () => void;
    editingOrder: MaterialOrder | null;
    onEditOrder: (order: MaterialOrder) => void;
}

const MaterialOrdersSection: React.FC<MaterialOrdersSectionProps> = ({ project, orders, samples, isModalOpen, onCloseModal, editingOrder, onEditOrder }) => {
    
    const { addMaterialOrder, updateMaterialOrder, addSample } = useData();
    const [supplier, setSupplier] = useState('');
    const [etaDate, setEtaDate] = useState('');
    const [lineItems, setLineItems] = useState<{ sample: Sample; quantity: string; unitCost: string; }[]>([]);
    
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedSample, setSelectedSample] = useState<Sample | null>(null);
    const [isAddingNewSample, setIsAddingNewSample] = useState(false);
    const [newSampleForm, setNewSampleForm] = useState({ manufacturer: '', styleColor: '', sku: '', type: 'LVP' });

    const searchResults = useMemo(() => { 
        if (!searchTerm) return [];
        const lowercasedTerm = searchTerm.toLowerCase(); 
        return samples.filter(s => s.styleColor.toLowerCase().includes(lowercasedTerm) || (s.manufacturer && s.manufacturer.toLowerCase().includes(lowercasedTerm))); 
    }, [samples, searchTerm]);

    const formatDateForInput = (dateString: string | undefined | null) => dateString ? new Date(dateString).toISOString().split('T')[0] : '';

    useEffect(() => {
        if (editingOrder && isModalOpen) {
            setSupplier(editingOrder.supplier || '');
            setEtaDate(formatDateForInput(editingOrder.etaDate));
            const itemsToEdit = editingOrder.lineItems.map(item => {
                const sample = samples.find(s => s.id === item.sampleId);
                return {
                    sample: sample!,
                    quantity: String(item.quantity),
                    unitCost: item.unitCost != null ? String(item.unitCost) : '',
                };
            }).filter(item => item.sample);
            setLineItems(itemsToEdit);
        } else {
            setSupplier('');
            setEtaDate('');
            setLineItems([]);
        }
    }, [editingOrder, isModalOpen, samples]);

    const handleSelectSample = (sample: Sample) => { setSelectedSample(sample); setSearchTerm(sample.styleColor); };

    const handleAddLineItem = () => {
        if (selectedSample && !lineItems.some(item => item.sample.id === selectedSample.id)) {
            setLineItems(prev => [...prev, { sample: selectedSample, quantity: '1', unitCost: '' }]);
            setSearchTerm(''); setSelectedSample(null);
        }
    };

    const handleRemoveLineItem = (sampleId: number) => { setLineItems(prev => prev.filter(item => item.sample.id !== sampleId)); };

    const handleSaveNewSample = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const newlyAddedSample = await addSample(newSampleForm);
            setIsAddingNewSample(false);
            setSearchTerm(newlyAddedSample.styleColor);
            setSelectedSample(newlyAddedSample);
        } catch (error) { console.error("Failed to save new sample:", error); }
    };

    const handleSubmitOrder = async (e: React.FormEvent) => {
        e.preventDefault();
        if (lineItems.length === 0) { alert('Please add at least one line item to the order.'); return; }
        const orderData = {
            supplier, etaDate: etaDate || null,
            lineItems: lineItems.map(item => ({
                sampleId: item.sample.id,
                quantity: parseFloat(item.quantity) || 0,
                unitCost: item.unitCost ? parseFloat(item.unitCost) : null,
            })),
        };
        try { 
            if (editingOrder) {
                await updateMaterialOrder(editingOrder.id, orderData);
            } else {
                await addMaterialOrder({ ...orderData, projectId: project.id }); 
            }
            onCloseModal(); 
        } 
        catch (error) { console.error("Failed to save order:", error); }
    };

    return (
        <div>
            {orders.length === 0 ? ( <p className="text-text-secondary text-center py-4">No material orders placed yet.</p> ) : (
                <div className="space-y-4">
                    {orders.map(order => (
                        <div key={order.id} className="bg-gray-800 p-4 rounded-lg">
                            <div className="flex justify-between items-start mb-3">
                                <div>
                                    <p className="font-bold text-text-primary">{order.supplier || 'N/A'}</p>
                                    <p className="text-xs text-text-secondary">Order Date: {new Date(order.orderDate).toLocaleDateString()}</p>
                                </div>
                                <div className="flex items-center gap-4">
                                    <div className="text-right">
                                        <p className="text-sm font-semibold text-accent">{order.status}</p>
                                        <p className="text-xs text-text-secondary">ETA: {order.etaDate ? new Date(order.etaDate).toLocaleDateString() : 'N/A'}</p>
                                    </div>
                                    <button onClick={() => onEditOrder(order)} className="p-1 text-text-secondary hover:text-white"><Edit size={16}/></button>
                                </div>
                            </div>
                            <ul className="space-y-2 text-sm border-t border-gray-700 pt-3">
                                {order.lineItems.map(item => (
                                    <li key={item.id} className="flex justify-between items-center text-text-secondary">
                                        <span>{item.quantity} x {item.styleColor}</span>
                                        {item.unitCost != null && <span>@ ${Number(item.unitCost).toFixed(2)}</span>}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    ))}
                </div>
            )}

            {isModalOpen && (
                <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
                    <div className="bg-surface p-8 rounded-lg shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
                        <h2 className="text-2xl font-bold mb-6 text-text-primary">{editingOrder ? 'Edit Material Order' : 'Create Material Order'}</h2>
                        <form onSubmit={handleSubmitOrder}>
                            <div className="grid grid-cols-2 gap-4 mb-6">
                                <input type="text" placeholder="Supplier" value={supplier} onChange={e => setSupplier(e.target.value)} className="w-full p-2 bg-gray-800 border border-border rounded" />
                                <input type="date" value={etaDate} onChange={e => setEtaDate(e.target.value)} className="w-full p-2 bg-gray-800 border border-border rounded" />
                            </div>
                            <div className="bg-gray-900 p-4 rounded-lg">
                                <h3 className="font-semibold mb-2">Line Items</h3>
                                <div className="space-y-2 mb-4">
                                    {lineItems.map((item, index) => (
                                        <div key={item.sample.id} className="flex items-center gap-2 bg-gray-800 p-2 rounded">
                                            <span className="flex-grow text-sm">{item.sample.styleColor}</span>
                                            <input type="number" placeholder="Qty" value={item.quantity} onChange={e => { const newItems = [...lineItems]; newItems[index].quantity = e.target.value; setLineItems(newItems); }} className="w-20 p-1 bg-gray-700 border border-border rounded text-sm" />
                                            <input type="number" step="0.01" placeholder="Cost/Unit" value={item.unitCost} onChange={e => { const newItems = [...lineItems]; newItems[index].unitCost = e.target.value; setLineItems(newItems); }} className="w-24 p-1 bg-gray-700 border border-border rounded text-sm" />
                                            <button type="button" onClick={() => handleRemoveLineItem(item.sample.id)} className="text-red-400 hover:text-red-600"><XCircle size={18} /></button>
                                        </div>
                                    ))}
                                </div>
                                {!isAddingNewSample && (
                                    <div className="flex gap-2">
                                        <div className="relative flex-grow">
                                            <input type="text" placeholder="Search for material to add..." value={searchTerm} onChange={e => { setSearchTerm(e.target.value); setSelectedSample(null); }} className="w-full p-2 bg-gray-800 border-border rounded" />
                                            {searchTerm && !selectedSample && (
                                                <div className="absolute z-10 w-full bg-gray-900 border border-border rounded-b-md mt-1 max-h-40 overflow-y-auto">
                                                    {searchResults.map(s => ( <div key={s.id} onClick={() => handleSelectSample(s)} className="p-2 hover:bg-accent cursor-pointer">{s.styleColor}</div> ))}
                                                    {searchResults.length === 0 && ( <div className="p-2 text-center text-text-secondary">No results. <button type="button" onClick={() => { setIsAddingNewSample(true); setNewSampleForm(prev => ({ ...prev, styleColor: searchTerm })); }} className="ml-2 text-accent font-semibold hover:underline">Add it?</button></div> )}
                                                </div>
                                            )}
                                        </div>
                                        <button type="button" onClick={handleAddLineItem} disabled={!selectedSample} className="py-2 px-4 bg-primary rounded disabled:bg-gray-500">Add Item</button>
                                    </div>
                                )}
                                {isAddingNewSample && (
                                    <div className="bg-gray-800 p-4 rounded mt-2">
                                        <p className="text-sm text-text-secondary mb-2">Adding new material to library...</p>
                                        <div className="space-y-2">
                                            <input type="text" placeholder="Style / Color" value={newSampleForm.styleColor} onChange={e => setNewSampleForm({...newSampleForm, styleColor: e.target.value})} className="w-full p-2 bg-gray-700 border-border rounded" />
                                            <input type="text" placeholder="Manufacturer" value={newSampleForm.manufacturer || ''} onChange={e => setNewSampleForm({...newSampleForm, manufacturer: e.target.value})} className="w-full p-2 bg-gray-700 border-border rounded" />
                                        </div>
                                        <div className="flex justify-end gap-2 mt-4">
                                            <button type="button" onClick={() => setIsAddingNewSample(false)} className="py-1 px-3 bg-gray-600 rounded">Cancel</button>
                                            <button type="button" onClick={handleSaveNewSample} className="py-1 px-3 bg-primary rounded">Save & Add</button>
                                        </div>
                                    </div>
                                )}
                            </div>
                            <div className="flex justify-end space-x-4 mt-8">
                                <button type="button" onClick={onCloseModal} className="py-2 px-4 bg-gray-600 hover:bg-gray-700 rounded text-white">Cancel</button>
                                <button type="submit" className="py-2 px-4 bg-primary hover:bg-secondary rounded text-white">{editingOrder ? 'Save Changes' : 'Create Order'}</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default MaterialOrdersSection;