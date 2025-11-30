import React, { useState, useEffect, useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { ArrowRight, AlertTriangle, CheckCircle2, PlusCircle, AlertCircle, XCircle } from 'lucide-react';

interface ImportReviewProps {
    results: any[];
    onExecute: (modifiedResults: any[]) => void; // Callback now accepts modified data
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
        setRows(results.map(r => ({ ...r, isSkipped: r.status === 'error' })));
    }, [results]);

    const handleToggleSkip = (index: number) => {
        setRows(prev => {
            const newRows = [...prev];
            newRows[index].isSkipped = !newRows[index].isSkipped;
            return newRows;
        });
    };

    const handleNameEdit = (index: number, newName: string) => {
        setRows(prev => {
            const newRows = [...prev];
            // If it's a new variant, we edit the incoming name
            newRows[index].productName = newName;
            // If it's a specific variant match, we might want to update variantName too?
            // For now, let's just edit Product Name as that was the request (stripping prefixes)
            return newRows;
        });
    };

    // Stats calculation based on LOCAL state
    const activeRows = rows.filter(r => !r.isSkipped);
    const stats = {
        updates: activeRows.filter(r => r.status === 'update').length,
        new: activeRows.filter(r => r.status === 'new').length,
        errors: rows.filter(r => r.status === 'error').length
    };

    // --- VIRTUALIZATION SETUP ---
    const parentRef = useRef<HTMLDivElement>(null);
    
    const rowVirtualizer = useVirtualizer({
        count: rows.length,
        getScrollElement: () => parentRef.current,
        estimateSize: () => 56, // Estimate row height (56px is roughly accurate for this table)
        overscan: 10, // Buffer items to render outside view
    });

    return (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex flex-col h-[600px]">
            
            {/* SUMMARY HEADER */}
            <div className="p-6 border-b border-gray-200 bg-gray-50 flex justify-between items-center">
                <div>
                    <h2 className="text-lg font-bold text-gray-900">Review Changes</h2>
                    <p className="text-sm text-gray-500">Click status to skip. Click names to edit.</p>
                </div>
                <div className="flex gap-4">
                    <div className="flex items-center gap-2 px-3 py-1 bg-green-100 text-green-800 rounded-full text-xs font-bold uppercase">
                        <CheckCircle2 size={14} /> {stats.updates} Updates
                    </div>
                    <div className="flex items-center gap-2 px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-bold uppercase">
                        <PlusCircle size={14} /> {stats.new} New
                    </div>
                </div>
            </div>

            {/* SCROLLABLE TABLE */}
            <div ref={parentRef} className="flex-1 overflow-auto bg-white relative">
                <table className="w-full text-left text-sm border-collapse">
                    <thead className="bg-gray-50 text-gray-500 uppercase text-xs sticky top-0 z-10 border-b border-gray-200 shadow-sm">
                        <tr>
                            <th className="p-3 font-bold w-24">Action</th>
                            <th className="p-3 font-bold">Product Match (Editable)</th>
                            <th className="p-3 font-bold">SKU / Details</th>
                            <th className="p-3 font-bold text-right">Old Cost</th>
                            <th className="p-3 font-bold text-right">New Cost</th>
                            <th className="p-3 font-bold text-right">Diff</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {/* Top Spacer to push content down to correct scroll position */}
                        {rowVirtualizer.getVirtualItems().length > 0 && (
                            <tr><td style={{ height: `${rowVirtualizer.getVirtualItems()[0].start}px` }} colSpan={6}></td></tr>
                        )}

                        {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                            const row = rows[virtualRow.index];
                            const idx = virtualRow.index;
                            return (
                            <React.Fragment key={virtualRow.key}>
                                {/* MAIN ROW */}
                                <tr 
                                    data-index={virtualRow.index} 
                                    ref={rowVirtualizer.measureElement} // Dynamic height measurement
                                    className={`hover:bg-gray-50 transition-colors ${row.isSkipped ? 'opacity-50 bg-gray-50 grayscale' : ''}`}
                                >
                                    <td className="p-3">
                                        <button 
                                            onClick={() => handleToggleSkip(idx)}
                                            className={`text-xs font-bold px-2 py-0.5 rounded border transition-all w-full text-center
                                                ${row.isSkipped 
                                                    ? 'bg-gray-100 text-gray-500 border-gray-300 hover:bg-gray-200' 
                                                    : row.status === 'update' 
                                                        ? 'bg-green-50 text-green-600 border-green-200 hover:bg-green-100'
                                                        : row.status === 'new'
                                                            ? 'bg-blue-50 text-blue-600 border-blue-200 hover:bg-blue-100'
                                                            : 'bg-red-50 text-red-600 border-red-200 cursor-default'
                                                }`}
                                            disabled={row.status === 'error'}
                                        >
                                            {row.isSkipped ? 'SKIP' : row.status.toUpperCase()}
                                        </button>
                                    </td>
                                    <td className="p-3">
                                        <input 
                                            type="text" 
                                            className="font-medium text-gray-900 bg-transparent border-b border-transparent hover:border-gray-300 focus:border-indigo-500 focus:outline-none w-full transition-colors"
                                            value={row.productName}
                                            onChange={(e) => handleNameEdit(idx, e.target.value)}
                                            disabled={row.isSkipped}
                                        />
                                        {row.variantName && <div className="text-xs text-gray-500 mt-1">{row.variantName}</div>}
                                        {row.status === 'update' && row.details?.matchType && (
                                            <div className="text-[10px] text-gray-400 uppercase mt-1">Matched by: {row.details.matchType}</div>
                                        )}
                                        {row.status === 'error' && <div className="text-xs text-red-500 font-bold mt-1">{row.message}</div>}
                                    </td>
                                    <td className="p-3 text-gray-600 font-mono text-xs">{row.sku || '-'}</td>
                                    
                                    {/* Diff Logic (Same as before) */}
                                    {row.affectedVariants && row.affectedVariants.length === 1 ? (
                                        <>
                                            <td className="p-3 text-right text-gray-500">{formatMoney(row.affectedVariants[0].oldCost)}</td>
                                            <td className="p-3 text-right font-bold text-gray-900">{formatMoney(row.unitCost)}</td>
                                            <td className="p-3 text-right">
                                                {(() => {
                                                    const diff = Number(row.unitCost) - Number(row.affectedVariants[0].oldCost);
                                                    if (diff > 0) return <span className="text-red-500 text-xs">+{formatMoney(diff)}</span>;
                                                    if (diff < 0) return <span className="text-green-600 text-xs">{formatMoney(diff)}</span>;
                                                    return <span className="text-gray-300">-</span>;
                                                })()}
                                            </td>
                                        </>
                                    ) : row.status === 'new' ? (
                                        <>
                                            <td className="p-3 text-right text-gray-300">-</td>
                                            <td className="p-3 text-right font-bold text-blue-600">{formatMoney(row.unitCost)}</td>
                                            <td className="p-3 text-right text-blue-600 text-xs">NEW</td>
                                        </>
                                    ) : (
                                        <td colSpan={3} className="p-3 text-center text-xs text-gray-400 italic">
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
                            <tr><td style={{ height: `${rowVirtualizer.getTotalSize() - rowVirtualizer.getVirtualItems()[rowVirtualizer.getVirtualItems().length - 1].end}px` }} colSpan={6}></td></tr>
                        )}
                    </tbody>
                </table>
            </div>

            {/* FOOTER ACTIONS */}
            <div className="p-6 border-t border-gray-200 bg-gray-50 flex justify-between items-center">
                <button 
                    onClick={onBack}
                    className="text-gray-600 hover:text-gray-900 font-medium"
                    disabled={isExecuting}
                >
                    Adjust Mapping
                </button>
                
                <button 
                    onClick={() => onExecute(activeRows)} // Send filtered rows
                    disabled={isExecuting || (stats.updates === 0 && stats.new === 0)}
                    className={`flex items-center gap-2 px-6 py-2 rounded-lg shadow-sm font-bold text-white transition-all ${
                        isExecuting 
                            ? 'bg-gray-400 cursor-not-allowed' 
                            : 'bg-green-600 hover:bg-green-700 active:scale-95'
                    }`}
                >
                    {isExecuting ? 'Importing...' : `Import ${stats.updates + stats.new} Items`}
                </button>
            </div>
        </div>
    );
};

export default ImportReview;