import React, { useState, useEffect } from 'react';
import { useData } from '../context/DataContext';
import { useNavigate } from 'react-router-dom';
import { exportToCSV } from '../utils/csvUtils';
import ProductDetailModal from '../components/ProductDetailModal';
import ProductReportTable from '../components/reports/ProductReportTable';
import JobReportTable from '../components/reports/JobReportTable';
import InstallerReportTable from '../components/reports/InstallerReportTable';
import ReportCharts from '../components/reports/ReportCharts';
import { 
    getProductReport, 
    getJobReport, 
    getInstallerReport,
} from '../services/reportService';
import { PRODUCT_TYPES } from '../types';
import { 
    FileText, 
    Users, 
    Briefcase, 
    Printer, 
    Eye, 
    Play,
    Download,
    Settings2,
    Layers,
    CheckSquare
} from 'lucide-react';

// --- LOCAL HELPERS ---
const formatDate = (dateStr: string) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString();
};

// --- PRINT HEADER COMPONENT ---
const PrintHeader = ({ title, dateRange }: { title: string, dateRange?: string }) => {
    const { systemBranding } = useData();
    const logoUrl = systemBranding?.logoUrl || '/logo.png'; 

    return (
        <div className="hidden print:flex flex-col mb-8 border-b-2 border-gray-800 pb-4">
            <div className="flex justify-between items-center mb-4">
                <img src={logoUrl} alt="Logo" className="h-16 object-contain" />
                <div className="text-right">
                    <h1 className="text-3xl font-bold text-gray-900">{title}</h1>
                    <p className="text-xl text-gray-600 font-medium mt-1">{new Date().toLocaleDateString()}</p>
                    {dateRange && <p className="text-gray-600 text-sm">Period: {dateRange}</p>}
                </div>
            </div>
        </div>
    );
};

const NUMERIC_FIELDS = [
    'unit_cost', 
    'retail_price', 
    'total_value', 
    'material_cost', 
    'labor_cost', 
    'appointment_count', 
    'total_labor_value',
    'carton_size'
];

export default function Reports() {
    const { vendors, products, fetchProducts } = useData();
    
    // --- STATE ---
    const [activeTab, setActiveTab] = useState<'products' | 'jobs' | 'installers'>('products');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [reportData, setReportData] = useState<any[]>([]);
    
    const [selectedProduct, setSelectedProduct] = useState<any | null>(null);
    const [isProductModalOpen, setIsProductModalOpen] = useState(false);
    
    const navigate = useNavigate();
    
    const [showCost, setShowCost] = useState(false);
    
    const today = new Date();
    const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
    
    const [startDate, setStartDate] = useState(firstDay.toISOString().split('T')[0]);
    const [endDate, setEndDate] = useState(today.toISOString().split('T')[0]);
    
    const [manufacturerFilter, setManufacturerFilter] = useState('');
    const [typeFilter, setTypeFilter] = useState('');
    const [collapseProductLines, setCollapseProductLines] = useState(false);
    const [isSelectMode, setIsSelectMode] = useState(false);
    const [selectedIds, setSelectedIds] = useState(new Set<string>());
    const [columnOrder, setColumnOrder] = useState([
        'manufacturer',
        'product',
        'style_size',
        'sku',
        'carton',
        'cost',
        'retail'
    ]);

    const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null);
    const [hiddenColumns, setHiddenColumns] = useState<string[]>([]);
    const [isColumnMenuOpen, setIsColumnMenuOpen] = useState(false);

    const [statusFilter] = useState('All');
    const [installerFilter] = useState('');

    const fetchData = async () => {
        setLoading(true);
        setError(null);
        setReportData([]);
        try {
            if (activeTab === 'products') {
                const data = await getProductReport({ 
                    includeDiscontinued: false,
                    manufacturerId: manufacturerFilter,
                    productType: typeFilter
                });
                setReportData(data);
            } else if (activeTab === 'jobs') {
                const data = await getJobReport({ startDate, endDate, status: statusFilter });
                setReportData(data);
            } else if (activeTab === 'installers') {
                const data = await getInstallerReport({ startDate, endDate, installerId: installerFilter });
                setReportData(data);
            }
        } catch (err) {
            console.error(err);
            setError("Failed to load report data. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        setReportData([]);
        setError(null);
        setHiddenColumns([]);
    }, [activeTab]);

    // Pre-fill Product Type when Manufacturer changes
    useEffect(() => {
        if (manufacturerFilter) {
            const selectedVendor = vendors.find(v => v.id.toString() === manufacturerFilter.toString());
            if (selectedVendor?.defaultProductType) {
                setTypeFilter(selectedVendor.defaultProductType);
            }
        }
    }, [manufacturerFilter, vendors]);

    const toggleSelectMode = () => {
        setIsSelectMode(prev => {
            if (!prev) { // Entering select mode
                setSelectedIds(new Set());
            }
            return !prev;
        });
    };

    const generatePrintTitle = () => {
        if (activeTab !== 'products') {
            return activeTab === 'jobs' ? 'Job Pipeline Report' : 'Installer Activity Report';
        }
        const mfgName = manufacturerFilter ? vendors.find(v => v.id == manufacturerFilter)?.name : 'All Manufacturers';
        const typeName = typeFilter || '';

        return `${mfgName} ${typeName} Prices`.replace(/\s+/g, ' ').trim();
    };

    const handleApplyFilters = () => {
        fetchData();
    };

    const handlePrint = () => {
        window.print();
    };

    const handleExport = () => {
        const filename = activeTab === 'products' ? 'PriceList' : activeTab === 'jobs' ? 'JobPipeline' : 'InstallerActivity';
        exportToCSV(getSortedData(), filename);
    };

    const handleSort = (key: string) => {
        let direction: 'asc' | 'desc' = 'asc';
        if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc';
        }
        setSortConfig({ key, direction });
    };

    const getSortedData = () => {
        if (!sortConfig) return reportData;

        return [...reportData].sort((a, b) => {
            const aValue = a[sortConfig.key];
            const bValue = b[sortConfig.key];

            if (aValue === null) return 1;
            if (bValue === null) return -1;

            if (NUMERIC_FIELDS.includes(sortConfig.key)) {
                const numA = parseFloat(aValue) || 0;
                const numB = parseFloat(bValue) || 0;
                return sortConfig.direction === 'asc' 
                    ? numA - numB 
                    : numB - numA;
            }

            return sortConfig.direction === 'asc'
                ? String(aValue).localeCompare(String(bValue))
                : String(bValue).localeCompare(String(aValue));
        });
    };

    const toggleColumn = (columnKey: string) => {
        setHiddenColumns(prev => 
            prev.includes(columnKey) 
                ? prev.filter(c => c !== columnKey) 
                : [...prev, columnKey]
        );
    };

    const isVisible = (key: string) => !hiddenColumns.includes(key);

    const handleRowClick = async (row: any) => {
        if (activeTab === 'jobs') {
            navigate(`/projects/${row.id}`);
        } else if (activeTab === 'installers') {
            navigate(`/installers/${row.id}`);
        } else if (activeTab === 'products') {
            if (products.length === 0) await fetchProducts();
            
            const fullProduct = products.find((p: any) => p.id === row.product_id);
            if (fullProduct) {
                setSelectedProduct(fullProduct);
                setIsProductModalOpen(true);
            }
        }
    };

    return (
        <div className="flex h-full bg-surface-container-high rounded-2xl shadow-sm border border-outline/10 overflow-hidden print:block print:shadow-none print:border-none print:h-auto print:overflow-visible">
            
            {/* SIDEBAR - HIDDEN ON PRINT */}
            <div className="w-64 bg-surface-container-low border-r border-outline/10 flex-shrink-0 flex flex-col print:hidden">
                <div className="p-6 border-b border-outline/10">
                    <h2 className="text-lg font-bold text-text-primary">Reports</h2>
                </div>
                <nav className="flex-1 p-4 space-y-1">
                    <button
                        onClick={() => setActiveTab('products')}
                        className={`w-full flex items-center px-4 py-3 text-sm font-medium rounded-full transition-colors ${
                            activeTab === 'products' ? 'bg-primary-container text-primary font-bold' : 'text-text-secondary hover:bg-surface-container-highest hover:text-text-primary'
                        }`}
                    >
                        <FileText className="mr-3 h-5 w-5" />
                        Price List / Inventory
                    </button>
                    <button
                        onClick={() => setActiveTab('jobs')}
                        className={`w-full flex items-center px-4 py-3 text-sm font-medium rounded-full transition-colors ${
                            activeTab === 'jobs' ? 'bg-primary-container text-primary font-bold' : 'text-text-secondary hover:bg-surface-container-highest hover:text-text-primary'
                        }`}
                    >
                        <Briefcase className="mr-3 h-5 w-5" />
                        Job Pipeline
                    </button>
                    <button
                        onClick={() => setActiveTab('installers')}
                        className={`w-full flex items-center px-4 py-3 text-sm font-medium rounded-full transition-colors ${
                            activeTab === 'installers' ? 'bg-primary-container text-primary font-bold' : 'text-text-secondary hover:bg-surface-container-highest hover:text-text-primary'
                        }`}
                    >
                        <Users className="mr-3 h-5 w-5" />
                        Installer Activity
                    </button>
                </nav>
            </div>

            {/* MAIN CONTENT */}
            <div className="flex-1 flex flex-col overflow-hidden bg-surface print:block print:h-auto print:overflow-visible">
                
                {/* TOOLBAR - HIDDEN ON PRINT */}
                <div className="px-6 py-4 border-b border-outline/10 bg-surface-container-high flex flex-wrap items-end justify-between gap-4 print:hidden">
                    
                    <div className="flex items-end gap-3">
                        {activeTab === 'products' ? (
                            <>
                                <div className="flex flex-col">
                                    <label className="text-xs text-text-secondary font-bold uppercase mb-1">Manufacturer</label>
                                    <select
                                        className="h-10 border border-outline/10 rounded-lg px-3 text-sm bg-surface-container-highest text-text-primary min-w-[160px] focus:outline-none focus:ring-2 focus:ring-primary/50"
                                        value={manufacturerFilter}
                                        onChange={(e) => setManufacturerFilter(e.target.value)}
                                    >
                                        <option value="">All Manufacturers</option>
                                        {vendors
                                            .filter(v => v.vendorType !== 'Supplier')
                                            .sort((a, b) => a.name.localeCompare(b.name))
                                            .map(v => (
                                                <option key={v.id} value={v.id}>{v.name}</option>
                                            ))}
                                    </select>
                                </div>
                                <div className="flex flex-col">
                                    <label className="text-xs text-text-secondary font-bold uppercase mb-1">Product Type</label>
                                    <select
                                        className="h-10 border border-outline/10 rounded-lg px-3 text-sm bg-surface-container-highest text-text-primary min-w-[140px] focus:outline-none focus:ring-2 focus:ring-primary/50"
                                        value={typeFilter}
                                        onChange={(e) => setTypeFilter(e.target.value)}
                                    >
                                        <option value="">All Types</option>
                                        {PRODUCT_TYPES.map(type => (
                                            <option key={type} value={type}>{type}</option>
                                        ))}
                                    </select>
                                </div>
                            </>
                        ) : (
                            <>
                                <div className="flex flex-col">
                                    <label className="text-xs text-text-secondary font-bold uppercase mb-1">From</label>
                                    <input 
                                        type="date" 
                                        className="h-10 border border-outline/10 rounded-lg px-3 text-sm bg-surface-container-highest text-text-primary focus:outline-none focus:ring-2 focus:ring-primary/50" 
                                        value={startDate}
                                        onChange={(e) => setStartDate(e.target.value)}
                                    />
                                </div>
                                <div className="flex flex-col">
                                    <label className="text-xs text-text-secondary font-bold uppercase mb-1">To</label>
                                    <input 
                                        type="date" 
                                        className="h-10 border border-outline/10 rounded-lg px-3 text-sm bg-surface-container-highest text-text-primary focus:outline-none focus:ring-2 focus:ring-primary/50" 
                                        value={endDate}
                                        onChange={(e) => setEndDate(e.target.value)}
                                    />
                                </div>
                            </>
                        )}
                        
                        <button 
                            onClick={handleApplyFilters}
                            className="h-10 flex items-center gap-2 px-6 bg-primary text-on-primary text-sm font-bold rounded-full hover:bg-primary-hover shadow-md active:scale-95 transition-all"
                            title="Run or Refresh Report"
                        >
                            <Play className="w-4 h-4" />
                            Run
                        </button>
                    </div>

                    <div className="flex items-center gap-2">
                        <div className="relative">
                            <button 
                                onClick={() => setIsColumnMenuOpen(!isColumnMenuOpen)}
                                className="h-10 flex items-center gap-2 px-4 bg-surface-container-highest text-text-secondary border border-outline/10 rounded-full hover:bg-surface-container-high shadow-sm text-sm font-medium transition-colors"
                            >
                                <Settings2 className="h-4 w-4" />
                                Columns
                            </button>
                            
                            {isColumnMenuOpen && (
                                <div className="absolute right-0 mt-2 w-56 bg-surface-container-high rounded-xl shadow-xl border border-outline/10 z-50 p-2">
                                    <div className="text-xs font-bold text-text-secondary uppercase px-2 mb-2">Toggle Columns</div>
                                    <div className="space-y-1">
                                        {activeTab === 'products' && (
                                            <>
                                                {['Manufacturer', 'Product', 'Style_Size', 'SKU', 'Carton', 'Retail'].map(col => (
                                                    <label key={col} className="flex items-center px-2 py-2 hover:bg-surface-container-highest rounded-lg cursor-pointer text-text-primary">
                                                        <input 
                                                            type="checkbox" 
                                                            checked={isVisible(col.toLowerCase())}
                                                            onChange={() => toggleColumn(col.toLowerCase())}
                                                            className="rounded border-outline/20 text-primary mr-2 bg-surface-container-low"
                                                        />
                                                        <span className="text-sm">{col.replace('_', ' / ')}</span>
                                                    </label>
                                                ))}
                                            </>
                                        )}
                                        {activeTab === 'jobs' && (
                                            <>
                                                {['Date', 'Customer', 'Project', 'Status', 'Total'].map(col => (
                                                    <label key={col} className="flex items-center px-2 py-2 hover:bg-surface-container-highest rounded-lg cursor-pointer text-text-primary">
                                                        <input 
                                                            type="checkbox" 
                                                            checked={isVisible(col.toLowerCase())}
                                                            onChange={() => toggleColumn(col.toLowerCase())}
                                                            className="rounded border-outline/20 text-primary mr-2 bg-surface-container-low"
                                                        />
                                                        <span className="text-sm">{col}</span>
                                                    </label>
                                                ))}
                                            </>
                                        )}
                                        {activeTab === 'installers' && (
                                            <>
                                                {['Installer', 'Jobs', 'Labor'].map(col => (
                                                    <label key={col} className="flex items-center px-2 py-2 hover:bg-surface-container-highest rounded-lg cursor-pointer text-text-primary">
                                                        <input 
                                                            type="checkbox" 
                                                            checked={isVisible(col.toLowerCase())}
                                                            onChange={() => toggleColumn(col.toLowerCase())}
                                                            className="rounded border-outline/20 text-primary mr-2 bg-surface-container-low"
                                                        />
                                                        <span className="text-sm">{col}</span>
                                                    </label>
                                                ))}
                                            </>
                                        )}
                                    </div>
                                    <div className="fixed inset-0 z-[-1]" onClick={() => setIsColumnMenuOpen(false)}></div>
                                </div>
                            )}
                        </div>

                        {activeTab === 'products' && reportData.length > 0 && (
                            <button
                                onClick={toggleSelectMode}
                                className={`h-10 flex items-center gap-2 px-4 border rounded-full shadow-sm text-sm font-medium transition-colors ${
                                    isSelectMode 
                                        ? 'bg-primary-container text-primary border-primary/20' 
                                        : 'bg-surface-container-highest text-text-secondary border-outline/10 hover:bg-surface-container-high'
                                }`}
                                title="Toggle selection checkboxes for printing"
                            >
                                <CheckSquare className="h-4 w-4" />
                                <span>{isSelectMode ? 'Cancel Selection' : 'Select Rows'}</span>
                            </button>
                        )}

                        <div className="flex items-center border border-outline/10 rounded-full bg-surface-container-highest shadow-sm overflow-hidden h-10">
                            {activeTab === 'products' && reportData.length > 0 && (
                                <button 
                                    onClick={() => setCollapseProductLines(!collapseProductLines)}
                                    className={`p-3 border-r border-outline/10 hover:bg-surface-container-high transition-colors ${collapseProductLines ? 'text-primary bg-primary-container' : 'text-text-secondary'}`}
                                    title={collapseProductLines ? "Show Variants" : "Collapse Product Lines"}
                                >
                                    <Layers className="h-4 w-4" />
                                </button>
                            )}
                            <button 
                                onClick={() => setShowCost(!showCost)}
                                className={`p-3 hover:bg-surface-container-high transition-colors ${showCost ? 'text-error bg-error-container' : 'text-text-secondary'}`}
                                title={showCost ? "Hide Costs" : "Show Costs"}
                            >
                                <Eye className="h-4 w-4" />
                            </button>
                        </div>

                        {reportData.length > 0 && (
                            <button 
                                onClick={handleExport}
                                className="h-10 flex items-center gap-2 px-4 bg-surface-container-highest text-text-secondary border border-outline/10 rounded-full hover:bg-surface-container-high shadow-sm text-sm font-medium"
                            >
                                <Download className="h-4 w-4" />
                                Export CSV
                            </button>
                        )}
                        
                        <button 
                            onClick={handlePrint}
                            className="h-10 flex items-center gap-2 px-4 bg-secondary text-on-secondary rounded-full hover:bg-secondary-hover shadow-sm text-sm font-medium ml-2"
                        >
                            <Printer className="h-4 w-4" />
                            Print
                        </button>
                    </div>
                </div>

                {/* REPORT CANVAS */}
                <div className="flex-1 overflow-auto p-8 print:p-0 print:overflow-visible bg-surface">
                    
                    <PrintHeader 
                        title={generatePrintTitle()} 
                        dateRange={activeTab !== 'products' && startDate && endDate ? `${formatDate(startDate)} - ${formatDate(endDate)}` : undefined}
                    />

                    {error && (
                        <div className="mb-4 p-4 bg-error-container border-l-4 border-error text-error rounded-r-lg">
                            <p className="font-bold">Error</p>
                            <p>{error}</p>
                        </div>
                    )}

                    {loading ? (
                        <div className="flex justify-center items-center h-64">
                            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary"></div>
                        </div>
                    ) : (
                        <div className="min-w-full">

                           {reportData.length > 0 && activeTab === 'products' && (
                               <ProductReportTable 
                                   data={getSortedData()}
                                   sortConfig={sortConfig}
                                   onSort={handleSort}
                                   hiddenColumns={hiddenColumns}
                                   showCost={showCost}
                                   onRowClick={handleRowClick}
                                   collapseLines={collapseProductLines}
                                   isSelectMode={isSelectMode}
                                   selectedIds={selectedIds}
                                   onSelectionChange={setSelectedIds}
                                   columnOrder={columnOrder}
                                   onColumnReorder={setColumnOrder}
                               />
                           )}
                           {reportData.length > 0 && activeTab === 'jobs' && (
                               <JobReportTable 
                                   data={getSortedData()}
                                   sortConfig={sortConfig}
                                   onSort={handleSort}
                                   hiddenColumns={hiddenColumns}
                                   showCost={showCost}
                                   onRowClick={handleRowClick}
                               />
                           )}
                           {reportData.length > 0 && activeTab === 'installers' && (
                               <InstallerReportTable 
                                   data={getSortedData()}
                                   sortConfig={sortConfig}
                                   onSort={handleSort}
                                   hiddenColumns={hiddenColumns}
                                   onRowClick={handleRowClick}
                               />
                           )}
                           
                           {reportData.length === 0 && !error && (
                               <div className="text-center py-12 text-text-tertiary italic border-2 border-dashed border-outline/20 rounded-xl bg-surface-container-low">
                                   No data generated. Adjust filters and click "Run Report".
                               </div>
                           )}
                        </div>
                    )}
                </div>
            </div>

            {isProductModalOpen && selectedProduct && (
                <ProductDetailModal
                    isOpen={isProductModalOpen}
                    onClose={() => setIsProductModalOpen(false)}
                    product={selectedProduct}
                />
            )}
        </div>
    );
};