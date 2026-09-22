import React from 'react';
import { PhotoAlbum } from '../types';
import { X, Image, FolderCheck, Sparkles } from 'lucide-react';

interface AlbumSelectModalProps {
  isOpen: boolean;
  onClose: () => void;
  albums: PhotoAlbum[];
  selectedAlbumId: string;
  onSelectAlbum: (album: PhotoAlbum) => void;
}

export const AlbumSelectModal: React.FC<AlbumSelectModalProps> = ({
  isOpen,
  onClose,
  albums,
  selectedAlbumId,
  onSelectAlbum,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="w-full max-w-md bg-slate-900 border border-white/10 rounded-2xl shadow-2xl flex flex-col max-h-[85vh] overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-pink-600/20 text-pink-400">
              <Image className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Google Photos Album</h3>
              <p className="text-xs text-slate-400">
                Choose an album for the top slideshow
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Albums Grid */}
        <div className="p-4 overflow-y-auto space-y-2 flex-1">
          {albums.length === 0 ? (
            <div className="py-12 text-center text-slate-400">
              <Sparkles className="w-10 h-10 text-amber-400 mx-auto mb-2 opacity-80" />
              <p className="text-sm font-semibold text-white">No albums found</p>
              <p className="text-xs text-slate-400 mt-1">
                Make sure you have created albums in your Google Photos account.
              </p>
            </div>
          ) : (
            albums.map((album) => {
              const isSelected = album.id === selectedAlbumId;
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
                  <div className="w-14 h-14 rounded-lg overflow-hidden bg-slate-800 flex-shrink-0 relative border border-white/10">
                    {album.coverPhotoBaseUrl ? (
                      <img
                        src={album.coverPhotoBaseUrl}
                        alt={album.title}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-slate-500">
                        <Image className="w-6 h-6" />
                      </div>
                    )}
                  </div>

                  {/* Album Info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-white truncate">{album.title}</p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {album.mediaItemsCount !== undefined
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
        <div className="p-3 bg-slate-950 border-t border-white/10 flex justify-end">
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
