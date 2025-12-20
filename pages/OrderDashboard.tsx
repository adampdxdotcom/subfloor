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
    }, [projects, materialOrders, searchTerm, showReceived]);

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
                    
                    <div className="flex flex-col md:flex-row gap-3 w-full md:w-auto mt-4 md:mt-0">
                        <button 
                            onClick={() => setShowReceived(!showReceived)}
                            className="w-full md:w-auto justify-center bg-background border border-border hover:bg-surface text-text-secondary font-medium py-2 px-4 rounded-lg flex items-center gap-2 transition-colors"
                        >
                            {showReceived ? <EyeOff size={20} /> : <Eye size={20} />}
                            {showReceived ? 'Hide Received' : 'Show Received'}
                        </button>
                        <button 
                            onClick={handleGlobalAddOrder}
                            className="w-full md:w-auto justify-center bg-primary hover:bg-primary-hover text-on-primary font-bold py-2 px-4 rounded-lg flex items-center gap-2 shadow-md transition-colors"
                        >
                            <Plus size={20} /> New Order
                        </button>
                    </div>
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
                    {groupedOrders.map(({ project, orders }) => {
                        const isExpanded = expandedProjects.has(project.id);
                        // Show all if expanded, otherwise show first 2
                        const visibleOrders = isExpanded ? orders : orders.slice(0, 2);
                        const hiddenCount = orders.length - visibleOrders.length;

                        // Extract Header Data from the first order (shared by all in project)
                        const firstOrder = orders[0];
                        const poNumber = firstOrder?.poNumber || 'No PO';
                        
                        // Get Last Name only
                        const customerName = firstOrder?.customerName || '';
                        const lastName = customerName.split(' ').pop() || customerName;
                        const headerTitle = `#${poNumber} - ${lastName}`;

                        return (
                            <div key={project.id} className="bg-surface border border-border rounded-lg shadow-sm flex flex-col transition-all duration-200">
                                
                                {/* Card Header */}
                                <div className="p-4 border-b border-border flex justify-between items-start bg-surface rounded-t-lg">
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
                                        className="flex-shrink-0 p-2 bg-background hover:bg-primary/10 text-primary rounded-full transition-colors"
                                        title="Add Order"
                                    >
                                        <Plus size={18} />
                                    </button>
                                </div>

                                {/* Orders List */}
                                <div className="p-4 space-y-6 flex-grow">
                                    {visibleOrders.map(order => (
                                        <div key={order.id} className={`relative border-l-4 pl-3 py-1 ${
                                            order.status === 'Received' ? 'border-green-500' : 
                                            order.status === 'Damage Replacement' ? 'border-red-500' : 'border-primary'
                                        }`}>
                                            <div className="flex justify-between items-start mb-2">
                                                <span className="font-semibold text-text-primary text-sm truncate max-w-[60%]">{order.supplierName || 'Unknown Supplier'}</span>
                                                <div className="flex items-center">
                                                    {order.status === 'Received' ? (
                                                        <span className="text-xs font-bold text-green-500 flex items-center gap-1"><CheckCircle size={10} /> Received</span>
                                                    ) : order.status === 'Damage Replacement' ? (
                                                        <span className="text-xs font-bold text-red-500 flex items-center gap-1"><AlertTriangle size={10} /> Replacement</span>
                                                    ) : (
                                                        <span className="text-xs font-bold text-primary flex items-center gap-1"><Clock size={10} /> Ordered</span>
                                                    )}
                                                    
                                                    {/* EDIT BUTTON */}
                                                    <button 
                                                        onClick={() => setEditingOrder(order)}
                                                        className="p-1 text-text-tertiary hover:text-primary hover:bg-background rounded transition-colors ml-2"
                                                        title="Edit Order Details"
                                                    >
                                                        <Edit2 size={12} />
                                                    </button>
                                                </div>
                                            </div>
                                            
                                            {/* ENHANCED DATE DISPLAY */}
                                            <div className="flex gap-4 mb-3">
                                                <div>
                                                    <span className="text-[10px] uppercase tracking-wide text-text-tertiary block">Ordered</span>
                                                    <span className="text-sm font-medium text-text-primary">
                                                        {new Date(order.orderDate.split('T')[0] + 'T12:00:00').toLocaleDateString()}
                                                    </span>
                                                </div>
                                                {order.etaDate && (
                                                    <div>
                                                        <span className="text-[10px] uppercase tracking-wide text-text-tertiary block">ETA</span>
                                                        <span className={`text-sm font-medium ${
                                                            new Date(order.etaDate.split('T')[0] + 'T12:00:00') < new Date() && order.status !== 'Received' 
                                                            ? 'text-red-500' 
                                                            : 'text-text-primary'
                                                        }`}>
                                                            {new Date(order.etaDate.split('T')[0] + 'T12:00:00').toLocaleDateString()}
                                                        </span>
                                                    </div>
                                                )}
                                            </div>

                                            {/* Mini Line Items */}
                                            <ul className="text-xs text-text-secondary mb-3 bg-background p-2 rounded border border-border/50">
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
                                                    className="w-full py-4 md:py-1.5 bg-primary hover:bg-primary-hover text-on-primary text-lg md:text-xs font-bold md:font-medium rounded-lg md:rounded flex items-center justify-center gap-3 md:gap-2 transition-colors shadow-md md:shadow-none mt-2 md:mt-0"
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
                                        className="w-full py-3 border-t border-border flex items-center justify-center gap-1 text-xs font-semibold text-text-secondary hover:text-primary hover:bg-background transition-colors rounded-b-lg"
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
                        initialProjectId={activeProjectForAdd} // This might be null if using global add button
                    />
                </ModalPortal>
            )}
            
            {/* EDIT Modal */}
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