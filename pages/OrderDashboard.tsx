import React, { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useProjects } from '../hooks/useProjects';
import { useMaterialOrders, useMaterialOrderMutations } from '../hooks/useMaterialOrders';
import { Project, MaterialOrder } from '../types';
import { Package, AlertTriangle, CheckCircle, Clock, Search, Plus, Truck, ChevronDown, ChevronUp, Eye, EyeOff, Edit2 } from 'lucide-react';
import ReceiveOrderModal from '../components/ReceiveOrderModal';
import AddEditMaterialOrderModal from '../components/AddEditMaterialOrderModal';
import ModalPortal from '../components/ModalPortal';

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
    
    // State for "Edit Order" Modal
    const [editingOrder, setEditingOrder] = useState<MaterialOrder | null>(null);

    // Filter State
    const [showReceived, setShowReceived] = useState(false);

    // State to track expanded projects (for collapsing >2 orders)
    const [expandedProjects, setExpandedProjects] = useState<Set<number>>(new Set());

    const toggleProjectExpanded = (projectId: number) => {
        setExpandedProjects(prev => {
            const next = new Set(prev);
            if (next.has(projectId)) next.delete(projectId);
            else next.add(projectId);
            return next;
        });
    };

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
            let projOrders = ordersByProject.get(project.id) || [];
            
            // Filter out received orders unless toggled on
            if (!showReceived) {
                projOrders = projOrders.filter(o => o.status !== 'Received');
            }
            
            // Filter Logic: Show if project matches search OR has orders that match search
            const matchesSearch = !searchTerm || 
                project.projectName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                projOrders.some(o => o.supplierName?.toLowerCase().includes(searchTerm.toLowerCase()));

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
    }, [projects, materialOrders, searchTerm, showReceived]);

    const handleOpenReceive = (order: MaterialOrder) => {
        setReceivingOrder(order);
    };

    const handleOpenAddOrder = (project: Project) => {
        setActiveProjectForAdd(project.id);
        setIsAddOrderModalOpen(true);
    };

    const handleGlobalAddOrder = () => {
        setActiveProjectForAdd(null); 
        setIsAddOrderModalOpen(true);
    };

    // --- MUTATION WRAPPERS ---
    const handleReceiveWrapper = async (orderId: number, data: any) => {
        await materialOrderMutations.receiveMaterialOrder.mutateAsync({ id: orderId, data });
    };
    const handleDamageWrapper = async (orderId: number, data: any) => {
        await materialOrderMutations.reportMaterialOrderDamage.mutateAsync({ id: orderId, data });
    };

    return (
        <div className="space-y-8">
            {/* Header & Controls - MD3 De-boxed Style */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 px-1">
                <div>
                    <h1 className="text-4xl font-bold text-text-primary tracking-tight flex items-center gap-3">
                        <Truck className="text-primary w-8 h-8" /> Order Dashboard
                    </h1>
                    <p className="text-text-secondary text-sm mt-1 ml-11 font-medium">Track, receive, and manage material orders.</p>
                </div>
                
                <div className="flex flex-col md:flex-row gap-3 w-full md:w-auto mt-4 md:mt-0">
                    <button 
                        onClick={() => setShowReceived(!showReceived)}
                        className="w-full md:w-auto justify-center bg-surface-container-high border border-outline/10 hover:bg-surface-container-highest text-text-secondary font-medium py-3 px-6 rounded-full flex items-center gap-2 transition-colors"
                    >
                        {showReceived ? <EyeOff size={20} /> : <Eye size={20} />}
                        {showReceived ? 'Hide Received' : 'Show Received'}
                    </button>
                    <button 
                        onClick={handleGlobalAddOrder}
                        className="w-full md:w-auto justify-center bg-primary hover:bg-primary-hover text-on-primary font-semibold py-3 px-6 rounded-full flex items-center gap-2 shadow-lg hover:shadow-xl transition-all"
                    >
                        <Plus size={20} /> New Order
                    </button>
                </div>
            </div>

            {/* Floating Search Bar */}
            <div className="relative w-full max-w-2xl">
                <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-text-secondary" size={20} />
                <input 
                    type="text" 
                    placeholder="Search projects or suppliers..." 
                    value={searchTerm} 
                    onChange={e => setSearchTerm(e.target.value)}
                    className="w-full pl-12 pr-6 py-4 bg-surface-container-high border-none rounded-full text-text-primary focus:ring-2 focus:ring-primary/50 outline-none transition-shadow shadow-sm hover:shadow-md placeholder:text-text-tertiary"
                />
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
                    {groupedOrders.map(({ project, orders }) => {
                        const isExpanded = expandedProjects.has(project.id);
                        const visibleOrders = isExpanded ? orders : orders.slice(0, 2);
                        const hiddenCount = orders.length - visibleOrders.length;

                        const firstOrder = orders[0];
                        const poNumber = firstOrder?.poNumber || 'No PO';
                        const customerName = firstOrder?.customerName || '';
                        const lastName = customerName.split(' ').pop() || customerName;
                        const headerTitle = `#${poNumber} - ${lastName}`;

                        return (
                            <div key={project.id} className="bg-surface-container-high border border-outline/10 rounded-xl shadow-sm flex flex-col transition-all duration-200 hover:shadow-md">
                                
                                {/* Card Header */}
                                <div className="p-5 border-b border-outline/10 flex justify-between items-start bg-surface-container-low rounded-t-xl">
                                    <div className="min-w-0 pr-2">
                                        <Link 
                                            to={`/projects/${project.id}`}
                                            className="font-bold text-xl text-primary hover:text-primary-hover hover:underline truncate block"
                                            title="View Project"
                                        >
                                            {headerTitle}
                                        </Link>
                                        <p className="text-xs text-text-secondary truncate">{project.projectName}</p>
                                    </div>
                                    <button 
                                        onClick={() => handleOpenAddOrder(project)}
                                        className="flex-shrink-0 p-2 bg-surface-container-highest hover:bg-primary-container text-primary rounded-full transition-colors"
                                        title="Add Order"
                                    >
                                        <Plus size={18} />
                                    </button>
                                </div>

                                {/* Orders List */}
                                <div className="p-5 space-y-6 flex-grow">
                                    {visibleOrders.map(order => (
                                        <div key={order.id} className={`relative border-l-4 pl-3 py-1 ${
                                            order.status === 'Received' ? 'border-success' : 
                                            order.status === 'Damage Replacement' ? 'border-error' : 'border-primary'
                                        }`}>
                                            <div className="flex justify-between items-start mb-2">
                                                <span className="font-semibold text-text-primary text-sm truncate max-w-[60%]">{order.supplierName || 'Unknown Supplier'}</span>
                                                <div className="flex items-center">
                                                    {order.status === 'Received' ? (
                                                        <span className="text-xs font-bold text-success flex items-center gap-1"><CheckCircle size={12} /> Received</span>
                                                    ) : order.status === 'Damage Replacement' ? (
                                                        <span className="text-xs font-bold text-error flex items-center gap-1"><AlertTriangle size={12} /> Replacement</span>
                                                    ) : (
                                                        <span className="text-xs font-bold text-primary flex items-center gap-1"><Clock size={12} /> Ordered</span>
                                                    )}
                                                    
                                                    <button 
                                                        onClick={() => setEditingOrder(order)}
                                                        className="p-1.5 text-text-tertiary hover:text-primary hover:bg-surface-container-highest rounded-full transition-colors ml-2"
                                                        title="Edit Order Details"
                                                    >
                                                        <Edit2 size={12} />
                                                    </button>
                                                </div>
                                            </div>
                                            
                                            <div className="flex gap-4 mb-3">
                                                <div>
                                                    <span className="text-[10px] uppercase tracking-wide text-text-tertiary block font-bold">Ordered</span>
                                                    <span className="text-sm font-medium text-text-primary">
                                                        {new Date(order.orderDate.split('T')[0] + 'T12:00:00').toLocaleDateString()}
                                                    </span>
                                                </div>
                                                {order.etaDate && (
                                                    <div>
                                                        <span className="text-[10px] uppercase tracking-wide text-text-tertiary block font-bold">ETA</span>
                                                        <span className={`text-sm font-medium ${
                                                            new Date(order.etaDate.split('T')[0] + 'T12:00:00') < new Date() && order.status !== 'Received' 
                                                            ? 'text-error font-bold' 
                                                            : 'text-text-primary'
                                                        }`}>
                                                            {new Date(order.etaDate.split('T')[0] + 'T12:00:00').toLocaleDateString()}
                                                        </span>
                                                    </div>
                                                )}
                                            </div>

                                            {/* Mini Line Items */}
                                            <ul className="text-xs text-text-secondary mb-3 bg-surface-container-low p-3 rounded-lg border border-outline/10">
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
                                                    className="w-full py-4 md:py-2 bg-primary hover:bg-primary-hover text-on-primary text-lg md:text-xs font-bold md:font-semibold rounded-full md:rounded-full flex items-center justify-center gap-3 md:gap-2 transition-colors shadow-sm mt-3 md:mt-0"
                                                >
                                                    <Package className="w-6 h-6 md:w-3.5 md:h-3.5" /> Receive Order
                                                </button>
                                            )}
                                        </div>
                                    ))}
                                </div>

                                {/* EXPAND/COLLAPSE FOOTER */}
                                {orders.length > 2 && (
                                    <button 
                                        onClick={() => toggleProjectExpanded(project.id)}
                                        className="w-full py-3 border-t border-outline/10 flex items-center justify-center gap-1 text-xs font-semibold text-text-secondary hover:text-primary hover:bg-surface-container-highest transition-colors rounded-b-xl"
                                    >
                                        {isExpanded ? (
                                            <>Show Less <ChevronUp size={14} /></>
                                        ) : (
                                            <>Show {hiddenCount} More <ChevronDown size={14} /></>
                                        )}
                                    </button>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Modals */}
            {receivingOrder && (
                <ModalPortal>
                    <ReceiveOrderModal 
                        isOpen={!!receivingOrder}
                        onClose={() => setReceivingOrder(null)}
                        order={receivingOrder}
                        onReceive={handleReceiveWrapper}
                        onReportDamage={handleDamageWrapper}
                    />
                </ModalPortal>
            )}

            {isAddOrderModalOpen && (
                <ModalPortal>
                    <AddEditMaterialOrderModal 
                        isOpen={isAddOrderModalOpen}
                        onClose={() => setIsAddOrderModalOpen(false)}
                        editingOrder={null}
                        initialProjectId={activeProjectForAdd}
                    />
                </ModalPortal>
            )}
            
            {editingOrder && (
                <ModalPortal>
                    <AddEditMaterialOrderModal 
                        isOpen={!!editingOrder}
                        onClose={() => setEditingOrder(null)}
                        editingOrder={editingOrder}
                    />
                </ModalPortal>
            )}
        </div>
    );
};

export default OrderDashboard;