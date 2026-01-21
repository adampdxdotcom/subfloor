import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import * as sampleService from '../../services/sampleService'; // Use the shared service
import { CleanerFileUpload } from './cleaner/CleanerFileUpload';
import { CleanerColumnSelector } from './cleaner/CleanerColumnSelector';
import { CleanerAnalysisTable } from './cleaner/CleanerAnalysisTable';
import { ExcelSheetData, ParsedRow, KnownSize } from '../../types';
import { getCleanedCsvData, normalizeSize } from '../../services/spreadsheetService';

interface SpreadsheetCleanerModalProps {
    onClose: () => void;
    onComplete: (cleanedData: any[]) => void;
}

export const SpreadsheetCleanerModal: React.FC<SpreadsheetCleanerModalProps> = ({ onClose, onComplete }) => {
    // --- STATE ---
    const [step, setStep] = useState<'upload' | 'selectColumn' | 'analyze'>('upload');
    const [sheetData, setSheetData] = useState<ExcelSheetData | null>(null);
    const [targetColumn, setTargetColumn] = useState<string | null>(null);
    
    // Analysis State
    const [rows, setRows] = useState<ParsedRow[]>([]);
    const [knownSizes, setKnownSizes] = useState<KnownSize[]>([]);

    // --- EFFECTS ---
    // Load existing sizes AND aliases from DB on mount
    useEffect(() => {
        const fetchBrain = async () => {
            try {
                // 1. Fetch Clean Sizes (e.g. "12x24")
                const stats = await sampleService.getUniqueSizeStats();
                
                // 2. Fetch Aliases (e.g. "M122" -> "12x24")
                const aliases = await sampleService.getSizeAliases();

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
            
            // Try simple normalization (e.g. "12 x 24" -> "12x24")
            let extracted = normalizeSize(rawText);
            
            // Check if this initial guess is a Known Size
            let isKnown = knownSizes.some(k => k.label.toLowerCase() === extracted.toLowerCase());

            // INTELLIGENCE CHECK:
            // If the simple guess failed to find a match, check our Aliases/Matchers against the RAW text.
            // This ensures "7.09 X 48.03" triggers the alias even if normalizeSize changed it to "7.09x48.03"
            if (!isKnown) {
                for (const known of knownSizes) {
                    // Check if any alias exists inside this text
                    if (known.matchers?.some(alias => rawText.toLowerCase().includes(alias.toLowerCase()))) {
                        extracted = known.label;
                        isKnown = true;
                        break;
                    }
                }
            }

            return {
                id: idx.toString(),
                originalData: row,
                targetText: rawText,
                extractedSize: extracted || null, 
                // It is MATCHED only if it is a Known Size (either by direct match or alias lookup)
                status: isKnown ? 'MATCHED' : 'UNKNOWN',
                manualOverride: false
            };
        });

        setRows(initialRows);
        setStep('analyze');
    };

    // Step 3 Completion
    const handleFinalExport = () => {
        if (!targetColumn) return;
        
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
                    <div>
                        <h2 className="text-2xl font-bold text-text-primary">Spreadsheet Cleaner</h2>
                        <p className="text-text-secondary text-sm">
                            {step === 'upload' && "Step 1: Upload your messy vendor file."}
                            {step === 'selectColumn' && "Step 2: Identify the description column."}
                            {step === 'analyze' && "Step 3: Teach the system how to read sizes."}
                        </p>
                    </div>
                    <button 
                        onClick={onClose}
                        className="p-2 rounded-full hover:bg-surface-container-highest text-text-secondary transition-colors"
                    >
                        <X size={24} />
                    </button>
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
                        />
                    )}
                </div>
            </div>
        </div>
    );
};