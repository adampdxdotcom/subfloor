import React from 'react';
import { ChevronUp, ChevronDown } from 'lucide-react';

interface JobReportTableProps {
    data: any[];
    sortConfig: { key: string; direction: 'asc' | 'desc' } | null;
    onSort: (key: string) => void;
    hiddenColumns: string[];
    showCost: boolean;
    onRowClick: (row: any) => void;
}

const formatMoney = (amount: any) => {
    const num = Number(amount) || 0;
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(num);
};

const formatDate = (dateStr: string) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString();
};

const JobReportTable: React.FC<JobReportTableProps> = ({
    data,
    sortConfig,
    onSort,
    hiddenColumns,
    showCost,
    onRowClick
}) => {
    const isVisible = (key: string) => !hiddenColumns.includes(key);

    return (
        <table className="min-w-full text-left text-sm whitespace-nowrap">
            <thead className="uppercase tracking-wider border-b-2 border-gray-200 bg-gray-50 print:bg-transparent">
                <tr>
                    {isVisible('date') && (
                        <th onClick={() => onSort('created_at')} className="px-4 py-3 font-semibold text-gray-900 cursor-pointer hover:bg-gray-100 select-none">
                            <div className="flex items-center gap-1">Date {sortConfig?.key === 'created_at' && (sortConfig.direction === 'asc' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />)}</div>
                        </th>
                    )}
                    {isVisible('customer') && (
                        <th onClick={() => onSort('customer_name')} className="px-4 py-3 font-semibold text-gray-900 cursor-pointer hover:bg-gray-100 select-none">
                            <div className="flex items-center gap-1">Customer {sortConfig?.key === 'customer_name' && (sortConfig.direction === 'asc' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />)}</div>
                        </th>
                    )}
                    {isVisible('project') && (
                        <th onClick={() => onSort('project_name')} className="px-4 py-3 font-semibold text-gray-900 cursor-pointer hover:bg-gray-100 select-none">
                            <div className="flex items-center gap-1">Project {sortConfig?.key === 'project_name' && (sortConfig.direction === 'asc' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />)}</div>
                        </th>
                    )}
                    {isVisible('status') && (
                        <th onClick={() => onSort('status')} className="px-4 py-3 font-semibold text-gray-900 cursor-pointer hover:bg-gray-100 select-none">
                            <div className="flex items-center gap-1">Status {sortConfig?.key === 'status' && (sortConfig.direction === 'asc' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />)}</div>
                        </th>
                    )}
                    {showCost && <th className="px-4 py-3 font-semibold text-red-600">Est. Cost</th>}
                    {isVisible('total') && (
                        <th onClick={() => onSort('total_value')} className="px-4 py-3 font-semibold text-gray-900 text-right cursor-pointer hover:bg-gray-100 select-none flex justify-end">
                            <div className="flex items-center gap-1">Total Value {sortConfig?.key === 'total_value' && (sortConfig.direction === 'asc' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />)}</div>
                        </th>
                    )}
                </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
                {data.map((row, idx) => (
                    <tr 
                        key={idx} 
                        className="hover:bg-indigo-50 cursor-pointer transition-colors break-inside-avoid"
                        onClick={() => onRowClick(row)}
                    >
                        {isVisible('date') && <td className="px-4 py-2 text-gray-600">{formatDate(row.created_at)}</td>}
                        {isVisible('customer') && <td className="px-4 py-2 text-gray-900 font-medium">{row.customer_name}</td>}
                        {isVisible('project') && <td className="px-4 py-2 text-gray-600">{row.project_name}</td>}
                        {isVisible('status') && (
                            <td className="px-4 py-2">
                                <span className="px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-700 border border-gray-300">
                                    {row.status}
                                </span>
                            </td>
                        )}
                        {showCost && (
                            <td className="px-4 py-2 text-red-600 font-mono">
                                {formatMoney(Number(row.material_cost) + Number(row.labor_cost))}
                            </td>
                        )}
                        {isVisible('total') && (
                            <td className="px-4 py-2 text-gray-900 font-mono font-bold text-right">
                                {Number(row.total_value) > 0 ? formatMoney(row.total_value) : '-'}
                            </td>
                        )}
                    </tr>
                ))}
                {/* Footer Totals */}
                <tr className="bg-gray-100 font-bold border-t-2 border-gray-300">
                    <td colSpan={100} className="px-4 py-3 text-right flex justify-between">
                        <span>TOTAL PIPELINE:</span>
                        <div className="flex gap-4">
                            {showCost && (
                                <span className="font-mono text-red-700">
                                    {formatMoney(data.reduce((acc, r) => acc + (Number(r.material_cost) + Number(r.labor_cost)), 0))}
                                </span>
                            )}
                            {isVisible('total') && (
                                <span className="font-mono text-lg">
                                    {formatMoney(data.reduce((acc, r) => acc + Number(r.total_value), 0))}
                                </span>
                            )}
                        </div>
                    </td>
                </tr>
            </tbody>
        </table>
    );
};

export default JobReportTable;