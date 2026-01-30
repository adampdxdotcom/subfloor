import React from 'react';
import { Product, PricingSettings } from '../types';
import { useData } from '../context/DataContext';
import { ExternalLink, ChevronRight, CheckCircle2, Circle } from 'lucide-react';
import { calculatePrice, getActivePricingRules } from '../utils/pricingUtils';
import { getImageUrl } from '../utils/apiConfig';

interface ProductCardProps {
    product: Product;
    pricingSettings: PricingSettings | null;
    onClick: (product: Product) => void;
    showDiscontinuedStyle?: boolean; 
    isSelected?: boolean; 
    isSelectionMode?: boolean; 
}

const ProductCard: React.FC<ProductCardProps> = ({ product, pricingSettings, onClick, showDiscontinuedStyle, isSelected, isSelectionMode }) => {
    const { vendors } = useData();

    // Helper to calculate display price
    const getDisplayInfo = () => {
        if (!product.variants || product.variants.length === 0) return null;

        // Use stored retailPrice if available, otherwise fall back to calculation (legacy safety)
        const validVariants = product.variants.filter(v => (v.retailPrice && Number(v.retailPrice) > 0) || (v.unitCost && Number(v.unitCost) > 0));
        
        const prices = validVariants.map(v => {
            if (v.retailPrice && Number(v.retailPrice) > 0) return Number(v.retailPrice);
            
            // Fallback: Calculate if retailPrice is missing but cost exists
            if (pricingSettings && v.unitCost) {
                const vendorId = product.supplierId || product.manufacturerId;
                const vendor = vendors.find(vid => vid.id === vendorId);
                const rules = getActivePricingRules(vendor, pricingSettings, 'Customer');
                return calculatePrice(Number(v.unitCost), rules.percentage, rules.method);
            }
            return 0;
        }).filter(p => p > 0);
        
        if (prices.length === 0) return null;
        
        const min = Math.min(...prices);
        const max = Math.max(...prices);
        
        const priceStr = min === max ? `$${min.toFixed(2)}` : `$${min.toFixed(2)} - $${max.toFixed(2)}`;

        // Determine Unit (Prefer pricingUnit, then uom, then 'Unit')
        const representativeVariant = validVariants.find(v => v.pricingUnit) || validVariants[0];
        const unitLabel = representativeVariant?.pricingUnit || representativeVariant?.uom || 'Unit';

        return { priceStr, unitLabel };
    };

    const displayInfo = getDisplayInfo();

    return (
        <div 
            className={`bg-surface-container-high rounded-xl shadow-sm border overflow-hidden group flex flex-col cursor-pointer hover:shadow-md hover:-translate-y-1 transition-all h-full relative
                ${isSelected ? 'border-primary ring-2 ring-primary/80' : 'border-outline/10'}
            `} 
            onClick={() => onClick(product)}
        >
            {/* Selection Overlay Checkbox */}
            {(isSelectionMode || isSelected) && (
                <div className="absolute top-2.5 left-2.5 z-10 text-primary">
                    {isSelected ? <CheckCircle2 size={24} className="fill-surface-container-high" /> : <Circle size={24} className="text-white/80 drop-shadow-md" />}
                </div>
            )}

            {/* Image Area */}
            <div className="w-full h-48 bg-surface-container flex items-center justify-center relative">
                {product.defaultThumbnailUrl || product.defaultImageUrl ? (
                    <img src={getImageUrl(product.defaultThumbnailUrl || product.defaultImageUrl)} alt={product.name} className="w-full h-full object-cover" loading="lazy" />
                ) : (
                    <div className="text-center p-4">
                        <span className="text-4xl opacity-20 font-bold text-text-tertiary block mb-2">
                            {product.name.substring(0, 2).toUpperCase()}
                        </span>
                        <span className="text-xs text-text-secondary">No Image</span>
                    </div>
                )}
                <div className="absolute top-2 right-2 bg-scrim/60 text-white text-xs px-2 py-1 rounded-full backdrop-blur-sm">
                    {product.variants.length} Variants
                </div>
            </div>

            <div className="p-4 flex flex-col flex-grow">
                <h3 className="font-bold text-lg text-text-primary truncate" title={product.name}>{product.name}</h3>
                <p className="text-sm text-text-secondary truncate">{product.manufacturerName || 'Unknown Vendor'}</p>
                
                {/* Price Range */}
                <div className="mt-2">
                    {displayInfo ? (
                        <p className="text-sm font-semibold text-tertiary">
                            {displayInfo.priceStr} <span className="text-text-secondary font-normal text-xs">/ {displayInfo.unitLabel}</span>
                        </p>
                    ) : (
                        <p className="text-xs text-text-tertiary italic">No pricing set</p>
                    )}
                </div>

                <div className="flex-grow" />
                
                {showDiscontinuedStyle && (
                    <div className="mb-2 text-center bg-error-container text-on-error-container text-xs font-bold py-1 rounded-full uppercase tracking-wider">Discontinued</div>
                )}
                
                <div className="flex justify-between items-center mt-4 pt-3 border-t border-outline/10">
                    <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold bg-surface-container-highest text-text-secondary px-2 py-1 rounded-full">
                            {product.productType}
                        </span>
                        {product.productLineUrl && (
                            <a 
                                href={product.productLineUrl} 
                                target="_blank" 
                                rel="noreferrer" 
                                className="text-text-tertiary hover:text-primary p-1 rounded-full hover:bg-surface-container-highest transition-colors"
                                title="Open Product Website"
                                onClick={(e) => e.stopPropagation()} 
                            >
                                <ExternalLink size={14} />
                            </a>
                        )}
                    </div>
                    <ChevronRight size={18} className="text-text-secondary" />
                </div>
            </div>
        </div>
    );
};

export default ProductCard;