import React from 'react';
import { useData } from '../context/DataContext';
import { Project, MaterialOrder } from '../types';
import { Edit, Trash2, Package as PackageIcon, Move } from 'lucide-react';
import { formatCurrency } from '../utils/pricingUtils';
import AddEditMaterialOrderModal from './AddEditMaterialOrderModal';

interface MaterialOrdersSectionProps {
    project: Project;
    orders: MaterialOrder[];
    isModalOpen: boolean;
    onCloseModal: () => void;
    editingOrder: MaterialOrder | null;
    onEditOrder: (order: MaterialOrder) => void;
}

const MaterialOrdersSection: React.FC<MaterialOrdersSectionProps> = ({ project, orders, isModalOpen, onCloseModal, editingOrder, onEditOrder }) => {
    
    const { currentUser, deleteMaterialOrder } = useData();
    
    const handleDeleteOrder = async (orderId: number) => {
        if (window.confirm('Are you sure you want to delete this material order? This action cannot be undone.')) {
            try { await deleteMaterialOrder(orderId); } catch (error) { console.error("Failed to delete order:", error); }
        }
    };
    
    return (
        <div className="bg-surface rounded-lg shadow-md flex flex-col h-full">
            <div className="p-4 border-b border-border flex justify-between items-center flex-shrink-0">
                <div className="flex items-center gap-3">
                    <Move className="drag-handle cursor-move text-text-tertiary hover:text-text-primary transition-colors" size={20} />
                    <PackageIcon className="w-6 h-6 text-accent" />
                    <h3 className="text-xl font-semibold text-text-primary">Material Orders</h3>
                </div>
                <button 
                  onClick={() => onEditOrder(null as any)}
                  className="bg-primary hover:bg-primary-hover text-on-primary font-bold py-1 px-3 text-sm rounded-lg"
                >
                    Add Order
                </button>
            </div>
            
            <div className="p-4 overflow-y-auto flex-grow">
                {orders.length === 0 ? ( <p className="text-text-secondary text-center py-4">No material orders placed yet.</p> ) : (
                    <div className="space-y-4">
                        {orders.map(order => (
                            <div key={order.id} className="bg-background p-4 rounded-lg">
                                <div className="flex justify-between items-start mb-3">
                                    <div>
                                        <p className="font-bold text-text-primary">{order.supplierName || 'N/A'}</p>
                                        <p className="text-xs text-text-secondary">Order Date: {new Date(order.orderDate).toLocaleDateString()}</p>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <div className="text-right">
                                            <p className="text-sm font-semibold text-accent">{order.status}</p>
                                            <p className="text-xs text-text-secondary">ETA: {order.etaDate ? new Date(order.etaDate).toLocaleDateString() : 'N/A'}</p>
                                        </div>
                                        <button onClick={() => onEditOrder(order)} className="p-1 text-text-secondary hover:text-text-primary"><Edit size={16}/></button>
                                        {currentUser?.roles?.includes('Admin') && (
                                            <button onClick={() => handleDeleteOrder(order.id)} className="p-1 text-red-500 hover:text-red-400"><Trash2 size={16}/></button>
                                        )}
                                    </div>
                                </div>
                                <ul className="space-y-2 text-sm border-t border-border pt-3">{order.lineItems.map(item => (<li key={item.id} className="flex justify-between items-center text-text-secondary"><span>{item.quantity} {item.unit || ''} x {`${item.style}${item.color ? ` - ${item.color}` : ''}`}</span>{item.totalCost != null && <span>{formatCurrency(Number(item.totalCost))}</span>}</li>))}</ul>
                            </div>
                        ))}
                    </div>
                )}
            </div>
            {isModalOpen && (
                <AddEditMaterialOrderModal 
                    isOpen={isModalOpen} 
                    onClose={onCloseModal} 
                    editingOrder={editingOrder} 
                    initialProjectId={project.id} 
                />
            )}
        </div>
    );
};

export default MaterialOrdersSection;