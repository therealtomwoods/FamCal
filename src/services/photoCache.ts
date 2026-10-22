import { useState, useEffect, useRef, useCallback } from 'react';
import { PhotoItem } from '../types';

interface CachedPhoto {
  blobUrl: string;
  photoId: string;
  createdAt: number;
  lastAccessed: number;
}

const LEGACY_DISK_CACHE_NAME = 'famcal-photo-blobs-v1';
const DISK_CACHE_NAME = 'famcal-photo-blobs-v2';

function getDiskCacheUrl(photoId: string): string {
  return `https://famcal-cache.local/photo/${encodeURIComponent(photoId)}`;
}

async function readBlobHeaderBytes(blob: Blob, length = 12): Promise<Uint8Array | null> {
  const slice = blob.slice(0, length);
  if (typeof slice.arrayBuffer === 'function') {
    const buf = await slice.arrayBuffer();
    return new Uint8Array(buf);
  }
  if (typeof FileReader !== 'undefined') {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        if (reader.result instanceof ArrayBuffer) {
          resolve(new Uint8Array(reader.result));
        } else {
          resolve(null);
        }
      };
      reader.onerror = () => resolve(null);
      reader.readAsArrayBuffer(slice);
    });
  }
  return null;
}

/**
 * Inspects the first 12 bytes of a Blob to verify it is a genuine binary image
 * (JPEG, PNG, GIF, WebP, BMP, AVIF/HEIC) and never an HTML or JSON error page.
 */
export async function isValidImageBlob(blob: Blob | null | undefined): Promise<boolean> {
  if (!blob || blob.size <= 200) return false;
  try {
    const b = await readBlobHeaderBytes(blob, 12);
    if (!b) {
      return Boolean(blob.type && blob.type.startsWith('image/') && blob.size > 1000);
    }
    if (b.length < 4) return false;

    // JPEG: FF D8 FF
    if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return true;
    // PNG: 89 50 4E 47
    if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return true;
    // GIF: 47 49 46 38
    if (b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x38) return true;
    // WebP: RIFF....WEBP
    if (
      b.length >= 12 &&
      b[0] === 0x52 &&
      b[1] === 0x49 &&
      b[2] === 0x46 &&
      b[3] === 0x46 &&
      b[8] === 0x57 &&
      b[9] === 0x45 &&
      b[10] === 0x42 &&
      b[11] === 0x50
    ) {
      return true;
    }
    // BMP: 42 4D
    if (b[0] === 0x42 && b[1] === 0x4d) return true;
    // ISO Base Media File Format (AVIF / HEIC): ....ftyp
    if (b.length >= 8 && b[4] === 0x66 && b[5] === 0x74 && b[6] === 0x79 && b[7] === 0x70) {
      return true;
    }

    return false;
  } catch {
    return Boolean(blob.type && blob.type.startsWith('image/') && blob.size > 1000);
  }
}

/**
 * Verifies that the browser can actually decode and render the image URL with non-zero dimensions.
 */
export function verifyImageDecodes(url: string, timeoutMs = 4500): Promise<boolean> {
  if (typeof window === 'undefined' || !url) return Promise.resolve(false);
  return new Promise((resolve) => {
    const img = new window.Image();
    let settled = false;
    const finish = (ok: boolean) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      img.onload = null;
      img.onerror = null;
      resolve(ok);
    };
    const timer = setTimeout(() => finish(false), timeoutMs);
    if (!url.startsWith('blob:') && !url.startsWith('data:')) {
      img.referrerPolicy = 'no-referrer';
    }
    img.onload = () => finish(img.naturalWidth > 0 && img.naturalHeight > 0);
    img.onerror = () => finish(false);
    img.src = url;
  });
}

export async function getDiskCachedBlob(photoId: string): Promise<Blob | null> {
  if (typeof caches === 'undefined' || !photoId) return null;
  const cacheUrl = getDiskCacheUrl(photoId);

  for (const cacheName of [DISK_CACHE_NAME, LEGACY_DISK_CACHE_NAME]) {
    try {
      const cache = await caches.open(cacheName);
      const res = await cache.match(cacheUrl);
      if (res && res.ok) {
        const blob = await res.blob();
        if (await isValidImageBlob(blob)) {
          return blob;
        } else {
          await cache.delete(cacheUrl);
        }
      }
    } catch {
      // ignore
    }
  }
  return null;
}

export async function hasDiskCachedBlob(photoId: string): Promise<boolean> {
  if (typeof caches === 'undefined' || !photoId) return false;
  const cacheUrl = getDiskCacheUrl(photoId);

  for (const cacheName of [DISK_CACHE_NAME, LEGACY_DISK_CACHE_NAME]) {
    try {
      const cache = await caches.open(cacheName);
      const res = await cache.match(cacheUrl);
      if (res && res.ok) return true;
    } catch {
      // ignore
    }
  }
  return false;
}

export async function putDiskCachedBlob(photoId: string, blob: Blob): Promise<void> {
  if (typeof caches === 'undefined' || !photoId || !(await isValidImageBlob(blob))) return;
  try {
    const cache = await caches.open(DISK_CACHE_NAME);
    const response = new Response(blob, {
      headers: {
        'Content-Type': blob.type && blob.type.startsWith('image/') ? blob.type : 'image/jpeg',
        'Cache-Control': 'public, max-age=31536000',
      },
    });
    await cache.put(getDiskCacheUrl(photoId), response);
  } catch {
    // ignore storage quota errors gracefully
  }
}

export async function deleteDiskCachedBlob(photoId: string): Promise<void> {
  if (typeof caches === 'undefined' || !photoId) return;
  const cacheUrl = getDiskCacheUrl(photoId);
  for (const cacheName of [DISK_CACHE_NAME, LEGACY_DISK_CACHE_NAME]) {
    try {
      const cache = await caches.open(cacheName);
      await cache.delete(cacheUrl);
    } catch {
      // ignore
    }
  }
}

export async function clearDiskPhotoCache(): Promise<void> {
  if (typeof caches === 'undefined') return;
  try {
    await caches.delete(LEGACY_DISK_CACHE_NAME);
    await caches.delete(DISK_CACHE_NAME);
  } catch {
    // ignore
  }
}

function safeRevokeBlobUrl(url?: string, immediate = false): void {
  if (!url || !url.startsWith('blob:')) return;
  if (immediate) {
    try {
      URL.revokeObjectURL(url);
    } catch {
      // ignore
    }
    return;
  }
  // Delay revocation by 15 seconds so any active <img> or crossfade fallback never sees a revoked blob URL
  setTimeout(() => {
    try {
      URL.revokeObjectURL(url);
    } catch {
      // ignore
    }
  }, 15000);
}

// Global in-memory cache of active object URLs (keeps up to 20 object URLs in RAM)
class PhotoMemoryCache {
  private cache = new Map<string, CachedPhoto>();
  private inFlight = new Map<string, Promise<string | null>>();
  private failed = new Set<string>();
  private failureTimestamps = new Map<string, number>();
  private maxCacheEntries = 20;

  /**
   * Get cached blob/display URL for a photo if available
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
    // Allow retry after 45 seconds
    if (Date.now() - failedAt > 45000) {
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

  /**
   * Immediately invalidate a corrupted or expired entry from memory and disk
   */
  invalidate(photoId: string): void {
    const existing = this.cache.get(photoId);
    if (existing) {
      safeRevokeBlobUrl(existing.blobUrl);
      this.cache.delete(photoId);
    }
    this.markFailed(photoId);
    deleteDiskCachedBlob(photoId).catch(() => {});
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
   * Store a verified URL for a photo. Only prunes if protectedIds is explicitly provided
   * so active slides are never evicted mid-display.
   */
  set(photoId: string, blobUrl: string, protectedIds?: Set<string>): void {
    const existing = this.cache.get(photoId);
    if (existing && existing.blobUrl !== blobUrl) {
      safeRevokeBlobUrl(existing.blobUrl);
    }

    this.cache.set(photoId, {
      blobUrl,
      photoId,
      createdAt: Date.now(),
      lastAccessed: Date.now(),
    });

    if (protectedIds) {
      this.prune(protectedIds);
    }
  }

  /**
   * Evict entries that are not in the protected set when cache exceeds maxCacheEntries
   */
  prune(protectedIds?: Set<string>): void {
    if (this.cache.size <= this.maxCacheEntries) return;

    const candidates: CachedPhoto[] = [];
    for (const [id, entry] of this.cache.entries()) {
      if (!protectedIds || !protectedIds.has(id)) {
        candidates.push(entry);
      }
    }

    candidates.sort((a, b) => a.lastAccessed - b.lastAccessed);

    while (this.cache.size > this.maxCacheEntries && candidates.length > 0) {
      const victim = candidates.shift();
      if (!victim) break;

      safeRevokeBlobUrl(victim.blobUrl);
      this.cache.delete(victim.photoId);
    }
  }

  /**
   * Evict specific IDs or IDs not in the window
   */
  evictExcept(keepIds: Set<string>): void {
    for (const [id, entry] of this.cache.entries()) {
      if (!keepIds.has(id)) {
        safeRevokeBlobUrl(entry.blobUrl);
        this.cache.delete(id);
      }
    }
  }

  /**
   * Revoke all object URLs and clear cache completely
   */
  clearAll(): void {
    for (const entry of this.cache.values()) {
      safeRevokeBlobUrl(entry.blobUrl);
    }
    this.cache.clear();
    this.inFlight.clear();
    this.failed.clear();
    this.failureTimestamps.clear();
  }

  /**
   * Load photo with strict verification (checks RAM -> persistent CacheStorage -> network blob -> direct <img> load)
   */
  async loadPhoto(
    photo: PhotoItem,
    token?: string | null,
    onAuthExpired?: () => void
  ): Promise<string | null> {
    const photoId = photo.id;
    const rawUrl = photo.url || '';

    // 1. Check if already in memory
    const existing = this.get(photoId);
    if (existing) return existing;

    // 2. If photo URL is already a self-contained blob: or data: URL
    if (rawUrl.startsWith('blob:') || rawUrl.startsWith('data:')) {
      return rawUrl;
    }

    // 3. If it is a public URL (e.g. Unsplash demo photo)
    if (!photo.baseUrl && rawUrl && (rawUrl.includes('unsplash.com') || rawUrl.startsWith('/'))) {
      return rawUrl;
    }

    // 4. In-flight request deduplication (keyed by photoId + clean baseUrl so refreshed URLs bypass stale requests)
    const cleanKey = (photo.baseUrl || rawUrl || '').split('=')[0];
    const inFlightKey = `${photoId}:${cleanKey}`;
    const active = this.inFlight.get(inFlightKey);
    if (active) return active;

    const requestPromise = (async () => {
      try {
        // 5. Check persistent disk CacheStorage first (works offline & even after 7-day Google session limit)
        const diskBlob = await getDiskCachedBlob(photoId);
        if (diskBlob) {
          const blobUrl = URL.createObjectURL(diskBlob);
          if (await verifyImageDecodes(blobUrl)) {
            this.set(photoId, blobUrl);
            this.failed.delete(photoId);
            this.failureTimestamps.delete(photoId);
            return blobUrl;
          } else {
            safeRevokeBlobUrl(blobUrl, true);
            await deleteDiskCachedBlob(photoId);
          }
        }

        // 6. If recently marked failed on network, skip network retry for 45s
        if (this.isFailed(photoId)) {
          return null;
        }

        // 7. Fetch binary image from proxy / Google CDN and persist to disk CacheStorage
        const blob = await fetchPhotoBlobBytes(photo, token || undefined, onAuthExpired);
        if (blob) {
          const blobUrl = URL.createObjectURL(blob);
          if (await verifyImageDecodes(blobUrl)) {
            await putDiskCachedBlob(photoId, blob);
            this.set(photoId, blobUrl);
            this.failed.delete(photoId);
            this.failureTimestamps.delete(photoId);
            return blobUrl;
          } else {
            safeRevokeBlobUrl(blobUrl, true);
          }
        }

        // 8. Fallback for static hosts (e.g. GitHub Pages) or non-CORS environments:
        // Test direct browser <img> loading without custom headers
        const directBase = (photo.baseUrl || rawUrl || '').split('=')[0];
        if (directBase && directBase.startsWith('https://')) {
          const directCandidates = Array.from(
            new Set(
              [
                `${directBase}=w1200-h800`,
                rawUrl && rawUrl.startsWith('https://') ? rawUrl : '',
              ].filter(Boolean)
            )
          );

          for (const candidateUrl of directCandidates) {
            if (await verifyImageDecodes(candidateUrl, 3500)) {
              this.set(photoId, candidateUrl);
              this.failed.delete(photoId);
              this.failureTimestamps.delete(photoId);
              return candidateUrl;
            }
          }
        }

        // If all network + direct <img> methods failed for a Google photo, notify caller to refresh baseUrls
        if (photo.baseUrl) {
          onAuthExpired?.();
        }
        this.markFailed(photoId);
        return null;
      } catch {
        this.markFailed(photoId);
        return null;
      } finally {
        this.inFlight.delete(inFlightKey);
      }
    })();

    this.inFlight.set(inFlightKey, requestPromise);
    return requestPromise;
  }
}

export const photoMemoryCache = new PhotoMemoryCache();

/**
 * Low-level authenticated blob fetcher:
 * 1. Tries local proxy /api/photo with Authorization header
 * 2. Tries direct fetch with Authorization header and CORS
 * 3. Tries direct fetch without custom headers (avoids CORS preflight rejection on public signed baseUrls)
 * 4. Tries direct fetch with =d download parameter
 */
async function fetchPhotoBlobBytes(
  photo: PhotoItem,
  token?: string,
  onAuthExpired?: () => void
): Promise<Blob | null> {
  const baseUrl = photo.baseUrl || photo.url;
  if (!baseUrl) return null;

  const cleanBase = baseUrl.split('=')[0];
  // w1200-h800 scales proportionally inside a 1200x800 bounding box without cropping and matches browser HTTP cache
  const targetUrl = `${cleanBase}=w1200-h800`;

  const headers: Record<string, string> = {};
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  // 1. Try local proxy first (works in Vite dev server & Pi-Kiosk local server)
  let proxyRejectedUpstream = false;
  try {
    const proxyUrl = `/api/photo?url=${encodeURIComponent(targetUrl)}`;
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 3500);

    const res = await fetch(proxyUrl, {
      headers,
      signal: ctrl.signal,
    }).finally(() => clearTimeout(timer));

    const contentType = res.headers.get('content-type') || '';
    if (res.ok && contentType.startsWith('image/')) {
      const blob = await res.blob();
      if (await isValidImageBlob(blob)) {
        return blob;
      }
    } else if (res.status === 401 || res.status === 403) {
      proxyRejectedUpstream = true;
      onAuthExpired?.();
    } else if (res.status === 400 || res.status === 500) {
      proxyRejectedUpstream = true;
    }
  } catch {
    // Continue to direct fetch
  }

  // Also check if =w1600-h1600 is in local proxy/browser HTTP cache before giving up on proxy
  try {
    const altProxyUrl = `/api/photo?url=${encodeURIComponent(`${cleanBase}=w1600-h1600`)}`;
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 2500);

    const res = await fetch(altProxyUrl, {
      headers,
      signal: ctrl.signal,
    }).finally(() => clearTimeout(timer));

    const contentType = res.headers.get('content-type') || '';
    if (res.ok && contentType.startsWith('image/')) {
      const blob = await res.blob();
      if (await isValidImageBlob(blob)) {
        return blob;
      }
    }
  } catch {
    // ignore
  }

  // 2. Direct authenticated fetch (Google Photos Picker API allows direct GET with Bearer token)
  if (!proxyRejectedUpstream && token) {
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 3500);

      const res = await fetch(targetUrl, {
        headers,
        referrerPolicy: 'no-referrer',
        signal: ctrl.signal,
      }).finally(() => clearTimeout(timer));

      if (res.ok) {
        const blob = await res.blob();
        if (await isValidImageBlob(blob)) {
          return blob;
        }
      } else if (res.status === 401 || res.status === 403) {
        onAuthExpired?.();
      }
    } catch {
      // Continue to simple credential-less fetch
    }
  }

  // 3. Simple GET fetch without custom headers (avoids CORS preflight failure on static hosts)
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 3500);

    const res = await fetch(targetUrl, {
      referrerPolicy: 'no-referrer',
      signal: ctrl.signal,
    }).finally(() => clearTimeout(timer));

    if (res.ok) {
      const blob = await res.blob();
      if (await isValidImageBlob(blob)) {
        return blob;
      }
    }
  } catch {
    // Continue to download parameter fallback
  }

  // 4. Direct fetch with =d (download parameter)
  if (!proxyRejectedUpstream) {
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 3500);

      const res = await fetch(`${cleanBase}=d`, {
        headers,
        referrerPolicy: 'no-referrer',
        signal: ctrl.signal,
      }).finally(() => clearTimeout(timer));

      if (res.ok) {
        const blob = await res.blob();
        if (await isValidImageBlob(blob)) {
          return blob;
        }
      } else if (res.status === 401 || res.status === 403) {
        onAuthExpired?.();
      }
    } catch {
      // All attempts failed
    }
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
  /**
   * Monotonic version counter that increments whenever cache state changes
   */
  cacheVersion: number;
  /**
   * Invalidate a broken photo at index from memory and disk caches
   */
  invalidatePhoto: (index: number) => void;
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
  const [version, setVersion] = useState(0);
  const loadingIndicesRef = useRef<Set<number>>(new Set());
  const queueRunIdRef = useRef<number>(0);
  const currentIndexRef = useRef<number>(currentIndex);
  currentIndexRef.current = currentIndex;

  const photosLength = photos?.length || 0;

  // Signature of token + first/last photo baseUrls so we only reset failed state when URLs actually change
  const urlSignature = `${token || ''}:${photosLength}:${photos?.[0]?.baseUrl || ''}:${photos?.[photosLength - 1]?.baseUrl || ''}`;

  // Clear transient failure markers only when token or actual baseUrl signature updates
  useEffect(() => {
    if (token || photosLength > 0) {
      photoMemoryCache.clearFailed();
    }
  }, [urlSignature, token, photosLength]);

  // Window configuration: current + up to 4 ready photos ahead + 1 behind
  const AHEAD_COUNT = 4;

  // Background sequential queue runner:
  // 1. Fast-path loads disk-cached photos first (<20ms) so a family photo is always ready immediately on startup.
  // 2. Then loads uncached network photos in the background.
  useEffect(() => {
    if (photosLength === 0) return;

    const currentRunId = ++queueRunIdRef.current;

    const isImmediatelyReady = (photo: PhotoItem): boolean => {
      const rawUrl = photo.url || '';
      return (
        photoMemoryCache.has(photo.id) ||
        rawUrl.startsWith('data:') ||
        rawUrl.startsWith('blob:') ||
        (!photo.baseUrl && Boolean(rawUrl) && rawUrl.includes('unsplash.com'))
      );
    };

    const runSequentialQueue = async () => {
      const protectedIds = new Set<string>();
      const currentPhoto = photos[currentIndex];
      if (currentPhoto?.id) protectedIds.add(currentPhoto.id);
      const prevPhoto = photos[(currentIndex - 1 + photosLength) % photosLength];
      if (prevPhoto?.id) protectedIds.add(prevPhoto.id);

      const loadSingleIndex = async (idx: number): Promise<boolean> => {
        const photo = photos[idx];
        if (!photo) return false;

        if (isImmediatelyReady(photo)) {
          protectedIds.add(photo.id);
          return true;
        }

        if (photoMemoryCache.isFailed(photo.id)) {
          return false;
        }

        loadingIndicesRef.current.add(idx);
        try {
          const loadedUrl = await photoMemoryCache.loadPhoto(photo, token, onNeedBaseUrlRefresh);
          if (loadedUrl) {
            protectedIds.add(photo.id);
          }
          if (queueRunIdRef.current === currentRunId) {
            setVersion((v) => v + 1);
          }
          return Boolean(loadedUrl);
        } catch {
          return false;
        } finally {
          loadingIndicesRef.current.delete(idx);
        }
      };

      // Phase 1: Instant Disk-Cache Fast Path (<20ms)
      // Check currentIndex and scan ahead for photos already in persistent CacheStorage on disk
      // BEFORE blocking on any slow network requests!
      let readyAhead = 0;
      const currentReadyOrOnDisk =
        currentPhoto &&
        (isImmediatelyReady(currentPhoto) || (await hasDiskCachedBlob(currentPhoto.id)));

      if (currentReadyOrOnDisk) {
        if (queueRunIdRef.current !== currentRunId) return;
        await loadSingleIndex(currentIndex);
      }

      // Scan forward for disk-cached or memory-ready photos so Slideshow has immediate slides ready
      for (let offset = 1; offset < photosLength; offset++) {
        if (queueRunIdRef.current !== currentRunId) break;
        if (readyAhead >= AHEAD_COUNT) break;

        const idx = (currentIndex + offset) % photosLength;
        const photo = photos[idx];
        if (!photo) continue;

        if (isImmediatelyReady(photo)) {
          protectedIds.add(photo.id);
          readyAhead++;
          continue;
        }

        const onDisk = await hasDiskCachedBlob(photo.id);
        if (onDisk) {
          const ok = await loadSingleIndex(idx);
          if (ok) {
            readyAhead++;
          }
        }
      }

      // Phase 2: Network Fetch Path for Uncached Photos
      // If currentIndex wasn't on disk, try loading it from network now
      if (!currentReadyOrOnDisk) {
        if (queueRunIdRef.current !== currentRunId) return;
        await loadSingleIndex(currentIndex);
      }

      // Try loading upcoming uncached photos from network so newly encountered slides are cached
      let networkCount = 0;
      const maxNetworkAttempts = Math.min(photosLength - 1, 6);

      for (let offset = 1; offset < photosLength; offset++) {
        if (queueRunIdRef.current !== currentRunId) break;
        if (networkCount >= maxNetworkAttempts) break;

        const idx = (currentIndex + offset) % photosLength;
        const photo = photos[idx];
        if (!photo || isImmediatelyReady(photo) || photoMemoryCache.isFailed(photo.id)) {
          continue;
        }

        networkCount++;
        const ok = await loadSingleIndex(idx);
        if (ok) {
          readyAhead++;
          if (readyAhead >= AHEAD_COUNT + 2) break;
        }

        if (queueRunIdRef.current !== currentRunId) break;
        await new Promise((resolve) => setTimeout(resolve, 40));
      }

      if (queueRunIdRef.current === currentRunId) {
        photoMemoryCache.prune(protectedIds);
      }
    };

    runSequentialQueue();

    return () => {
      if (queueRunIdRef.current === currentRunId) {
        queueRunIdRef.current++;
      }
    };
  }, [photos, currentIndex, token, photosLength, onNeedBaseUrlRefresh]);

  // Background parallel disk archiver:
  // Copies all 1,000+ selected photos into persistent CacheStorage on disk using 2 concurrent workers,
  // starting from currentIndex and pausing gracefully if network URLs are currently expired.
  useEffect(() => {
    if (photosLength === 0) return;
    let cancelled = false;

    const archiveRemainingToDisk = async () => {
      await new Promise((r) => setTimeout(r, 2500));
      if (cancelled) return;

      const startIdx = currentIndexRef.current % photosLength;
      let cursor = 0;
      let consecutiveFailures = 0;
      const CONCURRENCY = 2;

      const worker = async () => {
        while (!cancelled && cursor < photosLength) {
          const offset = cursor++;
          const idx = (startIdx + offset) % photosLength;
          const p = photos[idx];
          if (!p || !p.id || !p.baseUrl) continue;
          const rawUrl = p.url || '';
          if (rawUrl.startsWith('data:') || rawUrl.startsWith('blob:') || rawUrl.includes('unsplash.com')) continue;

          const alreadyOnDisk = await hasDiskCachedBlob(p.id);
          if (alreadyOnDisk) continue;

          if (cancelled) break;
          try {
            const blob = await fetchPhotoBlobBytes(p, token || undefined, onNeedBaseUrlRefresh);
            if (blob && !cancelled) {
              consecutiveFailures = 0;
              await putDiskCachedBlob(p.id, blob);
              setVersion((v) => v + 1);
            } else {
              consecutiveFailures++;
              if (consecutiveFailures >= 6) {
                onNeedBaseUrlRefresh?.();
                // Pause for 30s if network URLs are currently expired so we don't flood the network
                await new Promise((r) => setTimeout(r, 30000));
                consecutiveFailures = 0;
              }
            }
          } catch {
            // ignore
          }

          await new Promise((r) => setTimeout(r, 150));
        }
      };

      await Promise.all(
        Array.from({ length: Math.min(CONCURRENCY, photosLength) }, () => worker())
      );
    };

    archiveRemainingToDisk();

    return () => {
      cancelled = true;
    };
  }, [urlSignature, photosLength, token, onNeedBaseUrlRefresh]);

  // Helper getters (depend on version so callers always see fresh cache state on re-render)
  const getPhotoSrc = useCallback(
    (index: number): string | undefined => {
      void version;
      if (!photos || index < 0 || index >= photos.length) return undefined;
      const photo = photos[index];
      if (!photo) return undefined;

      // 1. Check in-memory blob cache
      const cached = photoMemoryCache.get(photo.id);
      if (cached) return cached;

      // 2. Self-contained data or blob URL
      const rawUrl = photo.url || '';
      if (rawUrl.startsWith('data:') || rawUrl.startsWith('blob:')) {
        return rawUrl;
      }

      // 3. Public demo images (Unsplash)
      if (!photo.baseUrl && rawUrl && rawUrl.includes('unsplash.com')) {
        return rawUrl;
      }

      // 4. Otherwise, not ready yet
      return undefined;
    },
    [photos, version]
  );

  const isPhotoReady = useCallback(
    (index: number): boolean => {
      return Boolean(getPhotoSrc(index));
    },
    [getPhotoSrc]
  );

  const isPhotoLoading = useCallback(
    (index: number): boolean => {
      void version;
      return loadingIndicesRef.current.has(index);
    },
    [version]
  );

  const hasPhotoFailed = useCallback(
    (index: number): boolean => {
      void version;
      if (!photos || index < 0 || index >= photos.length) return false;
      const photo = photos[index];
      return photo ? photoMemoryCache.isFailed(photo.id) : false;
    },
    [photos, version]
  );

  const invalidatePhoto = useCallback(
    (index: number): void => {
      if (!photos || index < 0 || index >= photos.length) return;
      const photo = photos[index];
      if (photo?.id) {
        photoMemoryCache.invalidate(photo.id);
        setVersion((v) => v + 1);
      }
    },
    [photos]
  );

  return {
    getPhotoSrc,
    isPhotoReady,
    isPhotoLoading,
    hasPhotoFailed,
    cachedCount: photos.filter((_, idx) => isPhotoReady(idx)).length,
    cacheVersion: version,
    invalidatePhoto,
  };
}
