import React from 'react';
import { Link } from 'react-router-dom';
import { MaterialOrder, Project } from '../types';
import { ChevronRight, Truck, AlertTriangle, Package } from 'lucide-react';

interface OrderCarouselProps {
    title: string;
    orders: MaterialOrder[];
    projects: Project[]; // Needed to look up project names
}

const OrderCard = ({ order, project }: { order: MaterialOrder; project?: Project }) => {
    // Determine urgency styling
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    let etaText = 'No ETA';
    let urgencyColor = 'text-text-secondary';
    
    if (order.etaDate) {
        // Fix Timezone/ISO Issue: Ensure we have just YYYY-MM-DD before appending time
        const dateStr = order.etaDate.includes('T') ? order.etaDate.split('T')[0] : order.etaDate;
        
        // Parse YYYY-MM-DD as Local Time
        const eta = new Date(`${dateStr}T00:00:00`);
        eta.setHours(0, 0, 0, 0);
        
        const diffTime = eta.getTime() - today.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        
        etaText = eta.toLocaleDateString();
        
        if (diffDays < 0) urgencyColor = 'text-red-500 font-bold'; // Overdue
        else if (diffDays === 0) urgencyColor = 'text-green-500 font-bold'; // Today
        else if (diffDays <= 3) urgencyColor = 'text-yellow-500 font-bold'; // Soon
    }

    return (
        <Link 
            to={`/projects/${order.projectId}`} 
            className="block bg-surface p-4 rounded-lg shadow-md hover:shadow-lg hover:bg-background transition-all duration-300 w-80 flex-shrink-0 border border-border"
        >
            <div className="flex justify-between items-start mb-2">
                <div>
                    <h3 className="font-bold text-lg text-text-primary truncate max-w-[180px]" title={project?.projectName}>
                        {project?.projectName || 'Unknown Project'}
                    </h3>
                    <p className="text-sm text-text-secondary truncate">{order.supplierName || 'Unknown Supplier'}</p>
                </div>
                <div className={`text-xs font-semibold px-2 py-1 rounded-full flex items-center gap-1 ${
                    order.status === 'Damage Replacement' ? 'bg-red-900 text-red-100' : 'bg-blue-900 text-blue-100'
                }`}>
                    {order.status === 'Damage Replacement' ? <AlertTriangle size={10} /> : <Truck size={10} />}
                    {order.status === 'Damage Replacement' ? 'Repl.' : 'Order'}
                </div>
            </div>

            <div className="mt-3 pt-3 border-t border-border">
                <div className="flex justify-between items-center text-sm mb-2">
                    <span className="text-text-secondary">ETA:</span>
                    <span className={urgencyColor}>{etaText}</span>
                </div>
                
                {/* Mini Line Items Preview */}
                <div className="space-y-1">
                    {order.lineItems.slice(0, 2).map(item => (
                        <div key={item.id} className="flex justify-between text-xs text-text-secondary">
                            <span className="truncate w-3/4">{item.quantity} {item.unit} - {item.style}</span>
                        </div>
                    ))}
                    {order.lineItems.length > 2 && (
                        <p className="text-xs text-text-tertiary italic">+{order.lineItems.length - 2} more items...</p>
                    )}
                </div>
            </div>

            <div className="mt-4 flex justify-end items-center text-sm text-accent">
                <span className="flex items-center gap-1">View <ChevronRight size={16}/></span>
            </div>
        </Link>
    );
};

const OrderCarousel: React.FC<OrderCarouselProps> = ({ title, orders, projects }) => {
    return (
        <div className="mb-12">
            <h2 className="text-2xl font-semibold mb-4 text-text-primary flex items-center gap-2">
                <Package className="text-primary" /> {title}
            </h2>
            <div className="flex gap-6 overflow-x-auto pb-4 no-scrollbar">
                {orders.map(order => (
                    <OrderCard 
                        key={order.id} 
                        order={order} 
                        project={projects.find(p => p.id === order.projectId)} 
                    />
                ))}
                {orders.length === 0 && (
                    <p className="text-text-secondary italic">No orders found matching this criteria.</p>
                )}
            </div>
        </div>
    );
};

export default OrderCarousel;