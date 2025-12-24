import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useProjectFiles, useFileMutations, ProjectFile } from '../hooks/usePhotos'; // Updated hook
import { Camera, Trash2, X, Maximize2, CheckCircle2, Move, ChevronLeft, ChevronRight, FileText, Download, File as FileIcon, Image as ImageIcon } from 'lucide-react';
import { Project } from '../types';
import { toast } from 'react-hot-toast';

interface ProjectFilesSectionProps {
    project: Project;
}

const ProjectFilesSection: React.FC<ProjectFilesSectionProps> = ({ project }) => {
    const { data: allFiles = [], isLoading } = useProjectFiles('PROJECT', project.id);
    const { uploadFiles, deleteFile } = useFileMutations('PROJECT', project.id);
    
    const [activeTab, setActiveTab] = useState<'SITE' | 'DOCUMENT'>('SITE');
    const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
    const [isSelectMode, setIsSelectMode] = useState(false);
    const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Filter list based on active tab
    // Safety check: Ensure allFiles is an array before filtering
    const displayedFiles = (Array.isArray(allFiles) ? allFiles : []).filter((f: ProjectFile) => {
        const cat = f.category || 'SITE'; // Default to SITE for old data
        return cat === activeTab;
    });

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            const toastId = toast.loading(`Uploading ${activeTab === 'SITE' ? 'photos' : 'documents'}...`);
            try {
                await uploadFiles.mutateAsync({
                    files: e.target.files,
                    category: activeTab
                });
                toast.success("Upload complete!", { id: toastId });
            } catch (err) {
                toast.error("Upload failed.", { id: toastId });
            }
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    const toggleSelection = (id: number) => {
        setSelectedIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const handleDeleteSelected = async () => {
        if (!window.confirm(`Delete ${selectedIds.size} items?`)) return;
        const toastId = toast.loading("Deleting...");
        try {
            await Promise.all(Array.from(selectedIds).map(id => deleteFile.mutateAsync(id)));
            toast.success("Deleted!", { id: toastId });
            setSelectedIds(new Set());
            setIsSelectMode(false);
        } catch (error) {
            toast.error("Delete failed.", { id: toastId });
        }
    };

    // --- LIGHTBOX NAVIGATION ---
    const photosOnly = displayedFiles; // Only valid for SITE tab currently
    
    const handlePhotoClick = (file: ProjectFile, index: number) => {
        if (isSelectMode) {
            toggleSelection(file.id);
        } else if (activeTab === 'SITE') {
            setLightboxIndex(index);
        } else {
            // For documents, open in new tab
            window.open(file.url, '_blank');
        }
    };

    const handlePrev = useCallback((e?: React.MouseEvent) => {
        e?.stopPropagation();
        setLightboxIndex(prev => (prev !== null && prev > 0 ? prev - 1 : photosOnly.length - 1));
    }, [photosOnly.length]);

    const handleNext = useCallback((e?: React.MouseEvent) => {
        e?.stopPropagation();
        setLightboxIndex(prev => (prev !== null && prev < photosOnly.length - 1 ? prev + 1 : 0));
    }, [photosOnly.length]);

    useEffect(() => {
        if (lightboxIndex === null) return;
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'ArrowLeft') handlePrev();
            if (e.key === 'ArrowRight') handleNext();
            if (e.key === 'Escape') setLightboxIndex(null);
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [lightboxIndex, handlePrev, handleNext]);

    return (
        <div className="bg-surface rounded-lg shadow-sm border border-border h-full flex flex-col overflow-hidden">
            {/* Standard Widget Header */}
            <div className="p-3 border-b border-border bg-background/50 flex justify-between items-center shrink-0">
                <div className="flex items-center gap-2">
                    <Move size={16} className="drag-handle text-text-tertiary cursor-move hover:text-text-primary shrink-0" />
                    <h3 className="font-bold text-text-primary flex items-center gap-2">
                        <ImageIcon size={18} /> Project Files
                    </h3>
                </div>
            </div>

            {/* Toolbar (Tabs & Actions) */}
            <div className="border-b border-border bg-background shrink-0">
                <div className="flex justify-between items-center px-3 py-2">
                    {/* Tabs */}
                    <div className="flex space-x-4">
                            <button
                                onClick={() => { setActiveTab('SITE'); setIsSelectMode(false); }}
                                className={`text-sm font-bold transition-colors flex items-center gap-2 ${
                                    activeTab === 'SITE' ? 'text-primary' : 'text-text-secondary hover:text-text-primary'
                                }`}
                            >
                                <Camera size={16} /> Site Photos
                            </button>
                            <button
                                onClick={() => { setActiveTab('DOCUMENT'); setIsSelectMode(false); }}
                                className={`text-sm font-bold transition-colors flex items-center gap-2 ${
                                    activeTab === 'DOCUMENT' ? 'text-primary' : 'text-text-secondary hover:text-text-primary'
                                }`}
                            >
                                <FileText size={16} /> Documents
                            </button>
                    </div>
                    
                    <div className="flex gap-2">
                        {isSelectMode ? (
                            <>
                                <button onClick={handleDeleteSelected} disabled={selectedIds.size === 0} className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded disabled:opacity-50">Delete ({selectedIds.size})</button>
                                <button onClick={() => { setIsSelectMode(false); setSelectedIds(new Set()); }} className="px-3 py-1 bg-secondary text-on-secondary text-xs font-bold rounded">Cancel</button>
                            </>
                        ) : (
                            <>
                                {displayedFiles.length > 0 && (
                                    <button onClick={() => setIsSelectMode(true)} className="px-3 py-1 text-xs font-medium text-text-secondary hover:text-text-primary hover:bg-border/50 rounded">Select</button>
                                )}
                                <button onClick={() => fileInputRef.current?.click()} className="flex items-center gap-1 px-3 py-1 bg-primary text-on-primary text-xs font-bold rounded hover:bg-primary-hover shadow-sm">
                                    {activeTab === 'SITE' ? <Camera size={14} /> : <FileText size={14} />} Add
                                </button>
                            </>
                        )}
                    </div>
                </div>
                <input 
                    type="file" 
                    multiple 
                    accept={activeTab === 'SITE' ? "image/*" : ".pdf,.doc,.docx,.xls,.xlsx,image/*"} 
                    className="hidden" 
                    ref={fileInputRef} 
                    onChange={handleFileChange} 
                />
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-y-auto p-3">
                {isLoading ? (
                    <div className="text-center py-8 text-text-secondary text-xs">Loading...</div>
                ) : displayedFiles.length === 0 ? (
                    <div 
                        onClick={() => fileInputRef.current?.click()}
                        className="h-full flex flex-col items-center justify-center text-text-tertiary cursor-pointer hover:bg-background/50 border-2 border-dashed border-border rounded-lg transition-colors p-4"
                    >
                        {activeTab === 'SITE' ? <Camera size={32} className="mb-2 opacity-50" /> : <FileText size={32} className="mb-2 opacity-50" />}
                        <span className="text-sm font-medium">No {activeTab === 'SITE' ? 'photos' : 'documents'} yet</span>
                        <span className="text-xs">Click to upload</span>
                    </div>
                ) : activeTab === 'SITE' ? (
                    // --- PHOTO GRID VIEW ---
                    <div className="grid grid-cols-3 gap-2">
                        {displayedFiles.map((file: ProjectFile, index: number) => {
                            const isSelected = selectedIds.has(file.id);
                            return (
                                <div 
                                    key={file.id} 
                                    onClick={() => handlePhotoClick(file, index)}
                                    className={`relative aspect-square rounded overflow-hidden cursor-pointer group border-2 transition-all ${isSelected ? 'border-primary ring-2 ring-primary/50' : 'border-transparent hover:border-border'}`}
                                >
                                    <img src={file.thumbnailUrl || file.url} alt="Project Site" className="w-full h-full object-cover" loading="lazy" />
                                    {isSelectMode && (
                                        <div className={`absolute top-1 right-1 rounded-full bg-white p-0.5 ${isSelected ? 'text-primary' : 'text-gray-300'}`}>
                                            <CheckCircle2 size={16} fill={isSelected ? "currentColor" : "none"} />
                                        </div>
                                    )}
                                    {!isSelectMode && (
                                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                                            <Maximize2 className="text-white drop-shadow-md" size={20} />
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                ) : (
                    // --- DOCUMENT LIST VIEW ---
                    <div className="space-y-2">
                        {displayedFiles.map((file: ProjectFile) => {
                            const isSelected = selectedIds.has(file.id);
                            const isPdf = file.mimeType?.includes('pdf') || file.url.endsWith('.pdf');
                            const isImage = file.mimeType?.includes('image') || file.thumbnailUrl;

                            return (
                                <div 
                                    key={file.id}
                                    onClick={() => isSelectMode ? toggleSelection(file.id) : window.open(file.url, '_blank')}
                                    className={`flex items-center p-3 rounded-lg border transition-all cursor-pointer ${
                                        isSelected ? 'border-primary bg-primary/5' : 'border-border bg-background hover:border-primary/50'
                                    }`}
                                >
                                    {/* Icon */}
                                    <div className="w-10 h-10 rounded bg-surface border border-border flex items-center justify-center mr-3 text-text-secondary shrink-0 overflow-hidden">
                                        {isImage ? (
                                            <img src={file.thumbnailUrl || file.url} className="w-full h-full object-cover" />
                                        ) : (
                                            <FileIcon size={20} className={isPdf ? 'text-red-500' : 'text-blue-500'} />
                                        )}
                                    </div>
                                    
                                    {/* Details */}
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium text-text-primary truncate">{file.fileName || 'Untitled Document'}</p>
                                        <p className="text-xs text-text-tertiary">{new Date(file.createdAt).toLocaleDateString()}</p>
                                    </div>

                                    {/* Actions */}
                                    {isSelectMode ? (
                                        <div className={`shrink-0 ${isSelected ? 'text-primary' : 'text-gray-300'}`}>
                                            <CheckCircle2 size={20} fill={isSelected ? "currentColor" : "none"} />
                                        </div>
                                    ) : (
                                        <button className="p-2 text-text-tertiary hover:text-primary transition-colors">
                                            <Download size={16} />
                                        </button>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Lightbox Modal (Photos Only) */}
            {lightboxIndex !== null && activeTab === 'SITE' && createPortal(
                <div 
                    className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center p-4 backdrop-blur-sm"
                    onClick={() => setLightboxIndex(null)}
                >
                    <button className="absolute top-4 right-4 text-white/70 hover:text-white bg-white/10 hover:bg-white/20 p-2 rounded-full transition-colors" onClick={() => setLightboxIndex(null)}><X size={24} /></button>
                    {photosOnly.length > 1 && <button className="absolute left-4 top-1/2 -translate-y-1/2 text-white/70 hover:text-white bg-white/10 hover:bg-white/20 p-2 rounded-full" onClick={handlePrev}><ChevronLeft size={32} /></button>}
                    
                    <img src={photosOnly[lightboxIndex].url} alt="Full View" className="max-w-full max-h-full rounded shadow-2xl" onClick={(e) => e.stopPropagation()} />
                    
                    {photosOnly.length > 1 && <button className="absolute right-4 top-1/2 -translate-y-1/2 text-white/70 hover:text-white bg-white/10 hover:bg-white/20 p-2 rounded-full" onClick={handleNext}><ChevronRight size={32} /></button>}
                    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-white/50 text-sm">{lightboxIndex + 1} / {photosOnly.length}</div>
                </div>,
                document.body
            )}
        </div>
    );
};

export default ProjectFilesSection;