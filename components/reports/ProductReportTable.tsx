import React from 'react';
import { ChevronUp, ChevronDown } from 'lucide-react';

interface ProductReportTableProps {
    data: any[];
    sortConfig: { key: string; direction: 'asc' | 'desc' } | null;
    onSort: (key: string) => void;
    hiddenColumns: string[];
    showCost: boolean;
    onRowClick: (row: any) => void;
}

// Local helper for safe formatting
const formatMoney = (amount: any) => {
    const num = Number(amount) || 0;
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(num);
};

const ProductReportTable: React.FC<ProductReportTableProps> = ({
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
                    {isVisible('manufacturer') && (
                        <th onClick={() => onSort('manufacturer_name')} className="px-4 py-3 font-semibold text-gray-900 cursor-pointer hover:bg-gray-100 select-none">
                            <div className="flex items-center gap-1">Manufacturer {sortConfig?.key === 'manufacturer_name' && (sortConfig.direction === 'asc' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />)}</div>
                        </th>
                    )}
                    {isVisible('product') && (
                        <th onClick={() => onSort('product_name')} className="px-4 py-3 font-semibold text-gray-900 cursor-pointer hover:bg-gray-100 select-none">
                            <div className="flex items-center gap-1">Product {sortConfig?.key === 'product_name' && (sortConfig.direction === 'asc' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />)}</div>
                        </th>
                    )}
                    {isVisible('style_size') && (
                        <th onClick={() => onSort('variant_size')} className="px-4 py-3 font-semibold text-gray-900 cursor-pointer hover:bg-gray-100 select-none">
                            <div className="flex items-center gap-1">Style / Size {sortConfig?.key === 'variant_size' && (sortConfig.direction === 'asc' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />)}</div>
                        </th>
                    )}
                    {isVisible('sku') && (
                        <th onClick={() => onSort('sku')} className="px-4 py-3 font-semibold text-gray-900 cursor-pointer hover:bg-gray-100 select-none">
                            <div className="flex items-center gap-1">SKU {sortConfig?.key === 'sku' && (sortConfig.direction === 'asc' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />)}</div>
                        </th>
                    )}
                    {isVisible('carton') && (
                        <th onClick={() => onSort('carton_size')} className="px-4 py-3 font-semibold text-gray-900 cursor-pointer hover:bg-gray-100 select-none">
                            <div className="flex items-center gap-1">Carton {sortConfig?.key === 'carton_size' && (sortConfig.direction === 'asc' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />)}</div>
                        </th>
                    )}
                    {showCost && (
                        <th onClick={() => onSort('unit_cost')} className="px-4 py-3 font-semibold text-red-600 print:text-gray-900 cursor-pointer hover:bg-gray-100 select-none">
                            <div className="flex items-center gap-1">Unit Cost {sortConfig?.key === 'unit_cost' && (sortConfig.direction === 'asc' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />)}</div>
                        </th>
                    )}
                    {isVisible('retail') && (
                        <th onClick={() => onSort('retail_price')} className="px-4 py-3 font-semibold text-gray-900 cursor-pointer hover:bg-gray-100 select-none">
                            <div className="flex items-center gap-1">Retail Price {sortConfig?.key === 'retail_price' && (sortConfig.direction === 'asc' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />)}</div>
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
                        {isVisible('manufacturer') && <td className="px-4 py-2 text-gray-600">{row.manufacturer_name}</td>}
                        {isVisible('product') && (
                            <td className="px-4 py-2 text-gray-900 font-medium">
                                {row.product_name} 
                                <span className="ml-2 text-xs text-gray-500 bg-gray-100 px-1 rounded">{row.product_type}</span>
                            </td>
                        )}
                        {isVisible('style_size') && (
                            <td className="px-4 py-2 text-gray-600">
                                {row.variant_style && <span className="mr-1">{row.variant_style}</span>}
                                {row.variant_color && <span className="mr-1">{row.variant_color}</span>}
                                {row.variant_size && <span className="ml-1 text-gray-500">({row.variant_size})</span>}
                            </td>
                        )}
                        {isVisible('sku') && <td className="px-4 py-2 text-gray-500 font-mono text-xs">{row.sku || '-'}</td>}
                        {isVisible('carton') && (
                            <td className="px-4 py-2 text-gray-600 font-mono text-xs">
                                {row.carton_size ? `${row.carton_size} ${row.uom || ''}` : '-'}
                            </td>
                        )}
                        {showCost && <td className="px-4 py-2 text-red-600 print:text-gray-900 font-mono">{formatMoney(row.unit_cost)} / {row.uom}</td>}
                        {isVisible('retail') && <td className="px-4 py-2 text-gray-900 font-mono font-bold">{formatMoney(row.retail_price)} / {row.uom}</td>}
                    </tr>
                ))}
                {/* Footer Totals for Products */}
                <tr className="bg-gray-100 font-bold border-t-2 border-gray-300">
                    <td colSpan={10} className="px-4 py-3 text-sm text-gray-600">
                        Showing {data.length} Variants
                    </td>
                </tr>
            </tbody>
        </table>
    );
};

export default ProductReportTable;