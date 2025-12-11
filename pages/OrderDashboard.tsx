import React, { useState, useMemo } from 'react';
import { useProjects } from '../hooks/useProjects';
import { useMaterialOrders, useMaterialOrderMutations } from '../hooks/useMaterialOrders';
import { Project, MaterialOrder } from '../types';
import { Package, AlertTriangle, CheckCircle, Clock, Search, Plus, Truck } from 'lucide-react';
import ReceiveOrderModal from '../components/ReceiveOrderModal';
import AddEditMaterialOrderModal from '../components/AddEditMaterialOrderModal';

// Helper to group orders by project
interface ProjectOrders {
    project: Project;
    orders: MaterialOrder[];
}

const OrderDashboard: React.FC = () => {
    const { data: projects = [] } = useProjects();
    const { data: materialOrders = [] } = useMaterialOrders();
    const materialOrderMutations = useMaterialOrderMutations();

    const [searchTerm, setSearchTerm] = useState('');

    // State for "Receive" Modal
    const [receivingOrder, setReceivingOrder] = useState<MaterialOrder | null>(null);

    // State for "Add Order" Modal
    const [isAddOrderModalOpen, setIsAddOrderModalOpen] = useState(false);
    const [activeProjectForAdd, setActiveProjectForAdd] = useState<number | null>(null);

    const groupedOrders = useMemo(() => {
        const groups: ProjectOrders[] = [];
        const ordersByProject = new Map<number, MaterialOrder[]>();

        // 1. Group orders
        materialOrders.forEach(order => {
            if (!ordersByProject.has(order.projectId)) {
                ordersByProject.set(order.projectId, []);
            }
            ordersByProject.get(order.projectId)?.push(order);
        });

        // 2. Map to projects, filtering by search
        projects.forEach(project => {
            const projOrders = ordersByProject.get(project.id) || [];
            
            // Filter Logic: Show if project matches search OR has orders that match search
            const matchesSearch = !searchTerm || 
                project.projectName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                projOrders.some(o => o.supplierName?.toLowerCase().includes(searchTerm.toLowerCase()));

            // Only show active projects that have orders, OR active projects if searching
            // Note: In a real app, you'd filter out Completed/Cancelled projects here.
            if (projOrders.length > 0 && matchesSearch) {
                groups.push({
                    project,
                    orders: projOrders.sort((a, b) => new Date(b.orderDate).getTime() - new Date(a.orderDate).getTime())
                });
            }
        });

        // Sort: Projects with oldest "Ordered" items first (most urgent)
        return groups.sort((a, b) => {
            const aUrgent = a.orders.some(o => o.status === 'Ordered');
            const bUrgent = b.orders.some(o => o.status === 'Ordered');
            if (aUrgent && !bUrgent) return -1;
            if (!aUrgent && bUrgent) return 1;
            return 0;
        });
    }, [projects, materialOrders, searchTerm]);

    const handleOpenReceive = (order: MaterialOrder) => {
        setReceivingOrder(order);
    };

    const handleOpenAddOrder = (project: Project) => {
        setActiveProjectForAdd(project.id);
        setIsAddOrderModalOpen(true);
    };

    // New: Global Add Order
    const handleGlobalAddOrder = () => {
        setActiveProjectForAdd(null); // User will select project in modal
        setIsAddOrderModalOpen(true);
    };

    // --- MUTATION WRAPPERS ---
    // Adapts React Query's single-object argument to the Modal's (id, data) signature
    const handleReceiveWrapper = async (orderId: number, data: any) => {
        await materialOrderMutations.receiveMaterialOrder.mutateAsync({ id: orderId, data });
    };
    const handleDamageWrapper = async (orderId: number, data: any) => {
        await materialOrderMutations.reportMaterialOrderDamage.mutateAsync({ id: orderId, data });
    };

    return (
        <div className="space-y-6">
            
            {/* Header Card */}
            <div className="bg-surface p-6 rounded-lg shadow-md border border-border">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6">
                    <div>
                        <h1 className="text-3xl font-bold text-text-primary flex items-center gap-3">
                            <Truck className="text-primary w-8 h-8" /> Order Dashboard
                        </h1>
                        <p className="text-text-secondary text-sm mt-1 ml-11">Track, receive, and manage material orders.</p>
                    </div>
                    
                    <button 
                        onClick={handleGlobalAddOrder}
                        className="mt-4 md:mt-0 bg-primary hover:bg-primary-hover text-on-primary font-bold py-2 px-4 rounded-lg flex items-center gap-2 shadow-md transition-colors"
                    >
                        <Plus size={20} /> New Order
                    </button>
                </div>

                {/* Search Bar */}
                <div className="relative w-full">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-text-tertiary" size={18} />
                    <input 
                        type="text" 
                        placeholder="Search projects or suppliers..." 
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-3 bg-background border border-border rounded-lg text-text-primary focus:ring-2 focus:ring-primary outline-none transition-all shadow-inner"
                    />
                </div>
            </div>

            {/* Grid */}
            {groupedOrders.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-64 text-text-secondary">
                    <Package size={48} className="mb-4 opacity-50" />
                    <p className="text-lg font-medium">No active orders found.</p>
                    <p className="text-sm">Create a material order from a Job Detail page to see it here.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                    {groupedOrders.map(({ project, orders }) => (
                        <div key={project.id} className="bg-surface border border-border rounded-lg shadow-sm flex flex-col">
                            
                            {/* Card Header */}
                            <div className="p-4 border-b border-border flex justify-between items-start bg-surface rounded-t-lg">
                                <div>
                                    <h3 className="font-bold text-lg text-text-primary truncate max-w-[200px]">{project.projectName}</h3>
                                </div>
                                <button 
                                    onClick={() => handleOpenAddOrder(project)}
                                    className="p-2 bg-background hover:bg-primary/10 text-primary rounded-full transition-colors"
                                    title="Add Order"
                                >
                                    <Plus size={18} />
                                </button>
                            </div>

                            {/* Orders List */}
                            <div className="p-4 space-y-4 flex-grow">
                                {orders.map(order => (
                                    <div key={order.id} className={`relative border-l-4 pl-3 py-1 ${
                                        order.status === 'Received' ? 'border-green-500' : 
                                        order.status === 'Damage Replacement' ? 'border-red-500' : 'border-primary'
                                    }`}>
                                        <div className="flex justify-between items-start mb-1">
                                            <span className="font-semibold text-text-primary text-sm">{order.supplierName || 'Unknown Supplier'}</span>
                                            {order.status === 'Received' ? (
                                                <span className="text-xs font-bold text-green-500 flex items-center gap-1"><CheckCircle size={10} /> Received</span>
                                            ) : order.status === 'Damage Replacement' ? (
                                                <span className="text-xs font-bold text-red-500 flex items-center gap-1"><AlertTriangle size={10} /> Replacement</span>
                                            ) : (
                                                <span className="text-xs font-bold text-primary flex items-center gap-1"><Clock size={10} /> Ordered</span>
                                            )}
                                        </div>
                                        
                                        <div className="text-xs text-text-secondary space-y-0.5 mb-2">
                                            <p>Ordered: {new Date(order.orderDate).toLocaleDateString()}</p>
                                            {order.etaDate && (
                                                <p className={new Date(order.etaDate) < new Date() && order.status !== 'Received' ? 'text-red-500 font-bold' : ''}>
                                                    ETA: {new Date(order.etaDate).toLocaleDateString()}
                                                </p>
                                            )}
                                        </div>

                                        {/* Mini Line Items */}
                                        <ul className="text-xs text-text-secondary mb-2 bg-background p-2 rounded border border-border/50">
                                            {order.lineItems.slice(0, 3).map(item => (
                                                <li key={item.id} className="flex justify-between">
                                                    <span className="truncate w-3/4">{item.quantity} {item.unit} - {item.style}</span>
                                                </li>
                                            ))}
                                            {order.lineItems.length > 3 && <li className="text-text-tertiary italic">+{order.lineItems.length - 3} more...</li>}
                                        </ul>

                                        {/* Action Button */}
                                        {order.status !== 'Received' && (
                                            <button 
                                                onClick={() => handleOpenReceive(order)}
                                                className="w-full py-1.5 bg-primary hover:bg-primary-hover text-on-primary text-xs font-medium rounded flex items-center justify-center gap-2 transition-colors"
                                            >
                                                <Package size={14} /> Receive Order
                                            </button>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Modals */}
            {receivingOrder && (
                <ReceiveOrderModal 
                    isOpen={!!receivingOrder}
                    onClose={() => setReceivingOrder(null)}
                    order={receivingOrder}
                    onReceive={handleReceiveWrapper}
                    onReportDamage={handleDamageWrapper}
                />
            )}

            {isAddOrderModalOpen && (
                <AddEditMaterialOrderModal 
                    isOpen={isAddOrderModalOpen}
                    onClose={() => setIsAddOrderModalOpen(false)}
                    editingOrder={null}
                    initialProjectId={activeProjectForAdd} // This might be null if using global add button
                />
            )}
        </div>
    );
};

export default OrderDashboard;