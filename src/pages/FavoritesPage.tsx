import { useFavoritesStore, useLibraryStore, usePlayerStore } from '@/stores';
import { Heart, Play, Pause, Music, Shuffle } from 'lucide-react';
import { motion } from 'framer-motion';
import { formatTime } from '@/utils';
import type { Song } from '@/types';
import { useState, useMemo } from 'react';
import { SongContextMenu } from '@/components/SongContextMenu';

export function FavoritesPage() {
  const { songIds, toggleFavoriteSong } = useFavoritesStore();
  const { getSongById } = useLibraryStore();
  const { setQueue, currentSong, isPlaying, setIsPlaying, shuffleMode, toggleShuffle } = usePlayerStore();
  const [contextMenu, setContextMenu] = useState<{ song: Song; x: number; y: number } | null>(null);

  // Map favorite song IDs to actual song objects
  const favoriteSongs = songIds
    .map((id) => getSongById(id))
    .filter((song): song is Song => song !== undefined);

  const isFavsPlaying = useMemo(() => {
    if (!isPlaying || !currentSong || favoriteSongs.length === 0) return false;
    return favoriteSongs.some((s) => s.id === currentSong.id);
  }, [isPlaying, currentSong, favoriteSongs]);

  const handlePlayAll = () => {
    if (favoriteSongs.length === 0) return;
    if (isFavsPlaying) {
      setIsPlaying(!isPlaying);
      window.dispatchEvent(new CustomEvent('player:toggle'));
    } else {
      const startIndex = shuffleMode === 'on' ? Math.floor(Math.random() * favoriteSongs.length) : 0;
      setQueue(favoriteSongs, startIndex, 'Favorites');
    }
  };

  const handleShuffleToggle = () => {
    toggleShuffle();
  };

  const handlePlaySong = (song: Song) => {
    const index = favoriteSongs.findIndex((s) => s.id === song.id);
    setQueue(favoriteSongs, index >= 0 ? index : 0, 'Favorites');
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Heart size={24} className="text-primary" fill="currentColor" />
            Favorites
          </h1>
          <p className="text-sm text-text/40 mt-1">
            {favoriteSongs.length} song{favoriteSongs.length !== 1 ? 's' : ''} loved
          </p>
        </div>
        {favoriteSongs.length > 0 && (
          <div className="flex items-center gap-4">
            <motion.button
              whileHover={{ scale: 1.06 }}
              whileTap={{ scale: 0.94 }}
              onClick={handlePlayAll}
              className="w-14 h-14 bg-primary text-zinc-950 rounded-full flex items-center justify-center shadow-lg shadow-primary/25 hover:bg-primary-hover transition-all cursor-pointer shrink-0"
              title={isFavsPlaying ? 'Pause' : 'Play Favorites'}
            >
              {isFavsPlaying ? (
                <Pause size={24} fill="currentColor" />
              ) : (
                <Play size={24} fill="currentColor" className="ml-1" />
              )}
            </motion.button>

            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={handleShuffleToggle}
              className={`relative w-10 h-10 rounded-full flex items-center justify-center transition-all cursor-pointer ${
                shuffleMode === 'on'
                  ? 'text-primary hover:text-primary-hover'
                  : 'text-text/50 hover:text-white'
              }`}
              title={shuffleMode === 'on' ? 'Disable shuffle' : 'Enable shuffle'}
            >
              <Shuffle size={22} />
              {shuffleMode === 'on' && (
                <span className="absolute -bottom-1 w-1.5 h-1.5 rounded-full bg-primary" />
              )}
            </motion.button>
          </div>
        )}
      </div>

      {favoriteSongs.length > 0 ? (
        <div className="space-y-0.5">
          {favoriteSongs.map((song, index) => {
            const isCurrent = currentSong?.id === song.id;
            const coverSrc = song.coverPath
              ? `local-image://${encodeURIComponent(song.coverPath)}`
              : null;

            return (
              <motion.div
                key={song.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.02 }}
                onDoubleClick={() => handlePlaySong(song)}
                onContextMenu={(event) => {
                  event.preventDefault();
                  setContextMenu({ song, x: event.clientX, y: event.clientY });
                }}
                className={`group flex items-center gap-4 px-4 py-3 rounded-xl cursor-pointer transition-colors ${
                  isCurrent ? 'bg-primary/10' : 'hover:bg-white/[0.03]'
                }`}
              >
                <div className="relative w-10 h-10 rounded-lg overflow-hidden shrink-0 shadow-md">
                  {coverSrc ? (
                    <img src={coverSrc} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full glass flex items-center justify-center">
                      <Music size={16} className="text-text/30" />
                    </div>
                  )}
                  <button
                    onClick={() => handlePlaySong(song)}
                    className="absolute inset-0 bg-black/40 items-center justify-center hidden group-hover:flex text-white transition-opacity"
                  >
                    {isCurrent && isPlaying ? (
                      <div className="flex gap-0.5 items-end h-3.5 pb-0.5">
                        {[1, 2, 3].map((i) => (
                          <motion.div
                            key={i}
                            className="w-0.5 bg-white rounded-full"
                            animate={{ height: ['20%', '100%', '20%'] }}
                            transition={{ duration: 0.7, repeat: Infinity, delay: i * 0.12 }}
                          />
                        ))}
                      </div>
                    ) : (
                      <Play size={16} fill="white" />
                    )}
                  </button>
                </div>

                <div className="min-w-0 flex-1">
                  <p className={`text-sm font-medium truncate ${isCurrent ? 'text-primary' : ''}`}>
                    {song.title}
                  </p>
                  <p className="text-xs text-text/40 truncate">
                    {song.artist} • {song.album}
                  </p>
                </div>

                <div className="flex items-center gap-4">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleFavoriteSong(song.id);
                    }}
                    className="text-primary hover:text-text transition-colors p-1"
                  >
                    <Heart size={16} fill="currentColor" />
                  </button>
                  <span className="text-xs text-text/20 font-mono w-12 text-right">
                    {formatTime(song.duration)}
                  </span>
                </div>
              </motion.div>
            );
          })}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center h-[50vh] text-center">
          <div className="w-24 h-24 glass rounded-2xl flex items-center justify-center mb-4">
            <Heart size={36} className="text-text/20" />
          </div>
          <p className="text-text/40 text-sm">No favorites yet</p>
          <p className="text-text/20 text-xs mt-1">Songs you love will appear here</p>
        </div>
      )}
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
