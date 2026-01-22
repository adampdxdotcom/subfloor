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
    
    // WORKBENCH STATE: Map each mode to its selected column
    const [columnMap, setColumnMap] = useState<Record<string, string | null>>({
        SIZES: null,
        NAMES: null,
        PRICES: null
    });
    
    // Analysis State (Master Copy)
    const [rows, setRows] = useState<ParsedRow[]>([]);
    
    // WORKBENCH MEMORY: Stores clean values for any column, indexed by Row ID
    // { "0": { "Column C": "12x24" }, "1": { "Column B": "Coretec" } }
    const [cleanDataMap, setCleanDataMap] = useState<Record<string, Record<string, string>>>({});
    
    const [knownSizes, setKnownSizes] = useState<KnownSize[]>([]);
    const [knownProductAliases, setKnownProductAliases] = useState<any[]>([]); 
    const [hasChanges, setHasChanges] = useState(false);

    // --- EFFECTS ---
    // Initialize from props if provided (The "Step 1.5" flow)
    useEffect(() => {
        if (initialData && initialData.length > 0 && step === 'upload') {
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

            // Initialize the master row list
            setRows(objectRows.map((r, i) => ({
                id: i.toString(),
                originalData: r,
                targetText: '', 
                status: 'UNKNOWN',
                manualOverride: false
            })));

            setStep('selectColumn');
        }
    }, [initialData, fileName]);

    // MODE SWITCHER LOGIC
    useEffect(() => {
        if (step === 'upload') return;
        
        const assignedCol = columnMap[cleaningMode];
        if (assignedCol) {
            setStep('analyze');
            handleColumnSelected(assignedCol); 
        } else {
            setStep('selectColumn');
        }
    }, [cleaningMode]);

    // Track changes
    useEffect(() => {
        const changes = rows.some(r => r.manualOverride);
        setHasChanges(changes);
    }, [rows]);

    // Load existing brain
    useEffect(() => {
        const fetchBrain = async () => {
            try {
                const stats = await sampleService.getUniqueSizeStats();
                const aliases = await sampleService.getSizeAliases();
                const prodAliases = await sampleService.getProductAliases();
                setKnownProductAliases(prodAliases || []);

                if (Array.isArray(stats)) {
                    const dbSizes: KnownSize[] = stats.map((s: any) => {
                        const myAliases = aliases.filter(a => a.mappedSize === s.value).map(a => a.aliasText);
                        return { id: s.value, label: s.value, matchers: myAliases };
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

    const handleFileLoaded = (data: ExcelSheetData) => {
        setSheetData(data);
        setStep('selectColumn');
    };

    const handleColumnSelected = (colKey: string) => {
        if (!sheetData) return;
        
        setColumnMap(prev => ({ ...prev, [cleaningMode]: colKey }));

        setRows(prevRows => prevRows.map((oldRow, idx) => {
            const rowData = oldRow.originalData;
            const rawText = rowData[colKey]?.toString() || '';
            let extracted = '';
            let isKnown = false;
            
            const rowId = idx.toString();
            if (cleanDataMap[rowId] && cleanDataMap[rowId][colKey]) {
                extracted = cleanDataMap[rowId][colKey];
                isKnown = true;
            } else {
                if (cleaningMode === 'SIZES') {
                    extracted = normalizeSize(rawText);
                    isKnown = knownSizes.some(k => k.label.toLowerCase() === extracted.toLowerCase());
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
                else if (cleaningMode === 'NAMES') {
                    const matchedAlias = knownProductAliases.find(p => p.aliasText.toLowerCase() === rawText.toLowerCase());
                    if (matchedAlias) {
                        extracted = matchedAlias.mappedProductName;
                        isKnown = true;
                    } else {
                        extracted = rawText; 
                        isKnown = false; 
                    }
                }
                else if (cleaningMode === 'PRICES') {
                     const num = parseFloat(rawText.replace(/[^0-9.]/g, ''));
                     if (!isNaN(num)) {
                         extracted = num.toFixed(2);
                         isKnown = true; 
                     } else {
                         extracted = rawText;
                         isKnown = false;
                     }
                }
            }

            return {
                ...oldRow,
                targetText: rawText,
                extractedSize: extracted || null,
                status: isKnown ? 'MATCHED' : 'UNKNOWN',
                manualOverride: false 
            };
        }));

        setStep('analyze');
    };

    const handleFinalExport = () => {
        if (!sheetData) { onClose(); return; }

        const cleanResult = sheetData.rows.map((originalRow, i) => {
            const updates = cleanDataMap[i] || {};
            const finalRow = { ...originalRow };
            
            Object.keys(updates).forEach(colKey => {
                finalRow[colKey] = updates[colKey];
            });
            
            return finalRow;
        });

        onComplete(cleanResult);
        onClose();
    };

    const handleReset = () => {
        if (confirm("Start over with a new file?")) {
            setStep('upload');
            setSheetData(null);
            setColumnMap({ SIZES: null, NAMES: null, PRICES: null });
            setCleanDataMap({});
            setRows([]);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 md:p-8">
            <div className="w-full max-w-6xl h-full max-h-[90vh] bg-surface-container rounded-2xl shadow-2xl overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-200">
                
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

                        {step !== 'upload' && (
                            <div className="hidden md:flex bg-surface-container-highest rounded-lg p-1 border border-outline/10">
                                {(['SIZES', 'NAMES', 'PRICES'] as const).map(mode => (
                                    <button
                                        key={mode}
                                        onClick={() => setCleaningMode(mode)}
                                        className={`flex items-center gap-2 px-4 py-1.5 rounded-md text-sm font-bold transition-all ${
                                            cleaningMode === mode 
                                                ? 'bg-surface-container shadow-sm text-primary' 
                                                : 'text-text-secondary hover:text-text-primary'
                                        }`}
                                    >
                                        {mode.charAt(0) + mode.slice(1).toLowerCase()}
                                        {columnMap[mode] && <Check size={12} className="text-success" />}
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
                    
                        <button onClick={onClose} className="p-2 rounded-full hover:bg-surface-container-highest text-text-secondary transition-colors">
                            <X size={24} />
                        </button>
                    </div>
                </div>

                <div className="flex-1 overflow-auto bg-surface-container p-6">
                    {step === 'upload' && (
                        <div className="h-full flex flex-col items-center justify-center">
                            <CleanerFileUpload onFileSelect={(file) => {
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
                            setRows={(newRowsOrFn) => {
                                setRows(prev => {
                                    const nextRows = typeof newRowsOrFn === 'function' ? newRowsOrFn(prev) : newRowsOrFn;
                                    const currentCol = columnMap[cleaningMode];
                                    if (currentCol) {
                                        setCleanDataMap(prevMap => {
                                            const newMap = { ...prevMap };
                                            nextRows.forEach((r, i) => {
                                                if (r.extractedSize) {
                                                    if (!newMap[i]) newMap[i] = {};
                                                    newMap[i][currentCol] = r.extractedSize;
                                                }
                                            });
                                            return newMap;
                                        });
                                    }
                                    return nextRows;
                                });
                            }}
                            setKnownSizes={setKnownSizes}
                            onExport={handleFinalExport}
                            onReset={handleReset}
                            mode={cleaningMode}
                        />
                    )}
                </div>
            </div>
        </div>
    );
};