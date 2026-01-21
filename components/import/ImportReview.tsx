import React, { useState, useEffect, useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { ArrowRight, AlertTriangle, CheckCircle2, PlusCircle, AlertCircle, XCircle, LayoutGrid, CheckSquare, Square } from 'lucide-react';

interface ImportReviewProps {
    results: any[];
    onExecute: (modifiedResults: any[]) => void;
    isExecuting: boolean;
    onBack: () => void;
}

const formatMoney = (val: any) => {
    if (!val && val !== 0) return '-';
    return `$${Number(val).toFixed(2)}`;
};

const ImportReview: React.FC<ImportReviewProps> = ({ results, onExecute, isExecuting, onBack }) => {
    
    // Local state to handle edits and toggles
    const [rows, setRows] = useState<any[]>([]);

    // Initialize state when results arrive
    useEffect(() => {
        const processed = results.map(r => ({ 
            ...r, 
            isSkipped: r.status === 'error',
            hasSample: false // Default to false (Catalog Only)
        }));

        // SORT: Errors -> New -> Updates -> Matches
        processed.sort((a, b) => {
            const score = (status: string) => {
                if (status === 'error') return 0;
                if (status === 'new') return 1;
                if (status === 'update') return 2;
                return 3; // match
            };
            return score(a.status) - score(b.status);
        });

        setRows(processed);
    }, [results]);

    const handleToggleSkip = (index: number) => {
        setRows(prev => {
            const newRows = [...prev];
            newRows[index].isSkipped = !newRows[index].isSkipped;
            return newRows;
        });
    };

    const handleToggleSample = (index: number) => {
        setRows(prev => {
            const newRows = [...prev];
            newRows[index].hasSample = !newRows[index].hasSample;
            return newRows;
        });
    };

    const handleNameEdit = (index: number, newName: string) => {
        setRows(prev => {
            const newRows = [...prev];
            newRows[index].productName = newName;
            return newRows;
        });
    };

    // --- BULK SAMPLE ACTIONS ---
    const handleSampleAction = (action: 'all' | 'none' | 'line_board') => {
        setRows(prev => {
            let newRows = [...prev];
            
            if (action === 'all') {
                newRows = newRows.map(r => ({ ...r, hasSample: true }));
            } else if (action === 'none') {
                newRows = newRows.map(r => ({ ...r, hasSample: false }));
            } else if (action === 'line_board') {
                // 1. Identify unique Product Lines
                const productLines = new Set(newRows.map(r => r.productName));
                
                // 2. Filter out lines that already have a "Master Sample" row (prevent duplicates)
                const existingMasters = new Set(
                    newRows.filter(r => r.isMaster).map(r => r.productName)
                );

                const linesToAdd = [...productLines].filter(p => !existingMasters.has(p));

                // 3. Create new rows
                const masterRows = linesToAdd.map(lineName => ({
                    productName: lineName,
                    variantName: "Master Sample", // Special designation
                    sku: "", 
                    unitCost: 0,
                    retailPrice: 0,
                    status: 'new', // It's a new "variant" of the product
                    isSkipped: false,
                    hasSample: true, // The whole point is to have a sample
                    isMaster: true, // Logic flag for backend
                    message: "Generated Line Board",
                    details: { matchType: 'generated' }
                }));
                
                // Prepend masters to the top
                newRows = [...masterRows, ...newRows];
            }
            return newRows;
        });
    };

    // Stats calculation based on LOCAL state
    const activeRows = rows.filter(r => !r.isSkipped);
    const stats = {
        updates: activeRows.filter(r => r.status === 'update').length,
        matches: activeRows.filter(r => r.status === 'match').length,
        new: activeRows.filter(r => r.status === 'new').length,
        samples: activeRows.filter(r => r.hasSample).length,
        errors: rows.filter(r => r.status === 'error').length
    };

    // --- VIRTUALIZATION SETUP ---
    const parentRef = useRef<HTMLDivElement>(null);
    
    const rowVirtualizer = useVirtualizer({
        count: rows.length,
        getScrollElement: () => parentRef.current,
        estimateSize: () => 60,
        overscan: 10,
    });

    return (
        <div className="bg-surface-container-high rounded-xl shadow-sm border border-outline/20 overflow-hidden flex flex-col h-[600px]">
            
            {/* SUMMARY HEADER */}
            <div className="p-6 border-b border-outline/10 bg-surface-container-low flex justify-between items-center">
                <div>
                    <h2 className="text-xl font-bold text-text-primary">Review Changes</h2>
                    <p className="text-sm text-text-secondary">Review prices and select which items to add to inventory.</p>
                </div>
                <div className="flex gap-3">
                    <div className="flex items-center gap-2 px-3 py-1 bg-success-container text-success rounded-full text-xs font-bold uppercase">
                        <CheckCircle2 size={14} /> {stats.updates} Updates
                    </div>
                    <div className="flex items-center gap-2 px-3 py-1 bg-surface-container-highest text-text-secondary rounded-full text-xs font-bold uppercase border border-outline/20">
                        <CheckCircle2 size={14} /> {stats.matches} Matched (No Change)
                    </div>
                    <div className="flex items-center gap-2 px-3 py-1 bg-primary-container text-primary rounded-full text-xs font-bold uppercase">
                        <PlusCircle size={14} /> {stats.new} New
                    </div>
                    <div className="flex items-center gap-2 px-3 py-1 bg-tertiary-container text-tertiary rounded-full text-xs font-bold uppercase">
                        <LayoutGrid size={14} /> {stats.samples} Samples
                    </div>
                </div>
            </div>

            {/* SCROLLABLE TABLE */}
            <div ref={parentRef} className="flex-1 overflow-auto bg-surface-container relative">
                <table className="w-full text-left text-sm border-collapse">
                    <thead className="bg-surface-container-low text-text-secondary uppercase text-xs sticky top-0 z-10 border-b border-outline/10 shadow-sm">
                        <tr>
                            <th className="p-3 font-bold w-24">Action</th>
                            <th className="p-3 font-bold">Product Match (Editable)</th>
                            <th className="p-3 font-bold">SKU / Details</th>
                            <th className="p-3 font-bold">Spec Changes</th>
                            
                            {/* NEW: PHYSICAL SAMPLE COLUMN */}
                            <th className="p-3 font-bold w-48 bg-surface-container-highest/50">
                                <div className="flex flex-col gap-2">
                                    <span>Physical Sample</span>
                                    <div className="flex gap-1">
                                        <button onClick={() => handleSampleAction('all')} className="px-1.5 py-0.5 text-[10px] bg-outline/10 hover:bg-outline/20 rounded text-text-primary">All</button>
                                        <button onClick={() => handleSampleAction('none')} className="px-1.5 py-0.5 text-[10px] bg-outline/10 hover:bg-outline/20 rounded text-text-primary">None</button>
                                        <button onClick={() => handleSampleAction('line_board')} className="px-1.5 py-0.5 text-[10px] bg-tertiary-container text-tertiary hover:brightness-110 rounded flex items-center gap-1">
                                            <PlusCircle size={10} /> Line Bd
                                        </button>
                                    </div>
                                </div>
                            </th>

                            <th className="p-3 font-bold text-right">Old Cost</th>
                            <th className="p-3 font-bold text-right">New Cost</th>
                            <th className="p-3 font-bold text-right">Diff</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-outline/10">
                        {/* Top Spacer */}
                        {rowVirtualizer.getVirtualItems().length > 0 && (
                            <tr><td style={{ height: `${rowVirtualizer.getVirtualItems()[0].start}px` }} colSpan={8}></td></tr>
                        )}

                        {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                            const row = rows[virtualRow.index];
                            const idx = virtualRow.index;
                            return (
                            <React.Fragment key={virtualRow.key}>
                                {/* MAIN ROW */}
                                <tr 
                                    data-index={virtualRow.index} 
                                    ref={rowVirtualizer.measureElement}
                                    className={`hover:bg-surface-container-highest transition-colors ${row.isSkipped ? 'opacity-50 grayscale' : ''} ${row.isMaster ? 'bg-tertiary-container/10' : ''}`}
                                >
                                    <td className="p-3">
                                        <button 
                                            onClick={() => handleToggleSkip(idx)}
                                            className={`text-xs font-bold px-2 py-1 rounded-lg border transition-all w-full text-center
                                                ${row.isSkipped 
                                                    ? 'bg-surface-container-highest text-text-secondary border-outline/20' 
                                                    : row.status === 'update' 
                                                        ? 'bg-success-container text-success border-success/30'
                                                        : row.status === 'new'
                                                            ? 'bg-primary-container text-primary border-primary/30'
                                                            : row.status === 'match'
                                                                ? 'bg-surface-container text-text-tertiary border-outline/20 opacity-70'
                                                                : 'bg-error-container text-error border-error/30 cursor-default'
                                                }`}
                                            disabled={row.status === 'error'}
                                        >
                                            {row.isSkipped ? 'SKIP' : row.status === 'match' ? 'MATCH' : row.status.toUpperCase()}
                                        </button>
                                    </td>
                                    <td className="p-3">
                                        <input 
                                            type="text" 
                                            className="font-medium text-text-primary bg-transparent border-b border-transparent hover:border-outline focus:border-primary focus:outline-none w-full transition-colors"
                                            value={row.productName}
                                            onChange={(e) => handleNameEdit(idx, e.target.value)}
                                            disabled={row.isSkipped}
                                        />
                                        <div className="flex items-center gap-2 mt-1">
                                            {row.isMaster && <span className="text-[10px] font-bold bg-tertiary text-on-tertiary px-1.5 py-0.5 rounded">MASTER</span>}
                                            {row.variantName && <div className="text-xs text-text-secondary">{row.variantName}</div>}
                                        </div>
                                        {row.status === 'error' && <div className="text-xs text-error font-bold mt-1">{row.message}</div>}
                                    </td>
                                    <td className="p-3 text-text-secondary font-mono text-xs">{row.sku || '-'}</td>
                                    
                                    {/* SPEC CHANGES COLUMN */}
                                    <td className="p-3 text-xs">
                                        {row.affectedVariants?.length > 0 && row.affectedVariants[0].changes?.length > 0 ? (
                                            <ul className="list-disc pl-4 space-y-0.5">
                                                {row.affectedVariants[0].changes
                                                    .filter((c: string) => c !== 'Cost') // Cost is shown in financial cols
                                                    .map((c: string, i: number) => (
                                                        <li key={i} className="text-tertiary font-medium">{c}</li>
                                                ))}
                                            </ul>
                                        ) : (
                                            <span className="text-text-secondary opacity-30">-</span>
                                        )}
                                    </td>

                                    {/* PHYSICAL SAMPLE CHECKBOX */}
                                    <td className="p-3 bg-surface-container-highest/20 text-center">
                                        <button 
                                            onClick={() => handleToggleSample(idx)}
                                            disabled={row.isSkipped}
                                            className={`p-1 rounded transition-colors ${row.hasSample ? 'text-primary' : 'text-outline/40 hover:text-outline'}`}
                                        >
                                            {row.hasSample ? <CheckSquare size={20} /> : <Square size={20} />}
                                        </button>
                                    </td>

                                    {/* Financials */}
                                    {row.affectedVariants && row.affectedVariants.length === 1 ? (
                                        <>
                                            <td className="p-3 text-right text-text-secondary">{formatMoney(row.affectedVariants[0].oldCost)}</td>
                                            <td className="p-3 text-right font-bold text-text-primary">{formatMoney(row.unitCost)}</td>
                                            <td className="p-3 text-right">
                                                {(() => {
                                                    const diff = Number(row.unitCost) - Number(row.affectedVariants[0].oldCost);
                                                    if (diff > 0) return <span className="text-error text-xs">+{formatMoney(diff)}</span>;
                                                    if (diff < 0) return <span className="text-success text-xs">{formatMoney(diff)}</span>;
                                                    return <span className="text-text-secondary">-</span>;
                                                })()}
                                            </td>
                                        </>
                                    ) : row.status === 'new' ? (
                                        <>
                                            <td className="p-3 text-right text-text-secondary">-</td>
                                            <td className="p-3 text-right font-bold text-primary">{formatMoney(row.unitCost)}</td>
                                            <td className="p-3 text-right text-primary text-xs">NEW</td>
                                        </>
                                    ) : (
                                        <td colSpan={3} className="p-3 text-center text-xs text-text-secondary italic">
                                            {row.affectedVariants?.length > 1 
                                                ? `Updating ${row.affectedVariants.length} variants` 
                                                : '-'}
                                        </td>
                                    )}
                                </tr>
                            </React.Fragment>
                            );
                        })}
                        
                        {/* Bottom Spacer */}
                        {rowVirtualizer.getVirtualItems().length > 0 && (
                            <tr><td style={{ height: `${rowVirtualizer.getTotalSize() - rowVirtualizer.getVirtualItems()[rowVirtualizer.getVirtualItems().length - 1].end}px` }} colSpan={8}></td></tr>
                        )}
                    </tbody>
                </table>
            </div>

            {/* FOOTER ACTIONS */}
            <div className="p-6 border-t border-outline/10 bg-surface-container-low flex justify-between items-center">
                <button 
                    onClick={onBack}
                    className="text-text-secondary hover:text-text-primary font-bold text-sm"
                    disabled={isExecuting}
                >
                    Back to Mapping
                </button>
                
                <button 
                    onClick={() => onExecute(activeRows)}
                    disabled={isExecuting || (stats.updates === 0 && stats.new === 0)}
                    className={`flex items-center gap-2 px-6 py-3 rounded-full shadow-md font-bold text-on-primary transition-all ${
                        isExecuting 
                            ? 'bg-surface-container-highest text-text-secondary cursor-not-allowed' 
                            : 'bg-primary hover:bg-primary-hover active:scale-95'
                    }`}
                >
                    {isExecuting ? 'Importing...' : (
                        <>Import <span className="bg-white/20 px-1.5 rounded text-sm">{stats.updates + stats.new}</span> Items</>
                    )}
                </button>
            </div>
        </div>
    );
};

export default ImportReview;