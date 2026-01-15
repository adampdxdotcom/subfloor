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
        documentTitle: `Sample_Labels_${new Date().toISOString().slice(0,10)}`,
        onBeforeGetContent: async () => {
            setIsGenerating(true);
            await new Promise(resolve => setTimeout(resolve, 500)); 
            setIsGenerating(false);
        },
        pageStyle: `
            @page { size: letter; margin: 0.25in; }
            @media print {
                body { -webkit-print-color-adjust: exact; }
                .print-grid { 
                    display: grid !important;
                    grid-template-columns: repeat(2, 1fr) !important;
                    grid-auto-rows: 3.33in !important;
                    gap: 0.16in !important;
                }
                .break-inside-avoid { page-break-inside: avoid; }
            }
        `
    });

    const toggleSelection = (id: string) => {
        setQueue(prev => prev.map(item => item.id === id ? { ...item, selected: !item.selected } : item));
    };

    if (!isOpen) return null;

    const selectedCount = queue.filter(i => i.selected).length;

    return (
        <div className="fixed inset-0 bg-scrim/80 flex items-center justify-center z-50 p-4">
            <div className="bg-surface-container-high w-full max-w-6xl h-[90vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden border border-outline/20">
                
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
                            onClick={() => handlePrint()} 
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
                    <div className="flex-1 bg-surface-variant/30 overflow-y-auto p-8 flex justify-center">
                        <div className="bg-white shadow-2xl p-[0.25in] min-h-[11in] w-[8.5in] scale-75 origin-top text-black">
                            {/* This div is referenced by useReactToPrint */}
                            <div ref={printRef} className="print-grid" style={{
                                display: 'grid',
                                gridTemplateColumns: 'repeat(2, 1fr)',
                                gridAutoRows: '3.33in',
                                gap: '0'
                            }}>
                                {queue.filter(q => q.selected).map(item => (
                                    <div key={item.id} className="p-2 w-full h-full flex items-center justify-center border border-dashed border-outline/10 print:border-none break-inside-avoid">
                                        <PrintableLabel 
                                            data={item.data} 
                                            qrUrl={`/api/products/${item.isVariant ? 'variants/' : ''}${item.id}/qr`} 
                                        />
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}