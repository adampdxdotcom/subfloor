import React, { useState } from 'react';
import { Upload, Loader2, AlertTriangle } from 'lucide-react';
import { useMediaAssets } from '../../hooks/useMedia';
import MediaCard from './MediaCard';
import UploadMediaModal from './UploadMediaModal';
import MediaDetailView from './MediaDetailView';
import { MediaAsset } from '../../types';

const MediaLibrarySection = () => {
  const { data: assets, isLoading, isError, error } = useMediaAssets();
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState<MediaAsset | null>(null);

  // --- RENDER: DETAIL VIEW ---
  if (selectedAsset) {
    return (
      <MediaDetailView 
        asset={selectedAsset} 
        onClose={() => setSelectedAsset(null)} 
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h2 className="text-2xl font-bold text-text-primary">Media Library</h2>
          <p className="mt-1 text-text-secondary">
            Manage all uploaded images, documents, and other files across the system.
          </p>
        </div>
        <button
          onClick={() => setIsUploadModalOpen(true)}
          className="flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-on-primary shadow-sm transition-colors hover:bg-primary-hover"
        >
          <Upload size={16} />
          Upload Media
        </button>
      </div>

      {isLoading && (
        <div className="flex justify-center items-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      )}

      {isError && (
        <div className="rounded-xl border border-error-container bg-error-container/20 p-8 text-center text-on-error-container">
          <AlertTriangle className="w-12 h-12 mx-auto" />
          <h3 className="mt-4 text-lg font-semibold">Could not load media assets</h3>
          <p className="mt-2 text-sm">{error?.message || 'An unknown error occurred.'}</p>
        </div>
      )}

      {assets && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
          {assets.map((asset) => (
            <div 
              key={asset.id} 
              onClick={() => setSelectedAsset(asset)}
              className="cursor-pointer transition-transform hover:scale-[1.02] active:scale-95"
            >
              <MediaCard asset={asset} />
            </div>
          ))}
        </div>
      )}

      <UploadMediaModal isOpen={isUploadModalOpen} onClose={() => setIsUploadModalOpen(false)} />
    </div>
  );
};

export default MediaLibrarySection;