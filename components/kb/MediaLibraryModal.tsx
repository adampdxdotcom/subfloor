import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Upload, X, Image as ImageIcon, Loader2, FileText } from 'lucide-react';
import { toast } from 'react-hot-toast';

interface MediaLibraryModalProps {
    onClose: () => void;
    onSelect: (url: string) => void;
}

export default function MediaLibraryModal({ onClose, onSelect }: MediaLibraryModalProps) {
    const [tab, setTab] = useState<'upload' | 'library'>('upload');
    const [sourceFilter, setSourceFilter] = useState('KB'); // 'KB' | 'PROJECT' | 'ALL'
    const [images, setImages] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isUploading, setIsUploading] = useState(false);

    useEffect(() => {
        if (tab === 'library') fetchImages();
    }, [tab, sourceFilter]);

    const fetchImages = async () => {
        setIsLoading(true);
        try {
            const res = await axios.get(`/api/kb/images?source=${sourceFilter}`);
            setImages(res.data);
        } catch (e) {
            console.error(e);
        } finally {
            setIsLoading(false);
        }
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const formData = new FormData();
        formData.append('file', file);

        setIsUploading(true);
        try {
            const res = await axios.post('/api/kb/images', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            onSelect(res.data.url); // Immediately insert
        } catch (err) {
            console.error(err);
            toast.error("Upload failed");
        } finally {
            setIsUploading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4" onClick={onClose}>
            <div className="bg-surface border border-border w-full max-w-2xl h-[600px] flex flex-col rounded-xl shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
                
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-border bg-background">
                    <div className="flex gap-4">
                        <button 
                            onClick={() => setTab('upload')}
                            className={`px-3 py-1 text-sm font-bold rounded-full transition-colors ${tab === 'upload' ? 'bg-primary text-on-primary' : 'text-text-secondary hover:bg-surface'}`}
                        >
                            Upload New
                        </button>
                        <button 
                            onClick={() => setTab('library')}
                            className={`px-3 py-1 text-sm font-bold rounded-full transition-colors ${tab === 'library' ? 'bg-primary text-on-primary' : 'text-text-secondary hover:bg-surface'}`}
                        >
                            Library
                        </button>
                    </div>
                    
                    {/* Filter (Only show on Library tab) */}
                    {tab === 'library' && (
                        <select 
                            className="bg-background border border-border rounded px-2 py-1 text-xs"
                            value={sourceFilter}
                            onChange={(e) => setSourceFilter(e.target.value)}
                        >
                            <option value="KB">KB Assets</option>
                            <option value="PROJECT">Job Photos</option>
                            <option value="ALL">All Images</option>
                        </select>
                    )}
                    
                    <button onClick={onClose} className="text-text-secondary hover:text-text-primary"><X size={20} /></button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6 bg-surface">
                    
                    {/* TAB: UPLOAD */}
                    {tab === 'upload' && (
                        <div className="h-full flex flex-col items-center justify-center border-2 border-dashed border-border rounded-xl bg-background/50 hover:bg-background/80 transition-colors">
                            {isUploading ? (
                                <div className="text-center">
                                    <Loader2 className="animate-spin mx-auto mb-2 text-primary" size={48} />
                                    <p className="text-text-secondary font-medium">Optimizing & Uploading...</p>
                                </div>
                            ) : (
                                <label className="cursor-pointer text-center p-12 w-full h-full flex flex-col items-center justify-center">
                                    <div className="bg-primary/10 p-4 rounded-full mb-4 text-primary">
                                        <Upload size={32} />
                                    </div>
                                    <h3 className="text-lg font-bold text-text-primary">Click to Upload</h3>
                                    <p className="text-text-secondary text-sm mt-2">Images, PDFs, Docs supported</p>
                                    <input type="file" className="hidden" accept="*" onChange={handleFileUpload} />
                                </label>
                            )}
                        </div>
                    )}

                    {/* TAB: LIBRARY */}
                    {tab === 'library' && (
                        <div>
                            {isLoading ? (
                                <div className="flex justify-center p-12"><Loader2 className="animate-spin text-primary" /></div>
                            ) : images.length === 0 ? (
                                <div className="text-center py-12 text-text-tertiary">No images found.</div>
                            ) : (
                                <div className="grid grid-cols-3 sm:grid-cols-4 gap-4">
                                    {images.map(img => (
                                        <button 
                                            key={img.id} 
                                            onClick={() => onSelect(img.url)}
                                            className="group relative aspect-square rounded-lg overflow-hidden border border-border hover:border-primary focus:ring-2 ring-primary focus:outline-none"
                                        >
                                            {/* Render Thumbnail or Generic File Icon */}
                                            {img.mimeType?.startsWith('image/') || img.url.match(/\.(jpeg|jpg|gif|png|webp)$/i) ? (
                                                <img src={img.thumbnailUrl || img.url} alt="" className="w-full h-full object-cover transition-transform group-hover:scale-110" />
                                            ) : (
                                                <div className="w-full h-full flex flex-col items-center justify-center bg-surface-hover text-text-secondary">
                                                    <FileText size={48} className="mb-2" />
                                                    <span className="text-xs px-2 text-center truncate w-full">
                                                        {img.fileName || 'Document'}
                                                    </span>
                                                </div>
                                            )}
                                            
                                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                                <span className="text-white text-xs font-bold bg-black/50 px-2 py-1 rounded">Select</span>
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}