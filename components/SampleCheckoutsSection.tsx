import React, { useState, useMemo } from 'react';
import { Project, Product, ProductVariant, SampleCheckout } from '../types';
import { Check, Clock, X, Search, Layers, Move, ThumbsUp, ShoppingCart } from 'lucide-react'; // Added icons
import { useData } from '../context/DataContext';
import { toast } from 'react-hot-toast';
import AddEditMaterialOrderModal from './AddEditMaterialOrderModal'; // Import Modal
import ModalPortal from './ModalPortal'; // Import Portal

interface SampleCheckoutsSectionProps {
    project: Project;
    // These are now optional/deprecated as state is local
    isModalOpen?: boolean; 
    onCloseModal?: () => void;
}

import * as sampleCheckoutService from '../services/sampleCheckoutService'; // Direct import for patch

// Helper to format display name
const formatVariantName = (productName: string, variantName: string) => {
  return `${productName} - ${variantName}`;
};

const SampleCheckoutsSection: React.FC<SampleCheckoutsSectionProps> = ({ project }) => {
    const { 
        products, 
        sampleCheckouts,
        addSampleCheckout,
        updateSampleCheckout,
        extendSampleCheckout,
        toggleSampleSelection // Use context function
    } = useData();
    
    // Internal state for modal management
    const [isModalOpen, setIsModalOpen] = useState(false);
    
    const [searchTerm, setSearchTerm] = useState(''); 
    // Store the selected item as a pair of Product + Variant
    const [selectedSearchItem, setSelectedSearchItem] = useState<{product: Product, variant: ProductVariant} | null>(null); 
    const [returnDate, setReturnDate] = useState('');

    // --- NEW: Ordering State ---
    const [isOrderModalOpen, setIsOrderModalOpen] = useState(false);
    const [prefillOrderData, setPrefillOrderData] = useState<any>(null);

    const projectCheckouts = useMemo(() => {
        return sampleCheckouts
            .filter(sc => sc.projectId === project.id)
            .sort((a, b) => {
                // Sort SELECTED items to the top, then by date
                if (a.isSelected !== b.isSelected) return a.isSelected ? -1 : 1;
                return new Date(b.checkoutDate).getTime() - new Date(a.checkoutDate).getTime();
            });
    }, [sampleCheckouts, project.id]);
    
    // --- NEW: Search Logic for Products/Variants ---
    const searchResults = useMemo(() => {
        if (searchTerm.length < 2) return [];
        const lowercasedTerm = searchTerm.toLowerCase();
        const results: {product: Product, variant: ProductVariant}[] = [];

        products.forEach(p => {
            // Match against Parent Name or Manufacturer
            // FIX: Added safe checks (?.) and fallbacks (|| '') to prevent crashes
            const parentMatch = (p.name || '').toLowerCase().includes(lowercasedTerm) || 
                                (p.manufacturerName || '').toLowerCase().includes(lowercasedTerm);
            
            p.variants.forEach(v => {
                // Match against Variant Name or SKU
                // FIX: Added safe checks (?.) here too
                const variantMatch = (v.name || '').toLowerCase().includes(lowercasedTerm) || 
                                     (v.sku || '').toLowerCase().includes(lowercasedTerm);
                
                // If either matches, include this specific variant in results
                if (parentMatch || variantMatch) {
                    results.push({ product: p, variant: v });
                }
            });
        });
        return results;
    }, [products, searchTerm]); 
    
    const resetModalState = () => { 
        setSearchTerm(''); 
        setSelectedSearchItem(null); 
        setReturnDate(''); 
    }; 
    
    const handleOpenModal = () => {
        setIsModalOpen(true);
    };

    const handleCloseMainModal = () => {
        resetModalState();
        setIsModalOpen(false);
    };

    const handleSelectVariant = (product: Product, variant: ProductVariant) => {
        // Warn if already checked out
        if ((variant.activeCheckouts || 0) > 0) {
             toast(`Note: "${variant.name}" is marked as checked out.`, { icon: '⚠️' });
        }
        setSelectedSearchItem({ product, variant });
        setSearchTerm(formatVariantName(product.name, variant.name));
    }; 
    
    const handleCheckoutSubmit = async (e: React.FormEvent) => { 
        e.preventDefault(); 
        if (!selectedSearchItem || !returnDate) return; 
        try { 
            await addSampleCheckout({ 
                projectId: project.id, 
                sampleId: 0, // Legacy field, backend handles or ignores
                variantId: selectedSearchItem.variant.id, // NEW Field
                expectedReturnDate: new Date(returnDate).toISOString(), 
            }); 
            handleCloseMainModal();
        } catch (error) { 
            console.error("Checkout failed", error);
            toast.error("Checkout failed.");
        } 
    }; 

    const handleReturn = async (checkout: SampleCheckout) => { 
        if(confirm(`Are you sure you want to return this sample?`)) { 
            try { await updateSampleCheckout(checkout); } 
            catch (error) { console.error("Return failed:", error); toast.error("Failed to return sample."); } 
        } 
    }; 
    
    const handleExtend = async (checkout: SampleCheckout) => {
        try { await extendSampleCheckout(checkout); } 
        catch (error) { console.error("Extend failed:", error); toast.error("Failed to extend checkout."); }
    };
    
    const handleToggleSelect = async (checkout: SampleCheckout) => {
        await toggleSampleSelection(checkout);
    };

    const handleOrderMaterial = (checkout: SampleCheckout) => {
        // Find full product details
        let foundProduct: Product | undefined;
        let foundVariant: ProductVariant | undefined;

        for (const p of products) {
            if (!p.variants) continue;
            const v = p.variants.find(v => String(v.id) === String(checkout.variantId));
            if (v) { foundProduct = p; foundVariant = v; break; }
        }

        if (foundProduct && foundVariant) {
            setPrefillOrderData({ product: foundProduct, variant: foundVariant, projectId: project.id });
            setIsOrderModalOpen(true);
        } else {
            toast.error("Could not find product details for ordering.");
        }
    };

    // Helper to look up display info for the list
    const getCheckoutDisplay = (checkout: SampleCheckout) => {
        for (const p of products) {
            // FIX: Added safe check for variants array
            if (!p.variants) continue;
            const v = p.variants.find(v => String(v.id) === String(checkout.variantId));
            if (v) return formatVariantName(p.name, v.name);
        }
        return 'Unknown Sample';
    };

    return (
        <div className="bg-surface rounded-lg shadow-md flex flex-col h-full">
             {/* Header */}
             <div className="p-4 border-b border-border flex justify-between items-center flex-shrink-0">
                <div className="flex items-center gap-3">
                    <Move className="drag-handle cursor-move text-text-secondary hover:text-text-primary transition-colors" size={20} />
                    <Layers className="w-6 h-6 text-accent" />
                    <h3 className="text-xl font-semibold text-text-primary">Sample Checkouts</h3>
                </div>
                <button 
                  onClick={handleOpenModal} 
                  className="bg-primary hover:bg-primary-hover text-on-primary font-bold py-1 px-3 text-sm rounded-lg"
                >
                    Check Out
                </button>
            </div>

            {/* List of Checkouts */}
            <div className="p-4 overflow-y-auto flex-grow">
                <div className="space-y-3"> 
                    {projectCheckouts.map(checkout => { 
                        const displayName = getCheckoutDisplay(checkout);
                        return ( 
                            <div 
                                key={checkout.id} 
                                className={`bg-background p-3 rounded-md flex justify-between items-center border-l-4 ${checkout.isSelected ? 'border-green-500 bg-green-50/10' : 'border-transparent'}`}
                            > 
                                <div>
                                    <p className="font-semibold text-text-primary">{displayName}</p>
                                    <p className="text-xs text-text-secondary">Expected Return: {new Date(checkout.expectedReturnDate).toLocaleDateString()}</p>
                                    
                                    {/* SELECTION BUTTON */}
                                    <div className="mt-2 flex gap-2">
                                        <button 
                                            onClick={() => handleToggleSelect(checkout)}
                                            className={`text-xs flex items-center gap-1 px-2 py-1 rounded border transition-colors ${
                                                checkout.isSelected 
                                                    ? 'bg-green-100 text-green-700 border-green-300' 
                                                    : 'bg-surface text-text-secondary border-border hover:bg-gray-100'
                                            }`}
                                        >
                                            <ThumbsUp size={12} />
                                            {checkout.isSelected ? 'Selected Choice' : 'Select'}
                                        </button>

                                        {/* ORDER BUTTON (Only if Selected) */}
                                        {checkout.isSelected && (
                                            <button 
                                                onClick={() => handleOrderMaterial(checkout)}
                                                className="text-xs flex items-center gap-1 px-2 py-1 rounded border border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 transition-colors"
                                            >
                                                <ShoppingCart size={12} /> Order
                                            </button>
                                        )}
                                    </div>
                                </div> 
                                {checkout.actualReturnDate ? ( 
                                    <div className="text-right">
                                        <span className="text-sm text-green-400 flex items-center justify-end"><Check className="w-4 h-4 mr-1"/> Returned</span>
                                        <span className="text-xs text-text-secondary">{new Date(checkout.actualReturnDate).toLocaleDateString()}</span>
                                    </div>
                                ) : ( 
                                    <div className="flex items-center gap-2">
                                        <button onClick={() => handleExtend(checkout)} className="text-sm bg-primary hover:bg-primary-hover text-on-primary py-1 px-3 rounded flex items-center gap-1"><Clock size={14} /> Extend</button>
                                        <button onClick={() => handleReturn(checkout)} className="text-sm bg-accent hover:bg-accent-hover text-on-accent py-1 px-3 rounded">Return</button> 
                                    </div>
                                )} 
                            </div> 
                        ); 
                    })} 
                    {projectCheckouts.length === 0 && <p className="text-text-secondary text-center py-4">No samples checked out for this project.</p>} 
                </div>
            </div>

            {/* Add Checkout Modal */}
            {isModalOpen && (
                <ModalPortal>
                    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50"> 
                        <div className="bg-surface p-8 rounded-lg w-full max-w-md border border-border">
                            {/* Modal Header */}
                            <div className="flex justify-between items-center mb-6">
                                <h3 className="text-xl font-bold text-text-primary">Check Out Sample</h3> 
                                <button onClick={handleCloseMainModal} className="text-text-secondary hover:text-text-primary"><X size={24} /></button>
                            </div>
                            <form onSubmit={handleCheckoutSubmit} className="space-y-4"> 
                                {/* Search Input */}
                                <div> 
                                    <label className="text-sm font-medium text-text-secondary block mb-2">1. Find Sample</label> 
                                    <div className="relative"> 
                                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" size={20} />
                                        <input type="text" placeholder="Search by style, color, manufacturer..." value={searchTerm} onChange={e => { setSearchTerm(e.target.value); setSelectedSearchItem(null); }} className="w-full p-2 pl-10 bg-background border border-border rounded text-text-primary" /> 
                                        
                                        {/* Search Results Dropdown */}
                                        {searchTerm.length > 1 && !selectedSearchItem && ( 
                                            <div className="absolute z-10 w-full bg-surface border border-border rounded-b-md mt-1 max-h-60 overflow-y-auto shadow-xl"> 
                                                {searchResults.map(item => (
                                                    <div key={item.variant.id} onClick={() => handleSelectVariant(item.product, item.variant)} className={`p-2 hover:bg-background cursor-pointer text-text-primary border-b border-border last:border-0`}>
                                                        <p className="font-semibold">{item.product.name} - {item.variant.name}</p>
                                                        <div className="flex justify-between text-xs mt-1">
                                                            <span className="text-text-secondary">{item.product.manufacturerName}</span>
                                                            {(item.variant.activeCheckouts || 0) > 0 && <span className="text-orange-400 font-bold">Currently Out</span>}
                                                        </div>
                                                    </div> 
                                                ))} 
                                                {searchResults.length === 0 && ( 
                                                    <div className="p-4 text-center text-text-secondary text-sm">No matching samples found.</div>
                                                )} 
                                            </div> 
                                        )} 
                                    </div> 
                                </div>  
                                
                                {/* Date Input */}
                                <div> 
                                    <label className="text-sm font-medium text-text-secondary block mb-2">2. Select Return Date</label> 
                                    <input type="date" value={returnDate} onChange={e => setReturnDate(e.target.value)} className="w-full p-2 bg-background border-border rounded text-text-primary" required/> 
                                </div> 
                                
                                {/* Actions */}
                                <div className="flex justify-end space-x-2 pt-4 border-t border-border"> 
                                    <button type="button" onClick={handleCloseMainModal} className="py-2 px-4 bg-secondary hover:bg-secondary-hover rounded text-on-secondary">Cancel</button> 
                                    <button type="submit" disabled={!selectedSearchItem || !returnDate} className="py-2 px-4 bg-primary hover:bg-primary-hover rounded text-on-primary disabled:opacity-50 disabled:cursor-not-allowed">Check Out Sample</button> 
                                </div> 
                            </form> 
                        </div> 
                    </div>
                </ModalPortal>
            )}
            
            {/* ORDER MODAL (Portal to escape dashboard grid) */}
            {isOrderModalOpen && (
                <ModalPortal>
                    <AddEditMaterialOrderModal 
                        isOpen={isOrderModalOpen} 
                        onClose={() => setIsOrderModalOpen(false)}
                        initialProjectId={project.id}
                        prefillData={prefillOrderData}
                    />
                </ModalPortal>
            )}
        </div>
    );
};

export default SampleCheckoutsSection;