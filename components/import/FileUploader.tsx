import React, { useState, useCallback } from 'react';
import * as XLSX from 'xlsx';
import { Upload, FileSpreadsheet, X, Trash2, ArrowDown } from 'lucide-react';
import { toast } from 'react-hot-toast';

interface FileUploaderProps {
    onDataLoaded: (data: any[][], fileName: string) => void;
}

const FileUploader: React.FC<FileUploaderProps> = ({ onDataLoaded }) => {
    const [dragActive, setDragActive] = useState(false);
    const [previewData, setPreviewData] = useState<any[][] | null>(null);
    const [fileName, setFileName] = useState<string | null>(null);

    // --- FILE PARSING LOGIC ---
    const processFile = (file: File) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = e.target?.result;
                const workbook = XLSX.read(data, { type: 'binary' });
                const sheetName = workbook.SheetNames[0];
                const sheet = workbook.Sheets[sheetName];
                
                // Parse to 2D Array (Array of Arrays)
                // header: 1 ensures we get raw rows, not object keys
                const jsonData = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[][];

                if (jsonData.length === 0) {
                    toast.error("File appears to be empty.");
                    return;
                }

                setPreviewData(jsonData);
                setFileName(file.name);
                
                // Don't auto-submit yet, let user clean data first
            } catch (err) {
                console.error(err);
                toast.error("Failed to parse file. Make sure it is a valid Excel or CSV.");
            }
        };
        reader.readAsBinaryString(file);
    };

    // --- EVENT HANDLERS ---
    const handleDrag = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.type === "dragenter" || e.type === "dragover") {
            setDragActive(true);
        } else if (e.type === "dragleave") {
            setDragActive(false);
        }
    }, []);

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setDragActive(false);
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            processFile(e.dataTransfer.files[0]);
        }
    }, []);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        e.preventDefault();
        if (e.target.files && e.target.files[0]) {
            processFile(e.target.files[0]);
        }
    };

    // --- STAGING TOOLS ---
    const removeTopRow = () => {
        if (!previewData || previewData.length === 0) return;
        setPreviewData(prev => prev ? prev.slice(1) : []);
    };

    const handleConfirm = () => {
        if (previewData && fileName) {
            onDataLoaded(previewData, fileName);
        }
    };

    const handleReset = () => {
        setPreviewData(null);
        setFileName(null);
    };

    // --- RENDER: EMPTY STATE ---
    if (!previewData) {
        return (
            <div 
                className={`relative border-2 border-dashed rounded-xl p-12 text-center transition-colors ${
                    dragActive ? "border-indigo-500 bg-indigo-50" : "border-gray-300 bg-gray-50"
                }`}
                onDragEnter={handleDrag} 
                onDragLeave={handleDrag} 
                onDragOver={handleDrag} 
                onDrop={handleDrop}
            >
                <input 
                    type="file" 
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" 
                    onChange={handleChange}
                    accept=".csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel"
                />
                <div className="flex flex-col items-center justify-center space-y-4 pointer-events-none">
                    <div className="p-4 bg-white rounded-full shadow-sm">
                        <Upload className="w-8 h-8 text-indigo-500" />
                    </div>
                    <div>
                        <p className="text-lg font-medium text-gray-900">Click to upload or drag and drop</p>
                        <p className="text-sm text-gray-500">Excel (.xlsx) or CSV files</p>
                    </div>
                </div>
            </div>
        );
    }

    // --- RENDER: STAGING TABLE ---
    return (
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden flex flex-col h-[600px]">
            {/* Toolbar */}
            <div className="p-4 border-b border-gray-200 bg-gray-50 flex justify-between items-center">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-green-100 text-green-700 rounded-lg">
                        <FileSpreadsheet size={20} />
                    </div>
                    <div>
                        <h3 className="font-bold text-gray-900">{fileName}</h3>
                        <p className="text-xs text-gray-500">{previewData.length} rows detected</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <button 
                        onClick={removeTopRow}
                        className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-red-600 bg-red-50 hover:bg-red-100 rounded-md transition-colors"
                        title="Delete the header row"
                    >
                        <Trash2 size={16} /> Remove Top Row
                    </button>
                    <div className="h-6 w-px bg-gray-300 mx-2"></div>
                    <button 
                        onClick={handleReset}
                        className="text-gray-500 hover:text-gray-700 px-3 py-1.5 text-sm"
                    >
                        Cancel
                    </button>
                    <button 
                        onClick={handleConfirm}
                        className="flex items-center gap-2 px-4 py-1.5 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 shadow-sm font-medium"
                    >
                        Next: Map Columns <ArrowDown size={16} />
                    </button>
                </div>
            </div>

            {/* Scrollable Preview Grid */}
            <div className="flex-1 overflow-auto bg-gray-50 p-4">
                <div className="bg-white shadow-sm border border-gray-300">
                    <table className="w-full text-left border-collapse text-sm">
                        <thead>
                            <tr>
                                <th className="p-2 bg-gray-100 border-b border-gray-300 w-12 text-center text-xs text-gray-500 font-mono">#</th>
                                {previewData[0].map((_, i) => (
                                    <th key={i} className="p-2 bg-gray-100 border-b border-r border-gray-300 font-mono text-xs text-gray-500 font-normal min-w-[100px]">
                                        Column {String.fromCharCode(65 + i)}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {previewData.slice(0, 20).map((row, rIdx) => (
                                <tr key={rIdx} className="hover:bg-indigo-50 transition-colors">
                                    <td className="p-2 border-b border-gray-200 bg-gray-50 text-center text-xs text-gray-400 select-none">{rIdx + 1}</td>
                                    {row.map((cell: any, cIdx: number) => (
                                        <td key={cIdx} className="p-2 border-b border-r border-gray-200 text-gray-700 whitespace-nowrap overflow-hidden text-ellipsis max-w-[200px]">
                                            {cell !== null && cell !== undefined ? String(cell) : <span className="text-gray-300 italic">null</span>}
                                        </td>
                                    ))}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    {previewData.length > 20 && (
                        <div className="p-2 text-center text-xs text-gray-500 bg-gray-50 border-t border-gray-200 italic">
                            ... {previewData.length - 20} more rows hidden ...
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default FileUploader;