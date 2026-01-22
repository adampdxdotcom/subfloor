// src/components/import/FileUploader.tsx

import React, { useState, useCallback } from 'react';
import { Upload } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { readExcelFile } from '../../services/spreadsheetService'; // Import the service helper

interface FileUploaderProps {
    onDataLoaded: (data: any[][], fileName: string) => void;
}

const FileUploader: React.FC<FileUploaderProps> = ({ onDataLoaded }) => {
    const [dragActive, setDragActive] = useState(false);
    const [isParsing, setIsParsing] = useState(false);

    // --- FILE PARSING LOGIC ---
    const processFile = async (file: File) => {
        setIsParsing(true);
        try {
            // Use shared service for consistent parsing
            const data = await readExcelFile(file);
            
            if (!data || data.length === 0) {
                toast.error("File appears to be empty.");
                return;
            }

            // IMMEDIATE HANDOFF - No internal preview
            onDataLoaded(data, file.name);
        } catch (err: any) {
            console.error(err);
            toast.error(err.message || "Failed to parse file.");
        } finally {
            setIsParsing(false);
        }
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

    return (
        <div 
            className={`relative border-2 border-dashed rounded-xl p-12 text-center transition-all ${
                dragActive 
                    ? "border-primary bg-primary-container/20 scale-[1.02]" 
                    : "border-outline/20 bg-surface-container-low hover:bg-surface-container"
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
                disabled={isParsing}
            />
            <div className="flex flex-col items-center justify-center space-y-4 pointer-events-none">
                <div className={`p-4 rounded-full shadow-sm transition-colors ${dragActive ? 'bg-primary-container text-primary' : 'bg-surface-container-high text-primary/70'}`}>
                    <Upload className={`w-8 h-8 ${isParsing ? 'animate-bounce' : ''}`} />
                </div>
                <div>
                    <p className="text-lg font-bold text-text-primary">
                        {isParsing ? "Reading file..." : "Click to upload or drag and drop"}
                    </p>
                    <p className="text-sm text-text-secondary">Excel (.xlsx) or CSV files</p>
                </div>
            </div>
        </div>
    );
};

export default FileUploader;