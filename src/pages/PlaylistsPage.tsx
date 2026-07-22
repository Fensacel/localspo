import { usePlaylistStore, useLibraryStore } from '@/stores';
import { ListMusic, Plus, Pin, Heart, Trash2, Camera, Radio } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ImportPlaylistModal } from '@/components/ImportPlaylistModal';
import { getImageUrl } from '@/utils';

export function PlaylistsPage() {
  const { playlists, createPlaylist, deletePlaylist, togglePinPlaylist, toggleFavoritePlaylist } =
    usePlaylistStore();
  const { getSongById } = useLibraryStore();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [playlistToDelete, setPlaylistToDelete] = useState<string | null>(null);
  const [newPlaylistName, setNewPlaylistName] = useState('');
  const [newPlaylistDesc, setNewPlaylistDesc] = useState('');
  const [newPlaylistCover, setNewPlaylistCover] = useState<string | null>(null);
  const navigate = useNavigate();

  const handlePickCover = async () => {
    const file = await window.electronAPI.dialog.openImage();
    if (file) {
      setNewPlaylistCover(file);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = newPlaylistName.trim();
    if (!name) return;

    try {
      const newPlaylist = await createPlaylist(name, newPlaylistDesc, newPlaylistCover);
      setNewPlaylistName('');
      setNewPlaylistDesc('');
      setNewPlaylistCover(null);
      setShowCreateModal(false);
      if (newPlaylist?.id) {
        navigate(`/playlists/${newPlaylist.id}`);
      }
    } catch (err) {
      console.error('Failed to create playlist:', err);
      setShowCreateModal(false);
    }
  };

  // Sort playlists: pinned first, then newest
  const sortedPlaylists = [...playlists].sort((a, b) => {
    if (a.isPinned && !b.isPinned) return -1;
    if (!a.isPinned && b.isPinned) return 1;
    return b.createdAt - a.createdAt;
  });

  return (
    <div className="relative">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Playlists</h1>
          <p className="text-sm text-text/40 mt-1">
            {playlists.length} playlist{playlists.length !== 1 ? 's' : ''} created
          </p>
        </div>
        <div className="flex items-center gap-3">
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setShowImportModal(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-sky-500/15 hover:bg-sky-500/25 border border-sky-500/30 rounded-button text-sm font-semibold text-sky-400 transition-all shadow-sm"
          >
            <Radio size={16} />
            Import Spotify Playlist
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-primary rounded-button text-sm font-semibold text-zinc-950 shadow-glow hover:bg-primary-hover transition-colors"
          >
            <Plus size={16} />
            New Playlist
          </motion.button>
        </div>
      </div>

      {sortedPlaylists.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-5">
          {sortedPlaylists.map((playlist) => {
            const coverSrc = playlist.coverPath
              ? getImageUrl(playlist.coverPath)
              : null;
            const validSongCount = playlist.songIds.filter((sid) => !!getSongById(sid)).length;

            return (
              <motion.div
                key={playlist.id}
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                onClick={() => navigate(`/playlists/${playlist.id}`)}
                className="group cursor-pointer relative"
              >
                <div className="relative rounded-card overflow-hidden aspect-square mb-3 shadow-glass bg-white/[0.02]">
                  {coverSrc ? (
                    <img
                      src={coverSrc}
                      alt={playlist.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center text-text/10 group-hover:text-primary/25 transition-colors">
                      <ListMusic size={48} strokeWidth={1.2} />
                    </div>
                  )}

                  {/* Actions overlay */}
                  <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        togglePinPlaylist(playlist.id);
                      }}
                      className={`p-1.5 rounded-lg glass hover:scale-110 transition-transform ${
                        playlist.isPinned ? 'text-primary' : 'text-text/50 hover:text-text'
                      }`}
                    >
                      <Pin size={12} fill={playlist.isPinned ? 'currentColor' : 'none'} />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleFavoritePlaylist(playlist.id);
                      }}
                      className={`p-1.5 rounded-lg glass hover:scale-110 transition-transform ${
                        playlist.isFavorite ? 'text-red-500' : 'text-text/50 hover:text-text'
                      }`}
                    >
                      <Heart size={12} fill={playlist.isFavorite ? 'currentColor' : 'none'} />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setPlaylistToDelete(playlist.id);
                      }}
                      className="p-1.5 rounded-lg glass hover:scale-110 hover:text-danger text-text/50 transition-all"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>

                  {/* Songs counter indicator */}
                  <div className="absolute bottom-2 left-2 px-2 py-0.5 rounded-md glass text-[10px] font-mono tracking-wide text-text/70">
                    {validSongCount} song{validSongCount !== 1 ? 's' : ''}
                  </div>
                </div>

                <div className="px-1">
                  <div className="flex items-center gap-1.5">
                    {playlist.isPinned && (
                      <Pin size={10} className="text-primary transform rotate-45" />
                    )}
                    <p className="text-sm font-semibold truncate flex-1">{playlist.name}</p>
                  </div>
                  <p className="text-xs text-text/30 truncate mt-0.5">
                    {playlist.description || 'No description'}
                  </p>
                </div>
              </motion.div>
            );
          })}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center h-[50vh] text-center">
          <div className="w-24 h-24 glass rounded-2xl flex items-center justify-center mb-4">
            <ListMusic size={36} className="text-text/20" />
          </div>
          <p className="text-text/40 text-sm">No playlists yet</p>
          <p className="text-text/20 text-xs mt-1">Create a playlist to organize your music</p>
        </div>
      )}

      {/* Create Modal overlay */}
      <AnimatePresence>
        {showCreateModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="w-full max-w-md glass rounded-2xl p-6 shadow-glow"
            >
              <h3 className="text-lg font-bold mb-4">Create Playlist</h3>
              <form onSubmit={handleCreate} className="space-y-4">
                <div className="flex gap-4 items-center">
                  <button
                    type="button"
                    onClick={handlePickCover}
                    className="group relative w-24 h-24 rounded-2xl glass shrink-0 overflow-hidden flex flex-col items-center justify-center border border-dashed border-white/20 hover:border-primary/50 transition-colors"
                    title="Choose Cover Image"
                  >
                    {newPlaylistCover ? (
                      <img
                        src={`local-image://${encodeURIComponent(newPlaylistCover)}`}
                        alt=""
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <>
                        <Camera size={24} className="text-text/30 group-hover:text-primary transition-colors mb-1" />
                        <span className="text-[10px] font-semibold text-text/40 group-hover:text-text">Add Cover</span>
                      </>
                    )}
                  </button>
                  <div className="flex-1 space-y-2">
                    <div>
                      <label className="block text-[10px] font-semibold uppercase tracking-wider text-text/40 mb-1">
                        Playlist Name
                      </label>
                      <input
                        type="text"
                        required
                        value={newPlaylistName}
                        onChange={(e) => setNewPlaylistName(e.target.value)}
                        placeholder="My Awesome Playlist"
                        className="w-full px-3.5 py-2 glass rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                      />
                    </div>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-text/40 mb-1.5">
                    Description
                  </label>
                  <textarea
                    value={newPlaylistDesc}
                    onChange={(e) => setNewPlaylistDesc(e.target.value)}
                    placeholder="Add an optional description"
                    rows={3}
                    className="w-full px-4 py-2.5 glass rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
                  />
                </div>
                <div className="flex justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setNewPlaylistName('');
                      setNewPlaylistDesc('');
                      setNewPlaylistCover(null);
                      setShowCreateModal(false);
                    }}
                    className="px-4 py-2 text-sm text-text/50 hover:text-text transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-primary rounded-button text-sm font-semibold text-zinc-950 shadow-glow hover:bg-primary-hover transition-colors"
                  >
                    Create
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {playlistToDelete && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-sm bg-zinc-900 border border-white/10 p-6 rounded-2xl shadow-2xl text-center"
            >
              <h3 className="text-base font-bold mb-2 text-text">Delete Playlist</h3>
              <p className="text-xs text-text/50 mb-6">
                Are you sure you want to delete this playlist? This action cannot be undone.
              </p>
              <div className="flex gap-3 justify-center">
                <button
                  onClick={() => setPlaylistToDelete(null)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-text/60 hover:text-text hover:bg-white/5 transition-colors border border-white/5"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    deletePlaylist(playlistToDelete);
                    setPlaylistToDelete(null);
                  }}
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-red-600 text-white hover:bg-red-500 transition-colors shadow-glow"
                >
                  Delete
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      <ImportPlaylistModal
        isOpen={showImportModal}
        onClose={() => setShowImportModal(false)}
      />
    </div>
  );
}
