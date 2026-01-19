import React, { useState } from 'react';
import * as XLSX from 'xlsx'; // Need this for the dummy generator
import FileUploader from '../components/import/FileUploader';
import ColumnMapper from '../components/import/ColumnMapper';
import ImportReview from '../components/import/ImportReview';
import { SpreadsheetCleanerModal } from '../components/import/SpreadsheetCleanerModal'; // Phase 4 Import
import { CheckCircle2, Sparkles, FileSpreadsheet, Download } from 'lucide-react';
import { toast } from 'react-hot-toast';
import axios from 'axios';

const ImportData: React.FC = () => {
    // --- STATE ---
    const [step, setStep] = useState<1 | 2 | 3>(1);
    const [isCleanerModalOpen, setIsCleanerModalOpen] = useState(false); // Phase 4 State
    
    // Step 1: Raw Data
    const [rawData, setRawData] = useState<any[][] | null>(null);
    const [fileName, setFileName] = useState<string | null>(null);

    // Step 3: Preview Data
    const [previewResults, setPreviewResults] = useState<any[]>([]);
    const [isProcessing, setIsProcessing] = useState(false);
    const [importStrategy, setImportStrategy] = useState<string>('variant_match');
    const [importDefaults, setImportDefaults] = useState<any>({}); 

    // --- HANDLERS ---
    
    // 1. Data Arrives (From Disk OR Cleaner)
    const handleDataLoaded = (data: any[][], name: string) => {
        setRawData(data);
        setFileName(name);
        // CRITICAL CHANGE: Do NOT setStep(2) yet. 
        // We stay on Step 1 to allow "Remove Top Row" / Review.
    };

    // 2. Data Manipulation (Step 1 Actions)
    const handleRemoveTopRow = () => {
        if (!rawData || rawData.length < 2) return;
        setRawData(prev => prev ? prev.slice(1) : []);
        toast.success("Top row removed.");
    };

    const handleResetStep1 = () => {
        setRawData(null);
        setFileName(null);
    };

    const handleConfirmStep1 = () => {
        if (!rawData || rawData.length === 0) return;
        setStep(2); // NOW we go to mapping
    };

    // Phase 4: Handle data coming from the Cleaner Tool
    const handleCleaningComplete = (cleanedObjects: any[]) => {
        if (!cleanedObjects || cleanedObjects.length === 0) return;

        // Convert JSON Objects back to Matrix for the standard preview
        const headers = Object.keys(cleanedObjects[0]);
        const rows = cleanedObjects.map(obj => headers.map(h => obj[h]));
        const matrixData = [headers, ...rows];

        // Feed into the standard "Data Loaded" state
        handleDataLoaded(matrixData, "Cleaned_Inventory_Data.xlsx");
        setIsCleanerModalOpen(false);
        toast.success("Cleaned data loaded! Please review below.");
    };

    // --- HELPER: GENERATE DUMMY DATA ---
    const downloadDummyFile = () => {
        const headers = ["Manufacturer", "Collection", "Color", "Item Description", "SKU", "Cost"];
        const data = [
            // Standard Size (12x24) - Should Auto Match
            ["Global Floors", "Nebula Series", "Stardust", "Nebula Stardust Tile 12x24 Matte", "NB-100", 3.49],
            ["Global Floors", "Nebula Series", "Cosmos", "Nebula Cosmos Tile 12x24 Matte", "NB-101", 3.49],
            
            // Messy Size (7 inch x 48 inch) - Should require Cleaner
            ["Global Floors", "Rustic Woods", "Oak Natural", "LVP Plank 7 inch x 48 inch Click", "RW-200", 2.99],
            ["Global Floors", "Rustic Woods", "Oak Dark", "LVP Plank 7 inch x 48 inch Click", "RW-201", 2.99],
            
            // Messy Size (3 by 6) - Should require Cleaner
            ["Global Floors", "Metro Subway", "White Gloss", "Ceramic Wall Tile 3 by 6", "MT-300", 0.89],
        ];

        const ws = XLSX.utils.aoa_to_sheet([headers, ...data]);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Inventory");
        XLSX.writeFile(wb, "messy_vendor_file.xlsx");
    };

    const handleMappingComplete = async (mappedData: any[], strategy: string) => {
        setIsProcessing(true);
        setImportStrategy(strategy);
        
        try {
            const res = await axios.post('/api/import/preview', {
                mappedRows: mappedData,
                strategy,
                defaults: importDefaults 
            });
            setPreviewResults(res.data);
            setStep(3);
        } catch (err) {
            console.error(err);
            toast.error("Failed to generate preview.");
        } finally {
            setIsProcessing(false);
        }
    };

    const handleExecuteImport = async (finalRows: any[]) => {
        if (!confirm("Are you sure you want to apply these changes to the database?")) return;
        
        setIsProcessing(true);
        try {
            const res = await axios.post('/api/import/execute', {
                previewResults: finalRows, 
                strategy: importStrategy,
                defaults: importDefaults 
            });
            
            toast.success(`Import complete! ${res.data.updates} updated, ${res.data.created} created.`);
            setStep(1);
            setRawData(null);
            setFileName(null);
        } catch (err) {
            console.error(err);
            toast.error("Import failed. Check console for details.");
        } finally {
            setIsProcessing(false);
        }
    };

    return (
        <div className="space-y-8">
            
            {/* SECTION 1: HEADER BOX - De-boxed MD3 Style */}
            <div className="bg-surface-container-high p-8 rounded-xl shadow-sm border border-outline/10">
                <div>
                    <h1 className="text-4xl font-bold text-text-primary tracking-tight">Import Inventory</h1>
                    <p className="text-text-secondary mt-1 font-medium">Upload vendor price lists to update products in bulk.</p>
                </div>
            </div>

            {/* SECTION 2: WORKSPACE (Steps + Content) */}
            <div className="bg-surface-container-high rounded-xl shadow-sm border border-outline/10 overflow-hidden">
                {/* Progress Bar (Integrated into top of card) */}
                <div className="bg-surface-container-low border-b border-outline/10 p-8">
                    <div className="flex items-center justify-between max-w-3xl mx-auto">
                        {/* Step 1 */}
                        <div className={`flex flex-col items-center transition-colors ${step >= 1 ? 'text-primary' : 'text-text-secondary'}`}>
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold mb-2 transition-colors ${step >= 1 ? 'bg-primary-container text-primary' : 'bg-surface-container-highest text-text-tertiary border border-outline/10'}`}>
                                {step > 1 ? <CheckCircle2 size={24} /> : '1'}
                            </div>
                            <span className="text-sm font-medium">Upload & Clean</span>
                        </div>
                        <div className={`flex-1 h-0.5 mx-4 transition-colors ${step > 1 ? 'bg-primary' : 'bg-outline/20'}`}></div>
                        
                        {/* Step 2 */}
                        <div className={`flex flex-col items-center transition-colors ${step >= 2 ? 'text-primary' : 'text-text-secondary'}`}>
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold mb-2 transition-colors ${step >= 2 ? 'bg-primary-container text-primary' : 'bg-surface-container-highest text-text-tertiary border border-outline/10'}`}>
                                {step > 2 ? <CheckCircle2 size={24} /> : '2'}
                            </div>
                            <span className="text-sm font-medium">Map Columns</span>
                        </div>
                        <div className={`flex-1 h-0.5 mx-4 transition-colors ${step > 2 ? 'bg-primary' : 'bg-outline/20'}`}></div>

                        {/* Step 3 */}
                        <div className={`flex flex-col items-center transition-colors ${step >= 3 ? 'text-primary' : 'text-text-secondary'}`}>
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold mb-2 transition-colors ${step >= 3 ? 'bg-primary-container text-primary' : 'bg-surface-container-highest text-text-tertiary border border-outline/10'}`}>
                                3
                            </div>
                            <span className="text-sm font-medium">Review & Import</span>
                        </div>
                    </div>
                </div>

                {/* CONTENT AREA */}
                <div className="p-8">
                    {step === 1 && !rawData && (
                        /* STATE 1A: NO DATA YET (Upload or Clean) */
                        <div className="max-w-2xl mx-auto space-y-8">
                            
                            {/* Main Uploader */}
                            <div className="bg-surface-container-low rounded-2xl border border-outline/10 p-1 shadow-sm">
                                <FileUploader onDataLoaded={handleDataLoaded} />
                            </div>

                            {/* Helper Actions */}
                            <div className="flex flex-col md:flex-row gap-4 justify-center items-center text-center md:text-left">
                                <div 
                                    onClick={() => setIsCleanerModalOpen(true)}
                                    className="flex items-center gap-3 px-6 py-4 rounded-xl bg-surface-container hover:bg-surface-container-high border border-outline/10 cursor-pointer transition-colors group w-full md:w-auto"
                                >
                                    <div className="p-2 bg-tertiary-container rounded-full text-tertiary group-hover:scale-110 transition-transform">
                                        <Sparkles size={20} />
                                    </div>
                                    <div>
                                        <div className="font-bold text-text-primary">Launch Spreadsheet Cleaner</div>
                                        <div className="text-xs text-text-secondary">Messy data? Extract sizes first.</div>
                                    </div>
                                </div>

                                <button 
                                    onClick={downloadDummyFile} 
                                    className="flex items-center gap-2 px-4 py-2 text-sm text-text-secondary hover:text-primary transition-colors"
                                >
                                    <Download size={16} /> Download Test File
                                </button>
                            </div>
                        </div>
                    )}

                    {step === 1 && rawData && (
                        /* STATE 1B: PREVIEW & CLEAN (Data Loaded) */
                        <div className="space-y-6">
                            {/* Toolbar */}
                            <div className="bg-surface-container rounded-xl p-4 border border-outline/10 flex flex-wrap gap-4 justify-between items-center shadow-sm">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-success-container rounded-lg text-success">
                                        <FileSpreadsheet size={24} />
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-text-primary text-lg">{fileName}</h3>
                                        <p className="text-sm text-text-secondary">{rawData.length} rows detected</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3">
                                    <button 
                                        onClick={handleRemoveTopRow}
                                        className="px-4 py-2 text-sm font-bold text-error bg-error-container/20 hover:bg-error-container/40 rounded-lg transition-colors border border-error/20"
                                    >
                                        Remove Top Row
                                    </button>
                                    <div className="h-8 w-px bg-outline/20 mx-2"></div>
                                    <button 
                                        onClick={handleResetStep1}
                                        className="px-4 py-2 text-sm font-bold text-text-secondary hover:bg-surface-container-high rounded-lg transition-colors"
                                    >
                                        Cancel
                                    </button>
                                    <button 
                                        onClick={handleConfirmStep1}
                                        className="px-6 py-2 text-sm font-bold text-on-primary bg-primary hover:bg-primary-hover rounded-full shadow-md transition-all active:scale-95 flex items-center gap-2"
                                    >
                                        Next: Map Columns <CheckCircle2 size={16} />
                                    </button>
                                </div>
                            </div>

                            {/* Preview Table */}
                            <div className="bg-surface-container rounded-xl border border-outline/10 overflow-hidden shadow-sm">
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left text-sm">
                                        <thead className="bg-surface-container-high border-b border-outline/10 text-text-secondary uppercase text-xs">
                                            <tr>
                                                <th className="p-3 w-12 text-center">#</th>
                                                {rawData[0]?.map((header: any, i: number) => (
                                                    <th key={i} className="p-3 font-bold border-r border-outline/5 last:border-0 whitespace-nowrap">
                                                        {i < 5 ? `Col ${String.fromCharCode(65+i)}` : `Col ${i}`}
                                                    </th>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-outline/5">
                                            {rawData.slice(0, 5).map((row, rIdx) => (
                                                <tr key={rIdx} className="hover:bg-surface-container-high/50 transition-colors">
                                                    <td className="p-3 text-center text-text-secondary text-xs font-mono border-r border-outline/5">
                                                        {rIdx + 1}
                                                    </td>
                                                    {row.map((cell: any, cIdx: number) => (
                                                        <td key={cIdx} className="p-3 text-text-primary border-r border-outline/5 last:border-0 max-w-xs truncate">
                                                            {cell}
                                                        </td>
                                                    ))}
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                                <div className="p-3 bg-surface-container-low border-t border-outline/10 text-center text-xs text-text-secondary">
                                    Showing first 5 rows of {rawData.length}
                                </div>
                            </div>
                        </div>
                    )}

                    {step === 2 && (
                        <ColumnMapper 
                            rawData={rawData || []} 
                            fileName={fileName || 'Unknown File'} 
                            onBack={() => setStep(1)}
                            onComplete={handleMappingComplete}
                            isGeneratingPreview={isProcessing}
                            onDefaultsChange={setImportDefaults} 
                        />
                    )}

                    {step === 3 && (
                        <ImportReview 
                            results={previewResults}
                            onExecute={handleExecuteImport}
                            isExecuting={isProcessing}
                            onBack={() => setStep(2)}
                        />
                    )}
                </div>
            </div>

            {/* PHASE 4: CLEANER MODAL */}
            {isCleanerModalOpen && (
                <SpreadsheetCleanerModal 
                    onClose={() => setIsCleanerModalOpen(false)}
                    onComplete={handleCleaningComplete}
                />
            )}
        </div>
    );
};

export default ImportData;