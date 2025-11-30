import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom'; // NEW IMPORT
import { usePhotos, usePhotoMutations, Photo } from '../hooks/usePhotos';
import { Camera, Trash2, X, Maximize2, CheckCircle2, Move, ChevronLeft, ChevronRight } from 'lucide-react';
import { Project } from '../types';
import { toast } from 'react-hot-toast';

interface ProjectPhotosSectionProps {
    project: Project;
}

const ProjectPhotosSection: React.FC<ProjectPhotosSectionProps> = ({ project }) => {
    const { data: photos = [], isLoading } = usePhotos('PROJECT', project.id);
    const { uploadPhotos, deletePhoto } = usePhotoMutations('PROJECT', project.id);
    
    const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
    const [isSelectMode, setIsSelectMode] = useState(false);
    const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            const toastId = toast.loading("Uploading photos...");
            try {
                await uploadPhotos.mutateAsync(e.target.files);
                toast.success("Photos uploaded!", { id: toastId });
            } catch (err) {
                toast.error("Upload failed.", { id: toastId });
            }
            // Reset input so same file can be selected again if needed
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
        if (!window.confirm(`Delete ${selectedIds.size} photos?`)) return;
        
        const toastId = toast.loading("Deleting...");
        try {
            await Promise.all(Array.from(selectedIds).map(id => deletePhoto.mutateAsync(id)));
            toast.success("Deleted!", { id: toastId });
            setSelectedIds(new Set());
            setIsSelectMode(false);
        } catch (error) {
            toast.error("Delete failed.", { id: toastId });
        }
    };

    const handlePhotoClick = (photo: Photo, index: number) => {
        if (isSelectMode) {
            toggleSelection(photo.id);
        } else {
            setLightboxIndex(index);
        }
    };

    // --- LIGHTBOX NAVIGATION ---
    const handlePrev = useCallback((e?: React.MouseEvent) => {
        e?.stopPropagation();
        setLightboxIndex(prev => (prev !== null && prev > 0 ? prev - 1 : photos.length - 1));
    }, [photos.length]);

    const handleNext = useCallback((e?: React.MouseEvent) => {
        e?.stopPropagation();
        setLightboxIndex(prev => (prev !== null && prev < photos.length - 1 ? prev + 1 : 0));
    }, [photos.length]);

    // Keyboard Support
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
            {/* Header */}
            <div className="p-3 border-b border-border bg-background flex justify-between items-center shrink-0">
                <div className="flex items-center gap-2 overflow-hidden">
                    <Move size={16} className="drag-handle text-text-tertiary cursor-move hover:text-text-primary shrink-0" />
                    <h3 className="font-bold text-text-primary flex items-center gap-2 truncate">
                        <Camera size={18} /> Site Photos ({photos.length})
                    </h3>
                </div>
                
                <div className="flex gap-2">
                    {isSelectMode ? (
                        <>
                            <button 
                                onClick={handleDeleteSelected} 
                                disabled={selectedIds.size === 0}
                                className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded disabled:opacity-50 transition-colors"
                            >
                                Delete ({selectedIds.size})
                            </button>
                            <button 
                                onClick={() => { setIsSelectMode(false); setSelectedIds(new Set()); }}
                                className="px-3 py-1 bg-secondary text-on-secondary text-xs font-bold rounded hover:bg-secondary-hover transition-colors"
                            >
                                Cancel
                            </button>
                        </>
                    ) : (
                        <>
                            {photos.length > 0 && (
                                <button 
                                    onClick={() => setIsSelectMode(true)}
                                    className="px-3 py-1 text-xs font-medium text-text-secondary hover:text-text-primary hover:bg-border/50 rounded transition-colors"
                                >
                                    Select
                                </button>
                            )}
                            <button 
                                onClick={() => fileInputRef.current?.click()}
                                className="flex items-center gap-1 px-3 py-1 bg-primary text-on-primary text-xs font-bold rounded hover:bg-primary-hover shadow-sm transition-colors"
                            >
                                <Camera size={14} /> Add
                            </button>
                        </>
                    )}
                </div>
                <input 
                    type="file" 
                    multiple 
                    accept="image/*" 
                    className="hidden" 
                    ref={fileInputRef} 
                    onChange={handleFileChange} 
                />
            </div>

            {/* Grid */}
            <div className="flex-1 overflow-y-auto p-3">
                {isLoading ? (
                    <div className="text-center py-8 text-text-secondary text-xs">Loading...</div>
                ) : photos.length === 0 ? (
                    <div 
                        onClick={() => fileInputRef.current?.click()}
                        className="h-full flex flex-col items-center justify-center text-text-tertiary cursor-pointer hover:bg-background/50 border-2 border-dashed border-border rounded-lg transition-colors p-4"
                    >
                        <Camera size={32} className="mb-2 opacity-50" />
                        <span className="text-sm font-medium">No photos yet</span>
                        <span className="text-xs">Click to upload</span>
                    </div>
                ) : (
                    <div className="grid grid-cols-3 gap-2">
                        {photos.map((photo, index) => {
                            const isSelected = selectedIds.has(photo.id);
                            return (
                                <div 
                                    key={photo.id} 
                                    onClick={() => handlePhotoClick(photo, index)}
                                    className={`relative aspect-square rounded overflow-hidden cursor-pointer group border-2 transition-all ${isSelected ? 'border-primary ring-2 ring-primary/50' : 'border-transparent hover:border-border'}`}
                                >
                                    <img 
                                        src={photo.thumbnailUrl || photo.url} 
                                        alt="Project Site" 
                                        className="w-full h-full object-cover transition-transform group-hover:scale-105" 
                                        loading="lazy"
                                    />
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
                )}
            </div>

            {/* Lightbox Modal - Portal to document.body to escape grid layout */}
            {lightboxIndex !== null && createPortal(
                <div 
                    className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center p-4 backdrop-blur-sm"
                    onClick={() => setLightboxIndex(null)}
                >
                    <button 
                        className="absolute top-4 right-4 text-white/70 hover:text-white bg-white/10 hover:bg-white/20 p-2 rounded-full transition-colors"
                        onClick={() => setLightboxIndex(null)}
                    >
                        <X size={24} />
                    </button>
                    
                    {/* Left Arrow */}
                    {photos.length > 1 && (
                        <button
                            className="absolute left-4 top-1/2 -translate-y-1/2 text-white/70 hover:text-white bg-white/10 hover:bg-white/20 p-2 rounded-full transition-colors"
                            onClick={handlePrev}
                        >
                            <ChevronLeft size={32} />
                        </button>
                    )}

                    <img 
                        src={photos[lightboxIndex].url} 
                        alt="Full View" 
                        className="max-w-full max-h-full rounded shadow-2xl"
                        onClick={(e) => e.stopPropagation()} // Prevent click-through closing
                    />

                    {/* Right Arrow */}
                    {photos.length > 1 && (
                        <button
                            className="absolute right-4 top-1/2 -translate-y-1/2 text-white/70 hover:text-white bg-white/10 hover:bg-white/20 p-2 rounded-full transition-colors"
                            onClick={handleNext}
                        >
                            <ChevronRight size={32} />
                        </button>
                    )}
                    
                    {/* Simple Nav - Optional, click sides to nav could be added later */}
                    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-white/50 text-sm">
                        {lightboxIndex + 1} / {photos.length}
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
};

export default ProjectPhotosSection;