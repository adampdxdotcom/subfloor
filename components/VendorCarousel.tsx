import React from 'react';
import { Link } from 'react-router-dom';
import { Vendor } from '../types';
import { ChevronRight, Building, Truck, Layers } from 'lucide-react';

const VendorCard = ({ vendor }: { vendor: Vendor }) => {
    return (
        <Link to={`/vendors/${vendor.id}`} className="block bg-surface p-4 rounded-lg shadow-md hover:shadow-lg hover:bg-background border border-border transition-all duration-300 w-80 flex-shrink-0">
            <div className="flex justify-between items-start mb-2">
                <h3 className="font-bold text-lg text-text-primary truncate pr-2">{vendor.name}</h3>
                <ChevronRight className="w-5 h-5 text-accent flex-shrink-0"/>
            </div>
            
            <div className="flex items-center gap-2 text-xs text-text-secondary mb-3">
                {vendor.vendorType === 'Manufacturer' && <span className="flex items-center gap-1"><Building size={12}/> Manufacturer</span>}
                {vendor.vendorType === 'Both' && <span className="flex items-center gap-1"><Building size={12}/> Mfg & Dist</span>}
                <span className="flex items-center gap-1 bg-background/50 px-2 py-0.5 rounded-full border border-border">
                    <Layers size={12} /> {vendor.sampleCount || 0} Products
                </span>
            </div>

            <div className="text-sm text-text-secondary space-y-1">
                <p className="truncate">{vendor.repName || 'No Rep Listed'}</p>
                <p className="truncate">{vendor.phone || vendor.orderingEmail || 'No Contact Info'}</p>
            </div>
        </Link>
    );
};

interface VendorCarouselProps {
    title: string;
    vendors: Vendor[];
}

const VendorCarousel: React.FC<VendorCarouselProps> = ({ title, vendors }) => {
    if (vendors.length === 0) return null;

    return (
        <div className="mb-8">
            <h2 className="text-xl font-bold mb-4 text-text-primary">{title}</h2>
            <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-thin scrollbar-thumb-border scrollbar-track-transparent">
                {vendors.map(vendor => (
                    <VendorCard key={vendor.id} vendor={vendor} />
                ))}
            </div>
        </div>
    );
};

export default VendorCarousel;