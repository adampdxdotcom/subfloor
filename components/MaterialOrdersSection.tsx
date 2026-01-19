import React from 'react';
import { Project, MaterialOrder } from '../types';
import { Edit, Trash2, Package as PackageIcon, Move } from 'lucide-react';
import { formatCurrency } from '../utils/pricingUtils';
import AddEditMaterialOrderModal from './AddEditMaterialOrderModal';
import ModalPortal from './ModalPortal'; 
import { formatDate } from '../utils/dateUtils';
import { useMaterialOrderMutations } from '../hooks/useMaterialOrderMutations';
import { useProducts } from '../hooks/useProducts';
import { useData } from '../context/DataContext';
import { toast } from 'react-hot-toast';

interface MaterialOrdersSectionProps {
    project: Project;
    orders: MaterialOrder[];
    isModalOpen: boolean;
    onCloseModal: () => void;
    editingOrder: MaterialOrder | null;
    onEditOrder: (order: MaterialOrder) => void;
}

const MaterialOrdersSection: React.FC<MaterialOrdersSectionProps> = ({ project, orders, isModalOpen, onCloseModal, editingOrder, onEditOrder }) => {
    const { currentUser, systemBranding } = useData();
    const { data: products = [] } = useProducts();
    const { deleteMaterialOrder } = useMaterialOrderMutations();

    const handleDeleteOrder = async (orderId: number) => {
        if (window.confirm('Are you sure you want to delete this material order? This action cannot be undone.')) {
            try {
                await deleteMaterialOrder(orderId);
                toast.success('Order deleted successfully.');
            } catch (error) { 
                toast.error('Failed to delete order.'); 
                console.error("Failed to delete order:", error); 
            }
        }
    };

    const getPricingUnit = (sampleId: number | string, fallbackUnit: string | null) => {
        if (!products) return fallbackUnit;
        const variant = products.flatMap(p => p.variants).find(v => v.id === String(sampleId));
        return variant?.pricingUnit || fallbackUnit || '';
    };
    
    return (
        <div className="flex flex-col h-full">
            <div className="p-4 border-b border-outline/10 flex justify-between items-center flex-shrink-0">
                <div className="flex items-center gap-3">
                    <Move className="drag-handle cursor-move text-text-secondary hover:text-text-primary transition-colors" size={20} />
                    <PackageIcon className="w-6 h-6 text-primary" />
                    <h3 className="text-xl font-semibold text-text-primary">Material Orders</h3>
                </div>
                <button 
                  onClick={() => onEditOrder(null as any)}
                  className="bg-primary hover:bg-primary-hover text-on-primary font-semibold py-1 px-4 text-sm rounded-full"
                >
                    Add Order
                </button>
            </div>
            
            <div className="p-4 overflow-y-auto flex-grow scrollbar-thin scrollbar-thumb-surface-container-highest">
                {orders.length === 0 ? ( <p className="text-text-secondary text-center py-4">No material orders placed yet.</p> ) : (
                    <div className="space-y-4">
                        {orders.map(order => (
                            <div key={order.id} className="bg-surface-container p-4 rounded-xl border border-outline/20">
                                <div className="flex justify-between items-start mb-3">
                                    <div>
                                        <p className="font-bold text-text-primary">{order.supplierName || 'N/A'}</p>
                                        <p className="text-xs text-text-secondary">Order Date: {formatDate(order.orderDate.split('T')[0] + 'T12:00:00', systemBranding?.systemTimezone)}</p>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <div className="text-right">
                                            <p className="text-xs font-medium bg-secondary-container text-on-secondary-container px-2 py-0.5 rounded-full">{order.status}</p>
                                            <p className="text-xs text-text-secondary">ETA: {order.etaDate ? formatDate(order.etaDate.split('T')[0] + 'T12:00:00', systemBranding?.systemTimezone) : 'N/A'}</p>
                                        </div>
                                        <button onClick={() => onEditOrder(order)} className="p-1.5 text-text-secondary hover:text-text-primary rounded-full hover:bg-surface-container-highest">
                                            <Edit size={16}/>
                                        </button>
                                        {currentUser?.roles?.includes('Admin') && (
                                            <button onClick={() => handleDeleteOrder(order.id)} className="p-1.5 text-error hover:text-error-hover rounded-full hover:bg-error-container/50">
                                                <Trash2 size={16}/>
                                            </button>
                                        )}
                                    </div>
                                </div>
                                <ul className="space-y-2 text-sm border-t border-outline/20 pt-3">
                                    {order.lineItems.map(item => (
                                        <li key={item.id} className="flex justify-between items-center text-text-secondary">
                                            <span>
                                                {item.quantity} {getPricingUnit(item.sampleId, item.unit)} x {`${item.style}${item.color ? ` - ${item.color}` : ''}`}
                                            </span>
                                            {item.totalCost != null && <span>{formatCurrency(Number(item.totalCost))}</span>}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        ))}
                    </div>
                )}
            </div>
            {isModalOpen && (
                <ModalPortal>
                    <AddEditMaterialOrderModal 
                        isOpen={isModalOpen} 
                        onClose={onCloseModal} 
                        editingOrder={editingOrder} 
                        initialProjectId={project.id} 
                    />
                </ModalPortal>
            )}
        </div>
    );
};

export default MaterialOrdersSection;