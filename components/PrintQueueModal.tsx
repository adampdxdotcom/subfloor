import React, { useState, useEffect, useRef } from 'react';
import { Product } from '../types';
import { Printer, Loader2, CheckSquare, Square } from 'lucide-react';
import { PrintableLabel } from './PrintableLabel';
import { useReactToPrint } from 'react-to-print';

interface PrintQueueModalProps {
    isOpen: boolean;
    onClose: () => void;
    selectedProducts: Product[]; // Passed from Library (Single or Multiple)
}

export default function PrintQueueModal({ isOpen, onClose, selectedProducts }: PrintQueueModalProps) {
    // Flattened list of printable items (Variants + Parents)
    const [queue, setQueue] = useState<{
        id: string;
        parentId: string;
        isVariant: boolean;
        selected: boolean;
        data: any; // Data for the label component
    }[]>([]);

    const printRef = useRef<HTMLDivElement>(null);
    const [isGenerating, setIsGenerating] = useState(false);

    // Initialize Queue on Open
    useEffect(() => {
        if (isOpen && selectedProducts.length > 0) {
            const newQueue: typeof queue = [];
            
            selectedProducts.forEach(prod => {
                const isSingleProductMode = selectedProducts.length === 1;

                newQueue.push({
                    id: prod.id,
                    parentId: prod.id,
                    isVariant: false,
                    selected: isSingleProductMode && prod.variants.length === 0, 
                    data: {
                        id: prod.id,
                        name: prod.name,
                        manufacturer: prod.manufacturerName,
                        isVariant: false
                    }
                });

                // 2. Add Variants
                prod.variants.forEach(v => {
                    newQueue.push({
                        id: v.id,
                        parentId: prod.id,
                        isVariant: true,
                        selected: true, // Auto-select variants by default (common workflow)
                        data: {
                            id: v.id,
                            name: prod.name,
                            subName: v.name,
                            sku: v.sku,
                            size: v.size,
                            manufacturer: prod.manufacturerName,
                            retailPrice: v.retailPrice,
                            uom: v.uom,
                            pricingUnit: v.pricingUnit, 
                            cartonSize: v.cartonSize,
                            isVariant: true
                        }
                    });
                });
            });
            setQueue(newQueue);
        }
    }, [isOpen, selectedProducts]);

    const handlePrint = useReactToPrint({
        contentRef: printRef,
        onBeforeGetContent: () => {
            return new Promise<void>((resolve) => {
                setIsGenerating(true);
                // Wait for all images to load before printing
                const images = printRef.current?.querySelectorAll('img') || [];
                const imagePromises = Array.from(images).map(img => {
                    if (img.complete) return Promise.resolve();
                    return new Promise(res => {
                        img.onload = () => res(true);
                        img.onerror = () => res(true); // Resolve even on error
                    });
                });
                Promise.all(imagePromises).then(() => {
                    setIsGenerating(false); // Reset loading state here if we are about to resolve
                    resolve();
                });
            });
        },
        documentTitle: `Sample_Labels_${new Date().toISOString().slice(0,10)}`,
        pageStyle: `
            @page { size: letter; margin: 0.25in; }
            @media print {
                body { -webkit-print-color-adjust: exact !important; color-adjust: exact !important; }
                .print-page-container {
                    box-shadow: none !important;
                    margin: 0 !important;
                    page-break-after: always;
                }
            }
        `
    });

    const toggleSelection = (id: string) => {
        setQueue(prev => prev.map(item => item.id === id ? { ...item, selected: !item.selected } : item));
    };

    if (!isOpen) return null;

    // 2. Calculate pages here so they can be passed as props
    const itemsToPrint = queue.filter(q => q.selected);
    const ITEMS_PER_PAGE = 6;
    const pages = [];
    if (itemsToPrint.length > 0) {
        for (let i = 0; i < itemsToPrint.length; i += ITEMS_PER_PAGE) {
            pages.push(itemsToPrint.slice(i, i + ITEMS_PER_PAGE));
        }
    }

    const selectedCount = queue.filter(i => i.selected).length;

    return (
        <div className="fixed inset-0 bg-scrim/80 flex items-center justify-center z-50 p-4">
            <div className="bg-surface-container-high w-full max-w-6xl h-[90vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden border border-outline/20">
                
                {/* Print + Preview Container */}
                <div ref={printRef} className="w-full print-only">
                    {pages.map((pageItems, pageIndex) => (
                        <div 
                            key={pageIndex}
                            className="print-page-container bg-white w-[8.5in] h-[11in] p-[0.25in] text-black shadow-2xl"
                            style={{ pageBreakAfter: 'always', display: 'block' }}
                        >
                            <div className="print-grid h-full w-full" style={{
                                display: 'grid',
                                gridTemplateColumns: 'repeat(2, 1fr)',
                                gridTemplateRows: 'repeat(3, 1fr)',
                                gap: '0'
                            }}>
                                {pageItems.map(item => (
                                    <div key={item.id} className="p-2 w-full h-full flex items-center justify-center border border-dashed border-outline/10 break-inside-avoid">
                                        <PrintableLabel 
                                            data={item.data} 
                                            qrUrl={`/api/products/${item.isVariant ? 'variants/' : ''}${item.id}/qr`} 
                                        />
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>

                {/* Header */}
                <div className="p-4 border-b border-outline/10 flex justify-between items-center shrink-0">
                    <div>
                        <h2 className="text-xl font-bold text-text-primary flex items-center gap-2">
                            <Printer className="text-primary" /> Print Labels
                        </h2>
                        <p className="text-sm text-text-secondary">{selectedCount} labels queued</p>
                    </div>
                    <div className="flex gap-3">
                        <button onClick={onClose} className="py-2.5 px-6 rounded-full border border-outline text-text-primary hover:bg-surface-container-highest transition-colors">Cancel</button>
                        <button 
                            onClick={handlePrint} 
                            disabled={selectedCount === 0 || isGenerating}
                            className="flex items-center gap-2 py-3 px-6 rounded-full bg-primary hover:bg-primary-hover text-on-primary font-semibold shadow-md transition-all disabled:opacity-50"
                        >
                            {isGenerating ? <Loader2 className="animate-spin" /> : <Printer size={20} />}
                            Print Sheets
                        </button>
                    </div>
                </div>

                <div className="flex-1 flex overflow-hidden">
                    {/* LEFT: Selection List */}
                    <div className="w-1/3 border-r border-outline/10 bg-surface-container overflow-y-auto p-4 space-y-4 scrollbar-thin scrollbar-thumb-surface-container-highest">
                        {selectedProducts.map(prod => {
                            const prodItems = queue.filter(q => q.parentId === prod.id);
                            return (
                                <div key={prod.id} className="bg-surface-container-high border border-outline/10 rounded-xl overflow-hidden">
                                    <div className="p-3 bg-surface-container-highest border-b border-outline/10 font-bold text-text-primary flex justify-between items-center">
                                        <span>{prod.name}</span>
                                        <span className="text-xs font-normal text-text-secondary">{prodItems.length} options</span>
                                    </div>
                                    <div className="divide-y divide-outline/10">
                                        {prodItems.map(item => (
                                            <div 
                                                key={item.id} 
                                                onClick={() => toggleSelection(item.id)}
                                                className={`p-3 flex items-center gap-3 cursor-pointer hover:bg-primary-container/20 transition-colors ${item.selected ? 'bg-primary-container/30' : ''}`}
                                            >
                                                {item.selected ? <CheckSquare size={18} className="text-primary" /> : <Square size={18} className="text-text-tertiary" />}
                                                <div className="flex-1 min-w-0">
                                                    <p className={`text-sm font-medium truncate ${item.selected ? 'text-primary' : 'text-text-secondary'}`}>
                                                        {item.isVariant ? item.data.subName : "Full Line Label"}
                                                    </p>
                                                    {item.isVariant && <p className="text-xs text-text-tertiary truncate">{item.data.sku || 'No SKU'}</p>}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {/* RIGHT: Print Preview */}
                    <div className="flex-1 bg-surface-variant/30 overflow-y-auto p-8">
                        {/* Visible Preview */}
                        <div className="scale-75 origin-top mx-auto w-[8.5in]">
                            {pages.map((pageItems, pageIndex) => (
                                <div 
                                    key={pageIndex} 
                                    className="print-page-container bg-white shadow-2xl w-full h-[11in] p-[0.25in] text-black mb-8"
                                >
                                    <div className="print-grid h-full w-full" style={{
                                        display: 'grid',
                                        gridTemplateColumns: 'repeat(2, 1fr)',
                                        gridTemplateRows: 'repeat(3, 1fr)',
                                        gap: '0'
                                    }}>
                                        {pageItems.map(item => (
                                            <div key={item.id} className="p-2 w-full h-full flex items-center justify-center border border-dashed border-outline/10 break-inside-avoid">
                                                <PrintableLabel 
                                                    data={item.data} 
                                                    qrUrl={`/api/products/${item.isVariant ? 'variants/' : ''}${item.id}/qr`} 
                                                />
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}