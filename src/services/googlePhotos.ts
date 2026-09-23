import { PhotoAlbum, PhotoItem } from '../types';
import { DEMO_ALBUMS, DEMO_PHOTOS } from '../mock/demoData';

export const PICKED_PHOTOS_KEY = 'famcal_picked_photos';
const DB_NAME = 'FamCalPhotosDB';
const STORE_NAME = 'photos';

export interface PickerSession {
  id: string;
  pickerUri: string;
  mediaItemsSet?: boolean;
}

export interface PickerMediaItem {
  id: string;
  createTime?: string;
  type?: 'PHOTO' | 'VIDEO';
  mediaFile?: {
    baseUrl: string;
    mimeType?: string;
    filename?: string;
    mediaFileMetadata?: {
      width?: number;
      height?: number;
    };
  };
}

export interface PhotosFetchResult {
  success: boolean;
  albums: PhotoAlbum[];
  error?: string;
}

interface GPhotosAlbumResponse {
  albums?: Array<{
    id: string;
    title: string;
    coverPhotoBaseUrl?: string;
    mediaItemsCount?: string;
  }>;
  sharedAlbums?: Array<{
    id: string;
    title: string;
    coverPhotoBaseUrl?: string;
    mediaItemsCount?: string;
  }>;
  error?: {
    code?: number;
    message?: string;
    status?: string;
  };
}

interface GPhotosMediaSearchResponse {
  mediaItems?: Array<{
    id: string;
    baseUrl: string;
    filename?: string;
    description?: string;
    mediaMetadata?: {
      creationTime?: string;
      width?: string;
      height?: string;
      photo?: Record<string, unknown>;
    };
  }>;
}

// Active Picker Session reference for manual check/cancel triggers
let currentActiveSession: { id: string; token: string } | null = null;

export function getActivePickerSession(): { id: string; token: string } | null {
  return currentActiveSession;
}

/**
 * Native browser IndexedDB database for persistent high-resolution photo caching
 */
function openPhotoDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      return reject(new Error('IndexedDB not supported'));
    }
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(STORE_NAME);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function savePhotosToIndexedDB(photos: PhotoItem[]): Promise<void> {
  try {
    const db = await openPhotoDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    store.put(photos, 'active_photos');
  } catch (err) {
    console.warn('Failed to save photos to IndexedDB:', err);
  }
}

export async function loadPhotosFromIndexedDB(): Promise<PhotoItem[] | null> {
  try {
    const db = await openPhotoDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get('active_photos');
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

/**
 * Retrieve cached picked photos from localStorage or IndexedDB
 */
export function getStoredPickedPhotos(): PhotoItem[] {
  try {
    const raw = localStorage.getItem(PICKED_PHOTOS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * Load stored photos prioritizing IndexedDB high-resolution cache
 */
export async function loadStoredPhotos(): Promise<PhotoItem[]> {
  const idbPhotos = await loadPhotosFromIndexedDB();
  if (idbPhotos && idbPhotos.length > 0) {
    return idbPhotos;
  }
  return getStoredPickedPhotos();
}

/**
 * Cache picked photos in localStorage so slideshow runs seamlessly across reloads
 */
export function saveStoredPickedPhotos(photos: PhotoItem[]): void {
  try {
    localStorage.setItem(PICKED_PHOTOS_KEY, JSON.stringify(photos));
  } catch (err) {
    console.warn('LocalStorage full, saving lightweight version to localStorage:', err);
    try {
      const lightweight = photos.map((p) => ({
        ...p,
        // Only strip data URL if localStorage is full
        url: p.url.startsWith('data:') && p.baseUrl ? `${p.baseUrl}=w1200-h800` : p.url,
      }));
      localStorage.setItem(PICKED_PHOTOS_KEY, JSON.stringify(lightweight));
    } catch {
      // ignore
    }
  }
}

/**
 * Clear cached picked photos
 */
export function clearStoredPickedPhotos(): void {
  localStorage.removeItem(PICKED_PHOTOS_KEY);
  try {
    openPhotoDB().then((db) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).delete('active_photos');
    });
  } catch {
    // ignore
  }
}

/**
 * Helper to fetch with a timeout using AbortController (with fallback for Chrome < 66)
 */
function fetchWithTimeout(url: string, options: RequestInit = {}, timeoutMs = 8000): Promise<Response> {
  if (typeof AbortController !== 'undefined') {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeoutMs);
    return fetch(url, { ...options, signal: controller.signal }).finally(() => clearTimeout(id));
  }
  return fetch(url, options);
}

/**
 * Convert a binary Blob into a self-contained base64 data URL
 */
export function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/**
 * Download authenticated image bytes from Google Photos baseUrl.
 * Tries direct authenticated fetch with size parameters.
 */
export async function downloadPhotoBlob(baseUrl: string, token: string): Promise<Blob | null> {
  const cleanBase = baseUrl.split('=')[0];
  const targetUrl = `${cleanBase}=w1200-h800`;

  // 1. Direct fetch with Authorization header
  try {
    const res = await fetchWithTimeout(targetUrl, {
      headers: { Authorization: `Bearer ${token}` },
    }, 5000);
    if (res.ok) {
      const blob = await res.blob();
      if (blob.size > 0 && (blob.type.startsWith('image/') || blob.size > 1000)) {
        return blob;
      }
    }
  } catch (err) {
    console.warn('Direct photo fetch failed:', err);
  }

  // 2. Direct fetch with download parameter (=d)
  try {
    const origUrl = `${cleanBase}=d`;
    const res = await fetchWithTimeout(origUrl, {
      headers: { Authorization: `Bearer ${token}` },
    }, 5000);
    if (res.ok) {
      const blob = await res.blob();
      if (blob.size > 0 && (blob.type.startsWith('image/') || blob.size > 1000)) {
        return blob;
      }
    }
  } catch (origErr) {
    console.warn('Direct photo =d fetch failed:', origErr);
  }

  return null;
}

/**
 * Hydrates photo items by downloading authenticated image bytes in parallel batches
 * and turning them into self-contained Data URLs.
 */
export async function hydratePhotosWithImages(
  photos: PhotoItem[],
  token: string,
  onProgress?: (msg: string) => void,
  onBatchComplete?: (updatedPhotos: PhotoItem[]) => void
): Promise<PhotoItem[]> {
  const result: PhotoItem[] = photos.map((p) => ({ ...p }));
  const itemsToHydrate: { index: number; photo: PhotoItem }[] = [];

  for (let i = 0; i < photos.length; i++) {
    const p = photos[i];
    if (
      p.baseUrl &&
      !p.url.startsWith('data:') &&
      !p.url.startsWith('blob:') &&
      !p.url.includes('unsplash.com') &&
      !(p as any)._hydrationAttempted
    ) {
      itemsToHydrate.push({ index: i, photo: { ...p } });
    }
  }

  if (itemsToHydrate.length === 0) {
    return photos;
  }

  let completedCount = 0;
  const total = itemsToHydrate.length;
  const batchSize = 4; // 4 concurrent downloads for optimal throughput

  for (let b = 0; b < itemsToHydrate.length; b += batchSize) {
    const currentBatch = itemsToHydrate.slice(b, b + batchSize);
    await Promise.all(
      currentBatch.map(async ({ index, photo }) => {
        (photo as any)._hydrationAttempted = true;
        try {
          const blob = await downloadPhotoBlob(photo.baseUrl!, token);
          if (blob) {
            try {
              const dataUrl = await blobToDataUrl(blob);
              photo.url = dataUrl;
            } catch {
              photo.url = URL.createObjectURL(blob);
            }
          }
        } catch (err) {
          console.warn(`Failed hydrating photo ${index + 1}:`, err);
        }
        completedCount++;
        result[index] = photo;
      })
    );
    onProgress?.(`Caching photos (${completedCount} of ${total})...`);
    onBatchComplete?.([...result]);
  }

  return result;
}

/**
 * Format picker URL with /autoclose path without breaking existing query parameters
 */
function getAutoclosePickerUri(rawUri: string): string {
  try {
    const url = new URL(rawUri);
    if (!url.pathname.endsWith('/autoclose')) {
      url.pathname = url.pathname.replace(/\/+$/, '') + '/autoclose';
    }
    return url.toString();
  } catch {
    return rawUri.endsWith('/') ? `${rawUri}autoclose` : `${rawUri}/autoclose`;
  }
}

/**
 * 1. Create a Google Photos Picker Session
 * POST https://photospicker.googleapis.com/v1/sessions
 */
export async function createGooglePhotosPickerSession(token: string): Promise<PickerSession> {
  const res = await fetch('https://photospicker.googleapis.com/v1/sessions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({}),
  });

  if (!res.ok) {
    const errText = await res.text();
    let message = `Google Photos Picker API error (${res.status})`;
    try {
      const parsed = JSON.parse(errText);
      if (parsed.error?.message) {
        message = parsed.error.message;
      }
    } catch {
      // ignore
    }
    throw new Error(message);
  }

  return await res.json();
}

/**
 * 2. Check Picker Session Status
 * GET https://photospicker.googleapis.com/v1/sessions/{sessionId}
 */
export async function checkPickerSessionStatus(token: string, sessionId: string): Promise<boolean> {
  const sessionPath = sessionId.startsWith('sessions/') ? sessionId : `sessions/${sessionId}`;
  try {
    const res = await fetch(`https://photospicker.googleapis.com/v1/${sessionPath}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!res.ok) {
      return false;
    }

    const data = await res.json();
    return Boolean(data.mediaItemsSet);
  } catch {
    return false;
  }
}

function mapPickerItems(items: Array<PickerMediaItem | Record<string, any>>): PhotoItem[] {
  return items
    .filter((item) => item.mediaFile?.baseUrl || (item as any).baseUrl)
    .map((item) => {
      const baseUrl = item.mediaFile?.baseUrl || (item as any).baseUrl;
      const filename = item.mediaFile?.filename || (item as any).filename || 'Family Photo';
      const width = item.mediaFile?.mediaFileMetadata?.width || (item as any).width;
      const height = item.mediaFile?.mediaFileMetadata?.height || (item as any).height;
      return {
        id: item.id,
        url: `${baseUrl}=w1200-h800`,
        baseUrl: baseUrl,
        filename: filename,
        caption: undefined,
        width: typeof width === 'number' ? width : undefined,
        height: typeof height === 'number' ? height : undefined,
      };
    });
}

/**
 * 3. Fetch media items selected by the user in the picker session.
 * Automatically paginates through all pages using nextPageToken so all selected photos
 * (hundreds or thousands) are completely retrieved.
 * GET https://photospicker.googleapis.com/v1/mediaItems?sessionId={sessionId}&pageSize=100&pageToken={token}
 */
export async function fetchPickerSelectedMediaItems(token: string, sessionId: string): Promise<PhotoItem[]> {
  // Google Photos Picker API query param 'sessionId' expects the raw ID (strip sessions/ prefix)
  const cleanId = sessionId.replace(/^sessions\//, '');
  const allRawItems: PickerMediaItem[] = [];
  let pageToken: string | undefined = undefined;
  let idToTry = cleanId;

  while (true) {
    const baseUrlStr = 'https://photospicker.googleapis.com/v1/mediaItems';
    const params = new URLSearchParams();
    params.set('sessionId', idToTry);
    params.set('pageSize', '100');
    if (pageToken) {
      params.set('pageToken', pageToken);
    }

    try {
      const res = await fetch(`${baseUrlStr}?${params.toString()}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) {
        // If cleanId failed on very first request, try with sessions/ prefix as fallback
        if (allRawItems.length === 0 && idToTry === cleanId) {
          const sessionPath = sessionId.startsWith('sessions/') ? sessionId : `sessions/${sessionId}`;
          idToTry = sessionPath;
          continue;
        }
        const errText = await res.text();
        console.warn(`Picker mediaItems fetch error (status ${res.status}):`, errText);
        break;
      }

      const data: { mediaItems?: PickerMediaItem[]; nextPageToken?: string } = await res.json();
      if (data.mediaItems && data.mediaItems.length > 0) {
        allRawItems.push(...data.mediaItems);
      }

      pageToken = data.nextPageToken;
      if (!pageToken) {
        break; // All pages traversed
      }
    } catch (fetchErr) {
      console.warn('Network error during picker mediaItems pagination:', fetchErr);
      break;
    }
  }

  console.log(`Fetched total ${allRawItems.length} selected items from Google Photos Picker`);
  return mapPickerItems(allRawItems);
}

/**
 * 4. Delete Picker Session once photos are obtained or cancelled
 * DELETE https://photospicker.googleapis.com/v1/sessions/{sessionId}
 */
export async function deletePickerSession(token: string, sessionId: string): Promise<void> {
  try {
    const sessionPath = sessionId.startsWith('sessions/') ? sessionId : `sessions/${sessionId}`;
    await fetch(`https://photospicker.googleapis.com/v1/${sessionPath}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
  } catch (err) {
    console.warn('Failed to delete picker session:', err);
  }
}

/**
 * Processes selected photos with immediate fast playback and background streaming:
 * 1. Saves all raw photo metadata immediately so all photos (hundreds) are recognized.
 * 2. High-priority hydrates the first 8 photos so slideshow starts playing in ~1-2 seconds.
 * 3. Background streams and caches the remaining photos into IndexedDB without freezing the UI.
 */
async function processAndStreamPickedPhotos(
  rawPhotos: PhotoItem[],
  token: string,
  onStatusUpdate?: (status: string) => void
): Promise<PhotoItem[]> {
  // 1. Immediately save the full list to IndexedDB and localStorage
  saveStoredPickedPhotos(rawPhotos);
  savePhotosToIndexedDB(rawPhotos);

  // 2. High-priority hydration for first 8 photos to start slideshow immediately
  const initialBatchCount = Math.min(8, rawPhotos.length);
  onStatusUpdate?.(`Preparing first ${initialBatchCount} of ${rawPhotos.length} photos...`);

  const initialItems = rawPhotos.slice(0, initialBatchCount);
  const hydratedInitial = await hydratePhotosWithImages(initialItems, token);

  const fullList = [...rawPhotos];
  for (let i = 0; i < hydratedInitial.length; i++) {
    fullList[i] = hydratedInitial[i];
  }

  saveStoredPickedPhotos(fullList);
  savePhotosToIndexedDB(fullList);

  // 3. If there are more photos, stream remaining photos in the background
  if (rawPhotos.length > initialBatchCount) {
    onStatusUpdate?.(`✓ Playing first photos! Streaming remaining ${rawPhotos.length - initialBatchCount} in background...`);
    setTimeout(() => {
      hydratePhotosWithImages(
        fullList,
        token,
        (progress) => onStatusUpdate?.(progress),
        (updated) => {
          saveStoredPickedPhotos(updated);
          savePhotosToIndexedDB(updated);
        }
      ).catch((err) => console.warn('Background streaming hydration failed:', err));
    }, 150);
  } else {
    onStatusUpdate?.(`✓ Successfully loaded ${fullList.length} photos!`);
  }

  return fullList;
}

/**
 * Manually check active session status immediately (called when user clicks 'Check Photos Now')
 */
export async function checkActivePickerNow(): Promise<{ success: boolean; photos: PhotoItem[]; error?: string }> {
  if (!currentActiveSession) {
    return { success: false, photos: [], error: 'No active Google Photos selection in progress.' };
  }

  const { token, id } = currentActiveSession;
  const isSet = await checkPickerSessionStatus(token, id);
  if (!isSet) {
    return {
      success: false,
      photos: [],
      error: 'Google Photos has not received your selection yet. Make sure you select your photos and click "Done" in the Google window.',
    };
  }

  try {
    const rawPhotos = await fetchPickerSelectedMediaItems(token, id);
    await deletePickerSession(token, id);
    currentActiveSession = null;

    if (rawPhotos.length > 0) {
      const photos = await processAndStreamPickedPhotos(rawPhotos, token);
      return { success: true, photos };
    } else {
      return { success: false, photos: [], error: 'No photos were selected.' };
    }
  } catch (err: any) {
    return { success: false, photos: [], error: err?.message || 'Failed to retrieve photos' };
  }
}

/**
 * Explicitly cancel active picker session
 */
export async function cancelActivePickerSession(): Promise<void> {
  if (currentActiveSession) {
    await deletePickerSession(currentActiveSession.token, currentActiveSession.id);
    currentActiveSession = null;
  }
}

/**
 * High-Level Orchestrator for the Google Photos Picker Flow
 * Opens picker popup, keeps session alive while user browses photos,
 * polls until user confirms selection, downloads image bytes, and saves to cache.
 */
export async function launchGooglePhotosPicker(
  token: string,
  onStatusUpdate?: (status: string) => void
): Promise<{ success: boolean; photos: PhotoItem[]; error?: string }> {
  if (!token) {
    return { success: false, photos: [], error: 'Google account not signed in' };
  }

  try {
    // Cancel any dangling session before starting a fresh one
    await cancelActivePickerSession();

    onStatusUpdate?.('Initializing Google Photos Picker session...');

    // 1. Create Picker Session
    const session = await createGooglePhotosPickerSession(token);
    if (!session || !session.pickerUri) {
      throw new Error('Failed to obtain Google Photos Picker URL from Google');
    }

    currentActiveSession = { id: session.id, token };

    onStatusUpdate?.('Opening Google Photos selection window...');

    // 2. Open Google Picker with /autoclose in a popup window
    const pickerUrl = getAutoclosePickerUri(session.pickerUri);

    const popupWidth = 880;
    const popupHeight = 740;
    const left = window.screen.width ? (window.screen.width - popupWidth) / 2 : 100;
    const top = window.screen.height ? (window.screen.height - popupHeight) / 2 : 100;

    const popup = window.open(
      pickerUrl,
      'GooglePhotosPicker',
      `width=${popupWidth},height=${popupHeight},top=${top},left=${left},scrollbars=yes,resizable=yes`
    );

    if (!popup) {
      window.open(pickerUrl, '_blank');
    }

    onStatusUpdate?.('Please select your photos in Google Photos and click Done.');

    // 3. Poll session until user finishes selecting (up to 10 minutes)
    const maxPollAttempts = 200; // ~10 minutes
    let pollCount = 0;
    let itemsSet = false;

    while (pollCount < maxPollAttempts) {
      await new Promise((resolve) => setTimeout(resolve, 3000));
      pollCount++;

      // Check if session was cancelled externally
      if (!currentActiveSession || currentActiveSession.id !== session.id) {
        return { success: false, photos: [], error: 'Photo selection was cancelled.' };
      }

      itemsSet = await checkPickerSessionStatus(token, session.id);
      if (itemsSet) {
        break;
      }
    }

    if (!itemsSet) {
      await deletePickerSession(token, session.id);
      currentActiveSession = null;
      return {
        success: false,
        photos: [],
        error: 'Photo selection timed out. Please try again.',
      };
    }

    onStatusUpdate?.('Retrieving selected photo metadata...');

    // 4. Fetch the selected photos metadata
    const rawPhotos = await fetchPickerSelectedMediaItems(token, session.id);

    // 5. Clean up session only after items are safely fetched
    await deletePickerSession(token, session.id);
    currentActiveSession = null;

    if (rawPhotos.length > 0) {
      const photos = await processAndStreamPickedPhotos(rawPhotos, token, onStatusUpdate);
      return { success: true, photos };
    } else {
      return {
        success: false,
        photos: [],
        error: 'No photos were selected. Please select at least one photo.',
      };
    }
  } catch (err: any) {
    const errorMsg = err?.message || 'Error running Google Photos Picker';
    if (
      errorMsg.includes('Google Photos Picker API has not been used') ||
      errorMsg.includes('disabled') ||
      errorMsg.includes('403')
    ) {
      return {
        success: false,
        photos: [],
        error: 'Google Photos Picker API must be enabled in Google Cloud Console. See Settings guide for instructions.',
      };
    }
    return { success: false, photos: [], error: errorMsg };
  }
}

/**
 * Fetch user photo albums (supports both Picked Photos and legacy API if available)
 */
export async function fetchUserPhotoAlbums(token: string): Promise<PhotosFetchResult> {
  const storedPicked = getStoredPickedPhotos();

  if (!token) {
    return {
      success: false,
      albums: storedPicked.length > 0 ? buildAlbumsWithPicked(storedPicked) : DEMO_ALBUMS,
      error: 'Google account not signed in',
    };
  }

  let combinedAlbums: PhotoAlbum[] = [];

  // Add Picked Photos album if user has selected photos via Picker API
  if (storedPicked.length > 0) {
    const coverPhoto = storedPicked[0];
    const coverUrl =
      coverPhoto?.url && (coverPhoto.url.startsWith('data:') || coverPhoto.url.startsWith('blob:') || coverPhoto.url.includes('unsplash.com'))
        ? coverPhoto.url
        : coverPhoto?.baseUrl
        ? `${coverPhoto.baseUrl.split('=')[0]}=w600-h400-c`
        : undefined;

    combinedAlbums.push({
      id: 'PICKED_GOOGLE_PHOTOS',
      title: `📸 Selected Google Photos (${storedPicked.length} photos)`,
      mediaItemsCount: storedPicked.length,
      coverPhotoBaseUrl: coverUrl,
    });
  }

  // Attempt to fetch legacy albums if allowed by user's account
  try {
    const res = await fetch('https://photoslibrary.googleapis.com/v1/albums?pageSize=50', {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (res.ok) {
      const data: GPhotosAlbumResponse = await res.json();
      if (data.albums && data.albums.length > 0) {
        const userAlbums = data.albums.map((album) => ({
          id: album.id,
          title: album.title || 'Untitled Album',
          coverPhotoBaseUrl: album.coverPhotoBaseUrl
            ? `${album.coverPhotoBaseUrl}=w600-h400-c`
            : undefined,
          mediaItemsCount: album.mediaItemsCount ? parseInt(album.mediaItemsCount, 10) : 0,
        }));
        combinedAlbums.push(...userAlbums);
      }
      return {
        success: true,
        albums: combinedAlbums,
      };
    } else {
      const errText = await res.text();
      let errorMsg = `Google Photos error (${res.status})`;
      try {
        const parsed = JSON.parse(errText);
        if (parsed.error?.message) {
          errorMsg = parsed.error.message;
        }
      } catch {
        // ignore
      }

      // Google deprecated legacy album listing in March 2025:
      if (res.status === 403 || errorMsg.includes('insufficient authentication scopes')) {
        return {
          success: storedPicked.length > 0,
          albums: combinedAlbums.length > 0 ? combinedAlbums : DEMO_ALBUMS,
          error: 'Google deprecated the legacy Photos Library API in 2025. Please use the "Select Photos from Google Photos" picker button to choose family photos or albums for your slideshow.',
        };
      }

      return {
        success: storedPicked.length > 0,
        albums: combinedAlbums.length > 0 ? combinedAlbums : DEMO_ALBUMS,
        error: errorMsg,
      };
    }
  } catch (error: any) {
    return {
      success: storedPicked.length > 0,
      albums: combinedAlbums.length > 0 ? combinedAlbums : DEMO_ALBUMS,
      error: error?.message || 'Network error fetching Google Photos albums',
    };
  }
}

function buildAlbumsWithPicked(picked: PhotoItem[]): PhotoAlbum[] {
  const coverPhoto = picked[0];
  const coverUrl =
    coverPhoto?.url && (coverPhoto.url.startsWith('data:') || coverPhoto.url.startsWith('blob:') || coverPhoto.url.includes('unsplash.com'))
      ? coverPhoto.url
      : coverPhoto?.baseUrl
      ? `${coverPhoto.baseUrl.split('=')[0]}=w600-h400-c`
      : undefined;

  return [
    {
      id: 'PICKED_GOOGLE_PHOTOS',
      title: `📸 Selected Google Photos (${picked.length} photos)`,
      mediaItemsCount: picked.length,
      coverPhotoBaseUrl: coverUrl,
    },
    ...DEMO_ALBUMS,
  ];
}

/**
 * Fetch photos for a specific album or library item
 */
export async function fetchAlbumPhotos(token: string, albumId: string): Promise<PhotoItem[]> {
  // 1. If explicit demo album requested, always return that demo album's photos
  if (DEMO_PHOTOS[albumId]) {
    return DEMO_PHOTOS[albumId];
  }

  // 2. If Picked Google Photos
  if (albumId === 'PICKED_GOOGLE_PHOTOS') {
    const picked = await loadStoredPhotos();
    if (picked.length > 0) return picked;
  }

  // Handle "All Recent Photos from Library"
  if (albumId === 'ALL_LIBRARY_PHOTOS' && token) {
    try {
      const res = await fetch('https://photoslibrary.googleapis.com/v1/mediaItems?pageSize=50', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data: GPhotosMediaSearchResponse = await res.json();
        if (data.mediaItems && data.mediaItems.length > 0) {
          return mapMediaItemsToPhotos(data.mediaItems);
        }
      }
    } catch (err) {
      console.warn('Failed to fetch library media items:', err);
    }
  }

  // Fetch photos from specific legacy album if valid
  if (token && albumId && albumId !== 'album-family-vacation' && albumId !== 'PICKED_GOOGLE_PHOTOS') {
    try {
      const res = await fetch('https://photoslibrary.googleapis.com/v1/mediaItems:search', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          albumId,
          pageSize: 50,
        }),
      });

      if (res.ok) {
        const data: GPhotosMediaSearchResponse = await res.json();
        if (data.mediaItems && data.mediaItems.length > 0) {
          return mapMediaItemsToPhotos(data.mediaItems);
        }
      }
    } catch (error) {
      console.error('Failed to search album media items:', error);
    }
  }

  // Fallback to stored picked photos, or demo photos
  const storedPicked = await loadStoredPhotos();
  if (storedPicked.length > 0) {
    return storedPicked;
  }

  const firstDemoKey = Object.keys(DEMO_PHOTOS)[0];
  return DEMO_PHOTOS[firstDemoKey] || [];
}

function mapMediaItemsToPhotos(items: NonNullable<GPhotosMediaSearchResponse['mediaItems']>): PhotoItem[] {
  return items.map((item) => {
    const highResUrl = `${item.baseUrl}=w1600-h1200`;
    let dateString: string | undefined;
    if (item.mediaMetadata?.creationTime) {
      try {
        const d = new Date(item.mediaMetadata.creationTime);
        dateString = d.toLocaleDateString(undefined, {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        });
      } catch {
        // ignore
      }
    }

    return {
      id: item.id,
      url: highResUrl,
      baseUrl: item.baseUrl,
      filename: item.filename,
      caption: item.description || undefined,
      dateTaken: dateString,
      width: item.mediaMetadata?.width ? parseInt(item.mediaMetadata.width, 10) : undefined,
      height: item.mediaMetadata?.height ? parseInt(item.mediaMetadata.height, 10) : undefined,
    };
  });
}
