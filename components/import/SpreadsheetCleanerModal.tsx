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
    const [cleanerStep, setCleanerStep] = useState<'upload' | 'selectColumn' | 'cleanSizes' | 'cleanNames'>('upload');
    
    const [sheetData, setSheetData] = useState<ExcelSheetData | null>(null);
    
    // WORKBENCH STATE: Map each mode to its selected column
    const [columnMap, setColumnMap] = useState<Record<string, string | null>>({
        description: null, // A single column for all text-based cleaning
    });
    
    // Analysis State (Master Copy)
    const [rows, setRows] = useState<ParsedRow[]>([]);
    
    // WORKBENCH MEMORY: Stores clean values for any column, indexed by Row ID
    const [cleanDataMap, setCleanDataMap] = useState<Record<string, Record<string, string>>>({});
    
    const [knownSizes, setKnownSizes] = useState<KnownSize[]>([]);
    const [knownProductAliases, setKnownProductAliases] = useState<any[]>([]); 
    const [nameMatchers, setNameMatchers] = useState<{searchText: string, resultText: string}[]>([]);
    const [isBrainLoading, setIsBrainLoading] = useState(true);
    const [hasChanges, setHasChanges] = useState(false);

    // --- EFFECTS ---
    // Initialize from props if provided (The "Step 1.5" flow)
    useEffect(() => {
        if (initialData && initialData.length > 0 && cleanerStep === 'upload') {
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
            })));

            setCleanerStep('selectColumn');
        }
    }, [initialData, fileName]);

    // Track changes
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
                // IMPORTANT: Sort by length descending to match more specific names first
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
        // This is now handled by the parent ImportData component's "Step 1.5" logic
    };

    const handleColumnSelected = (colKey: string) => {
        if (!sheetData) return;
        
        setColumnMap({ description: colKey });

        // --- RUN INITIAL SIZE SCAN ---
        setRows(prevRows => prevRows.map((oldRow, idx) => {
            const rowData = oldRow.originalData;
            const rawText = rowData[colKey]?.toString() || '';
            
            let extracted = oldRow.extractedSize || normalizeSize(rawText);
            let status: 'MATCHED' | 'UNKNOWN' | 'NEW' = oldRow.sizeStatus || 'UNKNOWN';

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
                sizeStatus: status,
                // Also populate name text for the next step
                nameTargetText: rawText
            };
        }));

        setCleanerStep('cleanSizes');
    };

    const handleNextFromSizes = () => {
        const colKey = columnMap.description;
        if (!colKey) return;

        // --- RUN INITIAL NAME SCAN ---
        setRows(prevRows => prevRows.map(oldRow => {
            const rawText = oldRow.originalData[colKey]?.toString() || '';
            let extracted = oldRow.extractedName || rawText.trim();
            let status: 'MATCHED' | 'UNKNOWN' | 'NEW' = oldRow.nameStatus || 'UNKNOWN';

            if (status === 'UNKNOWN') {
                const cleanRawText = rawText.trim().toLowerCase();
                const bestMatch = nameMatchers.find(m => cleanRawText.includes(m.searchText));
                if (bestMatch) {
                    extracted = bestMatch.resultText;
                    status = 'MATCHED';
                }
            }
            return { ...oldRow, extractedName: extracted, nameStatus: status };
        }));

        setCleanerStep('cleanNames');
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
            setCleanerStep('upload');
            setSheetData(null);
            setColumnMap({ description: null });
            setCleanDataMap({});
            setRows([]);
        }
    };

    const renderHeader = () => {
        const getStepTitle = () => {
            switch (cleanerStep) {
                case 'upload': return "Step 1: Upload your messy vendor file.";
                case 'selectColumn': return "Step 2: Identify the description column.";
                case 'cleanSizes': return "Step 3: Clean & verify product sizes.";
                case 'cleanNames': return "Step 4: Clean & verify product names.";
                default: return "";
            }
        };

        return (
            <div className="flex items-center justify-between p-6 border-b border-outline/10 bg-surface-container-high">
                <div>
                    <h2 className="text-2xl font-bold text-text-primary">Spreadsheet Cleaner</h2>
                    <p className="text-text-secondary text-sm">{getStepTitle()}</p>
                </div>
                <div className="flex items-center gap-3">
                    {cleanerStep === 'cleanSizes' && (
                        <button onClick={handleNextFromSizes} className="flex items-center gap-2 px-5 py-2.5 rounded-full font-bold bg-primary text-on-primary hover:bg-primary-hover shadow-md transition-all">
                            Next: Clean Names <ArrowRight size={18} />
                        </button>
                    )}
                    {cleanerStep === 'cleanNames' && (
                        <button onClick={handleFinalExport} className="flex items-center gap-2 px-5 py-2.5 rounded-full font-bold bg-primary text-on-primary hover:bg-primary-hover shadow-md transition-all">
                            Finish Cleaning <Check size={18} />
                        </button>
                    )}
                    <button onClick={onClose} className="p-2 rounded-full hover:bg-surface-container-highest text-text-secondary transition-colors">
                        <X size={24} />
                    </button>
                </div>
            </div>
        );
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 md:p-8">
            <div className="w-full max-w-6xl h-full max-h-[90vh] bg-surface-container rounded-2xl shadow-2xl overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-200">
                
                {renderHeader()}

                <div className="flex-1 overflow-auto bg-surface-container p-6">
                    {cleanerStep === 'upload' && (
                        <div className="h-full flex flex-col items-center justify-center">
                            <CleanerFileUpload onFileSelect={(file) => {
                                import('../../services/spreadsheetService').then(({ readExcelFile }) => {
                                    readExcelFile(file).then(handleFileLoaded).catch(err => alert(err.message));
                                });
                            }} />
                        </div>
                    )}

                    {cleanerStep === 'selectColumn' && sheetData && (
                        <CleanerColumnSelector 
                            data={sheetData} 
                            onConfirm={handleColumnSelected}
                            onBack={() => setCleanerStep('upload')}
                            isBrainLoading={isBrainLoading}
                        />
                    )}

                    {cleanerStep === 'cleanSizes' && (
                        <CleanerAnalysisTable 
                            rows={rows}
                            knownSizes={knownSizes}
                            setRows={(newRowsOrFn) => {
                                setRows(prev => {
                                    const nextRows = typeof newRowsOrFn === 'function' ? newRowsOrFn(prev) : newRowsOrFn;
                                    const currentCol = columnMap.description;
                                    if (currentCol) {
                                        setCleanDataMap(prevMap => {
                                            let newMap = { ...prevMap };
                                            nextRows.forEach((r) => {
                                                const key = r.id;
                                                if (!newMap[key]) newMap[key] = {};
                                                if (r.extractedSize) {
                                                    newMap[key][currentCol] = r.extractedSize;
                                                }
                                            });
                                            return newMap;
                                        });
                                    }
                                    return nextRows;
                                });
                            }}
                            setKnownSizes={setKnownSizes}
                            onExport={handleNextFromSizes}
                            onReset={handleReset}
                            mode={'SIZES'}
                            knownProductAliases={knownProductAliases}
                        />
                    )}

                    {cleanerStep === 'cleanNames' && (
                        <CleanerAnalysisTable 
                            rows={rows}
                            knownSizes={knownSizes}
                            setRows={(newRowsOrFn) => {
                                setRows(prev => {
                                    const nextRows = typeof newRowsOrFn === 'function' ? newRowsOrFn(prev) : newRowsOrFn;
                                    const currentCol = columnMap.description;
                                    if (currentCol) {
                                        setCleanDataMap(prevMap => {
                                            let newMap = { ...prevMap };
                                            nextRows.forEach((r) => {
                                                const key = r.id;
                                                if (!newMap[key]) newMap[key] = {};
                                                if (r.extractedName) {
                                                    newMap[key][currentCol] = r.extractedName;
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
                            mode={'NAMES'}
                            knownProductAliases={knownProductAliases}
                        />
                    )}
                </div>
            </div>
        </div>
    );
};