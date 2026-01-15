import React from 'react';
import { SampleCheckout, Product } from '../types';
import { useData } from '../context/DataContext';
import { Link } from 'react-router-dom';
import { Clock, Undo2, AlertCircle, Calendar } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { getImageUrl } from '../utils/apiConfig';
import { formatDate } from '../utils/dateUtils';

// Helper to find product/variant data from a checkout
const useCheckoutDetails = (checkout: SampleCheckout) => {
    const { products, projects, customers, installers } = useData();
    
    const project = projects.find(p => p.id === checkout.projectId);
    const customer = customers.find(c => c.id === checkout.customerId);
    const installer = installers.find(i => i.id === checkout.installerId);
    
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

    if (!product || !variant) return null;

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
    
    // Determine due date status styles
    let statusStyles = 'bg-surface-container border border-outline text-text-secondary';
    let statusText = 'Checked Out';
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dueDate = new Date(checkout.expectedReturnDate);
    dueDate.setHours(0, 0, 0, 0);
    const outDate = new Date(checkout.checkoutDate);
    
    const durationDays = Math.ceil((dueDate.getTime() - outDate.getTime()) / (1000 * 60 * 60 * 24));
    const isExtended = durationDays > 3;

    if (dueDate < today) {
        statusStyles = 'bg-error-container text-error font-bold border-none';
        statusText = 'OVERDUE';
    } else if (dueDate.getTime() === today.getTime()) {
        statusStyles = 'bg-warning-container text-warning font-bold border-none';
        statusText = 'Due Today';
    } else if (isExtended) {
        statusStyles = 'bg-primary-container text-primary font-bold border-none';
        statusText = 'Extended';
    } else {
        // Default set above
        statusText = 'On Time';
    }

    const displayImage = variant.imageUrl || product.defaultImageUrl;
    const displayName = `${product.name} - ${variant.name}`;

    return (
        <div className="bg-surface-container-high rounded-xl shadow-sm hover:shadow-md transition-shadow overflow-hidden group flex flex-col cursor-pointer w-80 flex-shrink-0 border border-outline/10" onClick={() => onClick(product)}>
            <div className="w-full h-48 bg-surface-container-low flex items-center justify-center text-text-secondary relative">
                {displayImage ? (
                    <img src={getImageUrl(displayImage)} alt={displayName} className="w-full h-full object-cover" />
                ) : (
                    <span className="text-sm">No Image</span>
                )}
                
                {/* Floating Status Badge */}
                <div className={`absolute top-3 right-3 px-3 py-1 rounded-full text-xs font-bold shadow-sm flex items-center gap-1 ${statusStyles}`}>
                     {statusText === 'OVERDUE' && <AlertCircle size={12} />}
                     {statusText}
                </div>
            </div>
            
            <div className="p-5 flex flex-col flex-grow">
                <h3 className="font-bold text-base text-text-primary truncate" title={displayName}>{displayName}</h3>
                <p className="text-sm text-text-secondary truncate mb-4">{product.manufacturerName || 'N/A'}</p>
                
                <div className="flex-grow" />
                
                <div className="mt-auto space-y-3">
                    {/* Date Grid */}
                    <div className="flex justify-between items-end text-xs">
                        <div>
                            <span className="text-text-secondary block mb-0.5">Checked Out</span>
                            <span className="text-text-secondary font-medium block truncate">{formatDate(checkout.checkoutDate)}</span>
                        </div>
                        <div className="text-right">
                            <span className="text-text-secondary block mb-0.5">Due Date</span>
                            <span className="font-bold text-text-primary block truncate">{formatDate(checkout.expectedReturnDate)}</span>
                        </div>
                    </div>

                    <div className="truncate text-xs">
                        <span className="text-text-secondary">For: </span>
                        {project ? (
                            <Link to={`/projects/${project.id}`} className="text-accent hover:underline font-medium" onClick={(e) => e.stopPropagation()}>
                                {project.projectName}
                            </Link>
                        ) : customer ? (
                            <Link to={`/customers/${customer.id}`} className="text-accent hover:underline font-medium" onClick={(e) => e.stopPropagation()}>
                                {customer.fullName}
                            </Link>
                        ) : installer ? (
                            <Link to={`/installers/${installer.id}`} className="text-accent hover:underline font-medium" onClick={(e) => e.stopPropagation()}>
                                {installer.installerName}
                            </Link>
                        ) : (
                            <span className="text-text-tertiary font-medium">Unknown</span>
                        )}
                    </div>

                    <div className="flex items-center gap-2 justify-end pt-3">
                        <button onClick={handleExtend} className="text-xs font-medium text-primary hover:bg-primary-container/20 py-2 px-4 rounded-full transition-colors">
                            Extend
                        </button>
                        <button onClick={handleReturn} className="text-xs font-bold bg-secondary hover:bg-secondary-hover text-on-secondary py-2 px-4 rounded-full shadow-sm flex items-center gap-1 transition-colors">
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
    checkouts: SampleCheckout[]; 
    onItemClick: (product: Product) => void; 
}

const SampleCarousel: React.FC<SampleCarouselProps> = ({ title, checkouts, onItemClick }) => {
    return (
        <div className="mb-12">
            <h2 className="text-2xl font-semibold mb-4 text-text-primary flex items-center gap-2">
                {title}
                {checkouts.length > 0 && (
                    <span className="text-sm font-bold bg-primary-container text-on-primary-container px-3 py-1 rounded-full">
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