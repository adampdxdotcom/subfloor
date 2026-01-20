import React from 'react';
import { MediaAsset } from '../../types';
import { getImageUrl } from '../../utils/apiConfig';
import { FileText, Link } from 'lucide-react';

interface MediaCardProps {
  asset: MediaAsset;
}

const MediaCard: React.FC<MediaCardProps> = ({ asset }) => {
  const isImage = asset.fileType.startsWith('image/');
  const displayUrl = asset.thumbnailPath || asset.filePath;
  const isDeletable = asset.usageCount === 0;

  return (
    <div className="group relative aspect-square flex flex-col rounded-xl border border-outline/10 bg-surface-container-low shadow-sm transition-all hover:shadow-md hover:border-outline/50">
      <div className="relative flex-1 overflow-hidden rounded-t-xl">
        {isImage ? (
          <img
            src={getImageUrl(displayUrl)}
            alt={asset.filePath}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center bg-surface-container text-text-secondary">
            <FileText className="h-1/3 w-1/3 opacity-50" />
            <span className="mt-2 text-xs font-mono uppercase tracking-widest">
              {asset.fileType.split('/')[1] || 'File'}
            </span>
          </div>
        )}
      </div>

      <div className="p-2 text-xs">
        <p className="truncate font-mono text-text-secondary" title={asset.filePath}>
          {asset.filePath}
        </p>
        <p className={`mt-1 flex items-center gap-1.5 font-semibold ${isDeletable ? 'text-text-tertiary' : 'text-primary'}`}>
          <Link size={12} />
          <span>In Use: {asset.usageCount}</span>
        </p>
      </div>
    </div>
  );
};

export default MediaCard;