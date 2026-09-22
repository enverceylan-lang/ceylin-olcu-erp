"use client";

import { ChevronLeft, ChevronRight, X } from "lucide-react";
import Image from "next/image";
import { useEffect } from "react";

interface MediaPreviewModalProps {
  url: string | null;
  type: 'photo' | 'video' | null;
  onClose: () => void;
  onPrevious?: () => void;
  onNext?: () => void;
}

export function MediaPreviewModal({
  url,
  type,
  onClose,
  onPrevious,
  onNext,
}: MediaPreviewModalProps) {
  useEffect(() => {
    if (!url) return;
    
    // Prevent background scrolling when modal is open
    const originalStyle = window.getComputedStyle(document.body).overflow;
    document.body.style.overflow = "hidden";
    
    // Listen for Escape key
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft') onPrevious?.();
      if (e.key === 'ArrowRight') onNext?.();
    };
    window.addEventListener('keydown', handleKeyDown);
    
    return () => {
      document.body.style.overflow = originalStyle;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [url, onClose, onNext, onPrevious]);

  if (!url || !type) return null;

  return (
    <div 
      onClick={onClose}
      className="fixed inset-0 bg-black/90 backdrop-blur-sm z-[9999] flex items-center justify-center p-4 cursor-zoom-out animate-fade-in"
    >
      <button 
        onClick={onClose}
        className="absolute top-4 right-4 p-2 text-white/80 hover:text-white bg-black/40 hover:bg-black/60 rounded-full transition-colors z-[10000] cursor-pointer"
        aria-label="Kapat"
      >
        <X className="w-6 h-6" />
      </button>

      {onPrevious && (
        <button
          type="button"
          onClick={event => {
            event.stopPropagation();
            onPrevious();
          }}
          className="absolute left-3 top-1/2 z-[10000] -translate-y-1/2 rounded-full bg-black/40 p-2 text-white/80 transition-colors hover:bg-black/60 hover:text-white sm:left-6"
          aria-label="Önceki fotoğraf"
        >
          <ChevronLeft className="h-7 w-7" />
        </button>
      )}

      {onNext && (
        <button
          type="button"
          onClick={event => {
            event.stopPropagation();
            onNext();
          }}
          className="absolute right-3 top-1/2 z-[10000] -translate-y-1/2 rounded-full bg-black/40 p-2 text-white/80 transition-colors hover:bg-black/60 hover:text-white sm:right-6"
          aria-label="Sonraki fotoğraf"
        >
          <ChevronRight className="h-7 w-7" />
        </button>
      )}

      <div 
        onClick={(e) => e.stopPropagation()}
        className="relative max-w-full max-h-full flex items-center justify-center cursor-default"
      >
        {type === 'photo' ? (
          <Image
            src={url} 
            alt="Medya Önizleme"
            width={1600}
            height={1200}
            sizes="95vw"
            unoptimized
            className="w-auto max-w-[95vw] h-auto max-h-[90vh] object-contain rounded-lg shadow-2xl select-none"
          />
        ) : (
          <video 
            src={url} 
            controls 
            autoPlay
            className="max-w-[95vw] max-h-[90vh] object-contain rounded-lg shadow-2xl"
          />
        )}
      </div>
    </div>
  );
}
