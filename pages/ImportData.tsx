import React, { useState } from 'react';
import * as XLSX from 'xlsx'; // Need this for the dummy generator
import FileUploader from '../components/import/FileUploader';
import ColumnMapper from '../components/import/ColumnMapper';
import ImportReview from '../components/import/ImportReview';
import { SpreadsheetCleanerModal } from '../components/import/SpreadsheetCleanerModal'; // Phase 4 Import
import { CheckCircle2, FileSpreadsheet, Download } from 'lucide-react';
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
    
    // 1. Data Arrives (From Disk)
    const handleDataLoaded = (data: any[][], name: string) => {
        setRawData(data);
        setFileName(name);
        // Automatically open the cleaner/prep tool
        setIsCleanerModalOpen(true);
    };

    // 2. Data Manipulation (Step 1 Actions)
    const handleRemoveTopRow = () => {
        if (!rawData || rawData.length < 2) return;
        setRawData(prev => prev ? prev.slice(1) : []);
        toast.success("Top row removed.");
    };

    // Phase 4: Handle data coming from the Cleaner Tool
    const handleCleaningComplete = (cleanedObjects: any[]) => {
        if (!cleanedObjects || cleanedObjects.length === 0) return;

        // Convert JSON Objects back to Matrix for the standard preview
        const headers = Object.keys(cleanedObjects[0]);
        const rows = cleanedObjects.map(obj => headers.map(h => obj[h]));
        const matrixData = [headers, ...rows];

        // Update raw data and Move to Mapping
        setRawData(matrixData);
        setIsCleanerModalOpen(false);
        setStep(2);
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
                    {step === 1 && (
                        /* STATE 1: UPLOAD ONLY */
                        <div className="max-w-2xl mx-auto space-y-8">
                            
                            {/* Main Uploader */}
                            <div className="bg-surface-container-low rounded-2xl border border-outline/10 p-1 shadow-sm">
                                <FileUploader onDataLoaded={handleDataLoaded} />
                            </div>

                            {/* Helper Actions */}
                            <div className="flex flex-col md:flex-row gap-4 justify-center items-center text-center md:text-left">
                                <button 
                                    onClick={downloadDummyFile} 
                                    className="flex items-center gap-2 px-4 py-2 text-sm text-text-secondary hover:text-primary transition-colors"
                                >
                                    <Download size={16} /> Download Test File
                                </button>
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
                    // @ts-ignore - Prop will be added in next step
                    initialData={rawData}
                    // @ts-ignore - Prop will be added in next step
                    fileName={fileName}
                />
            )}
        </div>
    );
};

export default ImportData;