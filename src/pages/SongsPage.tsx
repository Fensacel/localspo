import { useLibraryStore, usePlayerStore, useFavoritesStore } from '@/stores';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, Pause, Music, Clock, Heart, Check, List } from 'lucide-react';
import { formatTime, getImageUrl } from '@/utils';
import { useMemo, useCallback, useEffect, useRef, useState } from 'react';
import type { Song } from '@/types';
import { OverflowMarqueeText } from '@/components/OverflowMarqueeText';
import { SongContextMenu } from '@/components/SongContextMenu';

export function SongsPage() {
  const { songs } = useLibraryStore();
  const { currentSong, isPlaying, setQueue, setIsPlaying } = usePlayerStore();
  const listRef = useRef<HTMLDivElement | null>(null);
  const [titleColumnWidth, setTitleColumnWidth] = useState(360);
  const [isResizingTitleColumn, setIsResizingTitleColumn] = useState(false);

  const [sortBy, setSortBy] = useState<'custom' | 'title' | 'artist' | 'album' | 'added' | 'duration'>('custom');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [showSortDropdown, setShowSortDropdown] = useState(false);
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

  const handlePlay = useCallback(
    (song: Song) => {
      if (currentSong?.id === song.id) {
        setIsPlaying(!isPlaying);
        window.dispatchEvent(new CustomEvent('player:toggle'));
      } else {
        let index = sortedSongs.findIndex((s) => s.id === song.id);
        if (index < 0) {
          index = sortedSongs.findIndex((s) => s.path === song.path);
        }
        if (index < 0) {
          index = 0;
        }
        console.log('Playing', sortedSongs[index]);
        setQueue(sortedSongs, index, 'Songs');
      }
    },
    [currentSong, isPlaying, sortedSongs, setQueue, setIsPlaying],
  );

  useEffect(() => {
    if (!isResizingTitleColumn) return;

    const handleMouseMove = (event: MouseEvent) => {
      if (!listRef.current) return;
      const rect = listRef.current.getBoundingClientRect();
      const fixedColumnsWidth = 40 + 40 + 80;
      const totalGapWidth = 16 * 4;
      const availableWidth = rect.width - fixedColumnsWidth - totalGapWidth;
      const minTitleWidth = 220;
      const minAlbumWidth = 160;
      const maxTitleWidth = Math.max(minTitleWidth, availableWidth - minAlbumWidth);
      const nextTitleWidth = event.clientX - rect.left - (40 + 16);
      const clampedWidth = Math.min(Math.max(nextTitleWidth, minTitleWidth), maxTitleWidth);
      setTitleColumnWidth(clampedWidth);
    };

    const handleMouseUp = () => {
      setIsResizingTitleColumn(false);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizingTitleColumn]);

  const gridTemplateColumns = useMemo(
    () => `40px minmax(220px, ${titleColumnWidth}px) minmax(160px, 1fr) 40px 80px`,
    [titleColumnWidth],
  );

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

  return (
    <div ref={listRef}>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Songs</h1>
          <p className="text-sm text-text/40 mt-1">
            {songs.length} song{songs.length !== 1 ? 's' : ''}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {songs.length > 0 && (
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setShowSortDropdown(!showSortDropdown)}
                className="flex items-center gap-2 px-3 py-2 rounded-xl glass text-xs font-semibold hover:bg-white/5 transition-all text-text/60 hover:text-text select-none border border-white/5"
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
                    className="absolute right-0 mt-1.5 w-44 bg-zinc-900 border border-white/5 rounded-xl shadow-2xl p-1.5 z-50 text-xs text-text/80"
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

          {songs.length > 0 && (
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setQueue(sortedSongs, 0, 'Songs')}
              className="flex items-center gap-2 px-5 py-2.5 bg-primary rounded-button text-sm font-semibold text-zinc-950 shadow-glow hover:bg-primary-hover transition-colors"
            >
              <Play size={16} fill="currentColor" />
              Play All
            </motion.button>
          )}
        </div>
      </div>

      {/* Column headers */}
      {songs.length > 0 && (
        <div
          className="grid gap-4 px-4 py-2 text-[10px] uppercase tracking-widest text-text/30 font-semibold border-b border-white/5 mb-1 select-none"
          style={{ gridTemplateColumns }}
        >
          <span>#</span>
          <div className="relative flex items-center">
            <span
              onClick={() => handleSortChange('title')}
              className="cursor-pointer hover:text-text/70 transition-colors flex items-center gap-1 select-none"
            >
              Title {sortBy === 'title' && (sortOrder === 'asc' ? '↑' : '↓')}
            </span>
            <button
              aria-label="Resize title column"
              onMouseDown={(event) => {
                event.preventDefault();
                setIsResizingTitleColumn(true);
              }}
              className="absolute -right-2 top-1/2 -translate-y-1/2 h-6 w-2 cursor-col-resize"
            >
              <span className="block mx-auto h-4 w-px bg-white/15 hover:bg-primary/70 transition-colors" />
            </button>
          </div>
          <span
            onClick={() => handleSortChange('album')}
            className="cursor-pointer hover:text-text/70 transition-colors flex items-center gap-1 select-none w-fit"
          >
            Album {sortBy === 'album' && (sortOrder === 'asc' ? '↑' : '↓')}
          </span>
          <span className="text-center flex items-center justify-center">
            <Heart size={10} />
          </span>
          <span className="text-right flex items-center justify-end gap-1">
            <Clock size={10} />
            Duration
          </span>
        </div>
      )}

      {/* Song list */}
      <div className="space-y-0.5">
        {sortedSongs.map((song, index) => (
          <SongRow
            key={song.id}
            song={song}
            index={index + 1}
            gridTemplateColumns={gridTemplateColumns}
            isActive={currentSong?.id === song.id}
            isPlaying={currentSong?.id === song.id && isPlaying}
            onPlay={() => handlePlay(song)}
          />
        ))}
      </div>

      {songs.length === 0 && (
        <div className="flex flex-col items-center justify-center h-[50vh] text-center">
          <div className="w-24 h-24 glass rounded-2xl flex items-center justify-center mb-4">
            <Music size={36} className="text-text/20" />
          </div>
          <p className="text-text/40 text-sm">No songs in your library</p>
          <p className="text-text/20 text-xs mt-1">Add a music folder to get started</p>
        </div>
      )}
    </div>
  );
}

interface SongRowProps {
  song: Song;
  index: number;
  gridTemplateColumns: string;
  isActive: boolean;
  isPlaying: boolean;
  onPlay: () => void;
}

function SongRow({ song, index, gridTemplateColumns, isActive, isPlaying, onPlay }: SongRowProps) {
  const coverSrc = song.coverPath ? getImageUrl(song.coverPath) : null;
  const { isFavoriteSong, toggleFavoriteSong } = useFavoritesStore();
  const isFav = isFavoriteSong(song.id);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);

  const handleSongClick = () => {
    console.log('Song clicked', song);
    onPlay();
  };

  return (
    <motion.div
      whileTap={{ scale: 0.995 }}
      onDoubleClick={handleSongClick}
      onContextMenu={(event) => {
        event.preventDefault();
        setContextMenu({ x: event.clientX, y: event.clientY });
      }}
      className={`group grid gap-4 px-4 py-2.5 rounded-xl cursor-pointer transition-all duration-200 ${
        isActive
          ? 'bg-primary/10 border-l-2 border-primary'
          : 'hover:bg-white/[0.03] border-l-2 border-transparent'
      }`}
      style={{ gridTemplateColumns }}
    >
      {/* Track number / play button */}
      <div className="flex items-center justify-center">
        <span
          className={`text-sm tabular-nums group-hover:hidden ${
            isActive ? 'text-primary font-semibold' : 'text-text/30'
          }`}
        >
          {isActive && isPlaying ? (
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
            index
          )}
        </span>
        <button
          onClick={handleSongClick}
          className="hidden group-hover:flex items-center justify-center text-text/80"
        >
          {isActive && isPlaying ? (
            <Pause size={14} fill="currentColor" className="text-primary" />
          ) : (
            <Play size={14} fill="currentColor" />
          )}
        </button>
      </div>

      {/* Title + Artist */}
      <div className="flex items-center gap-3 min-w-0">
        {coverSrc ? (
          <img
            src={coverSrc}
            alt=""
            className="w-9 h-9 rounded-lg object-cover shrink-0"
            onError={(e) => {
              (e.target as HTMLImageElement).src = '/default-cover.png';
            }}
          />
        ) : (
          <div className="w-9 h-9 rounded-lg bg-white/5 flex items-center justify-center shrink-0 text-text/30">
            <Music size={14} />
          </div>
        )}
        <div className="min-w-0">
          <div className="flex items-center gap-2 min-w-0">
            <OverflowMarqueeText
              text={song.title}
              className={`text-sm font-medium flex-1 ${isActive ? 'text-primary' : 'text-text'}`}
            />
            <span className="text-[9px] px-1.5 py-0.5 rounded-md bg-white/5 text-text/40 uppercase font-mono shrink-0">
              {song.codec}
            </span>
          </div>
          <OverflowMarqueeText text={song.artist} className="text-xs text-text/40" />
        </div>
      </div>

      {/* Album */}
      <div className="flex items-center">
        <OverflowMarqueeText text={song.album} className="text-sm text-text/40 w-full" />
      </div>

      {/* Favorite toggler */}
      <div className="flex items-center justify-center">
        <button
          onClick={(e) => {
            e.stopPropagation();
            toggleFavoriteSong(song.id);
          }}
          className={`hover:scale-110 transition-transform ${
            isFav
              ? 'text-primary'
              : 'text-text/20 hover:text-text/50 opacity-0 group-hover:opacity-100'
          }`}
        >
          <Heart size={14} fill={isFav ? 'currentColor' : 'none'} />
        </button>
      </div>

      {/* Duration */}
      <div className="flex items-center justify-end">
        <span className="text-sm text-text/30 tabular-nums font-mono">
          {formatTime(song.duration)}
        </span>
      </div>

      {contextMenu && (
        <SongContextMenu
          song={song}
          x={contextMenu.x}
          y={contextMenu.y}
          onClose={() => setContextMenu(null)}
        />
      )}
    </motion.div>
  );
}
