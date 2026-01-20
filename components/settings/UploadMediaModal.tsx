import React, { useState, useCallback } from 'react';
import { useUploadMedia } from '../../hooks/useMedia';
import { X, UploadCloud, Loader2, Image as ImageIcon, File as FileIcon } from 'lucide-react';
import { MediaAsset } from '../../types';

interface UploadMediaModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const UPLOAD_CATEGORIES: MediaAsset['category'][] = ['branding', 'avatars', 'jobs', 'products', 'misc'];

const UploadMediaModal: React.FC<UploadMediaModalProps> = ({ isOpen, onClose }) => {
  const [file, setFile] = useState<File | null>(null);
  const [category, setCategory] = useState<MediaAsset['category']>('misc');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const uploadMediaMutation = useUploadMedia();

  const handleFileChange = (selectedFile: File | null) => {
    if (selectedFile) {
      setFile(selectedFile);
      if (selectedFile.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onloadend = () => {
          setPreviewUrl(reader.result as string);
        };
        reader.readAsDataURL(selectedFile);
      } else {
        setPreviewUrl(null);
      }
    }
  };
  
  const resetState = useCallback(() => {
    setFile(null);
    setPreviewUrl(null);
    setCategory('misc');
    uploadMediaMutation.reset();
  }, [uploadMediaMutation]);

  const handleClose = () => {
    resetState();
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file || !category || uploadMediaMutation.isPending) return;

    const formData = new FormData();
    formData.append('file', file);
    formData.append('category', category);

    uploadMediaMutation.mutate(formData, {
      onSuccess: () => {
        handleClose();
      }
    });
  };
  
  const handleDragEvents = (e: React.DragEvent, isEntering: boolean) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(isEntering);
  };
  
  const handleDrop = (e: React.DragEvent) => {
    handleDragEvents(e, false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileChange(e.dataTransfer.files[0]);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-scrim/80 p-4">
      <div className="relative w-full max-w-lg rounded-2xl bg-surface-container-high shadow-xl border border-outline/20">
        <div className="flex items-center justify-between p-4 border-b border-outline/10">
          <h2 className="text-lg font-bold text-text-primary">Upload New Media</h2>
          <button onClick={handleClose} className="rounded-full p-2 hover:bg-surface-container-highest">
            <X size={20} className="text-text-secondary" />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="p-6 space-y-4">
            <div
              onDragEnter={(e) => handleDragEvents(e, true)}
              onDragLeave={(e) => handleDragEvents(e, false)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleDrop}
              className={`relative flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-8 text-center transition-colors
                ${isDragging ? 'border-primary bg-primary/10' : 'border-outline/50 bg-surface-container'}`}
            >
              <UploadCloud size={40} className="text-primary" />
              <p className="mt-2 font-semibold text-text-primary">
                Drag & drop file or{' '}
                <label className="cursor-pointer text-primary underline hover:text-primary-hover">
                  browse
                  <input
                    type="file"
                    className="hidden"
                    onChange={(e) => handleFileChange(e.target.files?.[0] || null)}
                  />
                </label>
              </p>
              <p className="text-xs text-text-secondary">Any file type supported</p>
            </div>

            {file && (
              <div className="flex items-center gap-3 rounded-lg border border-outline/20 bg-surface-container p-3">
                <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-md bg-surface-container-lowest">
                  {previewUrl ? (
                    <img src={previewUrl} alt="Preview" className="h-full w-full rounded-md object-cover" />
                  ) : (
                    <FileIcon size={24} className="text-text-secondary" />
                  )}
                </div>
                <div className="flex-1 overflow-hidden">
                  <p className="truncate font-medium text-text-primary">{file.name}</p>
                  <p className="text-xs text-text-secondary">
                    {(file.size / 1024).toFixed(2)} KB
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleFileChange(null)}
                  className="rounded-full p-1 text-text-secondary hover:bg-surface-container-highest"
                >
                  <X size={16} />
                </button>
              </div>
            )}
            
            <div>
              <label htmlFor="category" className="mb-1 block text-sm font-medium text-text-secondary">
                Category
              </label>
              <select
                id="category"
                value={category}
                onChange={(e) => setCategory(e.target.value as MediaAsset['category'])}
                className="w-full rounded-lg border border-outline/50 bg-surface-container px-3 py-2.5 text-text-primary outline-none focus:ring-2 focus:ring-primary/50"
              >
                {UPLOAD_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat} className="capitalize">
                    {cat.charAt(0).toUpperCase() + cat.slice(1)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex justify-end gap-3 rounded-b-2xl border-t border-outline/10 bg-surface-container p-4">
            <button
              type="button"
              onClick={handleClose}
              className="rounded-full border border-outline px-6 py-2.5 text-sm font-semibold text-text-primary transition-colors hover:bg-surface-container-highest"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!file || !category || uploadMediaMutation.isPending}
              className="flex items-center justify-center rounded-full bg-primary px-6 py-2.5 text-sm font-semibold text-on-primary shadow-sm transition-opacity hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50"
            >
              {uploadMediaMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Uploading...
                </>
              ) : (
                'Upload File'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default UploadMediaModal;