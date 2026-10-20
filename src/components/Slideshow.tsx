import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { PhotoItem } from '../types';
import { Image, FolderOpen, ChevronLeft, ChevronRight, Calendar, Loader2, Shuffle } from 'lucide-react';
import { usePhotoCache } from '../services/photoCache';

interface SlideshowProps {
  photos: PhotoItem[];
  albumTitle?: string;
  intervalSeconds: number;
  onOpenAlbumPicker: () => void;
  userToken?: string | null;
  onPhotosNeedRefresh?: () => void;
  isSessionExpired?: boolean;
  randomOrder?: boolean;
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

export const formatPhotoDate = (photo?: PhotoItem | null): string | undefined => {
  if (!photo) return undefined;

  // 1. If explicit dateTaken exists
  if (photo.dateTaken && photo.dateTaken.trim()) {
    const raw = photo.dateTaken.trim();
    if (/^[A-Za-z]+\s+\d{1,2},\s+\d{4}$/.test(raw) || /^\d{1,2}\s+[A-Za-z]+,?\s+\d{4}$/.test(raw)) {
      return raw;
    }
    try {
      const d = new Date(raw);
      if (!isNaN(d.getTime())) {
        return d.toLocaleDateString(undefined, {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        });
      }
    } catch {
      return raw;
    }
  }

  // 2. Try camera filename timestamp (e.g. IMG_20230814_120422.jpg, PXL_20240102_...)
  if (photo.filename) {
    const m = photo.filename.match(/(?:IMG_|PXL_|VID_|\b)(\d{4})[-_]?(\d{2})[-_]?(\d{2})/i);
    if (m) {
      const year = parseInt(m[1], 10);
      const month = parseInt(m[2], 10) - 1;
      const day = parseInt(m[3], 10);
      if (year >= 1990 && year <= 2035 && month >= 0 && month <= 11 && day >= 1 && day <= 31) {
        const d = new Date(year, month, day);
        if (!isNaN(d.getTime())) {
          return d.toLocaleDateString(undefined, {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
          });
        }
      }
    }
  }

  return undefined;
};

// Guaranteed high-res reliable family fallback photos
const RELIABLE_FALLBACKS = [
  'https://images.unsplash.com/photo-1502086223501-7ea6ecd79368?auto=format&fit=crop&w=1400&q=85',
  'https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?auto=format&fit=crop&w=1400&q=85',
  'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=1400&q=85',
  'https://images.unsplash.com/photo-1513151233558-d860c5398176?auto=format&fit=crop&w=1400&q=85',
];

/**
 * Fisher-Yates unbiased shuffle algorithm
 */
function shuffleArray<T>(items: T[]): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

export const Slideshow: React.FC<SlideshowProps> = ({
  photos,
  intervalSeconds,
  onOpenAlbumPicker,
  userToken,
  onPhotosNeedRefresh,
  isSessionExpired,
  randomOrder = true,
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [previousIndex, setPreviousIndex] = useState<number | null>(null);
  const [isHovered, setIsHovered] = useState(false);
  const [shuffleVersion, setShuffleVersion] = useState(0);
  const lastWorkingSrcRef = useRef<string | null>(null);

  // Shuffled photo IDs reference to preserve consistent sequence across background baseUrl refreshes
  const shuffledIdsRef = useRef<string[]>([]);

  // Compute active display sequence: randomized or chronological
  const displayPhotos = useMemo(() => {
    if (!photos || photos.length === 0) return [];

    if (!randomOrder) {
      shuffledIdsRef.current = [];
      return photos;
    }

    const currentIds = photos.map((p) => p.id);
    const existingIds = shuffledIdsRef.current;
    const existingSet = new Set(existingIds);

    // If existing shuffled set matches current photos (e.g. background baseUrl refresh at 25m),
    // preserve the exact same random order and update objects with fresh URLs seamlessly!
    const hasSameIds =
      existingIds.length === currentIds.length &&
      existingIds.length > 0 &&
      currentIds.every((id) => existingSet.has(id));

    if (hasSameIds) {
      const photoMap = new Map(photos.map((p) => [p.id, p]));
      return existingIds
        .map((id) => photoMap.get(id))
        .filter(Boolean) as PhotoItem[];
    }

    // New photo collection or manual reshuffle triggered: generate fresh unbiased shuffle
    const shuffled = shuffleArray(photos);
    shuffledIdsRef.current = shuffled.map((p) => p.id);
    return shuffled;
  }, [photos, randomOrder, shuffleVersion]);

  const photosCount = displayPhotos?.length || 0;

  // In-memory sliding-window cache hook:
  // Sequentially caches upcoming photos in the background (a few at a time).
  // Zero database overhead, instant slide transitions, auto-evicts old blobs.
  const {
    getPhotoSrc,
    isPhotoReady,
    isPhotoLoading,
    hasPhotoFailed,
  } = usePhotoCache(displayPhotos, currentIndex, userToken, onPhotosNeedRefresh);

  const currentIndexRef = useRef(currentIndex);
  currentIndexRef.current = currentIndex;

  const transitionTo = useCallback((nextIdx: number) => {
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

  // If the active photo permanently failed to load, automatically advance to next after 1.5s
  useEffect(() => {
    if (hasPhotoFailed(currentIndex) && photosCount > 1) {
      const timer = setTimeout(() => {
        transitionTo((currentIndex + 1) % photosCount);
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [currentIndex, hasPhotoFailed, photosCount, transitionTo]);

  // Keep last working image updated
  const currentSrc = getPhotoSrc(currentIndex);
  useEffect(() => {
    if (currentSrc) {
      lastWorkingSrcRef.current = currentSrc;
    }
  }, [currentSrc]);

  const currentPhoto = displayPhotos?.[currentIndex];

  const handlePrev = (e: React.MouseEvent) => {
    e.stopPropagation();
    transitionTo((currentIndex - 1 + photosCount) % photosCount);
  };

  const handleNext = (e: React.MouseEvent) => {
    e.stopPropagation();
    transitionTo((currentIndex + 1) % photosCount);
  };

  const handleReshuffle = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (photos && photos.length > 0) {
      const shuffled = shuffleArray(photos);
      shuffledIdsRef.current = shuffled.map((p) => p.id);
      setShuffleVersion((v) => v + 1);
      setCurrentIndex(0);
      setPreviousIndex(null);
    }
  };

  if (!displayPhotos || displayPhotos.length === 0) {
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

  // Virtualized slide window: only mount active, previous (during crossfade), and next (preloading)
  const visibleIndices: number[] = [currentIndex];
  if (previousIndex !== null && previousIndex !== currentIndex) {
    visibleIndices.push(previousIndex);
  }
  const nextIdx = (currentIndex + 1) % photosCount;
  if (nextIdx !== currentIndex && !visibleIndices.includes(nextIdx)) {
    visibleIndices.push(nextIdx);
  }

  const isCurrentLoading = !isPhotoReady(currentIndex) && isPhotoLoading(currentIndex);

  return (
    <div
      className="relative w-full h-full overflow-hidden select-none bg-black group"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Background Slides with crossfade transition (strictly virtualized 3-slide buffer) */}
      {visibleIndices.map((idx) => {
        const photo = displayPhotos[idx];
        if (!photo) return null;

        const isCurrent = idx === currentIndex;
        const isActive = isCurrent;
        const rawSrc = getPhotoSrc(idx);

        // If active slide's blob isn't loaded yet, fall back to last working image or reliable family fallback
        const displaySrc = rawSrc || (isCurrent ? lastWorkingSrcRef.current || RELIABLE_FALLBACKS[idx % RELIABLE_FALLBACKS.length] : undefined);

        if (!displaySrc) return null;

        return (
          <div
            key={photo.id || idx}
            className={`absolute inset-0 w-full h-full overflow-hidden flex items-center justify-center transition-opacity duration-1000 ease-in-out ${
              isActive ? 'opacity-100 z-[1]' : 'opacity-0 pointer-events-none z-0'
            }`}
          >
            {/* Ambient blurred backdrop to softly fill letterbox/pillarbox space */}
            <img
              src={displaySrc}
              alt=""
              aria-hidden="true"
              referrerPolicy="no-referrer"
              className="absolute inset-0 w-full h-full object-cover object-center blur-2xl scale-110 opacity-35 pointer-events-none"
            />
            {/* Full photo scaled proportionally to fit completely inside the container */}
            <img
              src={displaySrc}
              alt={photo.caption && !isFileName(photo.caption, photo.filename) ? photo.caption : 'Family photo'}
              referrerPolicy="no-referrer"
              className="relative z-[1] w-full h-full max-w-full max-h-full object-contain object-center"
              loading={isCurrent ? 'eager' : 'lazy'}
              onLoad={() => {
                if (rawSrc) {
                  lastWorkingSrcRef.current = rawSrc;
                }
              }}
            />
          </div>
        );
      })}

      {/* Non-intrusive background caching pill (shows briefly only when downloading active slide) */}
      {isCurrentLoading && (
        <div className="absolute bottom-12 right-4 z-10 pointer-events-none transition-opacity duration-500">
          <span className="text-[10px] text-blue-200 bg-black/60 backdrop-blur-sm px-2.5 py-0.5 rounded-full border border-blue-400/30 flex items-center gap-1.5 shadow-sm">
            <Loader2 className="w-3 h-3 text-blue-400 animate-spin" />
            Caching photos...
          </span>
        </div>
      )}

      {/* Session Expiration Indicator (only shown if session expired AND photo cannot be loaded from local disk cache) */}
      {isSessionExpired && hasPhotoFailed(currentIndex) && !isPhotoReady(currentIndex) && (
        <div className="absolute top-3 left-3 z-30 pointer-events-auto">
          <button
            onClick={onOpenAlbumPicker}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-500/90 hover:bg-amber-400 text-slate-950 font-bold text-xs shadow-lg backdrop-blur-md transition"
            title="Tap here to refresh your Google Photos selection."
          >
            <FolderOpen className="w-3.5 h-3.5" />
            <span>Refresh Google Photos Selection</span>
          </button>
        </div>
      )}

      {/* Subtle top vignette for readability */}
      <div className="absolute inset-x-0 top-0 h-14 bg-gradient-to-b from-black/60 via-black/20 to-transparent pointer-events-none z-[2]" />

      {/* Subtle bottom gradient scrim blending into the middle / calendar section */}
      <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-slate-950/90 via-slate-950/30 to-transparent pointer-events-none z-[2]" />

      {/* Controls on hover or touch */}
      {photosCount > 1 && (
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

          {/* Quick Reshuffle button on hover */}
          {randomOrder && (
            <button
              onClick={handleReshuffle}
              className="px-2.5 py-1 rounded-full bg-black/60 backdrop-blur-md border border-pink-500/30 text-white text-[11px] font-semibold flex items-center gap-1.5 hover:bg-black/90 transition shadow-lg pointer-events-auto"
              title="Reshuffle photos in random order"
              aria-label="Reshuffle photos"
            >
              <Shuffle className="w-3 h-3 text-pink-400" />
              <span>Shuffle</span>
            </button>
          )}

          <button
            onClick={handleNext}
            className="w-8 h-8 rounded-full bg-black/60 backdrop-blur-md border border-white/20 text-white flex items-center justify-center hover:bg-black/90 transition shadow-lg"
            aria-label="Next photo"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      )}

      {/* Bottom Photo Metadata: Caption on Left, Small Date Tag in Bottom-Right Corner */}
      {currentPhoto && (
        <div className="absolute bottom-3 left-4 right-4 z-20 pointer-events-none flex items-end justify-between gap-3">
          {/* Caption on Left */}
          <div className="flex-1 min-w-0">
            {currentPhoto.caption && !isFileName(currentPhoto.caption, currentPhoto.filename) && (
              <p className="text-xs sm:text-sm font-medium text-white/95 drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)] line-clamp-1">
                {currentPhoto.caption}
              </p>
            )}
          </div>

          {/* Small Tag in Bottom-Right Corner with the Date of the Photo */}
          {formatPhotoDate(currentPhoto) && (
            <div className="flex-shrink-0">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black/65 backdrop-blur-md border border-white/20 text-white shadow-[0_2px_8px_rgba(0,0,0,0.8)]">
                <Calendar className="w-3.5 h-3.5 text-blue-400 flex-shrink-0" />
                <span className="text-[11px] sm:text-xs font-semibold tracking-wide text-slate-100 drop-shadow">
                  {formatPhotoDate(currentPhoto)}
                </span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
