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

const SHUFFLED_DECK_STORAGE_KEY = 'famcal_shuffled_deck_v1';
const SLIDESHOW_CURSOR_STORAGE_KEY = 'famcal_slideshow_cursor_v1';

function loadStoredDeckIds(): string[] {
  try {
    const raw = localStorage.getItem(SHUFFLED_DECK_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveStoredDeckIds(ids: string[]): void {
  try {
    localStorage.setItem(SHUFFLED_DECK_STORAGE_KEY, JSON.stringify(ids));
  } catch {
    // ignore
  }
}

function loadStoredCursor(): number {
  try {
    const raw = localStorage.getItem(SLIDESHOW_CURSOR_STORAGE_KEY);
    const parsed = raw ? parseInt(raw, 10) : 0;
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
  } catch {
    return 0;
  }
}

function saveStoredCursor(index: number): void {
  try {
    localStorage.setItem(SLIDESHOW_CURSOR_STORAGE_KEY, String(index));
  } catch {
    // ignore
  }
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
  const [currentIndex, setCurrentIndex] = useState<number>(() => loadStoredCursor());
  const [previousIndex, setPreviousIndex] = useState<number | null>(null);
  const [fallbackIndex, setFallbackIndex] = useState(0);
  const [isHovered, setIsHovered] = useState(false);
  const [shuffleVersion, setShuffleVersion] = useState(0);
  const lastWorkingPhotoRef = useRef<{ src: string; photo: PhotoItem } | null>(null);
  const waitingForNextRef = useRef<boolean>(false);

  // Shuffled photo IDs reference to preserve consistent sequence across reloads & background baseUrl refreshes
  const shuffledIdsRef = useRef<string[]>(loadStoredDeckIds());
  // Track photo IDs already shown in the current pass so we never loop back over recently displayed slides
  const visitedInCycleRef = useRef<Set<string>>(new Set());

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

    // If existing shuffled set matches current photos (e.g. page reload or background baseUrl refresh at 25m),
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

    // New photo collection or manual reshuffle triggered: generate fresh unbiased shuffle across all 1,000+ photos
    const shuffled = shuffleArray(photos);
    const newIds = shuffled.map((p) => p.id);
    shuffledIdsRef.current = newIds;
    visitedInCycleRef.current.clear();
    saveStoredDeckIds(newIds);
    return shuffled;
  }, [photos, randomOrder, shuffleVersion]);

  const photosCount = displayPhotos?.length || 0;

  // In-memory sliding-window cache hook:
  // Silently pre-caches currentIndex + up to 4 working photos ahead in the background.
  const {
    getPhotoSrc,
    isPhotoReady,
    isPhotoLoading,
    hasPhotoFailed,
    cachedCount,
    cacheVersion,
    invalidatePhoto,
  } = usePhotoCache(displayPhotos, currentIndex, userToken, onPhotosNeedRefresh);

  const currentIndexRef = useRef(currentIndex);
  currentIndexRef.current = currentIndex;

  // Find the next photo after fromIndex that is cached & ready in memory without repeating
  // any photo already displayed in the current pass.
  const findNextReadyIndex = useCallback(
    (fromIndex: number): number | null => {
      if (photosCount <= 1) return null;

      // 1. Scan forward for the first ready photo that hasn't been displayed in this cycle yet
      for (let offset = 1; offset < photosCount; offset++) {
        const idx = (fromIndex + offset) % photosCount;
        const candidate = displayPhotos[idx];
        if (candidate && isPhotoReady(idx) && !visitedInCycleRef.current.has(candidate.id)) {
          return idx;
        }
      }

      // 2. All available ready photos have been shown in this pass: clear visited history and start a fresh pass
      if (visitedInCycleRef.current.size > 0) {
        visitedInCycleRef.current.clear();
        const currentPhoto = displayPhotos[fromIndex];
        if (currentPhoto?.id) {
          visitedInCycleRef.current.add(currentPhoto.id);
        }
        for (let offset = 1; offset < photosCount; offset++) {
          const idx = (fromIndex + offset) % photosCount;
          if (isPhotoReady(idx)) {
            return idx;
          }
        }
      }

      return null;
    },
    [photosCount, displayPhotos, isPhotoReady]
  );

  const findPrevReadyIndex = useCallback(
    (fromIndex: number): number | null => {
      if (photosCount <= 1) return null;
      for (let offset = 1; offset < photosCount; offset++) {
        const idx = (fromIndex - offset + photosCount) % photosCount;
        if (isPhotoReady(idx)) {
          return idx;
        }
      }
      return null;
    },
    [photosCount, isPhotoReady]
  );

  const findNextReadyIndexRef = useRef(findNextReadyIndex);
  findNextReadyIndexRef.current = findNextReadyIndex;

  const commitTransition = useCallback(
    (nextIdx: number) => {
      const current = currentIndexRef.current;
      waitingForNextRef.current = false;
      if (current !== nextIdx) {
        const currentPhoto = displayPhotos?.[current];
        if (currentPhoto?.id) {
          visitedInCycleRef.current.add(currentPhoto.id);
        }
        const nextPhoto = displayPhotos?.[nextIdx];
        if (nextPhoto?.id) {
          visitedInCycleRef.current.add(nextPhoto.id);
        }

        setPreviousIndex(current);
        setCurrentIndex(nextIdx);
        saveStoredCursor(nextIdx);
      }
    },
    [displayPhotos]
  );

  // Automatic photo rotation every intervalSeconds (e.g. 15s):
  // Transitions immediately to the next ready cached photo, or sets waitingForNextRef
  // so it transitions the instant the next background photo finishes downloading.
  useEffect(() => {
    if (photosCount <= 1) return;

    const intervalMs = Math.max(3, intervalSeconds) * 1000;
    const timer = setInterval(() => {
      const nextReady = findNextReadyIndexRef.current(currentIndexRef.current);
      if (nextReady !== null) {
        commitTransition(nextReady);
      } else {
        waitingForNextRef.current = true;
        setFallbackIndex((prev) => (prev + 1) % RELIABLE_FALLBACKS.length);
      }
    }, intervalMs);

    return () => clearInterval(timer);
  }, [currentIndex, photosCount, intervalSeconds, commitTransition]);

  // Reactive cache watcher:
  // Triggered whenever cacheVersion updates (a background photo finished loading).
  // If the active slide is not ready yet (e.g. cold start) or the rotation timer is waiting,
  // immediately transition as soon as a ready photo is available in cache.
  useEffect(() => {
    if (photosCount <= 1) return;

    const currentReady = isPhotoReady(currentIndex);
    if (waitingForNextRef.current || !currentReady) {
      const nextReady = findNextReadyIndex(currentIndex);
      if (nextReady !== null) {
        commitTransition(nextReady);
      }
    }
  }, [cacheVersion, currentIndex, photosCount, isPhotoReady, findNextReadyIndex, commitTransition]);

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
    if (photosCount > 0 && currentIndex >= photosCount) {
      setCurrentIndex(0);
      saveStoredCursor(0);
    }
  }, [photosCount, currentIndex]);

  // Synchronously clamp currentIndex during render so an out-of-bounds cursor from localStorage
  // never leaves displayPhotos[activeIndex] undefined on initial mount
  const activeIndex = photosCount > 0 ? ((currentIndex % photosCount) + photosCount) % photosCount : 0;

  // Keep last working photo & its exact metadata paired together
  const currentRawSrc = getPhotoSrc(activeIndex);
  const currentCandidatePhoto = displayPhotos?.[activeIndex];

  useEffect(() => {
    if (currentRawSrc && currentCandidatePhoto) {
      visitedInCycleRef.current.add(currentCandidatePhoto.id);
      lastWorkingPhotoRef.current = {
        src: currentRawSrc,
        photo: currentCandidatePhoto,
      };
    }
  }, [currentRawSrc, currentCandidatePhoto]);

  // Strictly pair the displayed metadata (caption + bottom-right date tag) with the exact photo shown on screen
  const displayedPhoto = currentRawSrc
    ? currentCandidatePhoto
    : lastWorkingPhotoRef.current?.photo ?? null;

  const handlePrev = (e: React.MouseEvent) => {
    e.stopPropagation();
    const prevReady = findPrevReadyIndex(activeIndex);
    if (prevReady !== null) {
      commitTransition(prevReady);
    } else {
      setFallbackIndex((prev) => (prev - 1 + RELIABLE_FALLBACKS.length) % RELIABLE_FALLBACKS.length);
    }
  };

  const handleNext = (e: React.MouseEvent) => {
    e.stopPropagation();
    const nextReady = findNextReadyIndex(activeIndex);
    if (nextReady !== null) {
      commitTransition(nextReady);
    } else {
      waitingForNextRef.current = true;
      setFallbackIndex((prev) => (prev + 1) % RELIABLE_FALLBACKS.length);
    }
  };

  const handleReshuffle = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (photos && photos.length > 0) {
      const shuffled = shuffleArray(photos);
      const newIds = shuffled.map((p) => p.id);
      shuffledIdsRef.current = newIds;
      visitedInCycleRef.current.clear();
      saveStoredDeckIds(newIds);
      saveStoredCursor(0);
      setShuffleVersion((v) => v + 1);
      waitingForNextRef.current = false;
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

  // Virtualized slide window: mount active, previous (during crossfade), and next ready slide
  const visibleIndices: number[] = [activeIndex];
  if (previousIndex !== null && previousIndex !== activeIndex && previousIndex < photosCount) {
    visibleIndices.push(previousIndex);
  }
  const nextReadyIdx = findNextReadyIndex(activeIndex) ?? ((activeIndex + 1) % photosCount);
  if (nextReadyIdx !== activeIndex && !visibleIndices.includes(nextReadyIdx)) {
    visibleIndices.push(nextReadyIdx);
  }

  // Only show initial loading indicator if no family photo has ever been rendered yet
  const isInitialColdLoad = !currentRawSrc && !lastWorkingPhotoRef.current && isPhotoLoading(activeIndex);
  const fallbackSrc = RELIABLE_FALLBACKS[fallbackIndex % RELIABLE_FALLBACKS.length];

  return (
    <div
      className="relative w-full h-full overflow-hidden select-none bg-slate-950 group"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Background Slides with crossfade transition (strictly virtualized 3-slide buffer) */}
      {visibleIndices.map((idx) => {
        const photo = displayPhotos[idx];
        if (!photo) return null;

        const isCurrent = idx === activeIndex;
        const isActive = isCurrent;
        const rawSrc = getPhotoSrc(idx);

        // If active slide's blob isn't loaded yet, stay on last working photo or calm fallback
        const displaySrc =
          rawSrc ||
          (isCurrent
            ? lastWorkingPhotoRef.current?.src || fallbackSrc
            : undefined);

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
              onError={(e) => {
                const target = e.currentTarget;
                if (target.src !== fallbackSrc) {
                  target.src = fallbackSrc;
                }
              }}
            />
            {/* Full photo scaled proportionally to fit completely inside the container */}
            <img
              src={displaySrc}
              alt={photo.caption && !isFileName(photo.caption, photo.filename) ? photo.caption : 'Family photo'}
              referrerPolicy="no-referrer"
              className="relative z-[1] w-full h-full max-w-full max-h-full object-contain object-center"
              loading={isCurrent ? 'eager' : 'lazy'}
              onLoad={() => {
                if (rawSrc && photo) {
                  lastWorkingPhotoRef.current = { src: rawSrc, photo };
                }
              }}
              onError={(e) => {
                const target = e.currentTarget;
                if (lastWorkingPhotoRef.current?.src === displaySrc) {
                  lastWorkingPhotoRef.current = null;
                }
                if (rawSrc) {
                  invalidatePhoto(idx);
                }
                if (target.src !== fallbackSrc) {
                  target.src = fallbackSrc;
                }
              }}
            />
          </div>
        );
      })}

      {/* Initial cold-start indicator (hidden once the first photo is displayed; all further caching is silent) */}
      {isInitialColdLoad && (
        <div className="absolute bottom-12 right-4 z-10 pointer-events-none transition-opacity duration-500">
          <span className="text-[10px] text-blue-200 bg-black/60 backdrop-blur-sm px-2.5 py-0.5 rounded-full border border-blue-400/30 flex items-center gap-1.5 shadow-sm">
            <Loader2 className="w-3 h-3 text-blue-400 animate-spin" />
            Loading photos...
          </span>
        </div>
      )}

      {/* Session / Expired Photo URLs Indicator (shown when photos cannot be loaded from network or local disk cache) */}
      {(isSessionExpired || cachedCount === 0) && !isInitialColdLoad && hasPhotoFailed(currentIndex) && (
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
      {displayedPhoto && (
        <div className="absolute bottom-3 left-4 right-4 z-20 pointer-events-none flex items-end justify-between gap-3">
          {/* Caption on Left */}
          <div className="flex-1 min-w-0">
            {displayedPhoto.caption && !isFileName(displayedPhoto.caption, displayedPhoto.filename) && (
              <p className="text-xs sm:text-sm font-medium text-white/95 drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)] line-clamp-1">
                {displayedPhoto.caption}
              </p>
            )}
          </div>

          {/* Small Tag in Bottom-Right Corner with the Date of the Currently Displayed Photo */}
          {formatPhotoDate(displayedPhoto) && (
            <div className="flex-shrink-0">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black/65 backdrop-blur-md border border-white/20 text-white shadow-[0_2px_8px_rgba(0,0,0,0.8)]">
                <Calendar className="w-3.5 h-3.5 text-blue-400 flex-shrink-0" />
                <span className="text-[11px] sm:text-xs font-semibold tracking-wide text-slate-100 drop-shadow">
                  {formatPhotoDate(displayedPhoto)}
                </span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
