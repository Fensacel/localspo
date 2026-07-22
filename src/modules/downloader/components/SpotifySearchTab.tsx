import { useState, useRef, FormEvent } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search,
  Download,
  Music,
  Disc3,
  Mic2,
  ListMusic,
  ExternalLink,
  Loader2,
  Play,
  Radio,
} from 'lucide-react';
import { useSpotifyStore } from '../stores/useSpotifyStore';
import { useDownloaderStore } from '../stores/useDownloaderStore';
import { useToastStore } from '@/stores/useToastStore';
import { usePlayerStore } from '@/stores/usePlayerStore';
import { useLibraryStore } from '@/stores/useLibraryStore';
import type { SpotifySearchType, SpotifySearchTrack } from '../types';
import { createStreamSong } from '@/types/music';

const TYPES: { id: SpotifySearchType; label: string; icon: React.ElementType }[] = [
  { id: 'track', label: 'Songs', icon: Music },
  { id: 'album', label: 'Albums', icon: Disc3 },
  { id: 'artist', label: 'Artists', icon: Mic2 },
  { id: 'playlist', label: 'Playlists', icon: ListMusic },
];

function formatDuration(ms: number): string {
  if (!ms) return '';
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${sec.toString().padStart(2, '0')}`;
}

export function SpotifySearchTab() {
  const {
    searchQuery,
    searchType,
    searchResults,
    isSearching,
    setSearchQuery,
    setSearchType,
    search,
    clearSearch,
  } = useSpotifyStore();
  const { downloadUrl } = useDownloaderStore();
  const { showToast } = useToastStore();
  const { setQueue } = usePlayerStore();
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) search();
  };

  const handleDownload = async (url: string, name: string) => {
    const ok = await downloadUrl(url);
    if (ok) showToast(`Queued: ${name}`, 'success');
  };

  const handlePlay = (track: SpotifySearchTrack) => {
    const trackId = track.ytVideoId || track.id;
    if (!trackId) return;
    const streamSong = createStreamSong({
      id: `stream_${trackId}`,
      title: track.title,
      artist: track.artist,
      album: track.album || 'Single',
      duration: track.durationMs ? track.durationMs / 1000 : 180,
      coverUrl: track.coverUrl || undefined,
      ytVideoId: track.ytVideoId || '',
    });
    useLibraryStore.getState().addStreamSong(streamSong);
    setQueue([streamSong], 0, 'Search Results');
    usePlayerStore.getState().setIsPlaying(true);
    window.dispatchEvent(new CustomEvent('player:play'));
    showToast(`Streaming: ${track.artist} — ${track.title}`, 'info');
  };

  const currentResults = searchResults
    ? searchType === 'track'
      ? searchResults.tracks
      : searchType === 'album'
        ? searchResults.albums
        : searchType === 'artist'
          ? searchResults.artists
          : searchResults.playlists
    : [];

  const totalCount = currentResults.length;

  return (
    <div className="space-y-4">
      {/* ── Search Bar ─────────────────────────────────────────────── */}
      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          ref={inputRef}
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search songs, albums, artists, playlists..."
          className="flex-1 px-4 py-3 bg-[#1a1a1a] border border-white/8 rounded-xl text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-primary/50 transition-colors"
        />
        <button
          type="submit"
          disabled={isSearching || !searchQuery.trim()}
          className="flex items-center gap-2 px-5 py-3 bg-primary rounded-xl text-sm font-bold text-zinc-950 hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-glow"
        >
          {isSearching ? (
            <Loader2 size={16} className="animate-spin" />
          ) : (
            <Search size={16} />
          )}
          Search
        </button>
        {searchResults && (
          <button
            type="button"
            onClick={clearSearch}
            className="px-3 py-3 text-xs text-white/40 hover:text-white/70 transition-colors"
          >
            Clear
          </button>
        )}
      </form>

      {/* ── Type Filter Pills ──────────────────────────────────────── */}
      <div className="flex items-center gap-2">
        {TYPES.map((t) => {
          const Icon = t.icon;
          const isActive = searchType === t.id;
          return (
            <button
              key={t.id}
              onClick={() => {
                setSearchType(t.id);
                if (searchQuery.trim()) search(searchQuery, t.id);
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                isActive
                  ? 'bg-white/10 border-white/20 text-white'
                  : 'border-transparent text-white/40 hover:text-white/70 hover:bg-white/5'
              }`}
            >
              <Icon size={12} />
              {t.label}
            </button>
          );
        })}

        {/* Streaming hint for tracks */}
        {searchType === 'track' && searchResults && (
          <span className="ml-auto flex items-center gap-1.5 text-xs text-white/25">
            <Radio size={11} />
            Click <Play size={9} className="inline" /> to stream instantly
          </span>
        )}
      </div>

      {/* ── Results Area ───────────────────────────────────────────── */}
      <AnimatePresence mode="wait">
        {/* Loading */}
        {isSearching && (
          <motion.div
            key="loading"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-col items-center justify-center h-48 gap-3"
          >
            <Loader2 size={28} className="text-primary animate-spin" />
            <p className="text-sm text-white/40">Searching...</p>
          </motion.div>
        )}

        {/* No results */}
        {!isSearching && searchResults && currentResults.length === 0 && (
          <motion.div
            key="empty"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col items-center justify-center h-40 gap-2"
          >
            <Search size={28} className="text-white/15" />
            <p className="text-sm text-white/40">No results found for "{searchQuery}"</p>
          </motion.div>
        )}

        {/* Results list */}
        {!isSearching && currentResults.length > 0 && (
          <motion.div
            key="results"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            {/* Header */}
            <div className="mb-4">
              <h2 className="text-lg font-bold text-white">Search results</h2>
              <p className="text-sm text-white/50 mt-0.5">
                Showing matches for{' '}
                <span className="font-semibold text-white/80">"{searchQuery}"</span>
                {' '}— {totalCount} {searchType === 'track' ? 'songs' : searchType + 's'}
              </p>
            </div>

            {/* Track rows */}
            {searchType === 'track' && (
              <div className="space-y-1">
                {searchResults?.tracks.map((track, i) => (
                  <TrackRow
                    key={track.id}
                    index={i}
                    cover={track.coverUrl}
                    title={track.title}
                    artist={track.artist}
                    album={track.album}
                    duration={formatDuration(track.durationMs)}
                    spotifyUrl={track.spotifyUrl}
                    canStream={true}
                    onPlay={() => handlePlay(track)}
                    onDownload={() => handleDownload(track.spotifyUrl, track.title)}
                  />
                ))}
              </div>
            )}

            {/* Album rows */}
            {searchType === 'album' && (
              <div className="space-y-1">
                {searchResults?.albums.map((album, i) => (
                  <TrackRow
                    key={album.id}
                    index={i}
                    cover={album.coverUrl}
                    title={album.name}
                    artist={album.artist}
                    album={`${album.trackCount} tracks · ${album.releaseDate?.slice(0, 4) ?? ''}`}
                    spotifyUrl={album.spotifyUrl}
                    onDownload={() => handleDownload(album.spotifyUrl, album.name)}
                  />
                ))}
              </div>
            )}

            {/* Artist rows */}
            {searchType === 'artist' && (
              <div className="space-y-1">
                {searchResults?.artists.map((artist, i) => (
                  <TrackRow
                    key={artist.id}
                    index={i}
                    cover={artist.coverUrl}
                    coverRound
                    title={artist.name}
                    artist={artist.genres?.slice(0, 2).join(', ') || 'Artist'}
                    album=""
                    spotifyUrl={artist.spotifyUrl}
                    onDownload={undefined}
                  />
                ))}
              </div>
            )}

            {/* Playlist rows */}
            {searchType === 'playlist' && (
              <div className="space-y-1">
                {searchResults?.playlists.map((playlist, i) => (
                  <TrackRow
                    key={playlist.id}
                    index={i}
                    cover={playlist.coverUrl}
                    title={playlist.name}
                    artist={`by ${playlist.owner}`}
                    album={`${playlist.trackCount} tracks`}
                    spotifyUrl={playlist.spotifyUrl}
                    onDownload={() => handleDownload(playlist.spotifyUrl, playlist.name)}
                    downloadLabel="Download"
                  />
                ))}
              </div>
            )}
          </motion.div>
        )}

        {/* Idle state */}
        {!isSearching && !searchResults && (
          <motion.div
            key="idle"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col items-center justify-center h-64 gap-3"
          >
            <div className="w-16 h-16 rounded-2xl bg-white/5 border border-white/5 flex items-center justify-center">
              <Search size={24} className="text-white/25" />
            </div>
            <p className="text-sm font-semibold text-white/40">Search YouTube Music</p>
            <p className="text-xs text-white/25 text-center max-w-xs leading-relaxed">
              Find songs, albums, artists, or playlists.
              <br />
              <span className="text-primary/60">Click ▶ to stream instantly</span>, or{' '}
              <span className="text-white/40">⬇ to download.</span>
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── TrackRow — result card with Play + Download ───────────────────────────────

interface TrackRowProps {
  index: number;
  cover: string | null | undefined;
  coverRound?: boolean;
  title: string;
  artist: string;
  album: string;
  duration?: string;
  spotifyUrl: string;
  canStream?: boolean;
  onPlay?: () => void;
  onDownload?: () => void;
  downloadLabel?: string;
}

function TrackRow({
  index,
  cover,
  coverRound,
  title,
  artist,
  album,
  duration,
  spotifyUrl,
  canStream,
  onPlay,
  onDownload,
  downloadLabel,
}: TrackRowProps) {
  const [hasError, setHasError] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index * 0.03, 0.4) }}
      onClick={() => {
        if (canStream && onPlay) onPlay();
      }}
      className={`flex items-center gap-4 px-4 py-3 bg-[#181818] hover:bg-[#232323] rounded-lg group transition-colors ${canStream && onPlay ? 'cursor-pointer' : 'cursor-default'}`}
    >
      {/* Album art */}
      <div
        className={`w-14 h-14 shrink-0 bg-white/5 overflow-hidden relative ${coverRound ? 'rounded-full' : 'rounded-md'}`}
      >
        {cover && !hasError ? (
          <img
            src={cover}
            alt=""
            referrerPolicy="no-referrer"
            onError={() => setHasError(true)}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Music size={18} className="text-white/20" />
          </div>
        )}

        {/* Play overlay on hover (streaming songs only) */}
        {canStream && onPlay && (
          <button
            onClick={(e) => { e.stopPropagation(); onPlay(); }}
            className="absolute inset-0 flex items-center justify-center bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity rounded-md"
            title="Stream this song"
          >
            <Play size={20} className="text-primary fill-primary drop-shadow-lg" />
          </button>
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-white leading-tight truncate">{title}</p>
        <p className="text-xs text-white/55 mt-0.5 truncate">{artist}</p>
        {album && <p className="text-xs text-white/35 truncate">{album}</p>}
      </div>

      {/* Duration */}
      {duration && (
        <span className="text-xs text-white/30 shrink-0 font-mono">{duration}</span>
      )}

      {/* Actions */}
      <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
        {/* Stream button (track only) */}
        {canStream && onPlay && (
          <button
            onClick={(e) => { e.stopPropagation(); onPlay(); }}
            title="Stream now"
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-primary/15 hover:bg-primary/25 text-primary text-xs font-semibold transition-colors"
          >
            <Play size={11} className="fill-primary" />
            Play
          </button>
        )}

        {/* Open externally */}
        <a
          href={spotifyUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-white/30 hover:text-white/70 transition-colors p-1.5"
          title="Open link"
          onClick={(e) => e.stopPropagation()}
        >
          <ExternalLink size={14} />
        </a>

        {/* Download */}
        {onDownload && (
          <button
            onClick={onDownload}
            title={downloadLabel || 'Download'}
            className="text-white/40 hover:text-white transition-colors p-1.5"
          >
            <Download size={16} />
          </button>
        )}
      </div>
    </motion.div>
  );
}
