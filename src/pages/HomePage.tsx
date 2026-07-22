import { useState, useEffect } from 'react';
import { useLibraryStore, usePlayerStore, usePlaylistStore } from '@/stores';
import { Play, Music, ListMusic, ListPlus, Radio, Heart, Sparkles, RefreshCw, Plus, Clock } from 'lucide-react';
import { SongContextMenu } from '@/components/SongContextMenu';
import { ImportPlaylistModal } from '@/components/ImportPlaylistModal';
import type { Song } from '@/types';

import { useNavigate } from 'react-router-dom';
import { getImageUrl } from '@/utils';
import { createStreamSong } from '@/types/music';

interface FeaturedTrack {
  ytVideoId: string;
  title: string;
  artist: string;
  album: string;
  coverUrl: string;
}

export function HomePage() {
  const { songs } = useLibraryStore();
  const { playlists } = usePlaylistStore();
  const { setQueue } = usePlayerStore();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState<'all' | 'music' | 'stream' | 'local'>('all');
  const [featuredTracks, setFeaturedTracks] = useState<FeaturedTrack[]>([]);
  const [isLoadingFeatured, setIsLoadingFeatured] = useState(false);
  const [contextMenu, setContextMenu] = useState<{ song: Song; x: number; y: number } | null>(null);
  const [showImportModal, setShowImportModal] = useState(false);

  // Load live online streaming tracks from YouTube Music based on actual user search history
  useEffect(() => {
    let cancelled = false;

    const fetchFeatured = async () => {
      setIsLoadingFeatured(true);
      try {
        let searchQuery = 'Trending Hits';
        try {
          const raw = localStorage.getItem('localspo_user_searches');
          if (raw) {
            const userSearches: string[] = JSON.parse(raw);
            if (Array.isArray(userSearches) && userSearches.length > 0) {
              searchQuery = userSearches[Math.floor(Math.random() * userSearches.length)];
            }
          }
        } catch {}

        const res = await window.electronAPI.spotify.search(searchQuery, ['track']);
        if (cancelled) return;

        if (res && Array.isArray(res.tracks) && res.tracks.length > 0) {
          const validTracks: FeaturedTrack[] = res.tracks
            .filter((t: any) => t.ytVideoId)
            .map((t: any) => ({
              ytVideoId: t.ytVideoId,
              title: t.title,
              artist: t.artist,
              album: t.album || 'Single',
              coverUrl: t.coverUrl || `https://i.ytimg.com/vi/${t.ytVideoId}/hqdefault.jpg`,
            }));
          setFeaturedTracks(validTracks.slice(0, 16));
        }
      } catch (err) {
        console.error('Failed to load online streaming tracks:', err);
      } finally {
        if (!cancelled) setIsLoadingFeatured(false);
      }
    };

    fetchFeatured();
    return () => {
      cancelled = true;
    };
  }, []);

  const handlePlayStreamTrack = (track: FeaturedTrack) => {
    if (!track.ytVideoId) return;

    const allStreamSongs = featuredTracks.map((t) => {
      const s = createStreamSong({
        id: `stream_${t.ytVideoId}`,
        title: t.title,
        artist: t.artist,
        album: t.album,
        duration: 180,
        coverUrl: t.coverUrl,
        ytVideoId: t.ytVideoId,
      });
      useLibraryStore.getState().addStreamSong(s);
      return s;
    });

    const index = featuredTracks.findIndex((t) => t.ytVideoId === track.ytVideoId);
    setQueue(allStreamSongs, index >= 0 ? index : 0, 'Featured Streaming');
    usePlayerStore.getState().setIsPlaying(true);
    window.dispatchEvent(new CustomEvent('player:play'));
  };

  const handleAddToQueueStreamTrack = (track: FeaturedTrack, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!track.ytVideoId) return;
    const streamSong = createStreamSong({
      id: `stream_${track.ytVideoId}`,
      title: track.title,
      artist: track.artist,
      album: track.album,
      duration: 180,
      coverUrl: track.coverUrl,
      ytVideoId: track.ytVideoId,
    });
    useLibraryStore.getState().addStreamSong(streamSong);
    usePlayerStore.getState().addToQueue(streamSong);
  };

  // Top 8 Grid Items for Spotify Header
  const topGridItems: Array<{
    title: string;
    subtitle: string;
    cover: string | null;
    icon: any;
    bg: string;
    noPlay?: boolean;
    action: () => void;
  }> = [
    {
      title: 'Liked Songs',
      subtitle: 'Playlist',
      cover: null,
      icon: Heart,
      bg: 'from-purple-700 to-indigo-900',
      action: () => navigate('/favorites'),
    },
    {
      title: 'Local Files',
      subtitle: `Folder • ${songs.length} tracks`,
      cover: null,
      icon: ListMusic,
      bg: 'from-emerald-700 to-teal-900',
      action: () => navigate('/songs'),
    },
    {
      title: 'Recently Played',
      subtitle: 'Listening History',
      cover: null,
      icon: Clock,
      bg: 'from-blue-600 to-indigo-900',
      action: () => navigate('/history'),
    },
    {
      title: 'Import Playlist',
      subtitle: 'From Spotify',
      cover: null,
      icon: Plus,
      bg: 'from-sky-500 to-indigo-600',
      noPlay: true,
      action: () => setShowImportModal(true),
    },
    ...playlists.map((p) => ({
      title: p.name,
      subtitle: `Playlist • ${p.songIds.length} tracks`,
      cover: p.coverPath ? getImageUrl(p.coverPath) : null,
      icon: ListMusic,
      bg: 'bg-[#282828]',
      action: () => navigate(`/playlists/${p.id}`),
    })),
  ].slice(0, 8);


  return (
    <div className="space-y-8 pb-10 select-none">
      {/* Top Filter Chips */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab('all')}
            className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all ${
              activeTab === 'all' ? 'bg-white text-black' : 'bg-white/10 text-white hover:bg-white/15'
            }`}
          >
            All
          </button>
          <button
            onClick={() => setActiveTab('music')}
            className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all ${
              activeTab === 'music' ? 'bg-white text-black' : 'bg-white/10 text-white hover:bg-white/15'
            }`}
          >
            Music
          </button>
          <button
            onClick={() => setActiveTab('stream')}
            className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all flex items-center gap-1.5 ${
              activeTab === 'stream' ? 'bg-sky-400 text-black font-extrabold' : 'bg-sky-500/15 text-sky-400 hover:bg-sky-500/25'
            }`}
          >
            <Radio size={13} /> Online Streaming
          </button>
          <button
            onClick={() => setActiveTab('local')}
            className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all ${
              activeTab === 'local' ? 'bg-white text-black' : 'bg-white/10 text-white hover:bg-white/15'
            }`}
          >
            Local Files ({songs.length})
          </button>
        </div>

        <button
          onClick={() => setShowImportModal(true)}
          className="flex items-center gap-1.5 px-3.5 py-1.5 bg-sky-500/15 hover:bg-sky-500/25 border border-sky-500/30 rounded-full text-xs font-extrabold text-sky-400 transition-all shadow-sm"
        >
          <Plus size={14} />
          Import Spotify Playlist
        </button>
      </div>

      {/* ── Spotify Desktop 8-Grid Cards (Top Row) ────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {topGridItems.map((item, idx) => (
          <div
            key={idx}
            onClick={item.action}
            className="group relative flex items-center gap-3 bg-[#1e1e22]/70 hover:bg-[#2a2a30] transition-all rounded-lg overflow-hidden cursor-pointer p-0 h-14 pr-3 border border-white/5 shadow-sm"
          >
            <div className={`w-14 h-14 shrink-0 flex items-center justify-center overflow-hidden bg-gradient-to-br ${item.bg}`}>
              {item.cover ? (
                <img
                  src={item.cover}
                  alt=""
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover"
                />
              ) : (
                <item.icon size={22} className="text-white fill-white/20" />
              )}
            </div>
            <span className="text-xs font-bold text-white truncate flex-1 leading-tight">
              {item.title}
            </span>
            {!item.noPlay && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  item.action();
                }}
                className="w-9 h-9 rounded-full bg-primary text-black flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all shadow-lg hover:scale-105 shrink-0"
              >
                <Play size={16} className="fill-black ml-0.5" />
              </button>
            )}
          </div>
        ))}
      </div>

      {/* ── Section 1: Quick Picks (YouTube Music Style Grid) ─────────────── */}
      {(activeTab === 'all' || activeTab === 'stream' || activeTab === 'music') && (
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-extrabold text-white tracking-tight flex items-center gap-2">
                <Sparkles size={20} className="text-sky-400" />
                Quick Picks
              </h2>
              <p className="text-xs text-text/40 mt-0.5">Start radio with any online stream track</p>
            </div>
            <button
              onClick={() => navigate('/search')}
              className="text-xs font-bold text-text/50 hover:text-white transition-colors uppercase tracking-wider"
            >
              Show all
            </button>
          </div>

          {isLoadingFeatured && featuredTracks.length === 0 ? (
            <div className="flex items-center justify-center h-32 text-text/40 text-xs gap-2">
              <RefreshCw size={16} className="animate-spin text-sky-400" />
              Loading Quick Picks...
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-x-4 gap-y-3">
              {featuredTracks.slice(0, 12).map((track) => (
                <div
                  key={track.ytVideoId}
                  onClick={() => handlePlayStreamTrack(track)}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    const streamSong = createStreamSong({
                      id: `stream_${track.ytVideoId}`,
                      title: track.title,
                      artist: track.artist,
                      album: track.album,
                      duration: 180,
                      coverUrl: track.coverUrl,
                      ytVideoId: track.ytVideoId,
                    });
                    setContextMenu({ song: streamSong, x: e.clientX, y: e.clientY });
                  }}
                  className="group flex items-center gap-3.5 p-2.5 bg-[#18181c] hover:bg-[#24242a] border border-white/5 hover:border-white/10 rounded-xl transition-all duration-200 cursor-pointer shadow-sm"
                >
                  {/* Compact Square Thumbnail */}
                  <div className="relative w-12 h-12 rounded-lg overflow-hidden shrink-0 bg-white/5 shadow-sm">
                    <img
                      src={track.coverUrl}
                      alt=""
                      referrerPolicy="no-referrer"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = `https://i.ytimg.com/vi/${track.ytVideoId}/hqdefault.jpg`;
                      }}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handlePlayStreamTrack(track);
                      }}
                      className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-white"
                    >
                      <Play size={16} className="fill-white ml-0.5" />
                    </button>
                  </div>

                  {/* Title & Artist/Album Subtitle */}
                  <div className="min-w-0 flex-1">
                    <h3 className="text-xs font-bold text-white group-hover:text-primary transition-colors truncate leading-snug">
                      {track.title}
                    </h3>
                    <p className="text-[11px] text-text/45 truncate mt-0.5">
                      {track.artist} {track.album ? `• ${track.album}` : ''}
                    </p>
                  </div>

                  {/* Add to Queue Button */}
                  <div className="shrink-0 flex items-center">
                    <button
                      onClick={(e) => handleAddToQueueStreamTrack(track, e)}
                      title="Add to queue"
                      className="p-1 rounded-lg text-text/40 hover:text-sky-400 hover:bg-white/5 transition-all opacity-0 group-hover:opacity-100"
                    >
                      <ListPlus size={15} />
                    </button>
                  </div>


                </div>
              ))}
            </div>
          )}
        </section>
      )}




      {/* ── Section 3: Your Local Library ──────────────────────────────────── */}
      {(activeTab === 'all' || activeTab === 'local') && (
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-extrabold text-white tracking-tight flex items-center gap-2">
              <Music size={20} className="text-emerald-400" />
              Your Local Library ({songs.length})
            </h2>
            {songs.length > 0 && (
              <button
                onClick={() => navigate('/songs')}
                className="text-xs font-bold text-text/50 hover:text-white transition-colors uppercase tracking-wider"
              >
                Show all
              </button>
            )}
          </div>

          {songs.length === 0 ? (
            <div className="p-6 rounded-2xl bg-[#121214] border border-white/5 flex flex-col items-center justify-center text-center gap-3">
              <Music size={32} className="text-text/20" />
              <div>
                <p className="text-sm font-bold text-white">No local music files scanned yet</p>
                <p className="text-xs text-text/40 mt-1">Add a music folder to scan your local MP3, FLAC, and M4A files</p>
              </div>
              <button
                onClick={async () => {
                  const folder = await window.electronAPI.dialog.openFolder();
                  if (folder) {
                    window.dispatchEvent(new CustomEvent('scan-folder', { detail: folder }));
                  }
                }}
                className="flex items-center gap-2 px-4 py-2 bg-primary/20 hover:bg-primary/30 text-primary border border-primary/30 rounded-xl text-xs font-bold transition-all"
              >
                <Plus size={15} />
                Add Local Music Folder
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {songs.slice(0, 12).map((song) => (
                <div
                  key={song.id}
                  onClick={() => {
                    const idx = songs.findIndex((s) => s.id === song.id);
                    setQueue(songs, idx >= 0 ? idx : 0, 'Local Library');
                  }}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    setContextMenu({ song, x: e.clientX, y: e.clientY });
                  }}
                  className="group bg-[#18181c] hover:bg-[#232329] p-3 rounded-xl transition-all duration-200 cursor-pointer flex flex-col border border-white/5"
                >
                  <div className="relative aspect-square rounded-lg overflow-hidden mb-3 bg-white/5 flex items-center justify-center">
                    {song.coverPath ? (
                      <img src={getImageUrl(song.coverPath) || ''} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <Music size={24} className="text-white/20" />
                    )}
                    <button className="absolute bottom-2 right-2 w-9 h-9 rounded-full bg-primary text-black flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all shadow-xl">
                      <Play size={16} className="fill-black ml-0.5" />
                    </button>
                  </div>
                  <h3 className="text-xs font-bold text-white truncate">{song.title}</h3>
                  <p className="text-[11px] text-text/40 truncate mt-0.5">{song.artist}</p>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {contextMenu && (
        <SongContextMenu
          song={contextMenu.song}
          x={contextMenu.x}
          y={contextMenu.y}
          onClose={() => setContextMenu(null)}
        />
      )}

      <ImportPlaylistModal
        isOpen={showImportModal}
        onClose={() => setShowImportModal(false)}
      />
    </div>
  );
}
