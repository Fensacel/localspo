import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ListMusic,
  Plus,
  RefreshCw,
  Trash2,
  ExternalLink,
  Download,
  Clock,
  CheckCircle2,
  X,
  ToggleLeft,
  ToggleRight,
} from 'lucide-react';
import { useSpotifyStore } from '../stores/useSpotifyStore';
import { useDownloaderStore } from '../stores/useDownloaderStore';
import type { SpotifyLinkedPlaylist, SyncInterval } from '../types';

const SYNC_INTERVALS: { value: SyncInterval; label: string }[] = [
  { value: 0, label: 'On Startup' },
  { value: 15, label: 'Every 15 min' },
  { value: 30, label: 'Every 30 min' },
  { value: 60, label: 'Every hour' },
  { value: 1440, label: 'Daily' },
];

function formatSyncDate(ts: number | null): string {
  if (!ts) return 'Never';
  const d = new Date(ts);
  const diff = Date.now() - ts;
  if (diff < 60000) return 'Just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return d.toLocaleDateString();
}

export function SpotifyPlaylistsTab() {
  const { linkedPlaylists, isLoadingPlaylists, loadLinkedPlaylists, addLinkedPlaylist, removeLinkedPlaylist, toggleAutoSync, setSyncInterval, syncPlaylist, syncProgress } =
    useSpotifyStore();
  const { settings } = useDownloaderStore();

  const [urlInput, setUrlInput] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [selectedPlaylist, setSelectedPlaylist] = useState<SpotifyLinkedPlaylist | null>(null);

  useEffect(() => {
    loadLinkedPlaylists();
  }, [loadLinkedPlaylists]);

  const handleAddPlaylist = async () => {
    if (!urlInput.trim()) return;
    setIsAdding(true);
    try {
      const linked = await addLinkedPlaylist(urlInput.trim(), {
        autoSync: true,
        syncInterval: 0,
      });
      if (linked) setUrlInput('');
    } finally {
      setIsAdding(false);
    }
  };

  const handleSync = async (playlist: SpotifyLinkedPlaylist) => {
    // We don't have spotifyId->localSongId mapping here — pass empty array so
    // the sync engine computes the full diff vs Spotify
    const localSpotifyIds: string[] = [];

    await syncPlaylist(playlist.spotifyId, localSpotifyIds, settings?.keepRemovedSongs ?? true);
  };

  if (isLoadingPlaylists) {
    return (
      <div className="flex items-center justify-center h-48">
        <RefreshCw size={20} className="text-primary animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Add Playlist Input */}
      <div className="flex gap-2">
        <input
          type="text"
          value={urlInput}
          onChange={(e) => setUrlInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleAddPlaylist()}
          placeholder="Paste Spotify playlist URL to follow..."
          className="flex-1 px-3 py-2.5 glass rounded-xl text-sm text-text placeholder:text-text/30 focus:outline-none focus:ring-1 focus:ring-primary/40 border border-white/5"
        />
        <button
          onClick={handleAddPlaylist}
          disabled={isAdding || !urlInput.trim()}
          className="flex items-center gap-2 px-4 py-2.5 bg-primary rounded-xl text-xs font-bold text-zinc-950 shadow-glow hover:bg-primary-hover disabled:opacity-50 transition-all"
        >
          {isAdding ? <RefreshCw size={14} className="animate-spin" /> : <Plus size={14} />}
          Follow
        </button>
      </div>

      {/* Playlist Grid */}
      {linkedPlaylists.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-56 gap-3">
          <div className="w-14 h-14 rounded-2xl bg-primary/10 border border-primary/15 flex items-center justify-center">
            <ListMusic size={22} className="text-primary/60" />
          </div>
          <p className="text-sm font-semibold text-text/40">No followed playlists</p>
          <p className="text-xs text-text/25 text-center max-w-xs">
            Paste a Spotify playlist URL above to follow it and keep it in sync
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-xs text-text/40 font-semibold uppercase tracking-wider">
            {linkedPlaylists.length} followed playlist{linkedPlaylists.length !== 1 ? 's' : ''}
          </p>
          {linkedPlaylists.map((playlist) => {
            const progress = syncProgress[playlist.spotifyId];
            const isSyncing = progress?.phase === 'fetching' || progress?.phase === 'comparing' || progress?.phase === 'downloading';

            return (
              <motion.div
                key={playlist.spotifyId}
                layout
                className="glass rounded-xl border border-white/5 overflow-hidden"
              >
                <div className="flex items-center gap-3 p-3">
                  {/* Cover */}
                  {playlist.coverUrl ? (
                    <img
                      src={playlist.coverUrl}
                      alt=""
                      className="w-12 h-12 rounded-lg object-cover shrink-0 cursor-pointer"
                      onClick={() => setSelectedPlaylist(playlist)}
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-lg bg-white/5 flex items-center justify-center shrink-0">
                      <ListMusic size={16} className="text-text/30" />
                    </div>
                  )}

                  {/* Info */}
                  <div className="flex-1 min-w-0 cursor-pointer" onClick={() => setSelectedPlaylist(playlist)}>
                    <p className="text-sm font-semibold text-text truncate">{playlist.name}</p>
                    <p className="text-xs text-text/50 truncate">
                      by {playlist.owner || 'Unknown'} · {playlist.trackCount} tracks
                    </p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <Clock size={10} className="text-text/30" />
                      <span className="text-[10px] text-text/30">
                        Synced {formatSyncDate(playlist.lastSync)}
                      </span>
                      {playlist.localPlaylistId && (
                        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-emerald-500/10 border border-emerald-500/20 text-[9px] font-bold text-emerald-400">
                          <CheckCircle2 size={8} />
                          Local
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    {/* Auto sync toggle */}
                    <button
                      onClick={() => toggleAutoSync(playlist.spotifyId, !playlist.autoSync)}
                      className={`p-1.5 rounded-lg transition-colors ${
                        playlist.autoSync ? 'text-primary hover:bg-primary/10' : 'text-text/30 hover:bg-white/5'
                      }`}
                      title={playlist.autoSync ? 'Auto sync ON' : 'Auto sync OFF'}
                    >
                      {playlist.autoSync ? <ToggleRight size={18} /> : <ToggleLeft size={18} />}
                    </button>

                    {/* Sync interval */}
                    <select
                      value={playlist.syncInterval}
                      onChange={(e) => setSyncInterval(playlist.spotifyId, Number(e.target.value) as SyncInterval)}
                      className="text-[10px] bg-white/5 border border-white/10 rounded-lg px-1.5 py-1 text-text/60 focus:outline-none focus:ring-1 focus:ring-primary/30"
                    >
                      {SYNC_INTERVALS.map((opt) => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>

                    {/* Sync button */}
                    <button
                      onClick={() => handleSync(playlist)}
                      disabled={isSyncing}
                      className="flex items-center gap-1 px-2.5 py-1.5 glass rounded-lg text-[10px] font-semibold text-text/70 hover:text-text hover:bg-white/10 transition-all disabled:opacity-50"
                    >
                      <RefreshCw size={11} className={isSyncing ? 'animate-spin' : ''} />
                      Sync
                    </button>

                    {/* Open on Spotify */}
                    <a
                      href={`https://open.spotify.com/playlist/${playlist.spotifyId}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-1.5 rounded-lg text-text/30 hover:text-text/60 hover:bg-white/5 transition-colors"
                    >
                      <ExternalLink size={13} />
                    </a>

                    {/* Remove */}
                    <button
                      onClick={() => removeLinkedPlaylist(playlist.spotifyId)}
                      className="p-1.5 rounded-lg text-text/30 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                      title="Remove from sync"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>

                {/* Sync progress bar */}
                {isSyncing && progress && (
                  <div className="px-3 pb-3">
                    <p className="text-[10px] text-text/40 mb-1">{progress.message}</p>
                    <div className="h-1 bg-white/5 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary rounded-full transition-all duration-300"
                        style={{
                          width: progress.totalTracks > 0
                            ? `${(progress.downloadedTracks / progress.totalTracks) * 100}%`
                            : '30%',
                        }}
                      />
                    </div>
                  </div>
                )}
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Playlist Detail Modal */}
      <AnimatePresence>
        {selectedPlaylist && (
          <PlaylistDetailModal
            playlist={selectedPlaylist}
            onClose={() => setSelectedPlaylist(null)}
            onSync={() => handleSync(selectedPlaylist)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function PlaylistDetailModal({
  playlist,
  onClose,
  onSync,
}: {
  playlist: SpotifyLinkedPlaylist;
  onClose: () => void;
  onSync: () => void;
}) {
  const { downloadUrl } = useDownloaderStore();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="w-full max-w-md glass-heavy rounded-2xl border border-white/10 shadow-2xl overflow-hidden"
      >
        {/* Cover Header */}
        <div className="relative h-40 bg-white/5">
          {playlist.coverUrl && (
            <img src={playlist.coverUrl} alt="" className="w-full h-full object-cover opacity-40" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-zinc-950/90 to-transparent" />
          <button
            onClick={onClose}
            className="absolute top-3 right-3 p-1.5 rounded-lg bg-black/40 text-white/60 hover:text-white transition-colors"
          >
            <X size={16} />
          </button>
          <div className="absolute bottom-3 left-4 flex items-end gap-3">
            {playlist.coverUrl && (
              <img src={playlist.coverUrl} alt="" className="w-16 h-16 rounded-xl object-cover border-2 border-white/20 shadow-xl" />
            )}
            <div>
              <p className="text-lg font-bold text-white leading-tight">{playlist.name}</p>
              <p className="text-xs text-white/60">by {playlist.owner || 'Unknown'}</p>
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="p-4 space-y-4">
          {playlist.description && (
            <p className="text-xs text-text/50 leading-relaxed">{playlist.description}</p>
          )}

          <div className="flex items-center gap-4 text-xs text-text/50">
            <span>{playlist.trackCount} tracks</span>
            <span>·</span>
            <span>Last synced {formatSyncDate(playlist.lastSync)}</span>
          </div>

          {/* Buttons */}
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => { onSync(); onClose(); }}
              className="flex items-center justify-center gap-2 py-2.5 bg-primary rounded-xl text-xs font-bold text-zinc-950 shadow-glow hover:bg-primary-hover transition-all"
            >
              <RefreshCw size={13} />
              Sync Now
            </button>
            <button
              onClick={async () => {
                await downloadUrl(`https://open.spotify.com/playlist/${playlist.spotifyId}`);
                onClose();
              }}
              className="flex items-center justify-center gap-2 py-2.5 glass border border-white/10 rounded-xl text-xs font-semibold text-text/80 hover:text-text hover:bg-white/10 transition-all"
            >
              <Download size={13} />
              Download Missing
            </button>
            <a
              href={`https://open.spotify.com/playlist/${playlist.spotifyId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 py-2 glass border border-white/5 rounded-xl text-xs text-text/50 hover:text-text/80 transition-colors col-span-2"
            >
              <ExternalLink size={12} />
              Open on Spotify
            </a>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
