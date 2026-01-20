import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, ZoomIn } from 'lucide-react';

interface SimpleLightboxProps {
  imageUrl: string;
  onClose: () => void;
  altText?: string;
}

const SimpleLightbox: React.FC<SimpleLightboxProps> = ({ imageUrl, onClose, altText = 'Image Preview' }) => {
  // Lock body scroll while open
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = 'unset'; };
  }, []);

  return createPortal(
    <div 
      className="fixed inset-0 z-[99999] bg-black/95 flex items-center justify-center p-4 animate-in fade-in duration-200"
      onClick={onClose}
    >
      {/* Toolbar */}
      <div className="absolute top-0 left-0 right-0 p-4 flex justify-between items-start z-[101] bg-gradient-to-b from-black/50 to-transparent">
        <span className="text-white/70 text-sm font-mono ml-2 mt-1 truncate max-w-[80%]">{altText}</span>
        <button 
          onClick={(e) => { e.stopPropagation(); onClose(); }}
          className="p-2 bg-white/10 hover:bg-white/20 text-white rounded-full transition-colors backdrop-blur-sm"
        >
          <X size={24} />
        </button>
      </div>

      {/* Image Stage */}
      <div 
        className="relative w-full h-full flex items-center justify-center"
        onClick={(e) => e.stopPropagation()} // Clicking background closes, clicking image does not
      >
        <img 
          src={imageUrl} 
          alt={altText} 
          className="max-w-full max-h-full object-contain shadow-2xl rounded-sm"
        />
      </div>
    </div>
  , document.body);
};

export default SimpleLightbox;