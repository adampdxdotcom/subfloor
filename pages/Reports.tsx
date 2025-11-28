import React, { useState, useEffect } from 'react';
import { useData } from '../context/DataContext';
import { useNavigate } from 'react-router-dom';
import { exportToCSV } from '../utils/csvUtils';
import ProductDetailModal from '../components/ProductDetailModal'; // Importing the modal
import ProductReportTable from '../components/reports/ProductReportTable';
import JobReportTable from '../components/reports/JobReportTable';
import InstallerReportTable from '../components/reports/InstallerReportTable';
import ReportCharts from '../components/reports/ReportCharts'; // Import Chart
import { 
    getProductReport, 
    getJobReport, 
    getInstallerReport,
    ProductReportFilters,
    JobReportFilters,
    InstallerReportFilters
} from '../services/reportService';
import { PRODUCT_TYPES } from '../types'; // Import the constant
import { formatCurrency } from '../utils/pricingUtils'; // Assuming you have this, or I'll use a local helper
import { 
    FileText, 
    Users, 
    Briefcase, 
    Printer, 
    Eye, 
    EyeOff,
    Play,
    Download,
    BarChart3, // New Icon
    ChevronUp,
    ChevronDown,
    Settings2
} from 'lucide-react';

// --- LOCAL HELPERS ---
const formatDate = (dateStr: string) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString();
};

// --- PRINT HEADER COMPONENT ---
// Only visible when printing
const PrintHeader = ({ title, dateRange }: { title: string, dateRange?: string }) => {
    const { systemBranding } = useData();
    const logoUrl = systemBranding?.logoUrl || '/logo.png'; // Fallback

    return (
        <div className="hidden print:flex flex-col mb-8 border-b-2 border-gray-800 pb-4">
            <div className="flex justify-between items-center mb-4">
                <img src={logoUrl} alt="Logo" className="h-16 object-contain" />
                <div className="text-right">
                    <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
                    <p className="text-gray-600 text-sm">Generated: {new Date().toLocaleDateString()}</p>
                    {dateRange && <p className="text-gray-600 text-sm">Period: {dateRange}</p>}
                </div>
            </div>
        </div>
    );
};

// Fields that must be sorted numerically
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
    const { installers, systemBranding, vendors } = useData(); // Get vendors from context
    
    // --- STATE ---
    const [activeTab, setActiveTab] = useState<'products' | 'jobs' | 'installers'>('products');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null); // NEW: Error state
    const [reportData, setReportData] = useState<any[]>([]);
    
    // For Product Drill-down
    const [selectedProduct, setSelectedProduct] = useState<any | null>(null);
    const [isProductModalOpen, setIsProductModalOpen] = useState(false);
    
    const navigate = useNavigate();
    const { fetchProducts, products } = useData(); // Needed to hydrate the modal
    
    // View Options
    const [showCost, setShowCost] = useState(false);
    const [showChart, setShowChart] = useState(true); // Default to showing chart
    
    // Filters
    // Default to First day of current month -> Today
    const today = new Date();
    const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
    
    const [startDate, setStartDate] = useState(firstDay.toISOString().split('T')[0]);
    const [endDate, setEndDate] = useState(today.toISOString().split('T')[0]);
    
    // Product Filters
    const [manufacturerFilter, setManufacturerFilter] = useState('');
    const [typeFilter, setTypeFilter] = useState('');

    // Sorting State
    const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null);
    // Column Visibility State
    const [hiddenColumns, setHiddenColumns] = useState<string[]>([]);
    const [isColumnMenuOpen, setIsColumnMenuOpen] = useState(false);

    const [statusFilter, setStatusFilter] = useState('All');
    const [installerFilter, setInstallerFilter] = useState('');

    // --- FETCH DATA ---
    const fetchData = async () => {
        setLoading(true);
        setError(null); // Clear previous errors
        setReportData([]); // Clear previous data
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

    // Clear data on tab change, but DO NOT auto-fetch
    useEffect(() => {
        setReportData([]);
        setError(null);
        setHiddenColumns([]); // Reset column visibility defaults
    }, [activeTab]);

    // Handle manual refresh for filters
    const handleApplyFilters = () => {
        fetchData();
    };

    const handlePrint = () => {
        window.print();
    };

    const handleExport = () => {
        const filename = activeTab === 'products' ? 'PriceList' : activeTab === 'jobs' ? 'JobPipeline' : 'InstallerActivity';
        exportToCSV(getSortedData(), filename); // Export sorted data
    };

    // --- SORTING LOGIC ---
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

            // Handle nulls
            if (aValue === null) return 1;
            if (bValue === null) return -1;

            // Explicit Numeric Sort
            if (NUMERIC_FIELDS.includes(sortConfig.key)) {
                const numA = parseFloat(aValue) || 0;
                const numB = parseFloat(bValue) || 0;
                return sortConfig.direction === 'asc' 
                    ? numA - numB 
                    : numB - numA;
            }

            // String Sort
            return sortConfig.direction === 'asc'
                ? String(aValue).localeCompare(String(bValue))
                : String(bValue).localeCompare(String(aValue));
        });
    };

    // --- COLUMN VISIBILITY LOGIC ---
    const toggleColumn = (columnKey: string) => {
        setHiddenColumns(prev => 
            prev.includes(columnKey) 
                ? prev.filter(c => c !== columnKey) 
                : [...prev, columnKey]
        );
    };

    const isVisible = (key: string) => !hiddenColumns.includes(key);

    // --- DRILL DOWN HANDLERS ---
    const handleRowClick = async (row: any) => {
        if (activeTab === 'jobs') {
            navigate(`/projects/${row.id}`);
        } else if (activeTab === 'installers') {
            navigate(`/installers/${row.id}`);
        } else if (activeTab === 'products') {
            // We need to find the full product object from context to open the modal
            // The report only gives us the ID and flattened data.
            if (products.length === 0) await fetchProducts();
            
            const fullProduct = products.find((p: any) => p.id === row.product_id);
            if (fullProduct) {
                setSelectedProduct(fullProduct);
                setIsProductModalOpen(true);
            }
        }
    };

    // --- MAIN LAYOUT ---
    return (
        <div className="flex h-screen bg-gray-50 overflow-hidden">
            
            {/* SIDEBAR - HIDDEN ON PRINT */}
            <div className="w-64 bg-white border-r border-gray-200 flex-shrink-0 flex flex-col print:hidden">
                <div className="p-4 border-b border-gray-200">
                    <h2 className="text-lg font-bold text-gray-900">Reports</h2>
                </div>
                <nav className="flex-1 p-4 space-y-1">
                    <button
                        onClick={() => setActiveTab('products')}
                        className={`w-full flex items-center px-3 py-2 text-sm font-medium rounded-md ${
                            activeTab === 'products' ? 'bg-indigo-50 text-indigo-700' : 'text-gray-700 hover:bg-gray-100'
                        }`}
                    >
                        <FileText className="mr-3 h-5 w-5" />
                        Price List / Inventory
                    </button>
                    <button
                        onClick={() => setActiveTab('jobs')}
                        className={`w-full flex items-center px-3 py-2 text-sm font-medium rounded-md ${
                            activeTab === 'jobs' ? 'bg-indigo-50 text-indigo-700' : 'text-gray-700 hover:bg-gray-100'
                        }`}
                    >
                        <Briefcase className="mr-3 h-5 w-5" />
                        Job Pipeline
                    </button>
                    <button
                        onClick={() => setActiveTab('installers')}
                        className={`w-full flex items-center px-3 py-2 text-sm font-medium rounded-md ${
                            activeTab === 'installers' ? 'bg-indigo-50 text-indigo-700' : 'text-gray-700 hover:bg-gray-100'
                        }`}
                    >
                        <Users className="mr-3 h-5 w-5" />
                        Installer Activity
                    </button>
                </nav>
            </div>

            {/* MAIN CONTENT */}
            <div className="flex-1 flex flex-col overflow-hidden bg-white print:block print:h-auto print:overflow-visible">
                
                {/* TOOLBAR - HIDDEN ON PRINT */}
                <div className="px-6 py-4 border-b border-gray-200 bg-white flex flex-wrap items-end justify-between gap-4 print:hidden">
                    
                    {/* LEFT: Filters & Run Action */}
                    <div className="flex items-end gap-3">
                        {activeTab === 'products' ? (
                            /* PRODUCT FILTERS */
                            <>
                                <div className="flex flex-col">
                                    <label className="text-xs text-gray-500 font-bold uppercase mb-1">Manufacturer</label>
                                    <select
                                        className="h-9 border border-gray-300 rounded-md shadow-sm px-3 text-sm bg-white min-w-[160px]"
                                        value={manufacturerFilter}
                                        onChange={(e) => setManufacturerFilter(e.target.value)}
                                    >
                                        <option value="">All Manufacturers</option>
                                        {vendors
                                            .filter(v => v.vendorType !== 'Supplier') // Optional: Hide pure suppliers
                                            .sort((a, b) => a.name.localeCompare(b.name))
                                            .map(v => (
                                                <option key={v.id} value={v.id}>{v.name}</option>
                                            ))}
                                    </select>
                                </div>
                                <div className="flex flex-col">
                                    <label className="text-xs text-gray-500 font-bold uppercase mb-1">Product Type</label>
                                    <select
                                        className="h-9 border border-gray-300 rounded-md shadow-sm px-3 text-sm bg-white min-w-[140px]"
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
                            /* DATE FILTERS (Jobs & Installers) */
                            <>
                                <div className="flex flex-col">
                                    <label className="text-xs text-gray-500 font-bold uppercase mb-1">From</label>
                                <input 
                                    type="date" 
                                    className="h-9 border border-gray-300 rounded-md shadow-sm px-3 text-sm" 
                                    value={startDate}
                                    onChange={(e) => setStartDate(e.target.value)}
                                />
                                </div>
                                <div className="flex flex-col">
                                    <label className="text-xs text-gray-500 font-bold uppercase mb-1">To</label>
                                <input 
                                    type="date" 
                                    className="h-9 border border-gray-300 rounded-md shadow-sm px-3 text-sm" 
                                    value={endDate}
                                    onChange={(e) => setEndDate(e.target.value)}
                                />
                                </div>
                            </>
                        )}
                        
                        {/* Unified RUN Button */}
                        <button 
                            onClick={handleApplyFilters}
                            className="h-9 flex items-center gap-2 px-4 bg-indigo-600 text-white text-sm font-bold rounded-md hover:bg-indigo-700 shadow-sm active:scale-95 transition-all"
                            title="Run or Refresh Report"
                        >
                            <Play className="w-4 h-4" />
                            Run
                        </button>
                    </div>

                    {/* RIGHT: Actions & View Toggles */}
                    <div className="flex items-center gap-2">
                        
                        {/* COLUMNS DROPDOWN */}
                        <div className="relative">
                            <button 
                                onClick={() => setIsColumnMenuOpen(!isColumnMenuOpen)}
                                className="h-9 flex items-center gap-2 px-3 bg-white text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50 shadow-sm text-sm font-medium"
                            >
                                <Settings2 className="h-4 w-4" />
                                Columns
                            </button>
                            
                            {isColumnMenuOpen && (
                                <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg border border-gray-200 z-50 p-2">
                                    <div className="text-xs font-bold text-gray-500 uppercase px-2 mb-2">Toggle Columns</div>
                                    <div className="space-y-1">
                                        {activeTab === 'products' && (
                                            <>
                                                {['Manufacturer', 'Product', 'Style_Size', 'SKU', 'Carton', 'Retail'].map(col => (
                                                    <label key={col} className="flex items-center px-2 py-1.5 hover:bg-gray-100 rounded cursor-pointer">
                                                        <input 
                                                            type="checkbox" 
                                                            checked={isVisible(col.toLowerCase())}
                                                            onChange={() => toggleColumn(col.toLowerCase())}
                                                            className="rounded border-gray-300 text-indigo-600 mr-2"
                                                        />
                                                        <span className="text-sm">{col.replace('_', ' / ')}</span>
                                                    </label>
                                                ))}
                                            </>
                                        )}
                                        {activeTab === 'jobs' && (
                                            <>
                                                {['Date', 'Customer', 'Project', 'Status', 'Total'].map(col => (
                                                    <label key={col} className="flex items-center px-2 py-1.5 hover:bg-gray-100 rounded cursor-pointer">
                                                        <input 
                                                            type="checkbox" 
                                                            checked={isVisible(col.toLowerCase())}
                                                            onChange={() => toggleColumn(col.toLowerCase())}
                                                            className="rounded border-gray-300 text-indigo-600 mr-2"
                                                        />
                                                        <span className="text-sm">{col}</span>
                                                    </label>
                                                ))}
                                            </>
                                        )}
                                        {activeTab === 'installers' && (
                                            <>
                                                {['Installer', 'Jobs', 'Labor'].map(col => (
                                                    <label key={col} className="flex items-center px-2 py-1.5 hover:bg-gray-100 rounded cursor-pointer">
                                                        <input 
                                                            type="checkbox" 
                                                            checked={isVisible(col.toLowerCase())}
                                                            onChange={() => toggleColumn(col.toLowerCase())}
                                                            className="rounded border-gray-300 text-indigo-600 mr-2"
                                                        />
                                                        <span className="text-sm">{col}</span>
                                                    </label>
                                                ))}
                                            </>
                                        )}
                                    </div>
                                    {/* Close on backdrop click (simple logic) */}
                                    <div className="fixed inset-0 z-[-1]" onClick={() => setIsColumnMenuOpen(false)}></div>
                                </div>
                            )}
                        </div>

                        {/* VIEW OPTIONS GROUP (Chart & Cost) */}
                        <div className="flex items-center border border-gray-300 rounded-md bg-white shadow-sm overflow-hidden h-9">
                            {reportData.length > 0 && (
                                <button 
                                    onClick={() => setShowChart(!showChart)}
                                    className={`p-2.5 border-r border-gray-300 hover:bg-gray-50 transition-colors ${showChart ? 'text-indigo-600 bg-indigo-50' : 'text-gray-500'}`}
                                    title={showChart ? "Hide Chart" : "Show Chart"}
                                >
                                    <BarChart3 className="h-4 w-4" />
                                </button>
                            )}
                            <button 
                                onClick={() => setShowCost(!showCost)}
                                className={`p-2.5 hover:bg-gray-50 transition-colors ${showCost ? 'text-red-600 bg-red-50' : 'text-gray-500'}`}
                                title={showCost ? "Hide Costs" : "Show Costs"}
                            >
                                <Eye className="h-4 w-4" />
                            </button>
                        </div>

                        {/* EXPORT CSV */}
                        {reportData.length > 0 && (
                            <button 
                                onClick={handleExport}
                                className="h-9 flex items-center gap-2 px-3 bg-white text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50 shadow-sm text-sm font-medium"
                            >
                                <Download className="h-4 w-4" />
                                Export CSV
                            </button>
                        )}
                        
                        <button 
                            onClick={handlePrint}
                            className="h-9 flex items-center gap-2 px-3 bg-gray-800 text-white rounded-md hover:bg-gray-900 shadow-sm text-sm font-medium ml-2"
                        >
                            <Printer className="h-4 w-4" />
                            Print
                        </button>
                    </div>
                </div>

                {/* REPORT CANVAS */}
                <div className="flex-1 overflow-auto p-8 print:p-0 print:overflow-visible">
                    
                    {/* Print Only Header */}
                    <PrintHeader 
                        title={
                            activeTab === 'products' ? 'Product Price List' :
                            activeTab === 'jobs' ? 'Job Pipeline Report' : 
                            'Installer Activity Report'
                        } 
                        dateRange={startDate && endDate ? `${formatDate(startDate)} - ${formatDate(endDate)}` : undefined}
                    />

                    {/* ERROR MESSAGE */}
                    {error && (
                        <div className="mb-4 p-4 bg-red-50 border-l-4 border-red-500 text-red-700">
                            <p className="font-bold">Error</p>
                            <p>{error}</p>
                        </div>
                    )}

                    {loading ? (
                        <div className="flex justify-center items-center h-64">
                            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600"></div>
                        </div>
                    ) : (
                        <div className="min-w-full">
                           {/* VISUALIZATION */}
                           {showChart && reportData.length > 0 && (
                               <ReportCharts data={getSortedData()} type={activeTab} />
                           )}

                           {reportData.length > 0 && activeTab === 'products' && (
                               <ProductReportTable 
                                   data={getSortedData()}
                                   sortConfig={sortConfig}
                                   onSort={handleSort}
                                   hiddenColumns={hiddenColumns}
                                   showCost={showCost}
                                   onRowClick={handleRowClick}
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
                               <div className="text-center py-12 text-gray-500 italic border-2 border-dashed border-gray-200 rounded-lg">
                                   No data generated. Adjust filters and click "Run Report".
                               </div>
                           )}
                        </div>
                    )}
                </div>
            </div>

            {/* Product Detail Modal for Drill-down */}
            {isProductModalOpen && selectedProduct && (
                <ProductDetailModal
                    isOpen={isProductModalOpen}
                    onClose={() => setIsProductModalOpen(false)}
                    product={selectedProduct}
                />
            )}
        </div>
    );
}