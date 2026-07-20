import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Heart, Check, ListMusic, ListPlus, Plus, ChevronRight, Trash2 } from 'lucide-react';
import { usePlaylistStore, useFavoritesStore, usePlayerStore, useToastStore } from '@/stores';
import type { Song } from '@/types';

interface SongContextMenuProps {
  song: Song;
  x: number;
  y: number;
  onClose: () => void;
  onRemoveFromPlaylist?: () => void; // Optional: Only for playlist detail page
  onRemoveFromHistory?: () => void; // Optional: Only for history page
}

export function SongContextMenu({ song, x, y, onClose, onRemoveFromPlaylist, onRemoveFromHistory }: SongContextMenuProps) {
  const { isFavoriteSong, toggleFavoriteSong } = useFavoritesStore();
  const { playlists, addSongToPlaylist, createPlaylist } = usePlaylistStore();
  const isFav = isFavoriteSong(song.id);

  const [isCreatingPlaylist, setIsCreatingPlaylist] = useState(false);
  const [newPlaylistName, setNewPlaylistName] = useState('');
  const [showPlaylistSubmenu, setShowPlaylistSubmenu] = useState(false);

  const menuRef = useRef<HTMLDivElement | null>(null);
  const submenuTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose();
      }
    };
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    const handleViewportChange = () => {
      onClose();
    };

    document.addEventListener('mousedown', handleOutsideClick);
    document.addEventListener('keydown', handleEscape);
    window.addEventListener('resize', handleViewportChange, { once: true });
    window.addEventListener('scroll', handleViewportChange, { once: true });

    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('keydown', handleEscape);
      window.removeEventListener('resize', handleViewportChange);
      window.removeEventListener('scroll', handleViewportChange);
      if (submenuTimeoutRef.current) {
        clearTimeout(submenuTimeoutRef.current);
      }
    };
  }, [onClose]);

  const handleSubmenuEnter = () => {
    if (submenuTimeoutRef.current) {
      clearTimeout(submenuTimeoutRef.current);
    }
    setShowPlaylistSubmenu(true);
  };

  const handleSubmenuLeave = () => {
    submenuTimeoutRef.current = setTimeout(() => {
      setShowPlaylistSubmenu(false);
    }, 300);
  };

  const handleAddToPlaylist = async (playlistId: string) => {
    await addSongToPlaylist(playlistId, song.id);
    useToastStore.getState().showToast('Added to playlist', 'success');
    onClose();
  };

  const handleCreateAndAddToPlaylist = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newPlaylistName.trim();
    if (!trimmed) return;

    const newPlaylist = await createPlaylist(trimmed);
    await addSongToPlaylist(newPlaylist.id, song.id);
    useToastStore.getState().showToast(`Created & added to ${trimmed}`, 'success');
    onClose();
  };

  const handleAddToQueue = () => {
    usePlayerStore.getState().addToQueue(song);
    useToastStore.getState().showToast('Added to queue', 'success');
    onClose();
  };

  const handleToggleFavorite = () => {
    toggleFavoriteSong(song.id);
    onClose();
  };

  const isLeft = x > window.innerWidth - 450;

  return createPortal(
    <motion.div
      ref={menuRef}
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.12 }}
      className="fixed w-56 glass rounded-xl py-1 z-50 shadow-glass border border-white/10 text-left font-sans text-xs text-text/80"
      style={{ top: y, left: x }}
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
      onMouseUp={(e) => e.stopPropagation()}
      onDoubleClick={(e) => e.stopPropagation()}
    >
      {/* 1. Add to Playlist Submenu Trigger */}
      <div
        className="relative"
        onMouseEnter={handleSubmenuEnter}
        onMouseLeave={handleSubmenuLeave}
      >
        <button className="w-full flex items-center justify-between px-3 py-2 hover:bg-white/5 hover:text-text transition-colors font-medium">
          <div className="flex items-center gap-2">
            <Plus size={14} className="text-text/50" />
            <span>Add to playlist</span>
          </div>
          <ChevronRight size={14} className="text-text/30" />
        </button>

        {/* Submenu flyout */}
        <AnimatePresence>
          {showPlaylistSubmenu && (
            <motion.div
              onMouseEnter={handleSubmenuEnter}
              onMouseLeave={handleSubmenuLeave}
              initial={{ opacity: 0, x: isLeft ? 10 : -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: isLeft ? 10 : -10 }}
              className={`absolute top-0 w-52 z-50 ${isLeft ? 'right-full pr-1.5' : 'left-full pl-1.5'}`}
              onClick={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
            >
              <div className="bg-zinc-900 border border-white/5 rounded-xl shadow-2xl py-1 text-left">
                {playlists.length > 0 ? (
                  <div className="max-h-52 overflow-y-auto">
                    {playlists.map((playlist) => {
                      const alreadyAdded = playlist.songIds.includes(song.id);
                      return (
                        <button
                          key={playlist.id}
                          onClick={(e) => {
                            e.stopPropagation();
                            if (!alreadyAdded) {
                              handleAddToPlaylist(playlist.id);
                            }
                          }}
                          onMouseDown={(e) => e.stopPropagation()}
                          disabled={alreadyAdded}
                          className={`w-full flex items-center justify-between px-3 py-2 text-xs font-medium transition-colors ${
                            alreadyAdded
                              ? 'text-text/30 cursor-not-allowed'
                              : 'text-text/70 hover:text-text hover:bg-white/5'
                          }`}
                        >
                          <span className="truncate flex-1 mr-2">{playlist.name}</span>
                          {alreadyAdded ? (
                            <Check size={10} className="text-primary shrink-0" />
                          ) : (
                            <ListMusic size={10} className="text-text/30 shrink-0" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <p className="px-3 py-2 text-xs text-text/40 italic">No playlists yet</p>
                )}

                {/* Inline Create and Add form */}
                <div className="border-t border-white/5 mt-1 pt-1">
                  {isCreatingPlaylist ? (
                    <form
                      onSubmit={handleCreateAndAddToPlaylist}
                      className="px-2 py-1 flex gap-1.5"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <input
                        type="text"
                        placeholder="Playlist name..."
                        value={newPlaylistName}
                        onChange={(e) => setNewPlaylistName(e.target.value)}
                        autoFocus
                        onClick={(e) => e.stopPropagation()}
                        onMouseDown={(e) => e.stopPropagation()}
                        className="bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-xs text-text placeholder:text-text/25 focus:outline-none focus:ring-1 focus:ring-primary/40 w-full"
                      />
                      <button
                        type="submit"
                        className="px-2.5 py-1 bg-primary text-zinc-950 rounded-lg font-semibold text-[10px] shadow-glow"
                      >
                        Add
                      </button>
                    </form>
                  ) : (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setIsCreatingPlaylist(true);
                      }}
                      onMouseDown={(e) => e.stopPropagation()}
                      className="w-full flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-primary hover:bg-white/5 transition-colors"
                    >
                      <Plus size={12} />
                      Create & Add
                    </button>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* 2. Add to / Remove from Liked Songs */}
      <button
        onClick={handleToggleFavorite}
        className="w-full flex items-center gap-2 px-3 py-2 hover:bg-white/5 hover:text-text transition-colors font-medium text-left"
      >
        {isFav ? (
          <>
            <Check size={14} className="text-primary" />
            <span>Remove from Liked Songs</span>
          </>
        ) : (
          <>
            <Heart size={14} className="text-text/50" />
            <span>Add to Liked Songs</span>
          </>
        )}
      </button>

      {/* 3. Add to Queue */}
      <button
        onClick={handleAddToQueue}
        className="w-full flex items-center gap-2 px-3 py-2 hover:bg-white/5 hover:text-text transition-colors font-medium text-left border-t border-white/5 mt-1 pt-1.5"
      >
        <ListPlus size={14} className="text-text/50" />
        <span>Add to queue</span>
      </button>

      {/* 4. Optional Remove from current playlist */}
      {onRemoveFromPlaylist && (
        <button
          onClick={() => {
            onRemoveFromPlaylist();
            onClose();
          }}
          className="w-full flex items-center gap-2 px-3 py-2 hover:bg-white/5 hover:text-danger text-danger/80 transition-colors font-medium text-left border-t border-white/5 mt-1 pt-1.5"
        >
          <Trash2 size={14} className="text-danger/60" />
          <span>Remove from playlist</span>
        </button>
      )}

      {/* 5. Optional Remove from listening history */}
      {onRemoveFromHistory && (
        <button
          onClick={() => {
            onRemoveFromHistory();
            onClose();
          }}
          className="w-full flex items-center gap-2 px-3 py-2 hover:bg-white/5 hover:text-danger text-danger/80 transition-colors font-medium text-left border-t border-white/5 mt-1 pt-1.5"
        >
          <Trash2 size={14} className="text-danger/60" />
          <span>Remove from history</span>
        </button>
      )}
    </motion.div>,
    document.body
  );
}
