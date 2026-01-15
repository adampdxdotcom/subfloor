import React, { useState } from 'react';
import FileUploader from '../components/import/FileUploader';
import ColumnMapper from '../components/import/ColumnMapper';
import ImportReview from '../components/import/ImportReview';
import { CheckCircle2 } from 'lucide-react';
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
    const [importDefaults, setImportDefaults] = useState<any>({}); 

    // --- HANDLERS ---
    const handleDataLoaded = (data: any[][], name: string) => {
        setRawData(data);
        setFileName(name);
        setStep(2); // Proceed to Mapping
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
                        <FileUploader onDataLoaded={handleDataLoaded} />
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
        </div>
    );
};

export default ImportData;