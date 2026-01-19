import React, { useRef } from 'react';
import { Upload } from 'lucide-react';
import { toast } from 'react-hot-toast';

interface CleanerFileUploadProps {
  onFileSelect: (file: File) => void;
}

export const CleanerFileUpload: React.FC<CleanerFileUploadProps> = ({ onFileSelect }) => {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      validateAndUpload(e.dataTransfer.files[0]);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      validateAndUpload(e.target.files[0]);
    }
  };

  const validateAndUpload = (file: File) => {
    const validTypes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel'
    ];
    // Simple extension check as fallback
    if (validTypes.includes(file.type) || file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
      onFileSelect(file);
    } else {
      toast.error("Please upload a valid Excel file (.xlsx, .xls)");
    }
  };

  return (
    <div className="flex flex-col items-center justify-center w-full max-w-2xl mx-auto mt-8">
      <div 
        className="w-full p-10 bg-surface-container-high border-2 border-dashed border-outline/20 rounded-2xl hover:border-primary hover:bg-surface-container-highest transition-all cursor-pointer shadow-sm group"
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
      >
        <div className="flex flex-col items-center justify-center space-y-4">
          <div className="p-4 bg-primary-container rounded-full group-hover:brightness-110 transition-colors">
            <Upload className="w-8 h-8 text-primary" />
          </div>
          <div className="text-center">
            <p className="text-xl font-bold text-text-primary">Drop your messy Excel file here</p>
            <p className="text-sm text-text-secondary mt-1">or click to browse (.xlsx, .xls)</p>
          </div>
        </div>
        <input 
          ref={inputRef}
          type="file" 
          className="hidden" 
          accept=".xlsx,.xls"
          onChange={handleChange}
        />
      </div>

      <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4 w-full text-center">
        <div className="bg-surface-container-high p-4 rounded-xl border border-outline/10">
          <div className="font-bold text-text-primary mb-1">1. Upload</div>
          <p className="text-xs text-text-secondary">Import the raw vendor file</p>
        </div>
        <div className="bg-surface-container-high p-4 rounded-xl border border-outline/10">
          <div className="font-bold text-text-primary mb-1">2. Scan</div>
          <p className="text-xs text-text-secondary">Auto-detect sizes from descriptions</p>
        </div>
        <div className="bg-surface-container-high p-4 rounded-xl border border-outline/10">
          <div className="font-bold text-text-primary mb-1">3. Clean</div>
          <p className="text-xs text-text-secondary">Review, standardize, and import</p>
        </div>
      </div>
    </div>
  );
};