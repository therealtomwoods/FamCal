import React, { useState, useEffect } from 'react';
import { PhotoItem } from '../types';
import { Image, FolderOpen, ChevronLeft, ChevronRight } from 'lucide-react';

interface SlideshowProps {
  photos: PhotoItem[];
  albumTitle?: string;
  intervalSeconds: number;
  onOpenAlbumPicker: () => void;
  userToken?: string | null;
}

const isFileName = (text?: string, filename?: string): boolean => {
  if (!text) return false;
  const trimmed = text.trim();
  // Suppress common file extensions
  if (/\.(jpe?g|png|gif|webp|heic|heif|bmp|tiff|raw|cr2|nef|dng|mp4|mov|avi|mkv)$/i.test(trimmed)) {
    return true;
  }
  // Suppress common camera generated prefixes
  if (/^(IMG_|PXL_|DSC_|VID_|Screenshot_|\d{8}_\d{6})/i.test(trimmed)) {
    return true;
  }
  // Suppress if identical to photo filename
  if (filename && trimmed.toLowerCase() === filename.trim().toLowerCase()) {
    return true;
  }
  return false;
};

export const Slideshow: React.FC<SlideshowProps> = ({
  photos,
  intervalSeconds,
  onOpenAlbumPicker,
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [previousIndex, setPreviousIndex] = useState<number | null>(null);
  const [isHovered, setIsHovered] = useState(false);

  const transitionTo = (nextIdx: number) => {
    setPreviousIndex(currentIndex);
    setCurrentIndex(nextIdx);
  };

  // Automatic photo rotation
  useEffect(() => {
    if (!photos || photos.length <= 1) return;

    const timer = setInterval(() => {
      setCurrentIndex((prev) => {
        setPreviousIndex(prev);
        return (prev + 1) % photos.length;
      });
    }, Math.max(3, intervalSeconds) * 1000);

    return () => clearInterval(timer);
  }, [photos, intervalSeconds]);

  // Clear previousIndex after crossfade completes (1400ms)
  useEffect(() => {
    if (previousIndex === null) return;
    const timer = setTimeout(() => {
      setPreviousIndex(null);
    }, 1400);
    return () => clearTimeout(timer);
  }, [previousIndex]);

  // Handle bounds
  useEffect(() => {
    if (currentIndex >= photos.length && photos.length > 0) {
      setCurrentIndex(0);
    }
  }, [photos, currentIndex]);

  const currentPhoto = photos[currentIndex];

  const handlePrev = (e: React.MouseEvent) => {
    e.stopPropagation();
    transitionTo((currentIndex - 1 + photos.length) % photos.length);
  };

  const handleNext = (e: React.MouseEvent) => {
    e.stopPropagation();
    transitionTo((currentIndex + 1) % photos.length);
  };

  if (!photos || photos.length === 0) {
    return (
      <div className="relative w-full h-full bg-slate-900 flex flex-col items-center justify-center p-6 text-center border-b border-slate-800">
        <div className="w-16 h-16 rounded-full bg-slate-800/80 flex items-center justify-center mb-3 text-slate-400">
          <Image className="w-8 h-8" />
        </div>
        <p className="text-sm font-medium text-slate-300">No photos in current album</p>
        <button
          onClick={onOpenAlbumPicker}
          className="mt-3 inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-blue-600/80 hover:bg-blue-600 text-xs font-semibold text-white transition shadow"
        >
          <FolderOpen className="w-3.5 h-3.5" />
          Select Google Photos Album
        </button>
      </div>
    );
  }

  return (
    <div
      className="relative w-full h-full min-h-[200px] overflow-hidden select-none bg-black group"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Background Slides with crossfade transition (virtualized 3-slide buffer) */}
      {photos.map((photo, idx) => {
        const isCurrent = idx === currentIndex;
        const isPrev = idx === previousIndex;
        const isNext = idx === (currentIndex + 1) % photos.length;

        // Virtual DOM windowing: only mount active, crossfading-out, and preloading slides
        if (photos.length > 3 && !isCurrent && !isPrev && !isNext) {
          return null;
        }

        const isActive = isCurrent;
        const isUnhydratedGoogle =
          Boolean(photo.baseUrl) &&
          !photo.url.startsWith('data:') &&
          !photo.url.startsWith('blob:') &&
          !photo.url.includes('unsplash.com');

        return (
          <div
            key={photo.id || idx}
            className={`absolute inset-0 transition-opacity duration-1000 ease-in-out ${
              isActive ? 'opacity-100 z-[1]' : 'opacity-0 pointer-events-none z-0'
            }`}
          >
            <img
              src={photo.url}
              alt={photo.caption || 'Family photo'}
              className="w-full h-full object-cover object-center"
              loading={idx === 0 ? 'eager' : 'lazy'}
              onError={(e) => {
                const target = e.currentTarget;
                if (target.dataset.hasFallback) return;
                target.dataset.hasFallback = 'true';

                // Fallback to high quality family sample photo so no broken icon ever appears
                const fallbacks = [
                  'https://images.unsplash.com/photo-1502086223501-7ea6ecd79368?auto=format&fit=crop&w=1400&q=85',
                  'https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?auto=format&fit=crop&w=1400&q=85',
                  'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=1400&q=85',
                  'https://images.unsplash.com/photo-1513151233558-d860c5398176?auto=format&fit=crop&w=1400&q=85',
                ];
                target.src = fallbacks[idx % fallbacks.length];
              }}
            />

            {/* Subtle corner badge if Google photo is still downloading in background */}
            {isUnhydratedGoogle && isActive && (
              <div className="absolute bottom-10 right-4 z-10 pointer-events-none">
                <span className="text-[10px] text-pink-300 bg-black/60 backdrop-blur-sm px-2 py-0.5 rounded-full border border-pink-500/30 flex items-center gap-1">
                  <Image className="w-3 h-3 text-pink-400 animate-pulse" />
                  Loading high-res...
                </span>
              </div>
            )}
          </div>
        );
      })}

      {/* Subtle top vignette for readability */}
      <div className="absolute inset-x-0 top-0 h-20 bg-gradient-to-b from-black/70 via-black/30 to-transparent pointer-events-none" />

      {/* Bottom gradient scrim blending into the middle / calendar section */}
      <div className="absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-slate-950 via-slate-950/70 to-transparent pointer-events-none" />

      {/* Prev / Next controls on hover or touch */}
      {photos.length > 1 && (
        <div
          className={`absolute inset-y-0 left-2 right-2 flex items-center justify-between z-10 transition-opacity duration-200 ${
            isHovered ? 'opacity-100' : 'opacity-0'
          }`}
        >
          <button
            onClick={handlePrev}
            className="w-8 h-8 rounded-full bg-black/60 backdrop-blur-md border border-white/20 text-white flex items-center justify-center hover:bg-black/90 transition shadow-lg"
            aria-label="Previous photo"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <button
            onClick={handleNext}
            className="w-8 h-8 rounded-full bg-black/60 backdrop-blur-md border border-white/20 text-white flex items-center justify-center hover:bg-black/90 transition shadow-lg"
            aria-label="Next photo"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      )}

      {/* Bottom Photo Metadata (Caption & Date) - Suppress any raw file names */}
      {currentPhoto && ((currentPhoto.caption && !isFileName(currentPhoto.caption, currentPhoto.filename)) || currentPhoto.dateTaken) && (
        <div className="absolute bottom-3 left-4 right-4 z-10 pointer-events-none">
          {currentPhoto.caption && !isFileName(currentPhoto.caption, currentPhoto.filename) && (
            <p className="text-xs sm:text-sm font-medium text-white/95 drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)] line-clamp-1">
              {currentPhoto.caption}
            </p>
          )}
          {currentPhoto.dateTaken && (
            <p className="text-[11px] font-normal text-white/70 drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)] mt-0.5">
              {currentPhoto.dateTaken}
            </p>
          )}
        </div>
      )}
    </div>
  );
};
