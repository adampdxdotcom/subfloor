import React, { useState, useMemo, useCallback } from 'react';
import { Project, Product, ProductVariant, SampleCheckout } from '../types';
import { Check, Clock, X, Layers, Move, ThumbsUp, ShoppingCart, PlusCircle } from 'lucide-react'; 
import { useData } from '../context/DataContext';
import { toast } from 'react-hot-toast';
import AddEditMaterialOrderModal from './AddEditMaterialOrderModal';
import ModalPortal from './ModalPortal';
import SampleSelector, { CheckoutItem } from './SampleSelector'; 

interface SampleCheckoutsSectionProps {
    project: Project;
    isModalOpen?: boolean; 
    onCloseModal?: () => void;
}

const getThreeDaysFromNowISO = () => {
    const date = new Date();
    date.setDate(date.getDate() + 3);
    return date.toISOString().split('T')[0];
};

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
        toggleSampleSelection 
    } = useData();
    
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [checkoutItems, setCheckoutItems] = useState<CheckoutItem[]>([]);
    const [returnDate, setReturnDate] = useState(getThreeDaysFromNowISO()); 

    const [isOrderModalOpen, setIsOrderModalOpen] = useState(false);
    const [prefillOrderData, setPrefillOrderData] = useState<any>(null);

    const projectCheckouts = useMemo(() => {
        return sampleCheckouts
            .filter(sc => sc.projectId === project.id)
            .sort((a, b) => {
                if (a.isSelected !== b.isSelected) return a.isSelected ? -1 : 1;
                return new Date(b.checkoutDate).getTime() - new Date(a.checkoutDate).getTime();
            });
    }, [sampleCheckouts, project.id]);
    
    const handleOpenModal = () => {
        setCheckoutItems([]); 
        setReturnDate(getThreeDaysFromNowISO()); 
        setIsModalOpen(true);
    };

    const handleCloseMainModal = () => {
        setIsModalOpen(false);
    };

    const handleItemsChange = useCallback((newItems: CheckoutItem[]) => {
        setCheckoutItems(newItems);
    }, []);
    
    const handleCheckoutSubmit = async (e: React.FormEvent) => { 
        e.preventDefault(); 
        if (checkoutItems.length === 0 || !returnDate) return; 
        
        try { 
            const promises = checkoutItems.map(item => 
                addSampleCheckout({ 
                    projectId: project.id, 
                    variantId: item.variantId,
                    interestVariantId: item.interestVariantId,
                    sampleType: item.sampleType,
                    quantity: item.quantity,
                    expectedReturnDate: new Date(returnDate).toISOString(), 
                })
            );
            
            await Promise.all(promises);
            toast.success(`Checked out ${checkoutItems.length} sample(s).`);
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

    const getCheckoutDisplay = (checkout: SampleCheckout) => {
        for (const p of products) {
            if (!p.variants) continue;
            const v = p.variants.find(v => String(v.id) === String(checkout.variantId));
            if (v) return formatVariantName(p.name, v.name);
        }
        return 'Unknown Sample';
    };

    return (
        <div className="bg-surface rounded-lg shadow-md flex flex-col h-full">
             <div className="p-4 border-b border-border flex justify-between items-center flex-shrink-0">
                <div className="flex items-center gap-3">
                    <Move className="drag-handle cursor-move text-text-secondary hover:text-text-primary transition-colors" size={20} />
                    <Layers className="w-6 h-6 text-accent" />
                    <h3 className="text-xl font-semibold text-text-primary">Sample Checkouts</h3>
                </div>
                <button 
                  onClick={handleOpenModal} 
                  className="bg-primary hover:bg-primary-hover text-on-primary font-bold py-1 px-3 text-sm rounded-lg flex items-center gap-1"
                >
                    <PlusCircle size={16} /> Check Out
                </button>
            </div>

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

            {isModalOpen && (
                <ModalPortal>
                    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50"> 
                        <div className="bg-surface p-8 rounded-lg w-full max-w-2xl border border-border flex flex-col max-h-[90vh]">
                            <div className="flex justify-between items-center mb-6">
                                <h3 className="text-xl font-bold text-text-primary">Check Out Sample</h3> 
                                <button onClick={handleCloseMainModal} className="text-text-secondary hover:text-text-primary"><X size={24} /></button>
                            </div>
                            
                            <form onSubmit={handleCheckoutSubmit} className="flex-1 flex flex-col min-h-0"> 
                                <div className="space-y-4 flex-1 overflow-y-auto pr-2">
                                    <div> 
                                        <label className="text-sm font-medium text-text-secondary block mb-2">1. Expected Return Date</label> 
                                        <input type="date" value={returnDate} onChange={e => setReturnDate(e.target.value)} className="w-full p-2 bg-background border border-border rounded text-text-primary" required/> 
                                    </div> 

                                    <div> 
                                        <label className="text-sm font-medium text-text-secondary block mb-2">2. Search or Scan Samples</label> 
                                        <SampleSelector onItemsChange={handleItemsChange} />
                                    </div> 
                                </div>
                                
                                <div className="flex justify-end space-x-2 pt-6 border-t border-border mt-4"> 
                                    <button type="button" onClick={handleCloseMainModal} className="py-2 px-4 bg-secondary hover:bg-secondary-hover rounded text-on-secondary">Cancel</button> 
                                    <button type="submit" disabled={checkoutItems.length === 0 || !returnDate} className="py-2 px-4 bg-primary hover:bg-primary-hover rounded text-on-primary disabled:opacity-50 disabled:cursor-not-allowed">
                                        Check Out ({checkoutItems.length})
                                    </button> 
                                </div> 
                            </form> 
                        </div> 
                    </div>
                </ModalPortal>
            )}
            
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