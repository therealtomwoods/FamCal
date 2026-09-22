import { PhotoAlbum, PhotoItem } from '../types';
import { DEMO_ALBUMS, DEMO_PHOTOS } from '../mock/demoData';
import { getStoredGrantedScopes } from './googleAuth';

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

export interface PhotosFetchResult {
  success: boolean;
  albums: PhotoAlbum[];
  error?: string;
}

export async function fetchUserPhotoAlbums(token: string): Promise<PhotosFetchResult> {
  if (!token) {
    return { success: false, albums: DEMO_ALBUMS, error: 'Google account not signed in' };
  }

  // Check if granted scopes include photoslibrary
  const granted = getStoredGrantedScopes();
  if (granted && !granted.includes('photoslibrary')) {
    return {
      success: false,
      albums: DEMO_ALBUMS,
      error: 'Google Photos permission was not checked on the login screen. Click "Re-Authorize Google Permissions" in Settings and ensure the Google Photos checkbox is checked.',
    };
  }

  try {
    let combinedAlbums: PhotoAlbum[] = [];

    // Always include option for All Recent Photos from Library
    combinedAlbums.push({
      id: 'ALL_LIBRARY_PHOTOS',
      title: '📸 All Recent Google Photos (Library Stream)',
      mediaItemsCount: 100,
    });

    // 1. Fetch created albums
    const res = await fetch('https://photoslibrary.googleapis.com/v1/albums?pageSize=50', {
      headers: { Authorization: `Bearer ${token}` }
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
    } else {
      const errText = await res.text();
      let errorMsg = `Google Photos error (${res.status}): ${res.statusText}`;
      try {
        const parsed = JSON.parse(errText);
        if (parsed.error?.message) {
          errorMsg = parsed.error.message;
        }
      } catch {
        // ignore
      }

      if (errorMsg.includes('insufficient authentication scopes')) {
        return {
          success: false,
          albums: DEMO_ALBUMS,
          error: 'Insufficient authentication scopes. Please click "Re-Authorize Google Permissions" in Settings and check the box for "See your Google Photos library". Also ensure Photos Library API is enabled in Google Cloud Console.',
        };
      }

      return { success: false, albums: DEMO_ALBUMS, error: errorMsg };
    }

    // 2. Fetch shared albums (safely; ignore errors so it doesn't fail main albums)
    try {
      const sharedRes = await fetch('https://photoslibrary.googleapis.com/v1/sharedAlbums?pageSize=50', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (sharedRes.ok) {
        const sharedData: GPhotosAlbumResponse = await sharedRes.json();
        if (sharedData.sharedAlbums) {
          const sharedAlbums = sharedData.sharedAlbums.map((album) => ({
            id: album.id,
            title: `Shared: ${album.title || 'Untitled Album'}`,
            coverPhotoBaseUrl: album.coverPhotoBaseUrl
              ? `${album.coverPhotoBaseUrl}=w600-h400-c`
              : undefined,
            mediaItemsCount: album.mediaItemsCount ? parseInt(album.mediaItemsCount, 10) : 0,
          }));
          combinedAlbums.push(...sharedAlbums);
        }
      }
    } catch {
      // ignore shared albums error
    }

    return {
      success: true,
      albums: combinedAlbums,
    };
  } catch (error: any) {
    return {
      success: false,
      albums: DEMO_ALBUMS,
      error: error?.message || 'Network error fetching Google Photos albums',
    };
  }
}

export async function fetchAlbumPhotos(token: string, albumId: string): Promise<PhotoItem[]> {
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

  // Fetch photos from specific album
  if (token && albumId && albumId !== 'album-family-vacation') {
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

  // Fallback to demo photos if album has no items or offline
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
