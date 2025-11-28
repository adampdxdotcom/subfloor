import React, { useState } from 'react';
import { useData } from '../context/DataContext';
import FileUploader from '../components/import/FileUploader';
import ColumnMapper from '../components/import/ColumnMapper'; // New Component
import ImportReview from '../components/import/ImportReview'; // New Component
import { Database, ArrowRight, CheckCircle2 } from 'lucide-react';
import { toast } from 'react-hot-toast';
import axios from 'axios';

const ImportData: React.FC = () => {
    // --- STATE ---
    const [step, setStep] = useState<1 | 2 | 3>(1);
    
    // Step 1: Raw Data
    const [rawData, setRawData] = useState<any[][] | null>(null);
    const [fileName, setFileName] = useState<string | null>(null);

    // Step 3: Preview Data
    const [previewResults, setPreviewResults] = useState<any[]>([]);
    const [isProcessing, setIsProcessing] = useState(false);
    const [importStrategy, setImportStrategy] = useState<string>('variant_match');
    const [importDefaults, setImportDefaults] = useState<any>({}); // New State

    // --- HANDLERS ---
    const handleDataLoaded = (data: any[][], name: string) => {
        setRawData(data);
        setFileName(name);
        setStep(2); // Proceed to Mapping
    };

    const handleMappingComplete = async (mappedData: any[], strategy: string) => {
        setIsProcessing(true);
        setImportStrategy(strategy);
        // Note: defaults are set via onDefaultsChange before this function is called if we wire it up right,
        // OR we can pass it as a 3rd arg if we modify ColumnMapper signature again.
        // Let's use the state update approach via the prop we added.
        
        try {
            const res = await axios.post('/api/import/preview', {
                mappedRows: mappedData,
                strategy,
                defaults: importDefaults // Send defaults to backend
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
                previewResults: finalRows, // Send the edited/filtered rows
                strategy: importStrategy,
                defaults: importDefaults // Send defaults again for execution
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
        <div className="max-w-6xl mx-auto p-6 space-y-8">
            
            {/* HEADER */}
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900">Import Inventory</h1>
                    <p className="text-gray-500 mt-1">Upload vendor price lists to update products in bulk.</p>
                </div>
            </div>

            {/* PROGRESS STEPS */}
            <div className="flex items-center justify-between max-w-2xl mx-auto">
                {/* Step 1 */}
                <div className={`flex flex-col items-center ${step >= 1 ? 'text-indigo-600' : 'text-gray-400'}`}>
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold mb-2 ${step >= 1 ? 'bg-indigo-100' : 'bg-gray-100'}`}>
                        {step > 1 ? <CheckCircle2 size={24} /> : '1'}
                    </div>
                    <span className="text-sm font-medium">Upload & Clean</span>
                </div>
                <div className={`flex-1 h-0.5 mx-4 ${step > 1 ? 'bg-indigo-600' : 'bg-gray-200'}`}></div>
                
                {/* Step 2 */}
                <div className={`flex flex-col items-center ${step >= 2 ? 'text-indigo-600' : 'text-gray-400'}`}>
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold mb-2 ${step >= 2 ? 'bg-indigo-100' : 'bg-gray-100'}`}>
                        {step > 2 ? <CheckCircle2 size={24} /> : '2'}
                    </div>
                    <span className="text-sm font-medium">Map Columns</span>
                </div>
                <div className={`flex-1 h-0.5 mx-4 ${step > 2 ? 'bg-indigo-600' : 'bg-gray-200'}`}></div>

                {/* Step 3 */}
                <div className={`flex flex-col items-center ${step >= 3 ? 'text-indigo-600' : 'text-gray-400'}`}>
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold mb-2 ${step >= 3 ? 'bg-indigo-100' : 'bg-gray-100'}`}>
                        3
                    </div>
                    <span className="text-sm font-medium">Review & Import</span>
                </div>
            </div>

            {/* CONTENT AREA */}
            <div className="mt-8">
                {step === 1 && (
                    <FileUploader onDataLoaded={handleDataLoaded} />
                )}

                {step === 2 && (
                    <ColumnMapper 
                        rawData={rawData || []} 
                        fileName={fileName || 'Unknown File'} 
                        onBack={() => setStep(1)}
                        onComplete={handleMappingComplete}
                        isGeneratingPreview={isProcessing}
                        onDefaultsChange={setImportDefaults} // Wire up the setter
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
    );
};

export default ImportData;