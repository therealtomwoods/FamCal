import { PhotoAlbum, PhotoItem } from '../types';
import { DEMO_ALBUMS, DEMO_PHOTOS } from '../mock/demoData';

export const PICKED_PHOTOS_KEY = 'famcal_picked_photos';
const DB_NAME = 'FamCalPhotosDB';

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



export async function savePhotosToIndexedDB(_photos: PhotoItem[]): Promise<void> {
  // Database caching removed: Chrome browser in-memory sliding window cache is used instead
  return Promise.resolve();
}

export async function loadPhotosFromIndexedDB(): Promise<PhotoItem[] | null> {
  return null;
}

/**
 * Retrieve cached picked photos metadata from localStorage
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
 * Load stored photos metadata directly from localStorage without database overhead.
 * Cleans up legacy bloated IndexedDB databases from previous versions.
 */
export async function loadStoredPhotos(): Promise<PhotoItem[]> {
  if (typeof indexedDB !== 'undefined') {
    try {
      indexedDB.deleteDatabase(DB_NAME);
    } catch {
      // ignore
    }
  }
  return getStoredPickedPhotos();
}

/**
 * Cache picked photos metadata in localStorage so slideshow runs seamlessly across reloads.
 * Strips huge base64 strings and temporary blob URLs so localStorage never exceeds quota.
 */
export function saveStoredPickedPhotos(photos: PhotoItem[]): void {
  try {
    const lightweight = photos.map((p) => ({
      id: p.id,
      url: p.baseUrl || (p.url.startsWith('data:') || p.url.startsWith('blob:') ? '' : p.url),
      baseUrl: p.baseUrl,
      filename: p.filename,
      caption: p.caption,
      dateTaken: p.dateTaken,
      width: p.width,
      height: p.height,
    }));
    localStorage.setItem(PICKED_PHOTOS_KEY, JSON.stringify(lightweight));
  } catch (err) {
    console.warn('Failed to save picked photos to localStorage:', err);
  }
}

/**
 * Clear cached picked photos
 */
export function clearStoredPickedPhotos(token?: string | null): void {
  localStorage.removeItem(PICKED_PHOTOS_KEY);
  localStorage.removeItem('famcal_photos_fetched_at');
  localStorage.removeItem('famcal_picker_session_expired');
  const sessionId = localStorage.getItem('famcal_picker_session_id');
  if (sessionId) {
    localStorage.removeItem('famcal_picker_session_id');
    if (token) {
      deletePickerSession(token, sessionId).catch(() => {});
    }
  }
  if (typeof indexedDB !== 'undefined') {
    try {
      indexedDB.deleteDatabase(DB_NAME);
    } catch {
      // ignore
    }
  }
  if (typeof caches !== 'undefined') {
    try {
      caches.delete('famcal-photo-blobs-v1').catch(() => {});
    } catch {
      // ignore
    }
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
 * Tries local CORS-enabled /api/photo proxy first, then direct fallbacks.
 */
export async function downloadPhotoBlob(baseUrl: string, token?: string): Promise<Blob | null> {
  const cleanBase = baseUrl.split('=')[0];
  const targetUrl = `${cleanBase}=w1600-h1600`;

  // 1. Try local proxy first (works in both Vite dev server and Pi-Kiosk server)
  try {
    const proxyUrl = `/api/photo?url=${encodeURIComponent(targetUrl)}`;
    const headers: Record<string, string> = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    const res = await fetchWithTimeout(proxyUrl, { headers }, 8000);
    if (res.ok) {
      const blob = await res.blob();
      if (blob.size > 0 && blob.type.startsWith('image/')) {
        return blob;
      }
    }
  } catch {
    // fallback to direct fetch
  }

  // 2. Direct authenticated fetch (Google Photos Picker API allows direct GET with Bearer token)
  try {
    const directHeaders: Record<string, string> = {};
    if (token) {
      directHeaders['Authorization'] = `Bearer ${token}`;
    }
    const res = await fetchWithTimeout(targetUrl, {
      headers: directHeaders,
      referrerPolicy: 'no-referrer',
    }, 6000);
    if (res.ok) {
      const blob = await res.blob();
      if (blob.size > 0 && blob.type.startsWith('image/')) {
        return blob;
      }
    }
  } catch (err) {
    // ignore
  }

  // 3. Direct fetch with download parameter (=d)
  try {
    const origUrl = `${cleanBase}=d`;
    const directHeaders: Record<string, string> = {};
    if (token) {
      directHeaders['Authorization'] = `Bearer ${token}`;
    }
    const res = await fetchWithTimeout(origUrl, {
      headers: directHeaders,
      referrerPolicy: 'no-referrer',
    }, 6000);
    if (res.ok) {
      const blob = await res.blob();
      if (blob.size > 0 && blob.type.startsWith('image/')) {
        return blob;
      }
    }
  } catch (origErr) {
    // ignore
  }

  return null;
}

/**
 * Deprecated: Previously attempted to download hundreds of photos into base64 data URLs in bulk.
 * FamCal now uses an in-memory sliding-window cache in Chrome that sequentially caches photos
 * a few at a time in the background as needed with zero database overhead.
 */
export async function hydratePhotosWithImages(
  photos: PhotoItem[],
  _token?: string,
  _onProgress?: (msg: string) => void,
  _onBatchComplete?: (updatedPhotos: PhotoItem[]) => void
): Promise<PhotoItem[]> {
  return photos;
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
  // Clean up previous picker session on Google servers if one exists
  const oldSessionId = localStorage.getItem('famcal_picker_session_id');
  if (oldSessionId) {
    deletePickerSession(token, oldSessionId).catch(() => {});
    localStorage.removeItem('famcal_picker_session_id');
  }

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

      const rawDate =
        item.createTime ||
        (item as any).mediaMetadata?.creationTime ||
        (item as any).mediaFile?.createTime;

      let dateTaken: string | undefined;
      if (rawDate) {
        try {
          const d = new Date(rawDate);
          if (!isNaN(d.getTime())) {
            dateTaken = d.toLocaleDateString(undefined, {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
            });
          }
        } catch {
          dateTaken = rawDate;
        }
      }

      return {
        id: item.id,
        url: `${baseUrl}=w1600-h1600`,
        baseUrl: baseUrl,
        filename: filename,
        caption: undefined,
        dateTaken: dateTaken,
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
  // Google Photos Picker API query param 'sessionId' always expects the raw UUID (strip sessions/ prefix)
  const cleanId = sessionId.replace(/^sessions\//, '');
  const allRawItems: PickerMediaItem[] = [];
  let pageToken: string | undefined = undefined;

  while (true) {
    const baseUrlStr = 'https://photospicker.googleapis.com/v1/mediaItems';
    const params = new URLSearchParams();
    params.set('sessionId', cleanId);
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
        const errText = await res.text();
        console.warn(`Picker mediaItems fetch error (status ${res.status}):`, errText);
        if (res.status === 401 || res.status === 403) {
          throw new Error('UNAUTHORIZED_TOKEN_EXPIRED');
        }
        if (res.status === 404 || res.status === 410 || res.status === 400) {
          throw new Error(`PICKER_SESSION_EXPIRED (${res.status})`);
        }
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
    } catch (fetchErr: any) {
      if (fetchErr?.message?.includes('UNAUTHORIZED') || fetchErr?.message?.includes('PICKER_SESSION_EXPIRED')) {
        throw fetchErr;
      }
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
 * Processes selected photos with immediate fast playback:
 * 1. Saves all raw photo metadata immediately so all photos (hundreds) are recognized and playable.
 * 2. Immediately saves to localStorage with fresh fetch timestamp.
 * 3. Notifies callers so the active slideshow UI updates seamlessly without freezing.
 */
async function processAndStreamPickedPhotos(
  rawPhotos: PhotoItem[],
  _token: string,
  onStatusUpdate?: (status: string) => void,
  onPhotosUpdated?: (photos: PhotoItem[]) => void
): Promise<PhotoItem[]> {
  // 1. Immediately save lightweight metadata to localStorage
  saveStoredPickedPhotos(rawPhotos);
  localStorage.setItem('famcal_photos_fetched_at', Date.now().toString());
  localStorage.removeItem('famcal_picker_session_expired');

  onPhotosUpdated?.(rawPhotos);
  onStatusUpdate?.(`✓ Successfully loaded ${rawPhotos.length} family photos!`);

  return rawPhotos;
}

/**
 * Proactively or reactively refreshes Google Photos baseUrls before or after the 60-minute expiry.
 * Automatically recovers from expired OAuth tokens if clientId is available.
 */
export async function refreshPhotoUrls(
  token: string,
  currentAlbumId?: string,
  clientId?: string
): Promise<{ success: boolean; photos: PhotoItem[]; sessionExpired?: boolean; tokenExpired?: boolean }> {
  if (!token && !clientId) return { success: false, photos: [] };

  const pickerSessionId = localStorage.getItem('famcal_picker_session_id');
  const isPickedAlbum =
    !currentAlbumId ||
    currentAlbumId === 'PICKED_GOOGLE_PHOTOS' ||
    currentAlbumId === 'ALL_LIBRARY_PHOTOS';

  // 1. Refresh from active picker session (valid for up to 7 days on Google's servers)
  if (pickerSessionId && isPickedAlbum) {
    try {
      const cleanId = pickerSessionId.replace(/^sessions\//, '');
      let activeToken = token;
      let freshPhotos: PhotoItem[] = [];

      try {
        freshPhotos = await fetchPickerSelectedMediaItems(activeToken, cleanId);
      } catch (firstErr: any) {
        // If OAuth token expired (401/403), attempt silent renewal once and retry
        if (firstErr?.message?.includes('UNAUTHORIZED') && clientId) {
          console.log('Picker returned 401 Unauthorized. Attempting silent token renewal...');
          const { requestSilentTokenRefresh } = await import('./googleAuth');
          const renewed = await requestSilentTokenRefresh(clientId);
          if (renewed) {
            activeToken = renewed;
            freshPhotos = await fetchPickerSelectedMediaItems(activeToken, cleanId);
          } else {
            throw firstErr;
          }
        } else {
          throw firstErr;
        }
      }

      if (freshPhotos && freshPhotos.length > 0) {
        const existing = await loadStoredPhotos();
        const existingMap = new Map(existing.map((p) => [p.id, p]));

        const merged = freshPhotos.map((fresh) => {
          const old = existingMap.get(fresh.id);
          return {
            ...fresh,
            caption: old?.caption || fresh.caption,
            dateTaken: old?.dateTaken || fresh.dateTaken,
          };
        });

        saveStoredPickedPhotos(merged);
        localStorage.setItem('famcal_photos_fetched_at', Date.now().toString());
        localStorage.removeItem('famcal_picker_session_expired');
        console.log(`✓ Successfully refreshed ${merged.length} photo baseUrls from Google Photos Picker session`);
        return { success: true, photos: merged };
      }
    } catch (err: any) {
      console.warn('Failed to refresh picker photos from session:', err);
      // Throttle next check by updating timestamp so we don't retry every 60s
      localStorage.setItem('famcal_photos_fetched_at', Date.now().toString());
      if (
        err?.message?.includes('PICKER_SESSION_EXPIRED') ||
        err?.message?.includes('404') ||
        err?.message?.includes('410')
      ) {
        return { success: false, photos: [], sessionExpired: true };
      }
      if (err?.message?.includes('UNAUTHORIZED')) {
        return { success: false, photos: [], tokenExpired: true };
      }
    }
  }

  // 2. Refresh from legacy album
  if (
    currentAlbumId &&
    currentAlbumId !== 'PICKED_GOOGLE_PHOTOS' &&
    !currentAlbumId.startsWith('album-family')
  ) {
    try {
      const freshAlbumPhotos = await fetchAlbumPhotos(token, currentAlbumId);
      if (freshAlbumPhotos.length > 0) {
        saveStoredPickedPhotos(freshAlbumPhotos);
        localStorage.setItem('famcal_photos_fetched_at', Date.now().toString());
        return { success: true, photos: freshAlbumPhotos };
      }
    } catch (err) {
      console.warn('Failed to refresh album photos:', err);
    }
  }

  return { success: false, photos: [] };
}

/**
 * Manually check active session status immediately (called when user clicks 'Check Photos Now')
 */
export async function checkActivePickerNow(
  onPhotosUpdated?: (photos: PhotoItem[]) => void
): Promise<{ success: boolean; photos: PhotoItem[]; error?: string }> {
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
    // Keep session active for baseUrls validity - do not delete session immediately!
    localStorage.setItem('famcal_picker_session_id', id);
    currentActiveSession = null;

    if (rawPhotos.length > 0) {
      const photos = await processAndStreamPickedPhotos(rawPhotos, token, undefined, onPhotosUpdated);
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
  onStatusUpdate?: (status: string) => void,
  onPhotosUpdated?: (photos: PhotoItem[]) => void
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

    // Keep session active for baseUrls validity - do not delete session immediately!
    localStorage.setItem('famcal_picker_session_id', session.id);
    currentActiveSession = null;

    if (rawPhotos.length > 0) {
      const photos = await processAndStreamPickedPhotos(rawPhotos, token, onStatusUpdate, onPhotosUpdated);
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
