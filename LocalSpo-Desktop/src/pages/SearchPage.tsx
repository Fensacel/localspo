import { useState } from 'react';
import { useLibraryStore, usePlayerStore, useToastStore } from '@/stores';
import { useSpotifyStore } from '@/modules/downloader/stores/useSpotifyStore';
import { useDownloaderStore } from '@/modules/downloader/stores/useDownloaderStore';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search as SearchIcon,
  Music,
  Disc3,
  Mic2,
  Play,
  Download,
  ExternalLink,
  Radio,
  Loader2,
  HardDrive,
  ListPlus,
} from 'lucide-react';

import { formatTime, getImageUrl } from '@/utils';
import { useNavigate } from 'react-router-dom';
import { createStreamSong } from '@/types/music';
import type { SpotifySearchTrack } from '@/modules/downloader/types';
import { SongContextMenu } from '@/components/SongContextMenu';
import type { Song } from '@/types';

export function SearchPage() {
  const { searchQuery, searchResults, isSearching } = useSpotifyStore();
  const { songs: localSongs, albums: localAlbums, artists: localArtists } = useLibraryStore();
  const { setQueue, currentSong } = usePlayerStore();
  const { downloadUrl } = useDownloaderStore();
  const { showToast } = useToastStore();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState<'all' | 'online' | 'local'>('all');
  const [contextMenu, setContextMenu] = useState<{ song: Song; x: number; y: number } | null>(null);

  const q = searchQuery.toLowerCase().trim();

  // Local filtering
  const matchingLocalSongs = q
    ? localSongs.filter(
        (s) =>
          s.title.toLowerCase().includes(q) ||
          s.artist.toLowerCase().includes(q) ||
          s.album.toLowerCase().includes(q) ||
          s.genre.toLowerCase().includes(q),
      ).slice(0, 20)
    : [];

  const matchingLocalAlbums = q
    ? localAlbums.filter((a) => a.name.toLowerCase().includes(q) || a.artist.toLowerCase().includes(q)).slice(0, 8)
    : [];

  const matchingLocalArtists = q
    ? localArtists.filter((a) => a.name.toLowerCase().includes(q)).slice(0, 6)
    : [];

  const onlineTracks = searchResults?.tracks || [];
  const onlineAlbums = searchResults?.albums || [];
  const onlineArtists = searchResults?.artists || [];

  const handlePlayStream = (track: SpotifySearchTrack) => {
    if (!track.ytVideoId) {
      showToast('No streaming ID available for this track', 'error');
      return;
    }

    const allStreamSongs = onlineTracks
      .filter((t) => t.ytVideoId)
      .map((t) => {
        const s = createStreamSong({
          id: `stream_${t.ytVideoId}`,
          title: t.title,
          artist: t.artist,
          album: t.album,
          duration: t.durationMs ? t.durationMs / 1000 : 0,
          coverUrl: t.coverUrl || undefined,
          ytVideoId: t.ytVideoId!,
        });

        useLibraryStore.getState().addStreamSong(s);
        return s;
      });

    const idx = allStreamSongs.findIndex((s) => s.ytVideoId === track.ytVideoId);
    setQueue(allStreamSongs, idx >= 0 ? idx : 0, 'Online Search Streaming');
    usePlayerStore.getState().setIsPlaying(true);
    window.dispatchEvent(new CustomEvent('player:play'));
    showToast(`Streaming: ${track.artist} — ${track.title}`, 'info');
  };


  const handleAddToQueueStream = (track: SpotifySearchTrack) => {
    if (!track.ytVideoId) return;
    const streamSong = createStreamSong({
      id: `stream_${track.ytVideoId}`,
      title: track.title,
      artist: track.artist,
      album: track.album,
      duration: track.durationMs ? track.durationMs / 1000 : 0,
      coverUrl: track.coverUrl || undefined,
      ytVideoId: track.ytVideoId,
    });
    useLibraryStore.getState().addStreamSong(streamSong);
    usePlayerStore.getState().addToQueue(streamSong);
    showToast(`Added "${track.title}" to queue`, 'info');
  };

  const handleDownload = async (url: string, title: string) => {

    const ok = await downloadUrl(url);
    if (ok) showToast(`Added to download queue: ${title}`, 'success');
  };

  const hasAnyResults =
    matchingLocalSongs.length > 0 ||
    matchingLocalAlbums.length > 0 ||
    matchingLocalArtists.length > 0 ||
    onlineTracks.length > 0 ||
    onlineAlbums.length > 0 ||
    onlineArtists.length > 0;

  return (
    <div className="space-y-6 pb-12">
      {/* Category Filter Chips */}
      {searchQuery.trim() && (
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab('all')}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
              activeTab === 'all'
                ? 'bg-white/10 border-white/20 text-white'
                : 'border-transparent text-text/40 hover:text-text/70 hover:bg-white/5'
            }`}
          >
            All Results
          </button>
          <button
            onClick={() => setActiveTab('online')}
            className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
              activeTab === 'online'
                ? 'bg-sky-500/20 border-sky-500/30 text-sky-400'
                : 'border-transparent text-text/40 hover:text-text/70 hover:bg-white/5'
            }`}
          >
            <Radio size={12} />
            Online Stream ({onlineTracks.length})
          </button>
          <button
            onClick={() => setActiveTab('local')}
            className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
              activeTab === 'local'
                ? 'bg-emerald-500/20 border-emerald-500/30 text-emerald-400'
                : 'border-transparent text-text/40 hover:text-text/70 hover:bg-white/5'
            }`}
          >
            <HardDrive size={12} />
            Local Library ({matchingLocalSongs.length})
          </button>
        </div>
      )}

      {/* Main Content Area */}
      <AnimatePresence mode="wait">
        {/* Empty state when no query */}
        {!searchQuery.trim() && (
          <motion.div
            key="idle"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col items-center justify-center h-[50vh] gap-3"
          >
            <div className="w-16 h-16 rounded-2xl bg-white/5 border border-white/5 flex items-center justify-center">
              <SearchIcon size={28} className="text-text/25" />
            </div>
            <h2 className="text-base font-bold text-white">Search Everything</h2>
            <p className="text-xs text-text/35 text-center max-w-sm leading-relaxed">
              Type in the top bar to search songs, albums, and artists across both your{' '}
              <span className="text-emerald-400 font-semibold">Local Library</span> and{' '}
              <span className="text-sky-400 font-semibold">Music Streaming</span>.
            </p>
          </motion.div>
        )}

        {/* Searching loader */}
        {isSearching && searchQuery.trim() && (
          <motion.div
            key="searching"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex items-center justify-center h-32 gap-3 text-text/40 text-sm"
          >
            <Loader2 size={20} className="animate-spin text-primary" />
            Searching online...
          </motion.div>
        )}

        {/* No results */}
        {!isSearching && searchQuery.trim() && !hasAnyResults && (
          <motion.div
            key="no-results"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col items-center justify-center h-[40vh] gap-2"
          >
            <Music size={40} className="text-text/15" />
            <p className="text-sm font-semibold text-text/40">No matches found for "{searchQuery}"</p>
          </motion.div>
        )}

        {/* Results grid */}
        {!isSearching && searchQuery.trim() && hasAnyResults && (
          <motion.div
            key="results"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-8"
          >
            {/* ── 1. Online Streaming Songs (YouTube Music) ─────────────── */}
            {(activeTab === 'all' || activeTab === 'online') && onlineTracks.length > 0 && (
              <section className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-sky-400 uppercase tracking-wider flex items-center gap-2">
                    <Radio size={14} /> Instant Streaming Matches
                  </h3>
                  <span className="text-xs text-text/35">Click ▶ to stream instantly</span>
                </div>

                <div className="space-y-1">
                  {onlineTracks.map((track, i) => (
                    <motion.div
                      key={track.id}
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.02 }}
                      onContextMenu={(e) => {
                        e.preventDefault();
                        if (track.ytVideoId) {
                          const streamSong = createStreamSong({
                            id: `stream_${track.ytVideoId}`,
                            title: track.title,
                            artist: track.artist,
                            album: track.album || 'Single',
                            duration: track.durationMs ? track.durationMs / 1000 : 180,
                            coverUrl: track.coverUrl || `https://i.ytimg.com/vi/${track.ytVideoId}/hqdefault.jpg`,
                            ytVideoId: track.ytVideoId,
                          });
                          setContextMenu({ song: streamSong, x: e.clientX, y: e.clientY });
                        }
                      }}
                      className="group flex items-center gap-4 px-4 py-3 bg-[#181818] hover:bg-[#222226] rounded-xl transition-all cursor-default"
                    >
                      {/* Artwork */}
                      <div className="w-12 h-12 rounded-lg bg-white/5 overflow-hidden shrink-0 relative">
                        {track.coverUrl ? (
                          <img
                            src={track.coverUrl}
                            alt=""
                            referrerPolicy="no-referrer"
                            onError={(e) => {
                              if (track.ytVideoId) {
                                (e.target as HTMLImageElement).src = `https://i.ytimg.com/vi/${track.ytVideoId}/mqdefault.jpg`;
                              }
                            }}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <Music size={16} className="text-white/20" />
                          </div>
                        )}

                        {track.ytVideoId && (
                          <button
                            onClick={() => handlePlayStream(track)}
                            className="absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity rounded-lg"
                            title="Stream now"
                          >
                            <Play size={18} className="text-primary fill-primary" />
                          </button>
                        )}
                      </div>

                      {/* Song Details */}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-white truncate">{track.title}</p>
                        <p className="text-xs text-text/50 truncate mt-0.5">{track.artist} {track.album ? `• ${track.album}` : ''}</p>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-2 shrink-0">


                        {track.ytVideoId && (
                          <>
                            <button
                              onClick={() => handlePlayStream(track)}
                              className="flex items-center gap-1 px-3 py-1.5 bg-primary/15 hover:bg-primary/25 text-primary text-xs font-bold rounded-lg transition-colors"
                            >
                              <Play size={11} className="fill-primary" />
                              Play
                            </button>
                            <button
                              onClick={() => handleAddToQueueStream(track)}
                              title="Add to queue"
                              className="p-1.5 text-text/40 hover:text-sky-400 transition-colors"
                            >
                              <ListPlus size={16} />
                            </button>
                          </>
                        )}


                        <button
                          onClick={() => handleDownload(track.spotifyUrl, track.title)}
                          title="Download for offline"
                          className="p-1.5 text-text/40 hover:text-white transition-colors"
                        >
                          <Download size={16} />
                        </button>

                        <a
                          href={track.spotifyUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-1.5 text-text/25 hover:text-text/60 transition-colors"
                          title="Open link"
                        >
                          <ExternalLink size={13} />
                        </a>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </section>
            )}

            {/* ── 2. Local Library Songs ───────────────────────────────── */}
            {(activeTab === 'all' || activeTab === 'local') && matchingLocalSongs.length > 0 && (
              <section className="space-y-3">
                <h3 className="text-sm font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-2">
                  <HardDrive size={14} /> Local Library Songs
                </h3>

                <div className="space-y-1">
                  {matchingLocalSongs.map((song) => {
                    const isCurrent = currentSong?.id === song.id;
                    const coverSrc = song.coverPath ? getImageUrl(song.coverPath) : null;

                    return (
                      <motion.div
                        key={song.id}
                        whileTap={{ scale: 0.995 }}
                        onClick={() => {
                          const idx = matchingLocalSongs.findIndex((s) => s.id === song.id);
                          setQueue(matchingLocalSongs, idx >= 0 ? idx : 0, 'Local Search');
                        }}
                        onContextMenu={(e) => {
                          e.preventDefault();
                          setContextMenu({ song, x: e.clientX, y: e.clientY });
                        }}
                        className={`group flex items-center gap-3 px-4 py-2.5 rounded-xl cursor-pointer transition-colors ${
                          isCurrent ? 'bg-primary/10 border border-primary/20' : 'bg-white/[0.02] hover:bg-white/[0.05]'
                        }`}
                      >
                        <div className="w-10 h-10 rounded-lg bg-white/5 overflow-hidden shrink-0 flex items-center justify-center">
                          {coverSrc ? (
                            <img src={coverSrc} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <Music size={16} className="text-text/25" />
                          )}
                        </div>

                        <div className="min-w-0 flex-1">
                          <p className={`text-sm font-semibold truncate ${isCurrent ? 'text-primary' : 'text-white'}`}>
                            {song.title}
                          </p>
                          <p className="text-xs text-text/40 truncate">{song.artist} • {song.album}</p>
                        </div>

                        <span className="text-[10px] font-semibold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20 shrink-0">
                          💾 Offline
                        </span>

                        <span className="text-xs text-text/30 font-mono tabular-nums shrink-0">
                          {formatTime(song.duration)}
                        </span>
                      </motion.div>
                    );
                  })}
                </div>
              </section>
            )}

            {/* ── 3. Local Albums ──────────────────────────────────────── */}
            {(activeTab === 'all' || activeTab === 'local') && matchingLocalAlbums.length > 0 && (
              <section className="space-y-3">
                <h3 className="text-sm font-bold text-text/50 uppercase tracking-wider flex items-center gap-2">
                  <Disc3 size={14} /> Local Albums
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                  {matchingLocalAlbums.map((album) => {
                    const coverSrc = album.coverPath ? getImageUrl(album.coverPath) : '/default-cover.png';
                    return (
                      <motion.div
                        key={album.id}
                        whileHover={{ scale: 1.03 }}
                        onClick={() => navigate(`/albums/${album.id}`)}
                        className="group cursor-pointer bg-white/[0.02] hover:bg-white/[0.06] p-3 rounded-2xl border border-white/5 transition-all"
                      >
                        <div className="rounded-xl overflow-hidden aspect-square mb-2 bg-white/5">
                          <img src={coverSrc} alt={album.name} className="w-full h-full object-cover" />
                        </div>
                        <p className="text-xs font-bold text-white truncate">{album.name}</p>
                        <p className="text-[11px] text-text/40 truncate mt-0.5">{album.artist}</p>
                      </motion.div>
                    );
                  })}
                </div>
              </section>
            )}

            {/* ── 4. Local Artists ─────────────────────────────────────── */}
            {(activeTab === 'all' || activeTab === 'local') && matchingLocalArtists.length > 0 && (
              <section className="space-y-3">
                <h3 className="text-sm font-bold text-text/50 uppercase tracking-wider flex items-center gap-2">
                  <Mic2 size={14} /> Local Artists
                </h3>
                <div className="flex gap-4 overflow-x-auto pb-2">
                  {matchingLocalArtists.map((artist) => (
                    <motion.div
                      key={artist.id}
                      whileHover={{ scale: 1.05 }}
                      onClick={() => navigate(`/artists/${artist.id}`)}
                      className="flex flex-col items-center gap-2 cursor-pointer shrink-0 group"
                    >
                      <div className="w-20 h-20 rounded-full bg-white/5 border border-white/10 flex items-center justify-center overflow-hidden">
                        {artist.coverPath ? (
                          <img src={getImageUrl(artist.coverPath)} alt={artist.name} className="w-full h-full object-cover" />
                        ) : (
                          <Mic2 size={24} className="text-text/25" />
                        )}
                      </div>
                      <p className="text-xs font-bold text-white text-center w-20 truncate group-hover:text-primary transition-colors">
                        {artist.name}
                      </p>
                    </motion.div>
                  ))}
                </div>
              </section>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {contextMenu && (
        <SongContextMenu
          song={contextMenu.song}
          x={contextMenu.x}
          y={contextMenu.y}
          onClose={() => setContextMenu(null)}
        />
      )}
    </div>
  );
}
