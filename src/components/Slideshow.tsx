import React, { useState, useEffect, useRef, useCallback } from 'react';
import { PhotoItem } from '../types';
import { Image, FolderOpen, ChevronLeft, ChevronRight, Heart } from 'lucide-react';

interface SlideshowProps {
  photos: PhotoItem[];
  albumTitle?: string;
  intervalSeconds: number;
  onOpenAlbumPicker: () => void;
  userToken?: string | null;
  onPhotosNeedRefresh?: () => void;
  isSessionExpired?: boolean;
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

// Guaranteed high-res reliable family fallback photos
const RELIABLE_FALLBACKS = [
  'https://images.unsplash.com/photo-1502086223501-7ea6ecd79368?auto=format&fit=crop&w=1400&q=85',
  'https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?auto=format&fit=crop&w=1400&q=85',
  'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=1400&q=85',
  'https://images.unsplash.com/photo-1513151233558-d860c5398176?auto=format&fit=crop&w=1400&q=85',
];

export const Slideshow: React.FC<SlideshowProps> = ({
  photos,
  intervalSeconds,
  onOpenAlbumPicker,
  onPhotosNeedRefresh,
  isSessionExpired,
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [previousIndex, setPreviousIndex] = useState<number | null>(null);
  const [isHovered, setIsHovered] = useState(false);
  const [failedPhotoIds, setFailedPhotoIds] = useState<Record<string, boolean>>({});
  const [showLoadingBadge, setShowLoadingBadge] = useState(false);

  // Auto-reset failed photo statuses whenever fresh URLs are loaded
  useEffect(() => {
    setFailedPhotoIds({});
  }, [photos]);

  const currentIndexRef = useRef(currentIndex);
  currentIndexRef.current = currentIndex;

  const photosCount = photos?.length || 0;
  const autoSkipTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const badgeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const transitionTo = useCallback((nextIdx: number) => {
    if (autoSkipTimerRef.current) {
      clearTimeout(autoSkipTimerRef.current);
      autoSkipTimerRef.current = null;
    }
    const current = currentIndexRef.current;
    if (current !== nextIdx) {
      setPreviousIndex(current);
      setCurrentIndex(nextIdx);
    }
  }, []);

  // Automatic photo rotation that cannot stall
  useEffect(() => {
    if (photosCount <= 1) return;

    const intervalMs = Math.max(3, intervalSeconds) * 1000;
    const timer = setInterval(() => {
      const current = currentIndexRef.current;
      const next = (current + 1) % photosCount;
      setPreviousIndex(current);
      setCurrentIndex(next);
    }, intervalMs);

    return () => clearInterval(timer);
  }, [photosCount, intervalSeconds]);

  // Handle visibility change: reset stale crossfade state if browser tab was backgrounded
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        setPreviousIndex(null);
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);

  // Clear previousIndex after crossfade completes (1400ms)
  useEffect(() => {
    if (previousIndex === null) return;
    const timer = setTimeout(() => {
      setPreviousIndex(null);
    }, 1400);
    return () => clearTimeout(timer);
  }, [previousIndex]);

  // Bounds safety check
  useEffect(() => {
    if (currentIndex >= photosCount && photosCount > 0) {
      setCurrentIndex(0);
    }
  }, [photosCount, currentIndex]);

  // Temporary corner badge logic: auto-dismiss after 4 seconds so it never lingers indefinitely
  useEffect(() => {
    if (badgeTimerRef.current) {
      clearTimeout(badgeTimerRef.current);
      badgeTimerRef.current = null;
    }

    const currentPhoto = photos?.[currentIndex];
    const isUnhydrated =
      currentPhoto?.baseUrl &&
      !currentPhoto.url.startsWith('data:') &&
      !currentPhoto.url.startsWith('blob:') &&
      !currentPhoto.url.includes('unsplash.com');

    const photoKey = currentPhoto?.id || String(currentIndex);
    const hasFailed = failedPhotoIds[photoKey];

    if (isUnhydrated && !hasFailed) {
      setShowLoadingBadge(true);
      badgeTimerRef.current = setTimeout(() => {
        setShowLoadingBadge(false);
      }, 4000);
    } else {
      setShowLoadingBadge(false);
    }

    return () => {
      if (badgeTimerRef.current) clearTimeout(badgeTimerRef.current);
    };
  }, [currentIndex, photos, failedPhotoIds]);

  const currentPhoto = photos?.[currentIndex];

  const handlePrev = (e: React.MouseEvent) => {
    e.stopPropagation();
    transitionTo((currentIndex - 1 + photosCount) % photosCount);
  };

  const handleNext = (e: React.MouseEvent) => {
    e.stopPropagation();
    transitionTo((currentIndex + 1) % photosCount);
  };

  // Gracefully handle image load failure: mark as failed, switch to fallback, and request background refresh
  const handleImageError = (photoKey: string, idx: number) => {
    if (failedPhotoIds[photoKey]) return; // Already handled

    setFailedPhotoIds((prev) => ({ ...prev, [photoKey]: true }));

    const failedPhoto = photos?.[idx];
    const isGooglePhoto =
      failedPhoto?.url?.includes('googleusercontent.com') ||
      failedPhoto?.baseUrl?.includes('googleusercontent.com') ||
      failedPhoto?.url?.includes('photospicker.googleapis.com');

    // If an active Google Photos URL failed (likely 403 expired baseUrl), alert parent to fetch fresh baseUrls
    if (isGooglePhoto && onPhotosNeedRefresh) {
      onPhotosNeedRefresh();
    }

    // Smoothly advance after 4s (not 1.5s strobe) if the active visible photo failed, so fallback can show cleanly
    if (idx === currentIndexRef.current && photosCount > 1) {
      if (autoSkipTimerRef.current) clearTimeout(autoSkipTimerRef.current);
      autoSkipTimerRef.current = setTimeout(() => {
        const next = (currentIndexRef.current + 1) % photosCount;
        transitionTo(next);
      }, 4000);
    }
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
        const photoKey = photo.id || String(idx);
        const isFailed = Boolean(failedPhotoIds[photoKey]);
        const displaySrc = isFailed
          ? RELIABLE_FALLBACKS[idx % RELIABLE_FALLBACKS.length]
          : photo.url;

        return (
          <div
            key={photo.id || idx}
            className={`absolute inset-0 transition-opacity duration-1000 ease-in-out ${
              isActive ? 'opacity-100 z-[1]' : 'opacity-0 pointer-events-none z-0'
            }`}
          >
            <img
              src={displaySrc}
              alt={photo.caption && !isFileName(photo.caption, photo.filename) ? photo.caption : 'Family photo'}
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover object-center"
              loading={idx === 0 ? 'eager' : 'lazy'}
              onError={() => {
                if (!isFailed) {
                  handleImageError(photoKey, idx);
                }
              }}
            />

            {/* Offline-resilient fallback background if both primary and secondary network fail */}
            {isFailed && (
              <div className="absolute inset-0 -z-10 bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-950 flex flex-col items-center justify-center p-6 text-center">
                <div className="w-16 h-16 rounded-full bg-white/5 border border-white/10 flex items-center justify-center mb-2 text-indigo-400">
                  <Heart className="w-8 h-8 opacity-80" />
                </div>
                <p className="text-sm font-semibold text-white/90">Family Memories</p>
                {photo.caption && !isFileName(photo.caption, photo.filename) && (
                  <p className="text-xs text-slate-400 mt-1 max-w-[240px]">
                    {photo.caption}
                  </p>
                )}
              </div>
            )}

            {/* Temporary non-intrusive loading badge (auto-dismisses after 4s, never lingers) */}
            {showLoadingBadge && isActive && !isFailed && (
              <div className="absolute bottom-10 right-4 z-10 pointer-events-none transition-opacity duration-500">
                <span className="text-[10px] text-blue-200 bg-black/60 backdrop-blur-sm px-2.5 py-0.5 rounded-full border border-blue-400/30 flex items-center gap-1.5 shadow-sm">
                  <Image className="w-3 h-3 text-blue-400 animate-pulse" />
                  Loading photo...
                </span>
              </div>
            )}
          </div>
        );
      })}

      {/* 7-Day Session Expiration Indicator */}
      {isSessionExpired && (
        <div className="absolute top-3 left-3 z-30 pointer-events-auto">
          <button
            onClick={onOpenAlbumPicker}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-500/90 hover:bg-amber-400 text-slate-950 font-bold text-xs shadow-lg backdrop-blur-md transition animate-pulse"
            title="Google limits picker sessions to 7 days. Tap here to renew your family photo selection."
          >
            <FolderOpen className="w-3.5 h-3.5" />
            <span>Photos Expired (7d limit) • Tap to Renew</span>
          </button>
        </div>
      )}

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
