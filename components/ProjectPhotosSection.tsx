import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useProjectFiles, useFileMutations, ProjectFile } from '../hooks/usePhotos'; 
import { Camera, Trash2, X, Maximize2, CheckCircle2, Move, ChevronLeft, ChevronRight, FileText, Download, File as FileIcon, Image as ImageIcon } from 'lucide-react';
import { Project } from '../types';
import { toast } from 'react-hot-toast';
import { getImageUrl } from '../utils/apiConfig';

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

    const displayedFiles = (Array.isArray(allFiles) ? allFiles : []).filter((f: ProjectFile) => {
        const cat = f.category || 'SITE'; 
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

    const photosOnly = displayedFiles; 
    
    const handlePhotoClick = (file: ProjectFile, index: number) => {
        if (isSelectMode) {
            toggleSelection(file.id);
        } else if (activeTab === 'SITE') {
            setLightboxIndex(index);
        } else {
            window.open(getImageUrl(file.url), '_blank');
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
        <div className="h-full flex flex-col overflow-hidden">
            {/* Standard Widget Header */}
            <div className="p-4 border-b border-outline/10 flex justify-between items-center shrink-0">
                <div className="flex items-center gap-3">
                    <Move size={20} className="drag-handle text-text-secondary cursor-move hover:text-text-primary shrink-0" />
                    <h3 className="text-xl font-semibold text-text-primary flex items-center gap-2">
                        <ImageIcon size={20} /> Project Files
                    </h3>
                </div>
            </div>

            {/* Toolbar (Tabs & Actions) */}
            <div className="border-b border-outline/10 bg-surface-container-low shrink-0">
                <div className="flex justify-between items-center px-4 py-2">
                    {/* Tabs */}
                    <div className="flex space-x-2 bg-surface-container-highest p-1 rounded-full">
                        <button
                            onClick={() => { setActiveTab('SITE'); setIsSelectMode(false); }}
                            className={`px-3 py-1 rounded-full text-sm font-medium transition-all flex items-center gap-2 ${
                                activeTab === 'SITE' ? 'bg-primary-container text-on-primary-container shadow-sm' : 'text-text-secondary hover:text-text-primary'
                            }`}
                        >
                            <Camera size={16} /> Site Photos
                        </button>
                        <button
                            onClick={() => { setActiveTab('DOCUMENT'); setIsSelectMode(false); }}
                            className={`px-3 py-1 rounded-full text-sm font-medium transition-all flex items-center gap-2 ${
                                activeTab === 'DOCUMENT' ? 'bg-primary-container text-on-primary-container shadow-sm' : 'text-text-secondary hover:text-text-primary'
                            }`}
                        >
                            <FileText size={16} /> Documents
                        </button>
                    </div>
                    
                    <div className="flex items-center gap-2">
                        {isSelectMode ? (
                            <>
                                <button onClick={handleDeleteSelected} disabled={selectedIds.size === 0} className="px-3 py-1.5 bg-error hover:bg-error-hover text-on-error text-xs font-bold rounded-full disabled:opacity-50 transition-colors shadow-sm">Delete ({selectedIds.size})</button>
                                <button onClick={() => { setIsSelectMode(false); setSelectedIds(new Set()); }} className="px-3 py-1.5 border border-outline text-text-primary hover:bg-surface-container-highest text-xs font-bold rounded-full transition-colors">Cancel</button>
                            </>
                        ) : (
                            <>
                                {displayedFiles.length > 0 && (
                                    <button onClick={() => setIsSelectMode(true)} className="px-3 py-1.5 text-xs font-medium text-text-secondary hover:text-text-primary hover:bg-surface-container-highest rounded-full transition-colors">Select</button>
                                )}
                                <button onClick={() => fileInputRef.current?.click()} className="flex items-center gap-1 px-3 py-1.5 bg-primary text-on-primary text-xs font-bold rounded-full hover:bg-primary-hover shadow-md transition-all">
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
            <div className="flex-1 overflow-y-auto p-4 bg-surface-container">
                {isLoading ? (
                    <div className="text-center py-8 text-text-secondary text-xs">Loading...</div>
                ) : displayedFiles.length === 0 ? (
                    <div 
                        onClick={() => fileInputRef.current?.click()}
                        className="h-full flex flex-col items-center justify-center text-text-tertiary cursor-pointer hover:bg-surface-container-low border-2 border-dashed border-outline/30 rounded-xl transition-colors p-4"
                    >
                        {activeTab === 'SITE' ? <Camera size={32} className="mb-2 opacity-50" /> : <FileText size={32} className="mb-2 opacity-50" />}
                        <span className="text-sm font-medium">No {activeTab === 'SITE' ? 'photos' : 'documents'} yet</span>
                        <span className="text-xs">Click to upload</span>
                    </div>
                ) : activeTab === 'SITE' ? (
                    // --- PHOTO GRID VIEW ---
                    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2">
                        {displayedFiles.map((file: ProjectFile, index: number) => {
                            const isSelected = selectedIds.has(file.id);
                            return (
                                <div 
                                    key={file.id} 
                                    onClick={() => handlePhotoClick(file, index)}
                                    className={`relative aspect-square rounded-lg overflow-hidden cursor-pointer group border-2 transition-all ${isSelected ? 'border-primary ring-2 ring-primary/50' : 'border-transparent hover:border-outline/50'}`}
                                >
                                    <img src={getImageUrl(file.thumbnailUrl || file.url)} alt="Project Site" className="w-full h-full object-cover" loading="lazy" />
                                    {isSelectMode && (
                                        <div className={`absolute top-1.5 right-1.5 rounded-full bg-surface p-0.5 ${isSelected ? 'text-primary' : 'text-outline'}`}>
                                            <CheckCircle2 size={18} fill={isSelected ? "currentColor" : "none"} />
                                        </div>
                                    )}
                                    {!isSelectMode && (
                                        <div className="absolute inset-0 bg-scrim/0 group-hover:bg-scrim/30 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
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
                                    onClick={() => isSelectMode ? toggleSelection(file.id) : window.open(getImageUrl(file.url), '_blank')}
                                    className={`flex items-center p-3 rounded-xl border transition-all cursor-pointer ${
                                        isSelected ? 'border-primary bg-primary-container/20 shadow-sm' : 'border-outline/20 bg-surface-container-high hover:border-primary/50'
                                    }`}
                                >
                                    {/* Icon */}
                                    <div className="w-10 h-10 rounded-lg bg-surface-container-highest border border-outline/10 flex items-center justify-center mr-3 text-text-secondary shrink-0 overflow-hidden">
                                        {isImage ? (
                                            <img src={getImageUrl(file.thumbnailUrl || file.url)} className="w-full h-full object-cover" />
                                        ) : (
                                            <FileIcon size={20} className={isPdf ? 'text-error' : 'text-primary'} />
                                        )}
                                    </div>
                                    
                                    {/* Details */}
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium text-text-primary truncate">{file.fileName || 'Untitled Document'}</p>
                                        <p className="text-xs text-text-tertiary">{new Date(file.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric'})}</p>
                                    </div>

                                    {/* Actions */}
                                    {isSelectMode ? (
                                        <div className={`shrink-0 ${isSelected ? 'text-primary' : 'text-outline'}`}>
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
                    
                    <img src={getImageUrl(photosOnly[lightboxIndex].url)} alt="Full View" className="max-w-full max-h-full rounded shadow-2xl" onClick={(e) => e.stopPropagation()} />
                    
                    {photosOnly.length > 1 && <button className="absolute right-4 top-1/2 -translate-y-1/2 text-white/70 hover:text-white bg-white/10 hover:bg-white/20 p-2 rounded-full" onClick={handleNext}><ChevronRight size={32} /></button>}
                    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-white/50 text-sm">{lightboxIndex + 1} / {photosOnly.length}</div>
                </div>,
                document.body
            )}
        </div>
    );
};

export default ProjectFilesSection;