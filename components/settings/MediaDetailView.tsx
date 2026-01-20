import React from 'react';
import { ArrowLeft, Calendar, FileType, FolderOpen, Layers, Download, Trash2 } from 'lucide-react';
import { MediaAsset } from '../../types';
import { getImageUrl } from '../../utils/apiConfig';
import { useDeleteMedia } from '../../hooks/useMedia';

interface MediaDetailViewProps {
  asset: MediaAsset;
  onClose: () => void;
}

const MediaDetailView: React.FC<MediaDetailViewProps> = ({ asset, onClose }) => {
  const { mutateAsync: deleteMedia } = useDeleteMedia();

  // Format date for display
  const uploadedDate = new Date(asset.createdAt).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  // Extract filename from path for display
  const fileName = asset.filePath.split('/').pop() || 'Unknown File';

  const handleDelete = async () => {
    let message = "Are you sure you want to delete this file?\n\nThis action cannot be undone.";
    
    if (asset.usageCount > 0) {
      message = `⚠️ WARNING: This image is currently active in ${asset.usageCount} place(s).\n\nDeleting it will break images in those records.\n\nDelete anyhow?`;
    }

    if (window.confirm(message)) {
      await deleteMedia(asset.id);
      onClose();
    }
  };

  return (
    <div className="
      /* Mobile: Full Screen Overlay */
      fixed inset-0 z-[60] bg-background flex flex-col
      /* Desktop: Embedded Container (overrides fixed/inset/z-index) */
      md:static md:z-0 md:h-[700px] md:bg-surface-container-low md:rounded-2xl md:border md:border-outline-variant md:overflow-hidden
    ">
      {/* --- HEADER --- */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-outline-variant bg-surface md:bg-surface-container-low">
        <div className="flex items-center gap-3">
          <button
            onClick={onClose}
            className="p-2 -ml-2 rounded-full hover:bg-surface-container-highest transition-colors text-on-surface"
          >
            <ArrowLeft size={24} />
          </button>
          <h3 className="text-lg font-semibold text-text-primary truncate max-w-[200px] md:max-w-md">
            {fileName}
          </h3>
        </div>
        
        {/* Actions */}
        <div className="flex items-center gap-2">
          <button 
            onClick={handleDelete}
            className="p-2 rounded-full hover:bg-error-container hover:text-error transition-colors text-secondary"
            title="Delete File"
          >
            <Trash2 size={20} />
          </button>
          <a 
            href={getImageUrl(asset.filePath)} 
            download
            target="_blank"
            rel="noopener noreferrer"
            className="p-2 rounded-full hover:bg-surface-container-highest transition-colors text-primary"
            title="Open Original"
          >
            <Download size={20} />
          </a>
        </div>
      </div>

      {/* --- MAIN STAGE (Image) --- */}
      <div className="flex-1 relative overflow-hidden bg-black/5 flex items-center justify-center p-4">
        {/* 
          We use object-contain to ensure the whole image is visible without cropping.
          max-h-full ensures it doesn't push the footer off screen.
        */}
        <img
          src={getImageUrl(asset.filePath)}
          alt="Preview"
          className="max-w-full max-h-full object-contain shadow-lg rounded-sm"
        />
      </div>

      {/* --- FOOTER (Stats) --- */}
      <div className="bg-surface-container p-4 md:p-6 border-t border-outline-variant">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-8">
            
            {/* Stat 1: Category */}
            <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2 text-text-secondary text-xs uppercase font-bold tracking-wider">
                    <FolderOpen size={14} />
                    Category
                </div>
                <div className="text-text-primary font-medium capitalize">
                    {asset.category}
                </div>
            </div>

            {/* Stat 2: File Type */}
            <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2 text-text-secondary text-xs uppercase font-bold tracking-wider">
                    <FileType size={14} />
                    Type
                </div>
                <div className="text-text-primary font-medium uppercase">
                    {asset.fileType.replace('.', '')}
                </div>
            </div>

            {/* Stat 3: Usage */}
            <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2 text-text-secondary text-xs uppercase font-bold tracking-wider">
                    <Layers size={14} />
                    Usage
                </div>
                <div className="text-text-primary font-medium">
                    {asset.usageCount === 0 ? 'Unused' : `In Use (${asset.usageCount})`}
                </div>
            </div>

            {/* Stat 4: Date */}
            <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2 text-text-secondary text-xs uppercase font-bold tracking-wider">
                    <Calendar size={14} />
                    Uploaded
                </div>
                <div className="text-text-primary font-medium">
                    {uploadedDate}
                </div>
            </div>

        </div>
      </div>
    </div>
  );
};

export default MediaDetailView;