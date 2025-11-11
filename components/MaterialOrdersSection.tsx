import React, { useState, useEffect, useMemo } from 'react';
import { useData } from '../context/DataContext';
import { Project, MaterialOrder, Sample, Unit, UNITS, Vendor } from '../types';
import { Edit, Trash2, XCircle } from 'lucide-react';
import AddEditVendorModal from './AddEditVendorModal';
import AddSampleInlineModal from './AddSampleInlineModal'; // Import the centralized sample modal

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
    
    const { vendors, addVendor, addMaterialOrder, updateMaterialOrder, deleteMaterialOrder } = useData();
    const [supplierId, setSupplierId] = useState<number | null>(null);
    const [supplierSearch, setSupplierSearch] = useState('');
    const [etaDate, setEtaDate] = useState('');
    const [lineItems, setLineItems] = useState<{ sample: Sample; quantity: string; unit: Unit; totalCost: string; }[]>([]);
    
    const [sampleSearchTerm, setSampleSearchTerm] = useState('');
    const [selectedSample, setSelectedSample] = useState<Sample | null>(null);
    const [isAddingNewSample, setIsAddingNewSample] = useState(false);
    const [isVendorModalOpen, setIsVendorModalOpen] = useState(false);

    const supplierList = useMemo(() => vendors.filter(v => v.isSupplier), [vendors]);

    const supplierSearchResults = useMemo(() => {
        if (!supplierSearch.trim() || supplierId) return [];
        return supplierList.filter(s => s.name.toLowerCase().includes(supplierSearch.toLowerCase()));
    }, [supplierList, supplierSearch, supplierId]);

    const sampleSearchResults = useMemo(() => { 
        if (!sampleSearchTerm) return [];
        const lowercasedTerm = sampleSearchTerm.toLowerCase(); 
        return samples.filter(s => s.styleColor.toLowerCase().includes(lowercasedTerm) || (s.manufacturerName && s.manufacturerName.toLowerCase().includes(lowercasedTerm))); 
    }, [samples, sampleSearchTerm]);

    const formatDateForInput = (dateString: string | undefined | null) => dateString ? new Date(dateString).toISOString().split('T')[0] : '';

    useEffect(() => {
        if (editingOrder && isModalOpen) {
            setSupplierId(editingOrder.supplierId || null);
            const currentSupplier = vendors.find(v => v.id === editingOrder.supplierId);
            setSupplierSearch(currentSupplier?.name || '');
            setEtaDate(formatDateForInput(editingOrder.etaDate));
            const itemsToEdit = editingOrder.lineItems.map(item => {
                const sample = samples.find(s => s.id === item.sampleId);
                return {
                    sample: sample!,
                    quantity: String(item.quantity),
                    unit: item.unit || 'SF',
                    totalCost: item.totalCost != null ? String(item.totalCost) : '',
                };
            }).filter(item => item.sample);
            setLineItems(itemsToEdit);
        } else {
            setSupplierId(null);
            setSupplierSearch('');
            setEtaDate('');
            setLineItems([]);
        }
    }, [editingOrder, isModalOpen, samples, vendors]);

    const handleSupplierSelect = (vendorId: number) => {
        setSupplierId(vendorId);
        const selectedVendor = vendors.find(v => v.id === vendorId);
        setSupplierSearch(selectedVendor?.name || '');
        if (selectedVendor?.dedicatedShippingDay !== null && selectedVendor?.dedicatedShippingDay !== undefined) {
            const deliveryDay = selectedVendor.dedicatedShippingDay;
            const today = new Date();
            let daysUntilDelivery = deliveryDay - today.getDay();
            if (daysUntilDelivery <= 0) daysUntilDelivery += 7;
            const nextDeliveryDate = new Date();
            nextDeliveryDate.setDate(today.getDate() + daysUntilDelivery);
            setEtaDate(formatDateForInput(nextDeliveryDate.toISOString()));
        }
    };

    const handleSelectSample = (sample: Sample) => { 
        setSelectedSample(sample); 
        setSampleSearchTerm(sample.styleColor); 
    };

    const handleAddLineItem = () => {
        if (selectedSample && !lineItems.some(item => item.sample.id === selectedSample.id)) {
            setLineItems(prev => [...prev, { sample: selectedSample, quantity: '1', unit: 'SF', totalCost: '' }]);
            if (!supplierId && selectedSample.manufacturerId) {
                const manufacturer = vendors.find(v => v.id === selectedSample.manufacturerId);
                if (manufacturer && manufacturer.isSupplier) {
                    handleSupplierSelect(manufacturer.id);
                }
            }
            setSampleSearchTerm(''); 
            setSelectedSample(null);
        }
    };

    const handleRemoveLineItem = (sampleId: number) => { setLineItems(prev => prev.filter(item => item.sample.id !== sampleId)); };

    const handleDeleteOrder = async (orderId: number) => {
        if (window.confirm('Are you sure you want to delete this material order? This action cannot be undone.')) {
            try { await deleteMaterialOrder(orderId); } catch (error) { console.error("Failed to delete order:", error); }
        }
    };
    
    const handleSaveVendor = async (vendorData: Omit<Vendor, 'id'> | Vendor) => {
        try {
            await addVendor(vendorData as Omit<Vendor, 'id'>);
            setIsVendorModalOpen(false);
        } catch (error) { console.error(error); }
    };
    
    const onSampleCreated = (createdSample: Sample) => {
        setIsAddingNewSample(false);
        setLineItems(prev => [...prev, { sample: createdSample, quantity: '1', unit: 'SF', totalCost: '' }]);
        setSampleSearchTerm('');
        setSelectedSample(null);
    };

    const handleSubmitOrder = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!supplierId) { alert('Please select a supplier.'); return; }
        if (lineItems.length === 0) { alert('Please add at least one line item to the order.'); return; }
        const orderData = { supplierId, etaDate: etaDate || null, lineItems: lineItems.map(item => ({ sampleId: item.sample.id, quantity: parseFloat(item.quantity) || 0, unit: item.unit, totalCost: item.totalCost ? parseFloat(item.totalCost) : null, })) };
        try { 
            if (editingOrder) { await updateMaterialOrder(editingOrder.id, orderData); } 
            else { await addMaterialOrder({ ...orderData, projectId: project.id }); }
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
                                <div><p className="font-bold text-text-primary">{order.supplierName || 'N/A'}</p><p className="text-xs text-text-secondary">Order Date: {new Date(order.orderDate).toLocaleDateString()}</p></div>
                                <div className="flex items-center gap-2"><div className="text-right"><p className="text-sm font-semibold text-accent">{order.status}</p><p className="text-xs text-text-secondary">ETA: {order.etaDate ? new Date(order.etaDate).toLocaleDateString() : 'N/A'}</p></div><button onClick={() => onEditOrder(order)} className="p-1 text-text-secondary hover:text-white"><Edit size={16}/></button><button onClick={() => handleDeleteOrder(order.id)} className="p-1 text-red-500 hover:text-red-400"><Trash2 size={16}/></button></div>
                            </div>
                            <ul className="space-y-2 text-sm border-t border-gray-700 pt-3">{order.lineItems.map(item => (<li key={item.id} className="flex justify-between items-center text-text-secondary"><span>{item.quantity} {item.unit || ''} x {item.styleColor}</span>{item.totalCost != null && <span>$ {Number(item.totalCost).toFixed(2)}</span>}</li>))}</ul>
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
                                <div className="relative">
                                    <label htmlFor="supplier" className="block text-sm font-medium text-text-secondary mb-1">Supplier</label>
                                    <input id="supplier" type="text" placeholder="Search for a supplier..." value={supplierSearch} onChange={e => { setSupplierSearch(e.target.value); setSupplierId(null); }} className="w-full p-2 bg-gray-800 border border-border rounded" required />
                                    {supplierSearch && !supplierId && (
                                        <div className="absolute z-20 w-full bg-gray-900 border border-border rounded-b-md mt-1 max-h-40 overflow-y-auto">
                                            {supplierSearchResults.map(vendor => (<div key={vendor.id} onClick={() => handleSupplierSelect(vendor.id)} className="p-2 hover:bg-accent cursor-pointer">{vendor.name}</div>))}
                                             <div onClick={() => setIsVendorModalOpen(true)} className="p-2 text-accent font-semibold hover:bg-accent hover:text-white cursor-pointer text-center border-t border-border">+ Add New Supplier</div>
                                        </div>
                                    )}
                                </div>
                                <div><label htmlFor="etaDate" className="block text-sm font-medium text-text-secondary mb-1">ETA</label><input id="etaDate" type="date" value={etaDate} onChange={e => setEtaDate(e.target.value)} className="w-full p-2 bg-gray-800 border border-border rounded" /></div>
                            </div>
                            <div className="bg-gray-900 p-4 rounded-lg">
                                <h3 className="font-semibold mb-2 text-text-primary">Line Items</h3>
                                <div className="space-y-2 mb-4">{lineItems.map((item, index) => { const updateItem = (field: 'quantity'|'unit'|'totalCost', value: string|Unit) => { const newItems = [...lineItems]; (newItems[index] as any)[field] = value; setLineItems(newItems); }; return (<div key={item.sample.id} className="grid grid-cols-[1fr,auto,auto,auto,auto] items-center gap-2 bg-gray-800 p-2 rounded"><span className="flex-grow text-sm text-text-primary truncate" title={item.sample.styleColor}>{item.sample.styleColor}</span><input type="number" placeholder="Qty" value={item.quantity} onChange={e => updateItem('quantity', e.target.value)} className="w-20 p-1 bg-gray-700 border-border rounded text-sm" /><select value={item.unit} onChange={e => updateItem('unit', e.target.value as Unit)} className="p-1 bg-gray-700 border-border rounded text-sm appearance-none text-center">{UNITS.map(u => <option key={u} value={u}>{u}</option>)}</select><input type="number" step="0.01" placeholder="Total Cost" value={item.totalCost} onChange={e => updateItem('totalCost', e.target.value)} className="w-28 p-1 bg-gray-700 border-border rounded text-sm" /><button type="button" onClick={() => handleRemoveLineItem(item.sample.id)} className="text-red-400 hover:text-red-600"><XCircle size={18}/></button></div>);})}</div>
                                
                                <div className="flex gap-2">
                                    <div className="relative flex-grow">
                                        <input type="text" placeholder="Search for material to add..." value={sampleSearchTerm} onChange={e => { setSampleSearchTerm(e.target.value); setSelectedSample(null); }} className="w-full p-2 bg-gray-800 border-border rounded" />
                                        {sampleSearchTerm && !selectedSample && (
                                            <div className="absolute z-10 w-full bg-gray-900 border border-border rounded-b-md mt-1 max-h-40 overflow-y-auto">
                                                {sampleSearchResults.map(s => ( <div key={s.id} onClick={() => handleSelectSample(s)} className="p-2 hover:bg-accent cursor-pointer">{s.styleColor}</div> ))}
                                                {sampleSearchResults.length === 0 && ( <div className="p-2 text-center text-text-secondary">No results. <button type="button" onClick={() => setIsAddingNewSample(true)} className="ml-2 text-accent font-semibold hover:underline">Add it?</button></div> )}
                                            </div>
                                        )}
                                    </div>
                                    <button type="button" onClick={handleAddLineItem} disabled={!selectedSample} className="py-2 px-4 bg-primary rounded disabled:bg-gray-500">Add Item</button>
                                </div>
                            </div>
                            <div className="flex justify-end space-x-4 mt-8"><button type="button" onClick={onCloseModal} className="py-2 px-4 bg-gray-600 hover:bg-gray-700 rounded text-white">Cancel</button><button type="submit" className="py-2 px-4 bg-primary hover:bg-secondary rounded text-white">{editingOrder ? 'Save Changes' : 'Create Order'}</button></div>
                        </form>
                    </div>
                </div>
            )}
            
            <AddEditVendorModal isOpen={isVendorModalOpen} onClose={() => setIsVendorModalOpen(false)} onSave={handleSaveVendor} />
            
            {isAddingNewSample && (
                 <AddSampleInlineModal isOpen={isAddingNewSample} onClose={() => setIsAddingNewSample(false)} onSampleCreated={onSampleCreated} initialStyleColor={sampleSearchTerm} />
            )}
        </div>
    );
};

export default MaterialOrdersSection;