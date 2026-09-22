import React, { useState } from 'react';
import { PhotoAlbum } from '../types';
import {
  X,
  Image,
  FolderCheck,
  Sparkles,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  ExternalLink,
} from 'lucide-react';

interface AlbumSelectModalProps {
  isOpen: boolean;
  onClose: () => void;
  albums: PhotoAlbum[];
  selectedAlbumId: string;
  onSelectAlbum: (album: PhotoAlbum) => void;
  onRefreshAlbums?: () => void;
  photosError?: string;
  isGoogleConnected?: boolean;
  onLaunchPhotosPicker?: () => void;
  isLaunchingPicker?: boolean;
  pickedPhotosCount?: number;
}

export const AlbumSelectModal: React.FC<AlbumSelectModalProps> = ({
  isOpen,
  onClose,
  albums,
  selectedAlbumId,
  onSelectAlbum,
  onRefreshAlbums,
  photosError,
  isGoogleConnected = false,
  onLaunchPhotosPicker,
  isLaunchingPicker = false,
  pickedPhotosCount = 0,
}) => {
  const [customIdInput, setCustomIdInput] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);

  if (!isOpen) return null;

  const handleRefresh = async () => {
    if (onRefreshAlbums) {
      setIsRefreshing(true);
      await onRefreshAlbums();
      setTimeout(() => setIsRefreshing(false), 800);
    }
  };

  const handleApplyCustomId = () => {
    if (customIdInput.trim()) {
      onSelectAlbum({
        id: customIdInput.trim(),
        title: `Album (${customIdInput.trim().slice(0, 12)}...)`,
      });
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="w-full max-w-lg bg-slate-900 border border-white/10 rounded-2xl shadow-2xl flex flex-col max-h-[88vh] overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-pink-600/20 text-pink-400">
              <Image className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Google Photos Selection</h3>
              <p className="text-xs text-slate-400">
                Choose family photos or albums for your slideshow
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            {onRefreshAlbums && (
              <button
                onClick={handleRefresh}
                title="Refresh albums from Google Photos"
                className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition"
              >
                <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-pink-400' : ''}`} />
              </button>
            )}
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Feature Banner: Google Photos Picker API (New Official Flow) */}
        <div className="p-4 bg-gradient-to-r from-pink-950/60 via-purple-950/40 to-slate-900 border-b border-white/10 space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-1.5 text-xs font-bold text-pink-300 uppercase tracking-wider">
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                <span>Google Photos Picker API</span>
              </div>
              <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                Google's official picker lets you browse your photos, pick family memories, or select whole albums to display in FamCal.
              </p>
            </div>

            {pickedPhotosCount > 0 && (
              <span className="px-2 py-0.5 rounded-full bg-emerald-950 border border-emerald-500/40 text-emerald-300 font-mono text-[11px] flex-shrink-0 flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                {pickedPhotosCount} loaded
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onLaunchPhotosPicker}
              disabled={isLaunchingPicker || !isGoogleConnected}
              className={`flex-1 py-2.5 px-4 rounded-xl font-bold text-xs transition shadow-lg flex items-center justify-center gap-2 ${
                isGoogleConnected
                  ? 'bg-gradient-to-r from-pink-600 to-rose-600 hover:from-pink-500 hover:to-rose-500 text-white shadow-pink-600/30'
                  : 'bg-slate-800 text-slate-500 cursor-not-allowed border border-white/5'
              }`}
            >
              {isLaunchingPicker ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin text-white" />
                  <span>Waiting for Google Photos Selection...</span>
                </>
              ) : (
                <>
                  <ExternalLink className="w-4 h-4 text-white" />
                  <span>Select Photos from Google Photos</span>
                </>
              )}
            </button>
          </div>

          {!isGoogleConnected && (
            <p className="text-[11px] text-amber-300">
              * Connect your Google account in Settings to enable the Google Photos picker.
            </p>
          )}
        </div>

        {/* Notice if Google returned an error */}
        {photosError && (
          <div className="mx-4 mt-3 p-3 rounded-xl bg-amber-950/40 border border-amber-500/30 text-amber-200 text-xs flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-bold text-white">Google Photos Notice:</p>
              <p className="text-slate-300 leading-relaxed">{photosError}</p>
            </div>
          </div>
        )}

        {/* Manual Album ID input */}
        <div className="px-4 py-2.5 bg-slate-950/80 border-b border-white/5 space-y-1.5">
          <label className="text-[11px] font-semibold text-slate-400">
            Or paste a specific Google Photos Album ID
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={customIdInput}
              onChange={(e) => setCustomIdInput(e.target.value)}
              placeholder="Paste Google Photos Album ID"
              className="flex-1 px-3 py-1.5 rounded-lg bg-slate-900 border border-white/10 text-white text-xs font-mono"
            />
            <button
              onClick={handleApplyCustomId}
              disabled={!customIdInput.trim()}
              className="px-3 py-1.5 rounded-lg bg-pink-600 hover:bg-pink-500 disabled:opacity-40 text-white text-xs font-bold transition"
            >
              Apply
            </button>
          </div>
        </div>

        {/* Albums List */}
        <div className="p-4 overflow-y-auto space-y-2 flex-1">
          {albums.length === 0 ? (
            <div className="py-10 text-center text-slate-400">
              <Sparkles className="w-10 h-10 text-amber-400 mx-auto mb-2 opacity-80" />
              <p className="text-sm font-semibold text-white">No photos or albums selected yet</p>
              <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                Click <strong>"Select Photos from Google Photos"</strong> above to launch Google's photo picker and choose photos for your family display.
              </p>
            </div>
          ) : (
            albums.map((album) => {
              const isSelected = album.id === selectedAlbumId;
              const isPicked = album.id === 'PICKED_GOOGLE_PHOTOS';

              return (
                <div
                  key={album.id}
                  onClick={() => {
                    onSelectAlbum(album);
                    onClose();
                  }}
                  className={`flex items-center gap-3 p-3 rounded-xl border transition cursor-pointer ${
                    isSelected
                      ? 'bg-pink-950/40 border-pink-500/50 shadow-md ring-1 ring-pink-500/30'
                      : 'bg-slate-800/60 border-white/5 hover:bg-slate-800'
                  }`}
                >
                  {/* Cover Photo or Placeholder */}
                  <div className="w-14 h-14 rounded-lg overflow-hidden bg-slate-800 flex-shrink-0 relative border border-white/10 flex items-center justify-center">
                    {album.coverPhotoBaseUrl ? (
                      <img
                        src={album.coverPhotoBaseUrl}
                        alt={album.title}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="text-slate-400">
                        <Image className="w-6 h-6" />
                      </div>
                    )}
                  </div>

                  {/* Album Info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-white truncate">{album.title}</p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {isPicked
                        ? 'Photos selected via Google Photos Picker'
                        : album.mediaItemsCount !== undefined
                        ? `${album.mediaItemsCount} items`
                        : 'Google Photos Album'}
                    </p>
                  </div>

                  {isSelected && (
                    <div className="flex-shrink-0 text-pink-400 p-1">
                      <FolderCheck className="w-5 h-5" />
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="p-3 bg-slate-950 border-t border-white/10 flex items-center justify-between">
          <span className="text-[11px] text-slate-400">
            {albums.length} item{albums.length === 1 ? '' : 's'} available
          </span>
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-semibold text-sm transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
