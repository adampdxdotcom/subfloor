import React from 'react';
import { Product, PricingSettings } from '../types';
import { useData } from '../context/DataContext';
import { ExternalLink, ChevronRight } from 'lucide-react';
import { calculatePrice, getActivePricingRules } from '../utils/pricingUtils';

interface ProductCardProps {
    product: Product;
    pricingSettings: PricingSettings | null;
    onClick: (product: Product) => void;
    showDiscontinuedStyle?: boolean; // If true, shows the red "Discontinued" banner
}

const ProductCard: React.FC<ProductCardProps> = ({ product, pricingSettings, onClick, showDiscontinuedStyle }) => {
    const { vendors } = useData();

    // Helper to calculate display price
    const getDisplayPriceRange = () => {
        if (!product.variants || product.variants.length === 0 || !pricingSettings) return null;
        
        // Get active vendor
        const vendorId = product.supplierId || product.manufacturerId;
        const vendor = vendors.find(v => v.id === vendorId);
        const rules = getActivePricingRules(vendor, pricingSettings, 'Customer');

        const prices = product.variants
            .filter(v => v.unitCost)
            .map(v => calculatePrice(Number(v.unitCost), rules.percentage, rules.method));
        
        if (prices.length === 0) return null;
        
        const min = Math.min(...prices);
        const max = Math.max(...prices);
        
        if (min === max) return `$${min.toFixed(2)}`;
        return `$${min.toFixed(2)} - $${max.toFixed(2)}`;
    };

    const priceDisplay = getDisplayPriceRange();

    return (
        <div 
            className="bg-surface rounded-lg shadow-md border border-border overflow-hidden group flex flex-col cursor-pointer hover:shadow-lg transition-shadow h-full" 
            onClick={() => onClick(product)}
        >
            {/* Image Area */}
            <div className="w-full h-48 bg-background flex items-center justify-center relative">
                {product.defaultThumbnailUrl || product.defaultImageUrl ? (
                    <img src={product.defaultThumbnailUrl || product.defaultImageUrl || ''} alt={product.name} className="w-full h-full object-cover" loading="lazy" />
                ) : (
                    <div className="text-center p-4">
                        <span className="text-4xl opacity-20 font-bold text-text-tertiary block mb-2">
                            {product.name.substring(0, 2).toUpperCase()}
                        </span>
                        <span className="text-xs text-text-secondary">No Image</span>
                    </div>
                )}
                <div className="absolute top-2 right-2 bg-black/60 text-white text-xs px-2 py-1 rounded backdrop-blur-sm">
                    {product.variants.length} Variants
                </div>
            </div>

            <div className="p-4 flex flex-col flex-grow">
                <h3 className="font-bold text-lg text-text-primary truncate" title={product.name}>{product.name}</h3>
                <p className="text-sm text-text-secondary truncate">{product.manufacturerName || 'Unknown Vendor'}</p>
                
                {/* Price Range */}
                <div className="mt-2">
                    {priceDisplay ? (
                        <p className="text-sm font-semibold text-green-400">
                            {priceDisplay} <span className="text-text-secondary font-normal text-xs">/ Unit</span>
                        </p>
                    ) : (
                        <p className="text-xs text-text-tertiary italic">No pricing set</p>
                    )}
                </div>

                <div className="flex-grow" />
                
                {showDiscontinuedStyle && (
                    <div className="mb-2 text-center bg-red-900/30 text-red-400 text-xs font-bold py-1 rounded border border-red-900/50 uppercase tracking-wider">Discontinued</div>
                )}
                
                <div className="flex justify-between items-center mt-4 pt-3 border-t border-border">
                    <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold bg-background text-text-secondary px-2 py-1 rounded">
                            {product.productType}
                        </span>
                        {product.productLineUrl && (
                            <a 
                                href={product.productLineUrl} 
                                target="_blank" 
                                rel="noreferrer" 
                                className="text-text-tertiary hover:text-primary p-1 rounded hover:bg-background transition-colors"
                                title="Open Product Website"
                                onClick={(e) => e.stopPropagation()} 
                            >
                                <ExternalLink size={14} />
                            </a>
                        )}
                    </div>
                    <ChevronRight size={16} className="text-text-tertiary" />
                </div>
            </div>
        </div>
    );
};

export default ProductCard;