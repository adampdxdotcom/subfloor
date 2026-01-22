import React, { useState, useEffect } from 'react';
import { X, Check, ArrowRight } from 'lucide-react';
import * as sampleService from '../../services/sampleService'; // Use the shared service
import { CleanerFileUpload } from './cleaner/CleanerFileUpload';
import { CleanerColumnSelector } from './cleaner/CleanerColumnSelector';
import { CleanerAnalysisTable } from './cleaner/CleanerAnalysisTable';
import { ExcelSheetData, ParsedRow, KnownSize } from '../../types';
import { getCleanedCsvData, normalizeSize } from '../../services/spreadsheetService';

interface SpreadsheetCleanerModalProps {
    onClose: () => void;
    onComplete: (cleanedData: any[]) => void;
    initialData?: any[][];
    fileName?: string;
}

export const SpreadsheetCleanerModal: React.FC<SpreadsheetCleanerModalProps> = ({ onClose, onComplete, initialData, fileName }) => {
    // --- STATE ---
    const [step, setStep] = useState<'upload' | 'selectColumn' | 'analyze'>('upload');
    const [cleaningMode, setCleaningMode] = useState<'SIZES' | 'NAMES' | 'PRICES'>('SIZES');
    const [sheetData, setSheetData] = useState<ExcelSheetData | null>(null);
    const [targetColumn, setTargetColumn] = useState<string | null>(null);
    
    // Analysis State
    const [rows, setRows] = useState<ParsedRow[]>([]);
    const [knownSizes, setKnownSizes] = useState<KnownSize[]>([]);
    const [knownProductAliases, setKnownProductAliases] = useState<any[]>([]); // New state for Name memory
    const [hasChanges, setHasChanges] = useState(false);

    // --- EFFECTS ---
    // Initialize from props if provided (The "Step 1.5" flow)
    useEffect(() => {
        // Relaxed check: We don't strictly require fileName to start
        if (initialData && initialData.length > 0 && step === 'upload') {
            
            // CONVERT MATRIX (Array[]) TO SHEET DATA (Objects)
            // The cleaner expects { headers: [], rows: [{Col: Val}, ...] }
            const headers = initialData[0] as string[];
            const body = initialData.slice(1);
            
            const objectRows = body.map((rowArr: any[]) => {
                const obj: any = {};
                headers.forEach((h, i) => {
                    obj[h] = rowArr[i];
                });
                return obj;
            });

            setSheetData({ 
                name: fileName || 'Uploaded File', 
                headers: headers,
                rows: objectRows 
            });
            setStep('selectColumn');
        }
    }, [initialData, fileName]);

    // Track changes
    useEffect(() => {
        const changes = rows.some(r => r.manualOverride);
        setHasChanges(changes);
    }, [rows]);

    // Load existing sizes AND aliases from DB on mount
    useEffect(() => {
        const fetchBrain = async () => {
            try {
                // 1. Fetch Clean Sizes (e.g. "12x24")
                const stats = await sampleService.getUniqueSizeStats();
                
                // 2. Fetch Size Aliases (e.g. "M122" -> "12x24")
                const aliases = await sampleService.getSizeAliases();

                // 3. Fetch Product Aliases (e.g. "CORTC" -> "Coretec")
                const prodAliases = await sampleService.getProductAliases();
                setKnownProductAliases(prodAliases || []);

                if (Array.isArray(stats)) {
                    const dbSizes: KnownSize[] = stats.map((s: any) => {
                        // Find all aliases that map to this size
                        const myAliases = aliases
                            .filter(a => a.mappedSize === s.value)
                            .map(a => a.aliasText);

                        return {
                            id: s.value, 
                            label: s.value,
                            matchers: myAliases 
                        };
                    });
                    setKnownSizes(dbSizes);
                }
            } catch (err) {
                console.error("Failed to load cleaner brain:", err);
            }
        };
        fetchBrain();
    }, []);

    // --- HANDLERS ---

    // Step 1 -> 2
    const handleFileLoaded = (data: ExcelSheetData) => {
        setSheetData(data);
        setStep('selectColumn');
    };

    // Step 2 -> 3
    const handleColumnSelected = (colKey: string) => {
        if (!sheetData) return;
        setTargetColumn(colKey);

        // INITIAL PARSE: Convert raw Excel rows into our analysis format
        const initialRows: ParsedRow[] = sheetData.rows.map((row, idx) => {
            const rawText = row[colKey]?.toString() || '';
            let extracted = '';
            let isKnown = false;

            // --- STRATEGY: SIZES ---
            if (cleaningMode === 'SIZES') {
                // Try simple normalization (e.g. "12 x 24" -> "12x24")
                extracted = normalizeSize(rawText);
                
                // Check if this initial guess is a Known Size
                isKnown = knownSizes.some(k => k.label.toLowerCase() === extracted.toLowerCase());

                // If no match, check Aliases
                if (!isKnown) {
                    for (const known of knownSizes) {
                        if (known.matchers?.some(alias => rawText.toLowerCase().includes(alias.toLowerCase()))) {
                            extracted = known.label;
                            isKnown = true;
                            break;
                        }
                    }
                }
            } 
            
            // --- STRATEGY: NAMES ---
            else if (cleaningMode === 'NAMES') {
                // Exact match check against known aliases
                const matchedAlias = knownProductAliases.find(p => p.aliasText.toLowerCase() === rawText.toLowerCase());
                if (matchedAlias) {
                    extracted = matchedAlias.mappedProductName;
                    isKnown = true;
                } else {
                    extracted = rawText; // Default to raw text if unknown
                    isKnown = false; 
                }
            }
            
            // --- STRATEGY: PRICES ---
            else if (cleaningMode === 'PRICES') {
                 // Simple Number Cleaning
                 const num = parseFloat(rawText.replace(/[^0-9.]/g, ''));
                 if (!isNaN(num)) {
                     extracted = num.toFixed(2);
                     isKnown = true; // Technically "Valid", not "Known"
                 } else {
                     extracted = rawText;
                     isKnown = false;
                 }
            }

            return {
                id: idx.toString(),
                originalData: row,
                targetText: rawText,
                extractedSize: extracted || null, // Note: We reuse 'extractedSize' field for all modes to keep it simple
                status: isKnown ? 'MATCHED' : 'UNKNOWN',
                manualOverride: false
            };
        });

        setRows(initialRows);
        setStep('analyze');
    };

    // Step 3 Completion
    const handleFinalExport = () => {
        // If we are just skipping (no column selected yet, or no changes)
        if (!targetColumn || (!hasChanges && step !== 'analyze')) {
            if (sheetData) {
                // Return raw data as objects
                // If rows is already objects (from initialData flow), just use them
                // Otherwise (from disk flow), headers is Row 0.
                const finalObjects = sheetData.headers 
                    ? sheetData.rows // Structure created in useEffect
                    : sheetData.rows.slice(1).map(row => { // Raw matrix from disk
                        const obj: any = {};
                        const headers = sheetData.rows[0];
                        headers.forEach((h: any, i: number) => obj[h] = row[i]);
                        return obj;
                    });

                onComplete(finalObjects);
            }
            onClose();
            return;
        }
        
        // 1. Generate the clean array of objects
        const finalData = getCleanedCsvData(rows, targetColumn);
        
        // 2. Pass back to parent (ImportData page)
        onComplete(finalData);
        
        // 3. Close modal
        onClose();
    };

    const handleReset = () => {
        if (confirm("Start over with a new file?")) {
            setStep('upload');
            setSheetData(null);
            setTargetColumn(null);
            setRows([]);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 md:p-8">
            <div className="w-full max-w-6xl h-full max-h-[90vh] bg-surface-container rounded-2xl shadow-2xl overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-200">
                
                {/* HEADER */}
                <div className="flex items-center justify-between p-6 border-b border-outline/10 bg-surface-container-high">
                    <div className="flex items-center gap-6">
                        <div>
                            <h2 className="text-2xl font-bold text-text-primary">Spreadsheet Cleaner</h2>
                            <p className="text-text-secondary text-sm">
                                {step === 'upload' && "Step 1: Upload your messy vendor file."}
                                {step === 'selectColumn' && "Step 2: Identify the description column."}
                                {step === 'analyze' && "Step 3: Teach the system how to read sizes."}
                            </p>
                        </div>

                        {/* MODE SWITCHER */}
                        {step !== 'upload' && (
                            <div className="hidden md:flex bg-surface-container-highest rounded-lg p-1 border border-outline/10">
                                {(['SIZES', 'NAMES', 'PRICES'] as const).map(mode => (
                                    <button
                                        key={mode}
                                        onClick={() => setCleaningMode(mode)}
                                        className={`px-4 py-1.5 rounded-md text-sm font-bold transition-all ${
                                            cleaningMode === mode 
                                                ? 'bg-surface-container shadow-sm text-primary' 
                                                : 'text-text-secondary hover:text-text-primary'
                                        }`}
                                    >
                                        {mode.charAt(0) + mode.slice(1).toLowerCase()}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="flex items-center gap-3">
                         {step !== 'upload' && (
                             <button 
                                onClick={handleFinalExport}
                                className={`flex items-center gap-2 px-5 py-2.5 rounded-full font-bold transition-all ${
                                    hasChanges 
                                        ? 'bg-primary text-on-primary hover:bg-primary-hover shadow-md'
                                        : 'bg-surface-container-highest text-text-secondary border border-outline/10 hover:bg-surface-container-high hover:text-text-primary'
                                }`}
                             >
                                {hasChanges ? (
                                    <>Finish Cleaning <Check size={18} /></>
                                ) : (
                                    <>Skip Cleaning <ArrowRight size={18} /></>
                                )}
                             </button>
                         )}
                    
                        <button 
                            onClick={onClose}
                            className="p-2 rounded-full hover:bg-surface-container-highest text-text-secondary transition-colors"
                        >
                            <X size={24} />
                        </button>
                    </div>
                </div>

                {/* CONTENT AREA */}
                <div className="flex-1 overflow-auto bg-surface-container p-6">
                    {step === 'upload' && (
                        <div className="h-full flex flex-col items-center justify-center">
                            <CleanerFileUpload onFileSelect={(file) => {
                                // We need to read the file here using the service
                                import('../../services/spreadsheetService').then(({ readExcelFile }) => {
                                    readExcelFile(file).then(handleFileLoaded).catch(err => alert(err.message));
                                });
                            }} />
                        </div>
                    )}

                    {step === 'selectColumn' && sheetData && (
                        <CleanerColumnSelector 
                            data={sheetData} 
                            onConfirm={handleColumnSelected}
                            onBack={() => setStep('upload')}
                        />
                    )}

                    {step === 'analyze' && (
                        <CleanerAnalysisTable 
                            rows={rows}
                            knownSizes={knownSizes}
                            setRows={setRows}
                            setKnownSizes={setKnownSizes}
                            onExport={handleFinalExport}
                            onReset={handleReset}
                            mode={cleaningMode} // Pass mode down
                        />
                    )}
                </div>
            </div>
        </div>
    );
};