import React from 'react';
import { ChevronUp, ChevronDown, GripVertical } from 'lucide-react';

interface ProductReportTableProps {
    data: any[];
    sortConfig: { key: string; direction: 'asc' | 'desc' } | null;
    onSort: (key: string) => void;
    hiddenColumns: string[];
    showCost: boolean;
    onRowClick: (row: any) => void;
    collapseLines?: boolean;
    columnOrder: string[];
    onColumnReorder: (newOrder: string[]) => void;
    isSelectMode?: boolean;
    selectedIds?: Set<string>;
    onSelectionChange?: (newIds: Set<string>) => void;
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
    onRowClick,
    collapseLines = false,
    columnOrder,
    onColumnReorder,
    isSelectMode = false,
    selectedIds = new Set(),
    onSelectionChange = () => {}
}) => {
    const isVisible = (key: string) => !hiddenColumns.includes(key);
    const [draggedColumn, setDraggedColumn] = React.useState<string | null>(null);
    const headerCheckboxRef = React.useRef<HTMLInputElement>(null);

    const displayData = React.useMemo(() => {
        if (!collapseLines) return data;

        const groups = new Map();
        data.forEach(item => {
            if (!groups.has(item.product_id)) {
                groups.set(item.product_id, []);
            }
            groups.get(item.product_id).push(item);
        });

        return Array.from(groups.values()).map((items: any[]) => {
            const first = items[0];
            const costs = items.map(i => parseFloat(i.unit_cost) || 0);
            const retails = items.map(i => parseFloat(i.retail_price) || 0);
            
            // Calculate Group Pricing Unit
            const uniqueUnits = [...new Set(items.map(i => i.pricing_unit).filter(Boolean))];
            let groupUnit = null;
            if (uniqueUnits.length === 1) groupUnit = uniqueUnits[0];
            else if (uniqueUnits.length > 1) groupUnit = 'Mixed';

            return {
                ...first,
                isGroup: true,
                pricing_unit: groupUnit,
                variant_count: items.length,
                sku: items.length === 1 ? first.sku : (items.every(i => i.sku === first.sku) ? first.sku : '—'),
                min_cost: Math.min(...costs),
                max_cost: Math.max(...costs),
                min_retail: Math.min(...retails),
                max_retail: Math.max(...retails),
                carton_size: items.every(i => i.carton_size === first.carton_size) ? first.carton_size : '-'
            };
        });
    }, [data, collapseLines]);

    // --- SELECTION HANDLERS & EFFECTS ---
    React.useEffect(() => {
        if (headerCheckboxRef.current) {
            const allVisibleSelected = selectedIds.size === displayData.length && displayData.length > 0;
            const someSelected = selectedIds.size > 0 && selectedIds.size < displayData.length;
            headerCheckboxRef.current.checked = allVisibleSelected;
            headerCheckboxRef.current.indeterminate = someSelected;
        }
    }, [selectedIds, displayData]);

    const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newSelectedIds = new Set<string>();
        if (e.target.checked) {
            // When checking the header, select all visible items
            displayData.forEach(item => newSelectedIds.add(item.product_id));
        }
        // If unchecking, the set remains empty
        onSelectionChange(newSelectedIds);
    };

    const handleRowSelect = (id: string, isSelected: boolean) => {
        const newSelectedIds = new Set(selectedIds);
        if (isSelected) {
            newSelectedIds.add(id);
        } else {
            newSelectedIds.delete(id);
        }
        onSelectionChange(newSelectedIds);
    };

    // --- DRAG & DROP HANDLERS ---
    const handleDragStart = (e: React.DragEvent<HTMLTableCellElement>, columnKey: string) => {
        setDraggedColumn(columnKey);
        e.dataTransfer.effectAllowed = 'move';
    };

    const handleDragOver = (e: React.DragEvent<HTMLTableCellElement>) => {
        e.preventDefault();
    };

    const handleDrop = (e: React.DragEvent<HTMLTableCellElement>, targetColumnKey: string) => {
        e.preventDefault();
        if (!draggedColumn || draggedColumn === targetColumnKey) {
            setDraggedColumn(null);
            return;
        }

        const fromIndex = columnOrder.indexOf(draggedColumn);
        const toIndex = columnOrder.indexOf(targetColumnKey);
        
        const newOrder = [...columnOrder];
        const [movedItem] = newOrder.splice(fromIndex, 1);
        newOrder.splice(toIndex, 0, movedItem);

        onColumnReorder(newOrder);
        setDraggedColumn(null);
    };

    const handleDragEnd = () => {
        setDraggedColumn(null);
    };

    const renderPrice = (min: number, max: number, uom: string) => {
        const suffix = (uom && uom !== 'null') ? ` / ${uom}` : '';
        if (min === max) return `${formatMoney(min)}${suffix}`;
        return `${formatMoney(min)} - ${formatMoney(max)}${suffix}`;
    };

    const columnDefs: { [key: string]: any } = {
        manufacturer: {
            header: 'Manufacturer',
            sortKey: 'manufacturer_name',
            renderCell: (row: any) => <td key="mfg" className="px-4 py-2 text-gray-600">{row.manufacturer_name}</td>
        },
        product: {
            header: 'Product',
            sortKey: 'product_name',
            renderCell: (row: any) => (
                <td key="prod" className="px-4 py-2 text-gray-900 font-medium">
                    {row.product_name}
                </td>
            )
        },
        style_size: {
            header: 'Style / Size',
            sortKey: 'variant_size',
            renderCell: (row: any) => (
                <td key="style" className="px-4 py-2 text-gray-600">
                    {row.isGroup ? (
                        <span className="italic text-gray-500">{row.variant_count} Variants</span>
                    ) : (
                        <>
                            {row.variant_style && <span className="mr-1">{row.variant_style}</span>}
                            {row.variant_color && <span className="mr-1">{row.variant_color}</span>}
                            {row.variant_size && <span className="ml-1 text-gray-500">({row.variant_size})</span>}
                        </>
                    )}
                </td>
            )
        },
        sku: {
            header: 'SKU',
            sortKey: 'sku',
            renderCell: (row: any) => <td key="sku" className="px-4 py-2 text-gray-500 font-mono text-xs">{row.sku || '-'}</td>
        },
        carton: {
            header: 'Carton',
            sortKey: 'carton_size',
            renderCell: (row: any) => (
                <td key="carton" className="px-4 py-2 text-gray-600 font-mono text-xs">
                    {row.carton_size ? `${row.carton_size} ${row.uom || ''}` : '-'}
                </td>
            )
        },
        cost: {
            header: 'Unit Cost',
            sortKey: 'unit_cost',
            headerClassName: 'text-red-600 print:text-gray-900',
            renderCell: (row: any) => (
                <td key="cost" className="px-4 py-2 text-red-600 print:text-gray-900 font-mono">
                    {row.isGroup ? renderPrice(row.min_cost, row.max_cost, row.pricing_unit) : `${formatMoney(row.unit_cost)}${(row.pricing_unit && row.pricing_unit !== 'null') ? ` / ${row.pricing_unit}` : ''}`}
                </td>
            )
        },
        retail: {
            header: 'Retail Price',
            sortKey: 'retail_price',
            renderCell: (row: any) => (
                <td key="retail" className="px-4 py-2 text-gray-900 font-mono font-bold">
                    {row.isGroup ? renderPrice(row.min_retail, row.max_retail, row.pricing_unit) : `${formatMoney(row.retail_price)}${(row.pricing_unit && row.pricing_unit !== 'null') ? ` / ${row.pricing_unit}` : ''}`}
                </td>
            )
        }
    };

    return (
        <table className="min-w-full text-left text-sm whitespace-nowrap">
            <thead className="uppercase tracking-wider border-b-2 border-gray-200 bg-gray-50 print:bg-transparent">
                <tr>
                    {isSelectMode && (
                        <th className="px-4 py-3 font-semibold text-gray-900 select-none sticky left-0 bg-gray-50 z-10 print:hidden">
                            <input
                                type="checkbox"
                                ref={headerCheckboxRef}
                                onChange={handleSelectAll}
                                className="rounded border-outline/20 text-primary bg-surface-container-low"
                                title="Select/Deselect All Visible"
                            />
                        </th>
                    )}
                    {columnOrder.map(key => {
                        const def = columnDefs[key];
                        if (!def || !isVisible(key.replace('_cost', ''))) return null;
                        if (key === 'cost' && !showCost) return null;
                        
                        const isDraggingOver = draggedColumn && draggedColumn !== key;

                        return (
                            <th
                                key={key}
                                draggable
                                onDragStart={(e) => handleDragStart(e, key)}
                                onDragOver={handleDragOver}
                                onDrop={(e) => handleDrop(e, key)}
                                onDragEnd={handleDragEnd}
                                onClick={() => onSort(def.sortKey)}
                                className={`px-4 py-3 font-semibold select-none group transition-all
                                    ${def.headerClassName || 'text-gray-900'}
                                    ${draggedColumn === key ? 'opacity-50 bg-primary-container' : ''}
                                    ${isDraggingOver ? 'bg-primary/10' : ''}
                                `}
                            >
                                <div className="flex items-center gap-2 cursor-grab active:cursor-grabbing">
                                    <GripVertical className="w-4 h-4 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                                    <span>{def.header}</span>
                                    {sortConfig?.key === def.sortKey && (sortConfig.direction === 'asc' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />)}
                                </div>
                            </th>
                        );
                    })}
                </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
                {displayData.map((row, idx) => {
                    const isSelected = selectedIds.has(row.product_id);
                    return (
                        <tr
                            key={idx}
                            className={`hover:bg-indigo-50 cursor-pointer transition-colors break-inside-avoid group ${isSelectMode && !isSelected ? 'print:hidden' : ''}`}
                            onClick={() => onRowClick(row)}
                        >
                            {isSelectMode && (
                                <td 
                                    className="px-4 py-2 sticky left-0 bg-white group-hover:bg-indigo-50 z-10 print:hidden"
                                    onClick={(e) => e.stopPropagation()} // Prevent row click when interacting with checkbox
                                >
                                    <input
                                        type="checkbox"
                                        checked={isSelected}
                                        onChange={(e) => handleRowSelect(row.product_id, e.target.checked)}
                                        className="rounded border-outline/20 text-primary bg-surface-container-low"
                                    />
                                </td>
                            )}
                            {columnOrder.map(key => {
                                const def = columnDefs[key];
                                if (!def || !isVisible(key.replace('_cost', ''))) return null;
                                if (key === 'cost' && !showCost) return null;
                                return def.renderCell(row);
                            })}
                        </tr>
                    );
                })}
            </tbody>
        </table>
    );
};

export default ProductReportTable;