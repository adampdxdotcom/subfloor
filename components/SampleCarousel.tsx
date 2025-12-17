import React from 'react';
import { SampleCheckout, Product } from '../types';
import { useData } from '../context/DataContext';
import { Link } from 'react-router-dom';
import { Clock, Undo2, AlertCircle } from 'lucide-react';
import { toast } from 'react-hot-toast';

// Helper to find product/variant data from a checkout
const useCheckoutDetails = (checkout: SampleCheckout) => {
    const { products, projects, customers, installers } = useData();
    
    const project = projects.find(p => p.id === checkout.projectId);
    const customer = customers.find(c => c.id === checkout.customerId);
    const installer = installers.find(i => i.id === checkout.installerId);
    
    // Find the product and variant that matches this checkout
    // Note: This is O(N) on products. For very large libraries, a map would be better, 
    // but fine for typical client-side use.
    let product: Product | undefined;
    let variant = undefined;

    for (const p of products) {
        const v = p.variants.find(v => String(v.id) === String(checkout.variantId));
        if (v) {
            product = p;
            variant = v;
            break;
        }
    }

    return { product, variant, project, customer, installer };
};

const CheckoutCard = ({ checkout, onClick }: { checkout: SampleCheckout, onClick: (p: Product) => void }) => {
    const { extendSampleCheckout, updateSampleCheckout } = useData();
    const { product, variant, project, customer, installer } = useCheckoutDetails(checkout);

    if (!product || !variant) return null; // Should not happen unless data integrity issue

    const handleExtend = async (e: React.MouseEvent) => {
        e.stopPropagation(); 
        await extendSampleCheckout(checkout);
    };

    const handleReturn = async (e: React.MouseEvent) => {
        e.stopPropagation(); 
        if (confirm(`Return "${variant.name}"?`)) {
            await updateSampleCheckout(checkout);
        }
    };
    
    // Determine due date status
    let statusColor = 'text-yellow-400';
    let statusText = 'Checked Out';
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dueDate = new Date(checkout.expectedReturnDate);
    dueDate.setHours(0, 0, 0, 0);
    
    if (dueDate < today) {
        statusColor = 'text-red-500 font-bold';
        statusText = 'OVERDUE';
    } else if (dueDate.getTime() === today.getTime()) {
        statusColor = 'text-orange-400 font-bold';
        statusText = 'Due Today';
    }

    const displayImage = variant.imageUrl || product.defaultImageUrl;
    const displayName = `${product.name} - ${variant.name}`;

    return (
        <div className="bg-surface rounded-lg shadow-md border border-border overflow-hidden group flex flex-col cursor-pointer w-80 flex-shrink-0" onClick={() => onClick(product)}>
            <div className="w-full h-40 bg-background flex items-center justify-center text-text-secondary relative">
                {displayImage ? (
                    <img src={displayImage} alt={displayName} className="w-full h-full object-cover" />
                ) : (
                    <span className="text-sm">No Image</span>
                )}
            </div>
            <div className="p-4 flex flex-col flex-grow">
                <h3 className="font-bold text-base text-text-primary truncate" title={displayName}>{displayName}</h3>
                <p className="text-xs text-text-secondary truncate">{product.manufacturerName || 'N/A'}</p>
                
                <div className="flex-grow" />
                
                <div className="mt-3 text-xs">
                    <div className={`${statusColor} mb-2 flex justify-between items-center`}>
                        <span className="font-bold uppercase tracking-wider">{statusText}</span>
                        {statusText === 'OVERDUE' && <AlertCircle size={14} />}
                    </div>
                    
                    <div className="mb-2 truncate">
                        <span className="text-text-secondary">For: </span>
                        {project ? (
                            <Link to={`/projects/${project.id}`} className="text-accent hover:underline font-medium" onClick={(e) => e.stopPropagation()}>
                                {project.projectName}
                            </Link>
                        ) : customer ? (
                            <Link to={`/customers/${customer.id}`} className="text-accent hover:underline font-medium" onClick={(e) => e.stopPropagation()}>
                                {customer.fullName} (Customer)
                            </Link>
                        ) : installer ? (
                            <Link to={`/installers/${installer.id}`} className="text-accent hover:underline font-medium" onClick={(e) => e.stopPropagation()}>
                                {installer.installerName} (Installer)
                            </Link>
                        ) : (
                            <span className="text-text-tertiary font-medium">Unknown</span>
                        )}
                    </div>

                    <div className="flex items-center gap-2 justify-end pt-2 border-t border-border/50">
                        <button onClick={handleExtend} className="text-xs bg-surface hover:bg-surface-hover border border-border text-text-primary py-1.5 px-3 rounded flex items-center gap-1 transition-colors">
                            <Clock size={12} /> Extend
                        </button>
                        <button onClick={handleReturn} className="text-xs bg-primary hover:bg-primary-hover text-on-primary py-1.5 px-3 rounded flex items-center gap-1 transition-colors">
                            <Undo2 size={12} /> Return
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};


interface SampleCarouselProps {
    title: string;
    checkouts: SampleCheckout[]; // UPDATED: Now takes active checkouts directly
    onItemClick: (product: Product) => void; // UPDATED: Returns the Product object
}

const SampleCarousel: React.FC<SampleCarouselProps> = ({ title, checkouts, onItemClick }) => {
    return (
        <div className="mb-12">
            <h2 className="text-2xl font-semibold mb-4 text-text-primary flex items-center gap-2">
                {title}
                {checkouts.length > 0 && (
                    <span className="text-sm font-normal bg-surface text-text-secondary px-2 py-0.5 rounded-full border border-border">
                        {checkouts.length}
                    </span>
                )}
            </h2>
            {checkouts.length > 0 ? (
                <div className="flex gap-6 overflow-x-auto pb-4 scrollbar-thin scrollbar-thumb-border scrollbar-track-transparent">
                    {checkouts.map(co => (
                        <CheckoutCard key={co.id} checkout={co} onClick={onItemClick} />
                    ))}
                </div>
            ) : (
                <div className="p-8 text-center bg-surface/30 rounded-lg border border-dashed border-border">
                    <p className="text-text-secondary italic">No samples are currently checked out.</p>
                </div>
            )}
        </div>
    );
};

export default SampleCarousel;