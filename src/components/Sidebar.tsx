import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Disc3,
  Heart,
  ListMusic,
  Settings,
  FolderOpen,
  FileText,
  Download,
  Plus,
  Library,
  Folder,
  Home,
} from 'lucide-react';
import { usePlaylistStore, useLibraryStore, useFavoritesStore, usePlayerStore } from '@/stores';
import { getImageUrl } from '@/utils';

export function Sidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { playlists, createPlaylist } = usePlaylistStore();
  const { songs, albums } = useLibraryStore();
  const { songIds } = useFavoritesStore();

  const handleNav = (path: string) => {
    usePlayerStore.setState({ showLyrics: false, showNowPlaying: false });
    navigate(path);
  };

  const [activeFilter, setActiveFilter] = useState<'all' | 'playlists' | 'local'>('all');
  const [isCreatingPlaylist, setIsCreatingPlaylist] = useState(false);
  const [newPlaylistName, setNewPlaylistName] = useState('');

  const handleCreatePlaylist = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPlaylistName.trim()) return;
    const newPl = await createPlaylist(newPlaylistName.trim());
    setNewPlaylistName('');
    setIsCreatingPlaylist(false);
    handleNav(`/playlists/${newPl.id}`);
  };

  return (
    <motion.aside
      initial={{ x: -20, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
      className="w-[280px] h-full glass-heavy hidden md:flex flex-col shrink-0 z-40 select-none border-r border-white/5"
    >
      {/* Navigation Top Header */}
      <div className="px-3 pt-3 pb-2 space-y-1">
        <button
          type="button"
          onClick={() => handleNav('/')}
          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all cursor-pointer ${
            location.pathname === '/'
              ? 'bg-white/10 text-white shadow-sm'
              : 'text-text/60 hover:text-white hover:bg-white/5'
          }`}
        >
          <Home size={18} />
          <span>Home</span>
        </button>

        <button
          type="button"
          onClick={() => handleNav('/downloads')}
          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all cursor-pointer ${
            location.pathname === '/downloads'
              ? 'bg-white/10 text-white shadow-sm'
              : 'text-text/60 hover:text-white hover:bg-white/5'
          }`}
        >
          <Download size={18} />
          <span>Downloads</span>
        </button>
      </div>

      {/* ── Spotify Style "Your Library" Section ───────────────────────────── */}
      <div className="flex-1 flex flex-col min-h-0 mx-2 mb-2 bg-[#121214]/60 rounded-2xl border border-white/5 overflow-hidden">
        {/* Your Library Header */}
        <div className="flex items-center justify-between px-4 pt-3 pb-2">
          <div className="flex items-center gap-2 text-text/70 hover:text-white transition-colors cursor-pointer" onClick={() => handleNav('/songs')}>
            <Library size={18} />
            <span className="text-sm font-bold tracking-wide">Your Library</span>
          </div>

          <button
            onClick={() => setIsCreatingPlaylist(true)}
            className="w-7 h-7 rounded-full flex items-center justify-center text-text/50 hover:text-white hover:bg-white/10 transition-all"
            title="Create Playlist"
          >
            <Plus size={16} />
          </button>
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1.5 px-3 py-1 overflow-x-auto scrollbar-none border-b border-white/5 pb-2.5">
          <button
            onClick={() => setActiveFilter('all')}
            className={`px-3 py-1 rounded-full text-xs font-semibold transition-all ${
              activeFilter === 'all'
                ? 'bg-white text-black'
                : 'bg-white/5 text-text/60 hover:bg-white/10 hover:text-white'
            }`}
          >
            All
          </button>
          <button
            onClick={() => setActiveFilter('playlists')}
            className={`px-3 py-1 rounded-full text-xs font-semibold transition-all ${
              activeFilter === 'playlists'
                ? 'bg-white text-black'
                : 'bg-white/5 text-text/60 hover:bg-white/10 hover:text-white'
            }`}
          >
            Playlists
          </button>
          <button
            onClick={() => setActiveFilter('local')}
            className={`px-3 py-1 rounded-full text-xs font-semibold transition-all ${
              activeFilter === 'local'
                ? 'bg-white text-black'
                : 'bg-white/5 text-text/60 hover:bg-white/10 hover:text-white'
            }`}
          >
            Local Files
          </button>
        </div>

        {/* Create playlist quick input inline */}
        {isCreatingPlaylist && (
          <form onSubmit={handleCreatePlaylist} className="p-2 border-b border-white/10 bg-white/5">
            <input
              type="text"
              autoFocus
              placeholder="Playlist name..."
              value={newPlaylistName}
              onChange={(e) => setNewPlaylistName(e.target.value)}
              onBlur={() => !newPlaylistName && setIsCreatingPlaylist(false)}
              className="w-full bg-[#18181b] border border-white/15 rounded-lg px-2.5 py-1.5 text-xs text-white placeholder:text-text/40 focus:outline-none focus:border-primary"
            />
          </form>
        )}

        {/* Scrollable Library Items List */}
        <div className="flex-1 overflow-y-auto px-2 py-2 space-y-1 scrollbar-thin">
          {/* 1. Local Files item (Exact Spotify Local Files folder) */}
          {(activeFilter === 'all' || activeFilter === 'local') && (
            <div
              onClick={() => handleNav('/songs')}
              className={`flex items-center gap-3 p-2 rounded-xl transition-all cursor-pointer group ${
                location.pathname === '/songs' ? 'bg-white/15 text-white' : 'hover:bg-white/5 text-text/70'
              }`}
            >
              <div className="w-10 h-10 rounded-lg bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center shrink-0">
                <Folder size={18} className="text-emerald-400" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold text-white group-hover:text-primary transition-colors truncate">
                  Local Files
                </p>
                <p className="text-[11px] text-text/40 truncate">
                  Folder • {songs.length} tracks
                </p>
              </div>
            </div>
          )}

          {/* 2. Liked Songs */}
          {(activeFilter === 'all' || activeFilter === 'playlists') && (
            <div
              onClick={() => handleNav('/favorites')}
              className={`flex items-center gap-3 p-2 rounded-xl transition-all cursor-pointer group ${
                location.pathname === '/favorites' ? 'bg-white/15 text-white' : 'hover:bg-white/5 text-text/70'
              }`}
            >
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-indigo-600 to-purple-800 flex items-center justify-center shrink-0 shadow-md">
                <Heart size={16} className="text-white fill-white" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold text-white group-hover:text-primary transition-colors truncate">
                  Liked Songs
                </p>
                <p className="text-[11px] text-text/40 truncate">
                  Playlist • {songIds.length} songs
                </p>

              </div>
            </div>
          )}

          {/* 3. User Playlists */}
          {(activeFilter === 'all' || activeFilter === 'playlists') &&
            playlists.map((pl) => (
              <div
                key={pl.id}
                onClick={() => handleNav(`/playlists/${pl.id}`)}
                className={`flex items-center gap-3 p-2 rounded-xl transition-all cursor-pointer group ${
                  location.pathname === `/playlists/${pl.id}` ? 'bg-white/15 text-white' : 'hover:bg-white/5 text-text/70'
                }`}
              >
                <div className="w-10 h-10 rounded-lg bg-white/5 border border-white/5 overflow-hidden shrink-0 flex items-center justify-center">
                  {pl.coverPath ? (
                    <img src={getImageUrl(pl.coverPath) || ''} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <ListMusic size={16} className="text-text/30" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold text-white group-hover:text-primary transition-colors truncate">
                    {pl.name}
                  </p>
                  <p className="text-[11px] text-text/40 truncate">
                    Playlist • {pl.songIds.length} songs
                  </p>
                </div>
              </div>
            ))}

          {/* 4. Local Albums */}
          {(activeFilter === 'all' || activeFilter === 'local') &&
            albums.slice(0, 10).map((alb) => (
              <div
                key={alb.id}
                onClick={() => handleNav('/albums')}
                className="flex items-center gap-3 p-2 rounded-xl transition-all cursor-pointer group hover:bg-white/5 text-text/70"
              >
                <div className="w-10 h-10 rounded-lg bg-white/5 overflow-hidden shrink-0 flex items-center justify-center">
                  {alb.coverPath ? (
                    <img src={getImageUrl(alb.coverPath) || ''} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <Disc3 size={16} className="text-text/30" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold text-white group-hover:text-primary transition-colors truncate">
                    {alb.name}
                  </p>
                  <p className="text-[11px] text-text/40 truncate">
                    Album • {alb.artist}
                  </p>
                </div>
              </div>
            ))}
        </div>

        {/* Quick Folder Add button at bottom of library */}
        <div className="p-2 border-t border-white/5">
          <button
            onClick={async () => {
              const folder = await window.electronAPI.dialog.openFolder();
              if (folder) {
                window.dispatchEvent(new CustomEvent('scan-folder', { detail: folder }));
              }
            }}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium text-text/50 hover:text-white hover:bg-white/5 transition-all"
          >
            <FolderOpen size={15} />
            <span>Add Local Folder</span>
          </button>
        </div>
      </div>

      {/* Bottom Settings Link */}
      <div className="px-3 pb-3 pt-1 border-t border-white/5 flex items-center justify-between">
        <button
          type="button"
          onClick={() => handleNav('/docs')}
          className="p-2 text-text/40 hover:text-white transition-colors cursor-pointer"
          title="Documentation"
        >
          <FileText size={16} />
        </button>
        <button
          type="button"
          onClick={() => handleNav('/settings')}
          className="p-2 text-text/40 hover:text-white transition-colors cursor-pointer"
          title="Settings"
        >
          <Settings size={16} />
        </button>
      </div>
    </motion.aside>
  );
}
