import React, { useState, useEffect } from 'react';
import { X, Check, ArrowRight } from 'lucide-react';
import * as sampleService from '../../services/sampleService'; // Use the shared service
import { CleanerFileUpload } from './cleaner/CleanerFileUpload';
import { CleanerColumnSelector } from './cleaner/CleanerColumnSelector';
import { CleanerAnalysisTable } from './cleaner/CleanerAnalysisTable';
import { ExcelSheetData, ParsedRow, KnownSize } from '../../types';
import { normalizeSize } from '../../services/spreadsheetService';

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
    const [cleanDataMap, setCleanDataMap] = useState<Record<string, Record<string, string>>>({});
    
    const [knownSizes, setKnownSizes] = useState<KnownSize[]>([]);
    const [knownProductAliases, setKnownProductAliases] = useState<any[]>([]); 
    const [nameMatchers, setNameMatchers] = useState<{searchText: string, resultText: string}[]>([]);
    const [isBrainLoading, setIsBrainLoading] = useState(true); // NEW: Loading state for the "brain"
    const [hasChanges, setHasChanges] = useState(false);

    // --- EFFECTS ---
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

            setRows(objectRows.map((r, i) => ({
                id: i.toString(),
                originalData: r,
                sizeStatus: 'UNKNOWN',
                nameStatus: 'UNKNOWN',
                manualOverride: false
            })));

            setStep('selectColumn');
        }
    }, [initialData, fileName]);

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

    useEffect(() => {
        const changes = rows.some(r => r.manualOverride);
        setHasChanges(changes);
    }, [rows]);

    // Load existing brain
    useEffect(() => {
        const fetchBrain = async () => {
            setIsBrainLoading(true);
            try {
                const stats = await sampleService.getUniqueSizeStats();
                const aliases = await sampleService.getSizeAliases();
                const prodAliases = await sampleService.getProductAliases();
                const prodNames = await sampleService.getAllProductNames();

                setKnownProductAliases(prodAliases || []);

                // Build the smart name matcher list for auto-scanning
                const matchers = prodAliases.map(a => ({
                    searchText: a.aliasText.toLowerCase(),
                    resultText: a.mappedProductName
                }));
                prodNames.forEach(name => {
                    matchers.push({ searchText: name.toLowerCase(), resultText: name });
                });
                // IMPORTANT: Sort by length descending to match more specific names first (e.g., "Coretec Pro" before "Coretec")
                matchers.sort((a, b) => b.searchText.length - a.searchText.length); 
                setNameMatchers(matchers);

                if (Array.isArray(stats)) {
                    const dbSizes: KnownSize[] = stats.map((s: any) => {
                        const myAliases = aliases.filter(a => a.mappedSize === s.value).map(a => a.aliasText);
                        return { id: s.value, label: s.value, matchers: myAliases };
                    });
                    setKnownSizes(dbSizes);
                }
            } catch (err) {
                console.error("Failed to load cleaner brain:", err);
            } finally {
                setIsBrainLoading(false);
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
            let status: 'MATCHED' | 'UNKNOWN' | 'NEW' = 'UNKNOWN';
            
            if (cleaningMode === 'SIZES') {
                extracted = oldRow.extractedSize || normalizeSize(rawText);
                status = oldRow.sizeStatus || 'UNKNOWN';

                if (status === 'UNKNOWN') { 
                    const isKnownExact = knownSizes.some(k => k.label.toLowerCase() === extracted.toLowerCase());
                    if (isKnownExact) {
                        status = 'MATCHED';
                    } else {
                        const bestAlias = knownSizes.find(k => k.matchers?.some(alias => rawText.toLowerCase().includes(alias.toLowerCase())));
                        if (bestAlias) {
                            extracted = bestAlias.label;
                            status = 'MATCHED';
                        }
                    }
                }
                return {
                    ...oldRow,
                    sizeTargetText: rawText,
                    extractedSize: extracted,
                    sizeStatus: status
                };
            } 
            else if (cleaningMode === 'NAMES') {
                extracted = oldRow.extractedName || rawText.trim();
                status = oldRow.nameStatus || 'UNKNOWN';

                if (status === 'UNKNOWN') {
                    const cleanRawText = rawText.trim().toLowerCase();
                    const aliasMatch = knownProductAliases.find(p => p.aliasText.toLowerCase() === cleanRawText);
                    
                    if (aliasMatch) {
                        extracted = aliasMatch.mappedProductName;
                        status = 'MATCHED';
                    } else {
                        // Apply smart name matcher logic
                        const bestMatch = nameMatchers.find(m => cleanRawText.includes(m.searchText));
                        if (bestMatch) {
                            extracted = bestMatch.resultText;
                            status = 'MATCHED';
                        }
                    }
                }
                return {
                    ...oldRow,
                    nameTargetText: rawText,
                    extractedName: extracted,
                    nameStatus: status
                };
            }
            else if (cleaningMode === 'PRICES') {
                 const num = parseFloat(rawText.replace(/[^0-9.]/g, ''));
                 if (!isNaN(num)) {
                     extracted = num.toFixed(2);
                     status = 'MATCHED'; 
                 } else {
                     extracted = rawText;
                     status = 'UNKNOWN';
                }
                return {
                    ...oldRow,
                    priceTargetText: rawText,
                    extractedPrice: extracted,
                    priceStatus: status
                };
            }

            return oldRow; 
        }));

        setStep('analyze');
    };

    const handleFinalExport = () => {
        if (!sheetData) { onClose(); return; }

        const cleanResult = sheetData.rows.map((originalRow, i) => {
            const updates = cleanDataMap[i.toString()] || {};
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
                            isBrainLoading={isBrainLoading}
                        />
                    )}

                    {step === 'analyze' && (
                        <CleanerAnalysisTable 
                            rows={rows}
                            knownSizes={knownSizes}
                            knownProductAliases={knownProductAliases}
                            setRows={(newRowsOrFn) => {
                                setRows(prev => {
                                    const nextRows = typeof newRowsOrFn === 'function' ? newRowsOrFn(prev) : newRowsOrFn;
                                    const currentCol = columnMap[cleaningMode];
                                    if (currentCol) {
                                        setCleanDataMap(prevMap => {
                                            let newMap = { ...prevMap };
                                            nextRows.forEach((r) => {
                                                const key = r.id;
                                                if (!newMap[key]) newMap[key] = {};
                                                if (cleaningMode === 'SIZES' && r.extractedSize) {
                                                    newMap[key][currentCol] = r.extractedSize;
                                                } else if (cleaningMode === 'NAMES' && r.extractedName) {
                                                    newMap[key][currentCol] = r.extractedName;
                                                } else if (cleaningMode === 'PRICES' && r.extractedPrice) {
                                                    newMap[key][currentCol] = r.extractedPrice;
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