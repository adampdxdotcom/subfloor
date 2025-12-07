import React from 'react';
import { ProductVariant, Product } from '../types';
import { QrCode } from 'lucide-react';

interface PrintableLabelProps {
    data: {
        id: string; 
        name: string; 
        subName?: string; 
        sku?: string | null;
        size?: string | null;
        manufacturer?: string | null;
        retailPrice?: number | null;
        uom?: string | null;
        pricingUnit?: string | null; // NEW FIELD
        cartonSize?: number | null;
        isVariant: boolean;
    };
    qrUrl: string; 
}

export const PrintableLabel: React.FC<PrintableLabelProps> = ({ data, qrUrl }) => {
    return (
        // Changed h-full to h-auto. Border now wraps content only.
        <div className="border-2 border-black w-full h-auto p-2 flex flex-col box-border bg-white text-black break-inside-avoid overflow-hidden">
            {/* Header */}
            <div className="border-b-2 border-black pb-0.5 mb-1 shrink-0">
                <h2 className="text-[10px] font-bold uppercase tracking-wide text-gray-600 leading-none">{data.manufacturer}</h2>
                <h1 className="text-xl font-black leading-none mt-0.5 truncate tracking-tight">{data.name}</h1>
                {data.subName && <h3 className="text-base font-bold leading-none mt-0.5 text-gray-900 truncate">{data.subName}</h3>}
            </div>

            {/* Body */}
            <div className="flex gap-2 items-start">
                {/* Left: QR Code */}
                <div className="w-1/3 flex-shrink-0">
                    <img src={qrUrl} alt="QR" className="w-full h-auto object-contain rendering-pixelated" />
                </div>

                {/* Right: Data Stack */}
                <div className="flex-1 flex flex-col gap-0.5">
                    
                    {/* Row 1: SKU & Size */}
                    <div className="flex justify-between items-start">
                        {data.sku ? (
                            <div>
                                <span className="font-bold block text-[10px] uppercase text-gray-500 leading-none mb-0.5">SKU</span>
                                <span className="font-mono font-bold text-sm leading-none">{data.sku}</span>
                            </div>
                        ) : <div />}
                        
                        {data.size && (
                            <div className="text-right">
                                <span className="font-bold block text-[10px] uppercase text-gray-500 leading-none mb-0.5">Size</span>
                                <span className="font-bold text-sm leading-none">{data.size}</span>
                            </div>
                        )}
                    </div>

                    {/* Divider */}
                    {(data.retailPrice || data.cartonSize) && <div className="border-t border-gray-300 my-0.5"></div>}

                    {/* Row 2: Price & Carton */}
                    {(data.retailPrice || data.cartonSize) && (
                        <div className="flex justify-between items-end">
                            {data.retailPrice && (
                                <div>
                                    <span className="font-bold block text-[10px] uppercase text-gray-500 leading-none mb-0.5">Retail</span>
                                    <div className="flex items-baseline gap-0.5">
                                        <span className="text-xl font-black leading-none tracking-tighter">${data.retailPrice.toFixed(2)}</span>
                                        {/* Use pricingUnit if available, else fallback to uom */}
                                        <span className="text-[10px] font-bold text-gray-500">/{data.pricingUnit || data.uom || 'Unit'}</span>
                                    </div>
                                </div>
                            )}
                            {data.cartonSize && (
                                <div className="text-right">
                                    <span className="font-bold block text-[10px] uppercase text-gray-500 leading-none mb-0.5">Carton</span>
                                    <span className="font-bold text-sm leading-none">{data.cartonSize} {data.uom}</span>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};