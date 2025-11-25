import React, { useState, useRef } from 'react';
import { X, Upload, Link, Image as ImageIcon, Check } from 'lucide-react';
import { toast } from 'react-hot-toast';

interface VariantImageModalProps {
    onClose: () => void;
    onSave: (file: File | null, url: string | null) => void;
    currentPreview?: string | null;
}

const VariantImageModal: React.FC<VariantImageModalProps> = ({ onClose, onSave, currentPreview }) => {
    const [activeTab, setActiveTab] = useState<'upload' | 'url'>('upload');
    const [file, setFile] = useState<File | null>(null);
    const [url, setUrl] = useState<string>('');
    const [preview, setPreview] = useState<string | null>(currentPreview || null);
    
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const selected = e.target.files?.[0];
        if (selected) {
            setFile(selected);
            setPreview(URL.createObjectURL(selected));
            setUrl(''); // Clear URL if file selected
        }
    };

    const handleUrlChange = (val: string) => {
        setUrl(val);
        setPreview(val);
        setFile(null); // Clear file if URL entered
    };

    const handleSave = () => {
        if (!file && !url) {
            toast.error("Please select a file or enter a URL");
            return;
        }
        onSave(file, url);
        onClose();
    };

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4">
            <div className="bg-surface w-full max-w-md rounded-lg shadow-xl overflow-hidden border border-border animate-in fade-in zoom-in-95 duration-200">
                
                {/* Header */}
                <div className="flex justify-between items-center p-4 border-b border-border bg-background">
                    <h3 className="font-bold text-text-primary">Update Variant Image</h3>
                    <button onClick={onClose} className="text-text-secondary hover:text-text-primary">
                        <X size={20} />
                    </button>
                </div>

                {/* Tabs */}
                <div className="flex border-b border-border">
                    <button 
                        onClick={() => setActiveTab('upload')}
                        className={`flex-1 py-3 text-sm font-medium flex items-center justify-center gap-2 ${activeTab === 'upload' ? 'text-primary border-b-2 border-primary bg-primary/5' : 'text-text-secondary hover:bg-surface'}`}
                    >
                        <Upload size={16} /> Upload File
                    </button>
                    <button 
                        onClick={() => setActiveTab('url')}
                        className={`flex-1 py-3 text-sm font-medium flex items-center justify-center gap-2 ${activeTab === 'url' ? 'text-primary border-b-2 border-primary bg-primary/5' : 'text-text-secondary hover:bg-surface'}`}
                    >
                        <Link size={16} /> Image URL
                    </button>
                </div>

                {/* Body */}
                <div className="p-6">
                    {/* Preview Area */}
                    <div className="mb-6 flex justify-center">
                        <div className="w-32 h-32 bg-background border border-border rounded-lg overflow-hidden flex items-center justify-center shadow-inner">
                            {preview ? (
                                <img src={preview} alt="Preview" className="w-full h-full object-cover" />
                            ) : (
                                <ImageIcon className="text-border" size={48} />
                            )}
                        </div>
                    </div>

                    {activeTab === 'upload' ? (
                        <div className="space-y-4">
                            <input 
                                type="file" 
                                ref={fileInputRef}
                                accept="image/*" 
                                onChange={handleFileChange} 
                                className="hidden" 
                            />
                            <button 
                                onClick={() => fileInputRef.current?.click()}
                                className="w-full py-8 border-2 border-dashed border-border hover:border-primary rounded-lg flex flex-col items-center justify-center text-text-secondary hover:text-primary hover:bg-surface transition-colors"
                            >
                                <Upload size={32} className="mb-2 opacity-50" />
                                <span className="text-sm font-medium">{file ? "Change File" : "Click to Upload Image"}</span>
                                {file && <span className="text-xs mt-1 text-primary">{file.name}</span>}
                            </button>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-text-secondary">Image Address (URL)</label>
                            <input 
                                type="text" 
                                placeholder="https://example.com/image.jpg" 
                                value={url}
                                onChange={e => handleUrlChange(e.target.value)}
                                className="w-full p-2 bg-background border border-border rounded focus:border-primary focus:outline-none text-text-primary"
                                autoFocus
                            />
                            <p className="text-xs text-text-tertiary">Paste a direct link to an image file.</p>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-border bg-background flex justify-end gap-3">
                    <button onClick={onClose} className="px-4 py-2 text-text-secondary hover:text-text-primary text-sm">
                        Cancel
                    </button>
                    <button 
                        onClick={handleSave} 
                        disabled={!file && !url}
                        className="px-6 py-2 bg-primary text-text-on-primary rounded text-sm font-medium hover:bg-primary-hover disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                        <Check size={16} /> Apply Image
                    </button>
                </div>
            </div>
        </div>
    );
};

export default VariantImageModal;