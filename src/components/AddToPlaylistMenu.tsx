import { useState, useRef, useEffect } from 'react';
import { usePlaylistStore } from '@/stores';
import { Plus, ListMusic, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface AddToPlaylistMenuProps {
  songId: string;
}

export function AddToPlaylistMenu({ songId }: AddToPlaylistMenuProps) {
  const { playlists, addSongToPlaylist, createPlaylist } = usePlaylistStore();
  const [isOpen, setIsOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [newPlaylistName, setNewPlaylistName] = useState('');
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setIsCreating(false);
        setNewPlaylistName('');
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleAdd = async (e: React.MouseEvent, playlistId: string) => {
    e.stopPropagation();
    e.preventDefault();
    await addSongToPlaylist(playlistId, songId);
    setTimeout(() => setIsOpen(false), 50);
  };

  const handleCreateAndAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!newPlaylistName.trim()) return;
    try {
      const newPlaylist = await createPlaylist(newPlaylistName.trim());
      await addSongToPlaylist(newPlaylist.id, songId);
      setNewPlaylistName('');
      setIsCreating(false);
      setTimeout(() => setIsOpen(false), 50);
    } catch (err) {
      console.error('Failed to create and add to playlist:', err);
    }
  };

  return (
    <div
      className="relative"
      ref={menuRef}
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
      onDoubleClick={(e) => e.stopPropagation()}
    >
      <button
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen(!isOpen);
        }}
        className="opacity-0 group-hover:opacity-100 hover:text-primary text-text/30 transition-all p-1 hover:scale-110 animate-fade-in"
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
            className="absolute right-0 mt-1.5 w-52 glass rounded-xl py-1 z-30 shadow-glass border border-white/10 text-left font-sans"
            onClick={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
            onDoubleClick={(e) => e.stopPropagation()}
            onMouseUp={(e) => e.stopPropagation()}
          >
            <p className="px-3 py-1.5 text-[10px] uppercase font-bold tracking-wider text-text/30 border-b border-white/5 mb-1">
              Add to Playlist
            </p>
            
            {playlists.length > 0 ? (
              <div className="max-h-40 overflow-y-auto">
                {playlists.map((playlist) => {
                  const alreadyAdded = playlist.songIds.includes(songId);
                  return (
                    <button
                      key={playlist.id}
                      onClick={(e) => !alreadyAdded && handleAdd(e, playlist.id)}
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

            {/* Create New Playlist option inside the dropdown */}
            <div className="border-t border-white/5 mt-1 pt-1">
              {isCreating ? (
                <form onSubmit={handleCreateAndAdd} className="px-2 py-1 flex gap-1.5">
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
                    onClick={(e) => e.stopPropagation()}
                    onMouseDown={(e) => e.stopPropagation()}
                    className="px-2.5 py-1 bg-primary text-zinc-950 rounded-lg font-semibold text-[10px] shadow-glow"
                  >
                    Add
                  </button>
                </form>
              ) : (
                <button
                  onClick={(e) => { e.stopPropagation(); setIsCreating(true); }}
                  onMouseDown={(e) => e.stopPropagation()}
                  className="w-full flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-primary hover:bg-white/5 transition-colors"
                >
                  <Plus size={12} />
                  Create & Add
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
