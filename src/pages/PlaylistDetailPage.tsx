import { useParams, useNavigate } from 'react-router-dom';
import { usePlaylistStore, useLibraryStore, usePlayerStore, useFavoritesStore } from '@/stores';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, Pause, Trash2, Music, ListMusic, Heart, List, Check } from 'lucide-react';
import { formatTime } from '@/utils';
import type { Song } from '@/types';
import { useMemo, useCallback, useState, useEffect, useRef } from 'react';

export function PlaylistDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { playlists, removeSongFromPlaylist, deletePlaylist } = usePlaylistStore();
  const { getSongById } = useLibraryStore();
  const { currentSong, isPlaying, setQueue, setIsPlaying } = usePlayerStore();
  const { isFavoriteSong, toggleFavoriteSong } = useFavoritesStore();

  const [sortBy, setSortBy] = useState<'custom' | 'title' | 'artist' | 'album' | 'added' | 'duration'>('custom');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [showSortDropdown, setShowSortDropdown] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const dropdownRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowSortDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  const handleSortChange = (newSortBy: 'custom' | 'title' | 'artist' | 'album' | 'added' | 'duration') => {
    if (sortBy === newSortBy) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(newSortBy);
      setSortOrder('asc');
    }
  };

  const getSortLabel = (val: string) => {
    switch (val) {
      case 'title': return 'Title';
      case 'artist': return 'Artist';
      case 'album': return 'Album';
      case 'added': return 'Recently added';
      case 'duration': return 'Duration';
      default: return 'Custom order';
    }
  };

  const playlist = useMemo(() => playlists.find((p) => p.id === id), [playlists, id]);

  const songs = useMemo(() => {
    if (!playlist) return [];
    return playlist.songIds
      .map((sid) => getSongById(sid))
      .filter((song): song is Song => song !== undefined);
  }, [playlist, getSongById]);

  const sortedSongs = useMemo(() => {
    const list = [...songs];
    if (sortBy === 'custom') {
      if (sortOrder === 'desc') {
        list.reverse();
      }
      return list;
    }
    list.sort((a, b) => {
      if (sortBy === 'title') {
        return a.title.localeCompare(b.title);
      } else if (sortBy === 'artist') {
        return a.artist.localeCompare(b.artist);
      } else if (sortBy === 'album') {
        return (a.album || '').localeCompare(b.album || '');
      } else if (sortBy === 'added') {
        return (a.addedAt || 0) - (b.addedAt || 0);
      } else if (sortBy === 'duration') {
        return a.duration - b.duration;
      }
      return 0;
    });

    if (sortOrder === 'desc') {
      list.reverse();
    }
    return list;
  }, [songs, sortBy, sortOrder]);

  const totalDuration = useMemo(() => songs.reduce((acc, s) => acc + s.duration, 0), [songs]);

  const handlePlayAll = useCallback(() => {
    if (sortedSongs.length > 0) setQueue(sortedSongs, 0);
  }, [sortedSongs, setQueue]);

  const handlePlaySong = useCallback(
    (song: Song) => {
      if (currentSong?.id === song.id) {
        setIsPlaying(!isPlaying);
        window.dispatchEvent(new CustomEvent('player:toggle'));
      } else {
        const index = sortedSongs.findIndex((s) => s.id === song.id);
        setQueue(sortedSongs, index >= 0 ? index : 0);
      }
    },
    [currentSong, isPlaying, sortedSongs, setQueue, setIsPlaying],
  );

  const handleDelete = () => {
    setShowDeleteConfirm(true);
  };

  if (!playlist) {
    return (
      <div className="flex items-center justify-center h-[50vh] text-text/40">
        Playlist not found
      </div>
    );
  }

  const coverSrc = playlist.coverPath
    ? `local-image://${encodeURIComponent(playlist.coverPath)}`
    : null;

  return (
    <div>
      {/* Playlist header */}
      <div className="relative mb-8">
        {coverSrc && (
          <div className="absolute -inset-6 -top-20 overflow-hidden pointer-events-none">
            <img
              src={coverSrc}
              alt=""
              className="w-full h-64 object-cover opacity-20 blur-3xl scale-150"
              onError={(e) => {
                (e.target as HTMLImageElement).src = '/default-cover.png';
              }}
            />
            <div className="absolute inset-0 bg-gradient-to-b from-transparent via-bg/50 to-bg" />
          </div>
        )}

        <div className="relative flex gap-6 items-end">
          <div className="w-52 h-52 rounded-cover overflow-hidden shrink-0 shadow-xl bg-white/[0.02] flex items-center justify-center border border-white/5">
            {coverSrc ? (
              <img
                src={coverSrc}
                alt={playlist.name}
                className="w-full h-full object-cover"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = '/default-cover.png';
                }}
              />
            ) : (
              <ListMusic size={64} className="text-text/10" />
            )}
          </div>

          <div className="pb-2">
            <p className="text-[10px] uppercase tracking-widest text-primary font-semibold mb-1">
              Playlist
            </p>
            <h1 className="text-3xl font-bold mb-2">{playlist.name}</h1>
            {playlist.description && (
              <p className="text-sm text-text/50 mb-3 max-w-lg">{playlist.description}</p>
            )}
            <p className="text-xs text-text/30 mb-4">
              {songs.length} song{songs.length !== 1 ? 's' : ''} • {formatTime(totalDuration)}
            </p>

            <div className="flex items-center gap-3">
              {songs.length > 0 && (
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={handlePlayAll}
                  className="flex items-center gap-2 px-6 py-2.5 bg-primary rounded-button text-sm font-semibold text-zinc-950 shadow-glow hover:bg-primary-hover transition-colors"
                >
                  <Play size={16} fill="currentColor" />
                  Play
                </motion.button>
              )}
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={handleDelete}
                className="flex items-center gap-2 px-4 py-2.5 glass rounded-button text-sm font-semibold text-text/50 hover:text-danger transition-colors"
              >
                <Trash2 size={16} />
                Delete Playlist
              </motion.button>

              {songs.length > 0 && (
                <div className="relative" ref={dropdownRef}>
                  <button
                    onClick={() => setShowSortDropdown(!showSortDropdown)}
                    className="flex items-center gap-2 px-3 py-2.5 rounded-button glass text-sm font-semibold hover:bg-white/5 transition-all text-text/50 hover:text-text select-none border border-white/5"
                  >
                    <span>{getSortLabel(sortBy)}</span>
                    <List size={14} />
                  </button>

                  <AnimatePresence>
                    {showSortDropdown && (
                      <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        transition={{ duration: 0.15 }}
                        className="absolute left-0 mt-1.5 w-44 bg-zinc-900 border border-white/5 rounded-xl shadow-2xl p-1.5 z-50 text-xs text-text/80 font-normal"
                      >
                        <div className="px-3 py-1.5 text-[9px] uppercase font-bold text-text/30 tracking-wider">
                          Sort by
                        </div>
                        {[
                          { value: 'custom', label: 'Custom order' },
                          { value: 'title', label: 'Title' },
                          { value: 'artist', label: 'Artist' },
                          { value: 'album', label: 'Album' },
                          { value: 'added', label: 'Recently added' },
                          { value: 'duration', label: 'Duration' },
                        ].map((opt) => (
                          <button
                            key={opt.value}
                            onClick={() => {
                              handleSortChange(opt.value as any);
                              setShowSortDropdown(false);
                            }}
                            className={`w-full flex items-center justify-between px-3 py-1.5 rounded-lg text-left transition-colors ${
                              sortBy === opt.value
                                ? 'text-primary font-semibold bg-white/5'
                                : 'text-text/60 hover:text-text hover:bg-white/[0.02]'
                            }`}
                          >
                            <span>
                              {opt.label}
                              {sortBy === opt.value && (
                                <span className="ml-1 opacity-60">
                                  {sortOrder === 'asc' ? '↑' : '↓'}
                                </span>
                              )}
                            </span>
                            {sortBy === opt.value && <Check size={14} className="text-primary" />}
                          </button>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Playlist tracklist */}
      {songs.length > 0 ? (
        <div className="space-y-0.5">
          <div className="grid grid-cols-[40px_1fr_1fr_40px_40px_80px] gap-4 px-4 py-2 text-[10px] uppercase tracking-widest text-text/30 font-semibold border-b border-white/5 mb-1">
            <span>#</span>
            <span
              onClick={() => handleSortChange('title')}
              className="cursor-pointer hover:text-text/70 transition-colors flex items-center gap-1 select-none w-fit"
            >
              Title {sortBy === 'title' && (sortOrder === 'asc' ? '↑' : '↓')}
            </span>
            <span
              onClick={() => handleSortChange('album')}
              className="cursor-pointer hover:text-text/70 transition-colors flex items-center gap-1 select-none w-fit"
            >
              Album {sortBy === 'album' && (sortOrder === 'asc' ? '↑' : '↓')}
            </span>
            <span className="text-center">Love</span>
            <span className="text-center">Action</span>
            <span className="text-right">Duration</span>
          </div>

          {sortedSongs.map((song, index) => {
            const isCurrent = currentSong?.id === song.id;
            const songCover = song.coverPath
              ? `local-image://${encodeURIComponent(song.coverPath)}`
              : null;

            return (
              <motion.div
                key={song.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.02 }}
                onDoubleClick={() => handlePlaySong(song)}
                className={`group grid grid-cols-[40px_1fr_1fr_40px_40px_80px] gap-4 px-4 py-2.5 rounded-xl cursor-pointer transition-all duration-200 ${
                  isCurrent
                    ? 'bg-primary/10 border-l-2 border-primary'
                    : 'hover:bg-white/[0.03] border-l-2 border-transparent'
                }`}
              >
                <div className="flex items-center justify-center">
                  {isCurrent && isPlaying ? (
                    <div className="flex gap-0.5 items-end h-3.5">
                      {[1, 2, 3].map((i) => (
                        <motion.div
                          key={i}
                          className="w-0.5 bg-primary rounded-full"
                          animate={{ height: ['20%', '100%', '20%'] }}
                          transition={{ duration: 0.7, repeat: Infinity, delay: i * 0.12 }}
                        />
                      ))}
                    </div>
                  ) : (
                    <span
                      className={`text-sm tabular-nums group-hover:hidden ${isCurrent ? 'text-primary' : 'text-text/25'}`}
                    >
                      {index + 1}
                    </span>
                  )}
                  <button
                    onClick={() => handlePlaySong(song)}
                    className="hidden group-hover:flex text-text/80"
                  >
                    {isCurrent && isPlaying ? (
                      <Pause size={14} fill="currentColor" className="text-primary" />
                    ) : (
                      <Play size={14} fill="currentColor" />
                    )}
                  </button>
                </div>

                <div className="flex items-center gap-3 min-w-0">
                  {songCover ? (
                    <img
                      src={songCover}
                      alt=""
                      className="w-8 h-8 rounded-lg object-cover shrink-0"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = '/default-cover.png';
                      }}
                    />
                  ) : (
                    <div className="w-8 h-8 rounded-lg glass flex items-center justify-center shrink-0">
                      <Music size={12} className="text-text/25" />
                    </div>
                  )}
                  <div className="min-w-0">
                    <p
                      className={`text-sm font-medium truncate ${isCurrent ? 'text-primary' : ''}`}
                    >
                      {song.title}
                    </p>
                    <p className="text-xs text-text/35 truncate">{song.artist}</p>
                  </div>
                </div>

                <div className="flex items-center">
                  <p className="text-sm text-text/40 truncate">{song.album}</p>
                </div>

                {/* Favorite toggler */}
                <div className="flex items-center justify-center">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleFavoriteSong(song.id);
                    }}
                    className={`hover:scale-110 transition-transform ${
                      isFavoriteSong(song.id)
                        ? 'text-primary'
                        : 'text-text/20 hover:text-text/50 opacity-0 group-hover:opacity-100'
                    }`}
                  >
                    <Heart size={14} fill={isFavoriteSong(song.id) ? 'currentColor' : 'none'} />
                  </button>
                </div>

                {/* Remove song from playlist */}
                <div className="flex items-center justify-center">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      removeSongFromPlaylist(playlist.id, song.id);
                    }}
                    className="opacity-0 group-hover:opacity-100 hover:text-danger text-text/30 transition-all p-1"
                    title="Remove from playlist"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>

                <div className="flex items-center justify-end">
                  <span className="text-sm text-text/25 tabular-nums font-mono">
                    {formatTime(song.duration)}
                  </span>
                </div>
              </motion.div>
            );
          })}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center h-[40vh] text-center">
          <div className="w-16 h-16 glass rounded-2xl flex items-center justify-center mb-4 text-text/20">
            <Music size={24} />
          </div>
          <p className="text-text/40 text-sm">No songs in this playlist</p>
          <p className="text-text/20 text-xs mt-1">Add songs from the Songs list or Album view</p>
        </div>
      )}

      <AnimatePresence>
        {showDeleteConfirm && (
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
                  onClick={() => setShowDeleteConfirm(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-text/60 hover:text-text hover:bg-white/5 transition-colors border border-white/5"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    if (playlist) {
                      deletePlaylist(playlist.id);
                      setShowDeleteConfirm(false);
                      navigate('/playlists');
                    }
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
    </div>
  );
}
