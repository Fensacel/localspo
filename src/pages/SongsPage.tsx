import { useLibraryStore, usePlayerStore, useFavoritesStore } from '@/stores';
import { motion } from 'framer-motion';
import { Play, Pause, Music, Clock, Heart, ListMusic } from 'lucide-react';
import { formatTime, getImageUrl } from '@/utils';
import { useMemo, useCallback } from 'react';
import type { Song } from '@/types';
import { AddToPlaylistMenu } from '@/components/AddToPlaylistMenu';

export function SongsPage() {
  const { songs } = useLibraryStore();
  const { currentSong, isPlaying, setQueue, setIsPlaying } = usePlayerStore();

  const sortedSongs = useMemo(() => {
    return [...songs].sort((a, b) => a.title.localeCompare(b.title));
  }, [songs]);

  const handlePlay = useCallback(
    (song: Song) => {
      if (currentSong?.id === song.id) {
        setIsPlaying(!isPlaying);
        window.dispatchEvent(new CustomEvent('player:toggle'));
      } else {
        const index = sortedSongs.findIndex((s) => s.id === song.id);
        setQueue(sortedSongs, index);
      }
    },
    [currentSong, isPlaying, sortedSongs, setQueue, setIsPlaying],
  );

  return (
    <div>
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
        <div className="grid grid-cols-[40px_1fr_1fr_120px_40px_40px_80px] gap-4 px-4 py-2 text-[10px] uppercase tracking-widest text-text/30 font-semibold border-b border-white/5 mb-1">
          <span>#</span>
          <span>Title</span>
          <span>Album</span>
          <span>Format</span>
          <span className="text-center flex items-center justify-center">
            <Heart size={10} />
          </span>
          <span className="text-center flex items-center justify-center">
            <ListMusic size={10} />
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
  isActive: boolean;
  isPlaying: boolean;
  onPlay: () => void;
}

function SongRow({ song, index, isActive, isPlaying, onPlay }: SongRowProps) {
  const coverSrc = song.coverPath ? getImageUrl(song.coverPath) : null;

  const { isFavoriteSong, toggleFavoriteSong } = useFavoritesStore();
  const isFav = isFavoriteSong(song.id);

  return (
    <motion.div
      whileTap={{ scale: 0.995 }}
      onDoubleClick={onPlay}
      className={`group grid grid-cols-[40px_1fr_1fr_120px_40px_40px_80px] gap-4 px-4 py-2.5 rounded-xl cursor-pointer transition-all duration-200 ${
        isActive
          ? 'bg-primary/10 border-l-2 border-primary'
          : 'hover:bg-white/[0.03] border-l-2 border-transparent'
      }`}
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
          onClick={onPlay}
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
          <p className={`text-sm font-medium truncate ${isActive ? 'text-primary' : 'text-text'}`}>
            {song.title}
          </p>
          <p className="text-xs text-text/40 truncate">{song.artist}</p>
        </div>
      </div>

      {/* Album */}
      <div className="flex items-center">
        <p className="text-sm text-text/40 truncate">{song.album}</p>
      </div>

      {/* Format */}
      <div className="flex items-center">
        <span className="text-[10px] px-2 py-0.5 rounded-md bg-white/5 text-text/40 uppercase font-mono">
          {song.codec}
        </span>
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

      {/* Add to Playlist toggler */}
      <div className="flex items-center justify-center">
        <AddToPlaylistMenu songId={song.id} />
      </div>

      {/* Duration */}
      <div className="flex items-center justify-end">
        <span className="text-sm text-text/30 tabular-nums font-mono">
          {formatTime(song.duration)}
        </span>
      </div>
    </motion.div>
  );
}
