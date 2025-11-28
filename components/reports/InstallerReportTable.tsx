import React from 'react';
import { ChevronUp, ChevronDown } from 'lucide-react';

interface InstallerReportTableProps {
    data: any[];
    sortConfig: { key: string; direction: 'asc' | 'desc' } | null;
    onSort: (key: string) => void;
    hiddenColumns: string[];
    onRowClick: (row: any) => void;
}

const formatMoney = (amount: any) => {
    const num = Number(amount) || 0;
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(num);
};

const InstallerReportTable: React.FC<InstallerReportTableProps> = ({
    data,
    sortConfig,
    onSort,
    hiddenColumns,
    onRowClick
}) => {
    const isVisible = (key: string) => !hiddenColumns.includes(key);

    return (
        <table className="min-w-full text-left text-sm whitespace-nowrap">
            <thead className="uppercase tracking-wider border-b-2 border-gray-200 bg-gray-50 print:bg-transparent">
                <tr>
                    {isVisible('installer') && (
                        <th onClick={() => onSort('installer_name')} className="px-4 py-3 font-semibold text-gray-900 cursor-pointer hover:bg-gray-100 select-none">
                            <div className="flex items-center gap-1">Installer Name {sortConfig?.key === 'installer_name' && (sortConfig.direction === 'asc' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />)}</div>
                        </th>
                    )}
                    {isVisible('jobs') && (
                        <th onClick={() => onSort('appointment_count')} className="px-4 py-3 font-semibold text-gray-900 text-center cursor-pointer hover:bg-gray-100 select-none">
                            <div className="flex items-center justify-center gap-1">Jobs (Period) {sortConfig?.key === 'appointment_count' && (sortConfig.direction === 'asc' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />)}</div>
                        </th>
                    )}
                    {isVisible('labor') && (
                        <th onClick={() => onSort('total_labor_value')} className="px-4 py-3 font-semibold text-gray-900 text-right cursor-pointer hover:bg-gray-100 select-none flex justify-end">
                            <div className="flex items-center gap-1">Labor Value {sortConfig?.key === 'total_labor_value' && (sortConfig.direction === 'asc' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />)}</div>
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
                        {isVisible('installer') && (
                            <td className="px-4 py-3 text-gray-900 font-medium flex items-center gap-2">
                                <div className="w-4 h-4 rounded-full" style={{ backgroundColor: row.color || '#ccc' }}></div>
                                {row.installer_name}
                            </td>
                        )}
                        {isVisible('jobs') && <td className="px-4 py-3 text-center text-gray-600">{row.appointment_count}</td>}
                        {isVisible('labor') && (
                            <td className="px-4 py-3 text-right text-gray-900 font-mono font-bold">
                                {formatMoney(row.total_labor_value)}
                            </td>
                        )}
                    </tr>
                ))}
                {/* Footer Totals */}
                <tr className="bg-gray-100 font-bold border-t-2 border-gray-300">
                    <td colSpan={10} className="px-4 py-3">
                        <div className="flex justify-between items-center">
                            <span>TOTALS:</span>
                            {isVisible('labor') && (
                                <span className="font-mono text-lg text-gray-900">
                                    {formatMoney(data.reduce((acc, r) => acc + Number(r.total_labor_value), 0))}
                                </span>
                            )}
                        </div>
                    </td>
                </tr>
            </tbody>
        </table>
    );
};

export default InstallerReportTable;