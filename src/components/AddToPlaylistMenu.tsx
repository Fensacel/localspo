import { useState, useRef, useEffect } from 'react';
import { usePlaylistStore } from '@/stores';
import { Plus, ListMusic, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface AddToPlaylistMenuProps {
  songId: string;
}

export function AddToPlaylistMenu({ songId }: AddToPlaylistMenuProps) {
  const { playlists, addSongToPlaylist } = usePlaylistStore();
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleAdd = async (playlistId: string) => {
    await addSongToPlaylist(playlistId, songId);
    setIsOpen(false);
  };

  if (playlists.length === 0) return null;

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen(!isOpen);
        }}
        className="opacity-0 group-hover:opacity-100 hover:text-primary text-text/30 transition-all p-1 hover:scale-110"
        title="Add to Playlist"
      >
        <Plus size={14} />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -10 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 mt-1.5 w-48 glass rounded-xl py-1 z-30 shadow-glass border border-white/10 text-left"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="px-3 py-1.5 text-[10px] uppercase font-bold tracking-wider text-text/30 border-b border-white/5 mb-1">
              Add to Playlist
            </p>
            <div className="max-h-40 overflow-y-auto">
              {playlists.map((playlist) => {
                const alreadyAdded = playlist.songIds.includes(songId);
                return (
                  <button
                    key={playlist.id}
                    onClick={() => !alreadyAdded && handleAdd(playlist.id)}
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
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
