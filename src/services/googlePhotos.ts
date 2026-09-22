import { PhotoAlbum, PhotoItem } from '../types';
import { DEMO_ALBUMS, DEMO_PHOTOS } from '../mock/demoData';

interface GPhotosAlbumResponse {
  albums?: Array<{
    id: string;
    title: string;
    coverPhotoBaseUrl?: string;
    mediaItemsCount?: string;
  }>;
  nextPageToken?: string;
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
  nextPageToken?: string;
}

export async function fetchUserPhotoAlbums(token: string): Promise<PhotoAlbum[]> {
  try {
    const res = await fetch('https://photoslibrary.googleapis.com/v1/albums?pageSize=50', {
      headers: { Authorization: `Bearer ${token}` }
    });

    if (!res.ok) {
      console.warn(`Photos API returned status ${res.status}. Falling back to demo albums.`);
      return DEMO_ALBUMS;
    }

    const data: GPhotosAlbumResponse = await res.json();
    if (!data.albums || data.albums.length === 0) {
      return DEMO_ALBUMS;
    }

    return data.albums.map((album) => ({
      id: album.id,
      title: album.title || 'Untitled Album',
      coverPhotoBaseUrl: album.coverPhotoBaseUrl
        ? `${album.coverPhotoBaseUrl}=w600-h400-c`
        : undefined,
      mediaItemsCount: album.mediaItemsCount ? parseInt(album.mediaItemsCount, 10) : 0,
    }));
  } catch (error) {
    console.error('Error fetching Google Photos albums:', error);
    return DEMO_ALBUMS;
  }
}

export async function fetchAlbumPhotos(token: string, albumId: string): Promise<PhotoItem[]> {
  // Check if it's a demo album
  if (DEMO_PHOTOS[albumId]) {
    return DEMO_PHOTOS[albumId];
  }

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

    if (!res.ok) {
      console.warn(`Photos search failed (${res.status}). Using fallback demo photos.`);
      const firstDemoKey = Object.keys(DEMO_PHOTOS)[0];
      return DEMO_PHOTOS[firstDemoKey] || [];
    }

    const data: GPhotosMediaSearchResponse = await res.json();
    if (!data.mediaItems || data.mediaItems.length === 0) {
      const firstDemoKey = Object.keys(DEMO_PHOTOS)[0];
      return DEMO_PHOTOS[firstDemoKey] || [];
    }

    return data.mediaItems.map((item) => {
      // High-res parameter for Google Photos baseUrl
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
  } catch (error) {
    console.error('Failed to fetch album photos:', error);
    const firstDemoKey = Object.keys(DEMO_PHOTOS)[0];
    return DEMO_PHOTOS[firstDemoKey] || [];
  }
}
