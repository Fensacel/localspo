import { useLibraryStore, usePlayerStore, useFavoritesStore, usePlaylistStore } from '@/stores';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, Pause, Music, Clock, Heart, Check, ListMusic } from 'lucide-react';
import { formatTime, getImageUrl } from '@/utils';
import { useMemo, useCallback, useEffect, useRef, useState } from 'react';
import type { Song } from '@/types';
import { OverflowMarqueeText } from '@/components/OverflowMarqueeText';

export function SongsPage() {
  const { songs } = useLibraryStore();
  const { currentSong, isPlaying, setQueue, setIsPlaying } = usePlayerStore();
  const listRef = useRef<HTMLDivElement | null>(null);
  const [titleColumnWidth, setTitleColumnWidth] = useState(360);
  const [isResizingTitleColumn, setIsResizingTitleColumn] = useState(false);

  const sortedSongs = useMemo(() => {
    return [...songs].sort((a, b) => a.title.localeCompare(b.title));
  }, [songs]);

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
        setQueue(sortedSongs, index);
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

  return (
    <div ref={listRef}>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Songs</h1>
          <p className="text-sm text-text/40 mt-1">
            {songs.length} song{songs.length !== 1 ? 's' : ''}
          </p>
        </div>
        {songs.length > 0 && (
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setQueue(sortedSongs, 0)}
            className="flex items-center gap-2 px-5 py-2.5 bg-primary rounded-button text-sm font-semibold text-white shadow-glow hover:bg-primary-hover transition-colors"
          >
            <Play size={16} fill="currentColor" />
            Play All
          </motion.button>
        )}
      </div>

      {/* Column headers */}
      {songs.length > 0 && (
        <div
          className="grid gap-4 px-4 py-2 text-[10px] uppercase tracking-widest text-text/30 font-semibold border-b border-white/5 mb-1 select-none"
          style={{ gridTemplateColumns }}
        >
          <span>#</span>
          <div className="relative flex items-center">
            <span>Title</span>
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
          <span>Album</span>
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
  const { playlists, addSongToPlaylist } = usePlaylistStore();
  const isFav = isFavoriteSong(song.id);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!contextMenu) return;

    const handleOutsideClick = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setContextMenu(null);
      }
    };
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setContextMenu(null);
      }
    };
    const handleViewportChange = () => {
      setContextMenu(null);
    };

    document.addEventListener('mousedown', handleOutsideClick);
    document.addEventListener('keydown', handleEscape);
    window.addEventListener('resize', handleViewportChange, { once: true });
    window.addEventListener('scroll', handleViewportChange, { once: true });

    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('keydown', handleEscape);
      window.removeEventListener('resize', handleViewportChange);
      window.removeEventListener('scroll', handleViewportChange);
    };
  }, [contextMenu]);

  const handleSongClick = () => {
    console.log('Song clicked', song);
    onPlay();
  };

  const handleAddToPlaylist = async (playlistId: string) => {
    await addSongToPlaylist(playlistId, song.id);
    setContextMenu(null);
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
        {coverSrc && (
          <img src={coverSrc} alt="" className="w-9 h-9 rounded-lg object-cover shrink-0" />
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

      <AnimatePresence>
        {contextMenu && playlists.length > 0 && (
          <motion.div
            ref={menuRef}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.12 }}
            className="fixed w-52 glass rounded-xl py-1 z-50 shadow-glass border border-white/10 text-left"
            style={{ top: contextMenu.y, left: contextMenu.x }}
            onClick={(event) => event.stopPropagation()}
          >
            <p className="px-3 py-1.5 text-[10px] uppercase font-bold tracking-wider text-text/30 border-b border-white/5 mb-1">
              Add to Playlist
            </p>
            <div className="max-h-52 overflow-y-auto">
              {playlists.map((playlist) => {
                const alreadyAdded = playlist.songIds.includes(song.id);
                return (
                  <button
                    key={playlist.id}
                    onClick={() => !alreadyAdded && handleAddToPlaylist(playlist.id)}
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
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
