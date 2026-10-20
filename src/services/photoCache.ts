import { useState, useEffect, useRef, useCallback } from 'react';
import { PhotoItem } from '../types';

interface CachedPhoto {
  blobUrl: string;
  photoId: string;
  createdAt: number;
  lastAccessed: number;
}

const DISK_CACHE_NAME = 'famcal-photo-blobs-v1';

function getDiskCacheUrl(photoId: string): string {
  return `https://famcal-cache.local/photo/${encodeURIComponent(photoId)}`;
}

export async function getDiskCachedBlob(photoId: string): Promise<Blob | null> {
  if (typeof caches === 'undefined' || !photoId) return null;
  try {
    const cache = await caches.open(DISK_CACHE_NAME);
    const res = await cache.match(getDiskCacheUrl(photoId));
    if (res && res.ok) {
      const blob = await res.blob();
      if (blob && blob.size > 200) {
        return blob;
      }
    }
  } catch {
    // ignore
  }
  return null;
}

export async function hasDiskCachedBlob(photoId: string): Promise<boolean> {
  if (typeof caches === 'undefined' || !photoId) return false;
  try {
    const cache = await caches.open(DISK_CACHE_NAME);
    const res = await cache.match(getDiskCacheUrl(photoId));
    return Boolean(res && res.ok);
  } catch {
    return false;
  }
}

export async function putDiskCachedBlob(photoId: string, blob: Blob): Promise<void> {
  if (typeof caches === 'undefined' || !photoId || !blob || blob.size <= 200) return;
  try {
    const cache = await caches.open(DISK_CACHE_NAME);
    const response = new Response(blob, {
      headers: {
        'Content-Type': blob.type || 'image/jpeg',
        'Cache-Control': 'public, max-age=31536000',
      },
    });
    await cache.put(getDiskCacheUrl(photoId), response);
  } catch {
    // ignore storage quota errors gracefully
  }
}

export async function clearDiskPhotoCache(): Promise<void> {
  if (typeof caches === 'undefined') return;
  try {
    await caches.delete(DISK_CACHE_NAME);
  } catch {
    // ignore
  }
}

// Global in-memory cache of active object URLs (keeps at most 10 object URLs in RAM)
class PhotoMemoryCache {
  private cache = new Map<string, CachedPhoto>();
  private inFlight = new Map<string, Promise<string | null>>();
  private failed = new Set<string>();
  private failureTimestamps = new Map<string, number>();
  private maxCacheEntries = 10; // Keep at most 10 images in Chrome memory (~2MB)

  /**
   * Get cached blob URL for a photo if available
   */
  get(photoId: string): string | undefined {
    const entry = this.cache.get(photoId);
    if (entry) {
      entry.lastAccessed = Date.now();
      return entry.blobUrl;
    }
    return undefined;
  }

  has(photoId: string): boolean {
    return this.cache.has(photoId);
  }

  isFailed(photoId: string): boolean {
    const failedAt = this.failureTimestamps.get(photoId);
    if (!failedAt) return false;
    // Allow retry after 60 seconds
    if (Date.now() - failedAt > 60000) {
      this.failed.delete(photoId);
      this.failureTimestamps.delete(photoId);
      return false;
    }
    return true;
  }

  markFailed(photoId: string): void {
    this.failed.add(photoId);
    this.failureTimestamps.set(photoId, Date.now());
  }

  clearFailed(photoId?: string): void {
    if (photoId) {
      this.failed.delete(photoId);
      this.failureTimestamps.delete(photoId);
    } else {
      this.failed.clear();
      this.failureTimestamps.clear();
    }
  }

  /**
   * Store a blob URL for a photo and evict older entries outside the protected set
   */
  set(photoId: string, blobUrl: string, protectedIds?: Set<string>): void {
    // If already exists with different url, revoke old
    const existing = this.cache.get(photoId);
    if (existing && existing.blobUrl !== blobUrl) {
      try {
        URL.revokeObjectURL(existing.blobUrl);
      } catch {
        // ignore
      }
    }

    this.cache.set(photoId, {
      blobUrl,
      photoId,
      createdAt: Date.now(),
      lastAccessed: Date.now(),
    });

    this.prune(protectedIds);
  }

  /**
   * Evict entries that are not in the protected set when cache exceeds maxCacheEntries
   */
  prune(protectedIds?: Set<string>): void {
    if (this.cache.size <= this.maxCacheEntries) return;

    // Collect candidates for eviction (not in protectedIds)
    const candidates: CachedPhoto[] = [];
    for (const [id, entry] of this.cache.entries()) {
      if (!protectedIds || !protectedIds.has(id)) {
        candidates.push(entry);
      }
    }

    // Sort by lastAccessed ascending (oldest first)
    candidates.sort((a, b) => a.lastAccessed - b.lastAccessed);

    while (this.cache.size > this.maxCacheEntries && candidates.length > 0) {
      const victim = candidates.shift();
      if (!victim) break;

      try {
        URL.revokeObjectURL(victim.blobUrl);
      } catch {
        // ignore
      }
      this.cache.delete(victim.photoId);
    }
  }

  /**
   * Evict specific IDs or IDs not in the window
   */
  evictExcept(keepIds: Set<string>): void {
    for (const [id, entry] of this.cache.entries()) {
      if (!keepIds.has(id)) {
        try {
          URL.revokeObjectURL(entry.blobUrl);
        } catch {
          // ignore
        }
        this.cache.delete(id);
      }
    }
  }

  /**
   * Revoke all object URLs and clear cache completely
   */
  clearAll(): void {
    for (const entry of this.cache.values()) {
      try {
        URL.revokeObjectURL(entry.blobUrl);
      } catch {
        // ignore
      }
    }
    this.cache.clear();
    this.inFlight.clear();
    this.failed.clear();
    this.failureTimestamps.clear();
  }

  /**
   * Load photo blob with deduplication (checks RAM -> persistent CacheStorage -> network)
   */
  async loadPhoto(
    photo: PhotoItem,
    token?: string | null,
    onAuthExpired?: () => void
  ): Promise<string | null> {
    const photoId = photo.id;

    // 1. Check if already in memory
    const existing = this.get(photoId);
    if (existing) return existing;

    // 2. If photo URL is already a self-contained blob: or data: URL
    if (photo.url.startsWith('blob:') || photo.url.startsWith('data:')) {
      return photo.url;
    }

    // 3. If it is a public URL (e.g. Unsplash demo photo)
    if (!photo.baseUrl && photo.url && (photo.url.includes('unsplash.com') || photo.url.startsWith('/'))) {
      return photo.url;
    }

    // 4. In-flight request deduplication
    const active = this.inFlight.get(photoId);
    if (active) return active;

    const requestPromise = (async () => {
      try {
        // 5. Check persistent disk CacheStorage first (works offline & even after 7-day Google session limit)
        const diskBlob = await getDiskCachedBlob(photoId);
        if (diskBlob) {
          const blobUrl = URL.createObjectURL(diskBlob);
          this.set(photoId, blobUrl);
          this.failed.delete(photoId);
          this.failureTimestamps.delete(photoId);
          return blobUrl;
        }

        // 6. If recently marked failed on network, skip network retry for 60s
        if (this.isFailed(photoId)) {
          return null;
        }

        // 7. Fetch from Google CDN and persist to disk CacheStorage
        const blob = await fetchPhotoBlobBytes(photo, token || undefined, onAuthExpired);
        if (blob) {
          await putDiskCachedBlob(photoId, blob);
          const blobUrl = URL.createObjectURL(blob);
          this.set(photoId, blobUrl);
          this.failed.delete(photoId);
          this.failureTimestamps.delete(photoId);
          return blobUrl;
        } else {
          this.markFailed(photoId);
          return null;
        }
      } catch (err) {
        this.markFailed(photoId);
        return null;
      } finally {
        this.inFlight.delete(photoId);
      }
    })();

    this.inFlight.set(photoId, requestPromise);
    return requestPromise;
  }
}

export const photoMemoryCache = new PhotoMemoryCache();

/**
 * Low-level authenticated blob fetcher:
 * 1. Tries local proxy /api/photo with Authorization header
 * 2. Tries direct fetch with Authorization header and CORS
 * 3. Tries direct fetch with =d download parameter
 */
async function fetchPhotoBlobBytes(
  photo: PhotoItem,
  token?: string,
  onAuthExpired?: () => void
): Promise<Blob | null> {
  const baseUrl = photo.baseUrl || photo.url;
  if (!baseUrl) return null;

  const cleanBase = baseUrl.split('=')[0];
  // w1600-h1600 scales proportionally inside a 1600x1600 bounding box without cropping portrait or landscape photos
  const targetUrl = `${cleanBase}=w1600-h1600`;

  const headers: Record<string, string> = {};
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  // 1. Try local proxy first (works in Vite dev server & Pi-Kiosk local server)
  try {
    const proxyUrl = `/api/photo?url=${encodeURIComponent(targetUrl)}`;
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 8000);

    const res = await fetch(proxyUrl, {
      headers,
      signal: ctrl.signal,
    }).finally(() => clearTimeout(timer));

    if (res.ok) {
      const blob = await res.blob();
      if (blob.size > 0 && (blob.type.startsWith('image/') || blob.size > 200)) {
        return blob;
      }
    } else if (res.status === 401 || res.status === 403) {
      onAuthExpired?.();
    }
  } catch {
    // Continue to direct fetch
  }

  // 2. Direct authenticated fetch (Google Photos Picker API allows direct GET with Bearer token)
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 8000);

    const res = await fetch(targetUrl, {
      headers,
      referrerPolicy: 'no-referrer',
      signal: ctrl.signal,
    }).finally(() => clearTimeout(timer));

    if (res.ok) {
      const blob = await res.blob();
      if (blob.size > 0 && (blob.type.startsWith('image/') || blob.size > 200)) {
        return blob;
      }
    } else if (res.status === 401 || res.status === 403) {
      onAuthExpired?.();
    }
  } catch {
    // Continue to download parameter fallback
  }

  // 3. Direct fetch with =d (download parameter)
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 8000);

    const res = await fetch(`${cleanBase}=d`, {
      headers,
      referrerPolicy: 'no-referrer',
      signal: ctrl.signal,
    }).finally(() => clearTimeout(timer));

    if (res.ok) {
      const blob = await res.blob();
      if (blob.size > 0 && (blob.type.startsWith('image/') || blob.size > 200)) {
        return blob;
      }
    } else if (res.status === 401 || res.status === 403) {
      onAuthExpired?.();
    }
  } catch {
    // All attempts failed
  }

  return null;
}

export interface PhotoCacheHookResult {
  /**
   * Get the active display URL for photo at index. Returns blobUrl if cached,
   * or direct public URL, or undefined if still downloading.
   */
  getPhotoSrc: (index: number) => string | undefined;
  /**
   * Whether the photo at index has finished caching or is immediately ready
   */
  isPhotoReady: (index: number) => boolean;
  /**
   * Whether the photo at index is currently being downloaded in the background
   */
  isPhotoLoading: (index: number) => boolean;
  /**
   * Whether the photo at index failed to load
   */
  hasPhotoFailed: (index: number) => boolean;
  /**
   * Total number of cached images currently in the sliding window
   */
  cachedCount: number;
}

/**
 * React hook that manages a sliding-window cache of local photo blobs in Chrome.
 * Sequentially caches upcoming photos in the background (a few at a time),
 * guaranteeing zero memory leaks, zero database overhead, and instant slide transitions.
 */
export function usePhotoCache(
  photos: PhotoItem[],
  currentIndex: number,
  token?: string | null,
  onNeedBaseUrlRefresh?: () => void
): PhotoCacheHookResult {
  const [, setVersion] = useState(0);
  const loadingIndicesRef = useRef<Set<number>>(new Set());
  const queueRunIdRef = useRef<number>(0);

  const photosLength = photos?.length || 0;

  // Clear transient failure markers whenever token or photo list updates
  useEffect(() => {
    if (token || photosLength > 0) {
      photoMemoryCache.clearFailed();
    }
  }, [token, photos]);

  // Window configuration: current + 4 ahead + 1 behind = 6 protected images
  const AHEAD_COUNT = 4;
  const BEHIND_COUNT = 1;

  // Compute desired window of indices
  const getWindowIndices = useCallback(
    (center: number): number[] => {
      if (photosLength === 0) return [];
      const indices: number[] = [center];

      // Ahead indices in priority order
      for (let i = 1; i <= Math.min(AHEAD_COUNT, photosLength - 1); i++) {
        indices.push((center + i) % photosLength);
      }

      // Behind indices
      for (let i = 1; i <= Math.min(BEHIND_COUNT, photosLength - 1); i++) {
        indices.push((center - i + photosLength) % photosLength);
      }

      return Array.from(new Set(indices));
    },
    [photosLength]
  );

  // Background sequential queue runner
  useEffect(() => {
    if (photosLength === 0) return;

    const currentRunId = ++queueRunIdRef.current;
    const windowIndices = getWindowIndices(currentIndex);
    const protectedIds = new Set(
      windowIndices.map((idx) => photos[idx]?.id).filter(Boolean) as string[]
    );

    // Prune entries outside the current window
    photoMemoryCache.prune(protectedIds);

    // Sequential background download of uncached items in priority order
    const runSequentialQueue = async () => {
      for (const idx of windowIndices) {
        if (queueRunIdRef.current !== currentRunId) break;

        const photo = photos[idx];
        if (!photo) continue;

        // If already cached or public, skip
        if (photoMemoryCache.has(photo.id) || photo.url.startsWith('data:') || photo.url.startsWith('blob:')) {
          continue;
        }

        // If public demo URL, skip downloading
        if (!photo.baseUrl && photo.url && photo.url.includes('unsplash.com')) {
          continue;
        }

        loadingIndicesRef.current.add(idx);

        try {
          const loadedUrl = await photoMemoryCache.loadPhoto(photo, token, onNeedBaseUrlRefresh);
          if (queueRunIdRef.current === currentRunId && (loadedUrl || idx === currentIndex)) {
            setVersion((v) => v + 1);
          }
        } catch {
          // ignore
        } finally {
          loadingIndicesRef.current.delete(idx);
        }

        if (queueRunIdRef.current !== currentRunId) break;

        // Small 40ms pause between sequential fetches so network & UI stay completely smooth
        await new Promise((resolve) => setTimeout(resolve, 40));
      }
    };

    runSequentialQueue();

    return () => {
      if (queueRunIdRef.current === currentRunId) {
        queueRunIdRef.current++;
      }
    };
  }, [photos, currentIndex, token, photosLength, getWindowIndices, onNeedBaseUrlRefresh]);

  // Low-priority background disk archiver: gently caches remaining photos into CacheStorage on disk
  // without holding them in RAM so photos remain permanently playable even after Google's 7-day picker limit
  useEffect(() => {
    if (photosLength === 0 || !token) return;
    let cancelled = false;

    const archiveRemainingToDisk = async () => {
      // Wait 5s after mount/change so active slide window gets 100% network priority
      await new Promise((r) => setTimeout(r, 5000));

      for (let i = 0; i < photos.length; i++) {
        if (cancelled) break;
        const p = photos[i];
        if (!p || !p.id || !p.baseUrl) continue;
        if (p.url.startsWith('data:') || p.url.startsWith('blob:') || p.url.includes('unsplash.com')) continue;

        const alreadyOnDisk = await hasDiskCachedBlob(p.id);
        if (alreadyOnDisk) continue;

        if (cancelled) break;
        try {
          const blob = await fetchPhotoBlobBytes(p, token);
          if (blob && !cancelled) {
            await putDiskCachedBlob(p.id, blob);
          }
        } catch {
          // ignore
        }

        // Gentle 1.2s pause between background disk archives
        await new Promise((r) => setTimeout(r, 1200));
      }
    };

    archiveRemainingToDisk();

    return () => {
      cancelled = true;
    };
  }, [photos, photosLength, token]);

  // Helper getters
  const getPhotoSrc = useCallback(
    (index: number): string | undefined => {
      if (!photos || index < 0 || index >= photos.length) return undefined;
      const photo = photos[index];
      if (!photo) return undefined;

      // 1. Check in-memory blob cache
      const cached = photoMemoryCache.get(photo.id);
      if (cached) return cached;

      // 2. Self-contained data or blob URL
      if (photo.url.startsWith('data:') || photo.url.startsWith('blob:')) {
        return photo.url;
      }

      // 3. Public demo images (Unsplash)
      if (!photo.baseUrl && photo.url && photo.url.includes('unsplash.com')) {
        return photo.url;
      }

      // 4. Otherwise, not ready yet
      return undefined;
    },
    [photos]
  );

  const isPhotoReady = useCallback(
    (index: number): boolean => {
      return Boolean(getPhotoSrc(index));
    },
    [getPhotoSrc]
  );

  const isPhotoLoading = useCallback(
    (index: number): boolean => {
      return loadingIndicesRef.current.has(index);
    },
    []
  );

  const hasPhotoFailed = useCallback(
    (index: number): boolean => {
      if (!photos || index < 0 || index >= photos.length) return false;
      const photo = photos[index];
      return photo ? photoMemoryCache.isFailed(photo.id) : false;
    },
    [photos]
  );

  return {
    getPhotoSrc,
    isPhotoReady,
    isPhotoLoading,
    hasPhotoFailed,
    cachedCount: photos.filter((_, idx) => isPhotoReady(idx)).length,
  };
}
