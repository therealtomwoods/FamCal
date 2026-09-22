import { PhotoAlbum, PhotoItem } from '../types';
import { DEMO_ALBUMS, DEMO_PHOTOS } from '../mock/demoData';

export const PICKED_PHOTOS_KEY = 'famcal_picked_photos';

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

/**
 * Retrieve cached picked photos from localStorage
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
 * Cache picked photos in localStorage so slideshow runs seamlessly across reloads
 */
export function saveStoredPickedPhotos(photos: PhotoItem[]): void {
  try {
    localStorage.setItem(PICKED_PHOTOS_KEY, JSON.stringify(photos));
  } catch (err) {
    console.warn('Failed to cache picked photos in localStorage:', err);
  }
}

/**
 * Clear cached picked photos
 */
export function clearStoredPickedPhotos(): void {
  localStorage.removeItem(PICKED_PHOTOS_KEY);
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
  const cleanId = sessionId.startsWith('sessions/') ? sessionId.replace('sessions/', '') : sessionId;
  const res = await fetch(`https://photospicker.googleapis.com/v1/sessions/${cleanId}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!res.ok) {
    return false;
  }

  const data = await res.json();
  return Boolean(data.mediaItemsSet);
}

/**
 * 3. Fetch media items selected by the user in the picker session
 * GET https://photospicker.googleapis.com/v1/mediaItems?sessionId={sessionId}
 */
export async function fetchPickerSelectedMediaItems(token: string, sessionId: string): Promise<PhotoItem[]> {
  const cleanId = sessionId.startsWith('sessions/') ? sessionId.replace('sessions/', '') : sessionId;
  const res = await fetch(`https://photospicker.googleapis.com/v1/mediaItems?sessionId=${cleanId}&pageSize=100`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Failed to retrieve selected photos: ${errText}`);
  }

  const data: { mediaItems?: PickerMediaItem[] } = await res.json();
  if (!data.mediaItems || data.mediaItems.length === 0) {
    return [];
  }

  return data.mediaItems
    .filter((item) => item.mediaFile?.baseUrl)
    .map((item) => {
      const baseUrl = item.mediaFile!.baseUrl;
      return {
        id: item.id,
        url: `${baseUrl}=w1600-h1200`,
        baseUrl: baseUrl,
        filename: item.mediaFile?.filename,
        caption: item.mediaFile?.filename || 'Family Photo',
        width: item.mediaFile?.mediaFileMetadata?.width,
        height: item.mediaFile?.mediaFileMetadata?.height,
      };
    });
}

/**
 * 4. Delete Picker Session once photos are obtained
 * DELETE https://photospicker.googleapis.com/v1/sessions/{sessionId}
 */
export async function deletePickerSession(token: string, sessionId: string): Promise<void> {
  try {
    const cleanId = sessionId.startsWith('sessions/') ? sessionId.replace('sessions/', '') : sessionId;
    await fetch(`https://photospicker.googleapis.com/v1/sessions/${cleanId}`, {
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
 * High-Level Orchestrator for the Google Photos Picker Flow
 * Opens picker popup, polls until user confirms selection, retrieves photos, and saves to cache.
 */
export async function launchGooglePhotosPicker(
  token: string,
  onStatusUpdate?: (status: string) => void
): Promise<{ success: boolean; photos: PhotoItem[]; error?: string }> {
  if (!token) {
    return { success: false, photos: [], error: 'Google account not signed in' };
  }

  try {
    onStatusUpdate?.('Initializing Google Photos Picker session...');

    // 1. Create Picker Session
    const session = await createGooglePhotosPickerSession(token);
    if (!session || !session.pickerUri) {
      throw new Error('Failed to obtain Google Photos Picker URL from Google');
    }

    onStatusUpdate?.('Opening Google Photos selection window...');

    // 2. Open Google Picker in a popup window
    const pickerUrl = session.pickerUri.includes('?')
      ? `${session.pickerUri}&autoclose=true`
      : `${session.pickerUri}/autoclose`;

    const popupWidth = 850;
    const popupHeight = 720;
    const left = window.screen.width ? (window.screen.width - popupWidth) / 2 : 100;
    const top = window.screen.height ? (window.screen.height - popupHeight) / 2 : 100;

    const popup = window.open(
      pickerUrl,
      'GooglePhotosPicker',
      `width=${popupWidth},height=${popupHeight},top=${top},left=${left},scrollbars=yes,resizable=yes`
    );

    if (!popup) {
      // Fallback if popup blocker intercepted
      window.open(pickerUrl, '_blank');
    }

    onStatusUpdate?.('Waiting for you to select photos in Google Photos...');

    // 3. Poll session until user finishes selecting
    const maxPollAttempts = 150; // ~5 minutes max
    let pollCount = 0;
    let itemsSet = false;

    while (pollCount < maxPollAttempts) {
      await new Promise((resolve) => setTimeout(resolve, 2000));
      pollCount++;

      itemsSet = await checkPickerSessionStatus(token, session.id);
      if (itemsSet) {
        break;
      }

      // Check if popup was closed by user
      if (popup && popup.closed) {
        // Check one last time in case user clicked done right before close
        await new Promise((resolve) => setTimeout(resolve, 1000));
        itemsSet = await checkPickerSessionStatus(token, session.id);
        break;
      }
    }

    if (!itemsSet) {
      await deletePickerSession(token, session.id);
      return {
        success: false,
        photos: [],
        error: 'Photo selection was cancelled or timed out. Please try again.',
      };
    }

    onStatusUpdate?.('Retrieving selected family photos...');

    // 4. Fetch the selected photos
    const photos = await fetchPickerSelectedMediaItems(token, session.id);

    // 5. Clean up session
    await deletePickerSession(token, session.id);

    if (photos.length > 0) {
      saveStoredPickedPhotos(photos);
      onStatusUpdate?.(`Successfully loaded ${photos.length} photos!`);
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
    if (errorMsg.includes('Google Photos Picker API has not been used') || errorMsg.includes('disabled') || errorMsg.includes('403')) {
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
    combinedAlbums.push({
      id: 'PICKED_GOOGLE_PHOTOS',
      title: `📸 Selected Google Photos (${storedPicked.length} photos)`,
      mediaItemsCount: storedPicked.length,
      coverPhotoBaseUrl: storedPicked[0]?.baseUrl ? `${storedPicked[0].baseUrl}=w600-h400-c` : undefined,
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
  return [
    {
      id: 'PICKED_GOOGLE_PHOTOS',
      title: `📸 Selected Google Photos (${picked.length} photos)`,
      mediaItemsCount: picked.length,
      coverPhotoBaseUrl: picked[0]?.baseUrl ? `${picked[0].baseUrl}=w600-h400-c` : undefined,
    },
    ...DEMO_ALBUMS,
  ];
}

/**
 * Fetch photos for a specific album or library item
 */
export async function fetchAlbumPhotos(token: string, albumId: string): Promise<PhotoItem[]> {
  // If Picked Google Photos
  if (albumId === 'PICKED_GOOGLE_PHOTOS') {
    const picked = getStoredPickedPhotos();
    if (picked.length > 0) return picked;
  }

  // If demo album id and no token
  if (!token && DEMO_PHOTOS[albumId]) {
    return DEMO_PHOTOS[albumId];
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
  const storedPicked = getStoredPickedPhotos();
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
      caption: item.description || item.filename,
      dateTaken: dateString,
      width: item.mediaMetadata?.width ? parseInt(item.mediaMetadata.width, 10) : undefined,
      height: item.mediaMetadata?.height ? parseInt(item.mediaMetadata.height, 10) : undefined,
    };
  });
}
