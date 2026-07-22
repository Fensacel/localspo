import { useState } from 'react';
import { motion } from 'framer-motion';
import { X, Radio, Loader2, Sparkles, Plus } from 'lucide-react';
import { usePlaylistStore, useLibraryStore, useToastStore } from '@/stores';
import { createStreamSong } from '@/types/music';
import { useNavigate } from 'react-router-dom';

interface ImportPlaylistModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ImportPlaylistModal({ isOpen, onClose }: ImportPlaylistModalProps) {
  const [url, setUrl] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const { createPlaylist, addSongsToPlaylist } = usePlaylistStore();
  const { addStreamSong } = useLibraryStore();
  const { showToast } = useToastStore();
  const navigate = useNavigate();

  const handleImport = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanUrl = url.trim();
    if (!cleanUrl) return;

    if (!cleanUrl.includes('spotify.com/playlist') && !cleanUrl.includes('spotify:playlist')) {
      showToast('Please enter a valid Spotify Playlist link', 'error');
      return;
    }

    const playlistIdMatch = cleanUrl.match(/playlist[\/:]([a-zA-Z0-9]+)/);
    const playlistId = playlistIdMatch ? playlistIdMatch[1] : null;

    if (!playlistId) {
      showToast('Could not parse Spotify Playlist ID', 'error');
      return;
    }

    setIsImporting(true);
    try {
      showToast('Fetching Spotify playlist data...', 'info');
      let meta: any = null;

      // 1. Try IPC electronAPI
      try {
        meta = await window.electronAPI.spotify.fetchPlaylistMeta(cleanUrl);
      } catch (e) {
        console.warn('IPC fetchPlaylistMeta error, using direct renderer fallback:', e);
      }

      // 2. Direct Node fetch fallback if IPC fetchPlaylistMeta returned no tracks
      if (!meta || !Array.isArray(meta.tracks) || meta.tracks.length === 0) {
        try {
          const embedHtml = await window.electronAPI.spotify.fetchUrl(`https://open.spotify.com/embed/playlist/${playlistId}`);
          if (embedHtml) {
            const match = embedHtml.match(/<script id="__NEXT_DATA__"\s+type="application\/json">\s*(.+?)\s*<\/script>/s);
            if (match && match[1]) {
              const embedJson = JSON.parse(match[1]);
              const entity = embedJson?.props?.pageProps?.state?.data?.entity || 
                             embedJson?.props?.pageProps?.state?.entity ||
                             embedJson?.props?.pageProps?.entity ||
                             embedJson?.props?.pageProps;

              if (entity) {
                const playlistTitle = entity.title || entity.name || 'Spotify Playlist';
                const playlistCoverUrl = entity.coverArt?.sources?.[0]?.url || entity.images?.[0]?.url || null;
                const rawTrackList = entity.trackList || entity.tracks?.items || entity.tracks || entity.items || [];

                const extractedTracks = (Array.isArray(rawTrackList) ? rawTrackList : []).map((item: any, idx: number) => {
                  const trackObj = item.track || item.item || item;
                  const tTitle = trackObj.title || trackObj.name || item.title || item.name || `Track ${idx + 1}`;
                  const tSubtitle = item.subtitle || trackObj.subtitle;
                  const artistsList = trackObj.artists?.map((a: any) => a.name || a.profile?.name).filter(Boolean) || [];
                  const artistStr = artistsList.length > 0 ? artistsList.join(', ') : (tSubtitle || 'Unknown Artist');
                  const tId = trackObj.id || (item.uri?.startsWith('spotify:track:') ? item.uri.split(':')[2] : `${playlistId}_${idx}`);
                  const tDur = item.duration || trackObj.durationMs || trackObj.duration_ms || 180000;
                  const cover = trackObj.album?.images?.[0]?.url ||
                                trackObj.album?.coverArt?.sources?.[0]?.url ||
                                trackObj.coverArt?.sources?.[0]?.url ||
                                playlistCoverUrl;

                  return {
                    id: tId,
                    spotifyId: tId,
                    title: tTitle,
                    artist: artistStr,
                    album: trackObj.album?.name || playlistTitle,
                    coverUrl: cover,
                    durationMs: tDur,
                  };
                });

                meta = {
                  id: playlistId,
                  title: playlistTitle,
                  description: entity.description || `Imported Spotify playlist (${extractedTracks.length} tracks)`,
                  coverUrl: playlistCoverUrl,
                  tracks: extractedTracks,
                };
              }
            }
          }
        } catch (errFallback) {
          console.warn('IPC fetchUrl embed fetch failed:', errFallback);
        }
      }

      if (!meta || !Array.isArray(meta.tracks) || meta.tracks.length === 0) {
        showToast('Could not find tracks in this Spotify playlist. Make sure the playlist is public.', 'error');
        setIsImporting(false);
        return;
      }

      // Convert tracks to stream songs
      const streamSongs = meta.tracks.map((t: any) => {
        // Build per-track cover: prefer track's own coverUrl, then try ytimg thumbnail if we have a ytVideoId,
        // avoid using playlist cover for individual tracks
        const trackCover = (t.coverUrl && t.coverUrl !== meta.coverUrl) ? t.coverUrl : (t.coverUrl || undefined);
        return createStreamSong({
          id: `stream_${t.spotifyId || t.id || Math.random().toString(36).slice(2, 9)}`,
          title: t.title || 'Unknown Track',
          artist: t.artist || 'Unknown Artist',
          // Use real album name if available and not just the playlist title
          album: (t.album && t.album !== meta.title) ? t.album : (t.album || ''),
          duration: t.durationMs ? Math.round(t.durationMs / 1000) : 180,
          coverUrl: trackCover,
          ytVideoId: t.spotifyId || t.id || undefined,
        });
      });

      // Register stream songs to library store
      streamSongs.forEach((s: any) => addStreamSong(s));

      // Create local playlist
      const newPlaylist = await createPlaylist(
        meta.title || 'Imported Spotify Playlist',
        meta.description || `Imported Spotify playlist with ${streamSongs.length} tracks`,
        meta.coverUrl
      );

      if (newPlaylist && newPlaylist.id) {
        await addSongsToPlaylist(newPlaylist.id, streamSongs);
        showToast(`Imported "${newPlaylist.name}" (${streamSongs.length} songs)!`, 'success');
        setUrl('');
        onClose();
        navigate(`/playlists/${newPlaylist.id}`);
      }
    } catch (err: any) {
      console.error('Import playlist error:', err);
      showToast(err?.message || 'Failed to import Spotify playlist', 'error');
    } finally {
      setIsImporting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        className="w-full max-w-md bg-[#18181c] border border-white/10 p-6 rounded-2xl shadow-2xl relative overflow-hidden"
      >
        {/* Glow Accent */}
        <div className="absolute -top-12 -right-12 w-32 h-32 bg-sky-500/20 blur-3xl rounded-full pointer-events-none" />
        <div className="absolute -bottom-12 -left-12 w-32 h-32 bg-primary/20 blur-3xl rounded-full pointer-events-none" />

        <div className="flex items-center justify-between mb-4 relative z-10">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-sky-500/15 border border-sky-500/20 flex items-center justify-center text-sky-400">
              <Radio size={18} />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Import Spotify Playlist</h2>
              <p className="text-xs text-text/40">Stream playlist directly without downloading</p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isImporting}
            className="p-1.5 text-text/40 hover:text-white rounded-lg hover:bg-white/5 transition-all"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleImport} className="space-y-4 relative z-10">
          <div>
            <label className="block text-xs font-semibold text-text/60 mb-1.5">
              Spotify Playlist Link
            </label>
            <input
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://open.spotify.com/playlist/..."
              disabled={isImporting}
              className="w-full px-3.5 py-2.5 bg-black/40 border border-white/10 rounded-xl text-xs text-white placeholder:text-text/30 focus:outline-none focus:ring-1 focus:ring-sky-500/50 transition-all"
              autoFocus
            />
          </div>

          <div className="p-3 bg-white/[0.03] border border-white/5 rounded-xl text-[11px] text-text/50 leading-relaxed flex items-start gap-2">
            <Sparkles size={14} className="text-sky-400 shrink-0 mt-0.5" />
            <span>
              All tracks will be converted into online streaming tracks. You can listen immediately without using disk space!
            </span>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isImporting}
              className="px-4 py-2 text-xs font-semibold text-text/50 hover:text-white hover:bg-white/5 rounded-xl transition-all"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isImporting || !url.trim()}
              className="flex items-center gap-2 px-5 py-2.5 bg-sky-500 hover:bg-sky-400 disabled:opacity-50 text-black text-xs font-extrabold rounded-xl transition-all shadow-lg shadow-sky-500/20"
            >
              {isImporting ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  Importing...
                </>
              ) : (
                <>
                  <Plus size={14} />
                  Import Playlist
                </>
              )}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}
