import { useParams } from 'react-router-dom';
import { useLibraryStore, usePlayerStore, useFavoritesStore } from '@/stores';
import { motion } from 'framer-motion';
import { Play, Pause, Heart, Shuffle } from 'lucide-react';
import { formatTime, isLossless } from '@/utils';
import type { Song } from '@/types';
import { useCallback, useMemo, useState } from 'react';
import { AddToPlaylistMenu } from '@/components/AddToPlaylistMenu';
import { SongContextMenu } from '@/components/SongContextMenu';

export function AlbumDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { getAlbumById, getAlbumSongs } = useLibraryStore();
  const { currentSong, isPlaying, setQueue, setIsPlaying, shuffleMode, toggleShuffle } = usePlayerStore();
  const { isFavoriteSong, toggleFavoriteSong } = useFavoritesStore();
  const [contextMenu, setContextMenu] = useState<{ song: Song; x: number; y: number } | null>(null);

  const album = id ? getAlbumById(id) : undefined;
  const songs = useMemo(() => (id ? getAlbumSongs(id) : []), [id, getAlbumSongs]);

  const totalDuration = useMemo(() => songs.reduce((acc, s) => acc + s.duration, 0), [songs]);

  const isAlbumPlaying = useMemo(() => {
    if (!isPlaying || !currentSong || songs.length === 0) return false;
    return songs.some((s) => s.id === currentSong.id);
  }, [isPlaying, currentSong, songs]);

  const handlePlayAll = useCallback(() => {
    if (songs.length === 0 || !album) return;
    if (isAlbumPlaying) {
      setIsPlaying(!isPlaying);
      window.dispatchEvent(new CustomEvent('player:toggle'));
    } else {
      const startIndex = shuffleMode === 'on' ? Math.floor(Math.random() * songs.length) : 0;
      setQueue(songs, startIndex, album.name);
    }
  }, [songs, album, isAlbumPlaying, isPlaying, setIsPlaying, shuffleMode, setQueue]);

  const handleShuffleToggle = useCallback(() => {
    toggleShuffle();
  }, [toggleShuffle]);

  const handlePlaySong = useCallback(
    (song: Song) => {
      if (currentSong?.id === song.id) {
        setIsPlaying(!isPlaying);
        window.dispatchEvent(new CustomEvent('player:toggle'));
      } else {
        const index = songs.findIndex((s) => s.id === song.id);
        if (album) setQueue(songs, index, album.name);
      }
    },
    [currentSong, isPlaying, songs, album, setQueue, setIsPlaying],
  );

  if (!album) {
    return (
      <div className="flex items-center justify-center h-[50vh] text-text/40">Album not found</div>
    );
  }

  const coverSrc = album.coverPath
    ? `local-image://${encodeURIComponent(album.coverPath)}`
    : '/default-cover.png';

  return (
    <div>
      {/* Album header */}
      <div className="relative mb-8">
        {/* Blurred background */}
        <div className="absolute -inset-6 -top-20 overflow-hidden">
          <img
            src={coverSrc}
            alt=""
            className="w-full h-64 object-cover opacity-20 blur-3xl scale-150"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-bg/50 to-bg" />
        </div>

        <div className="relative flex gap-6 items-end">
          <motion.img
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 200, damping: 20 }}
            src={coverSrc}
            alt={album.name}
            className="w-52 h-52 rounded-cover object-cover shadow-xl"
          />

          <div className="pb-2">
            <p className="text-[10px] uppercase tracking-widest text-primary font-semibold mb-1">
              Album
            </p>
            <h1 className="text-3xl font-bold mb-2">{album.name}</h1>
            <p className="text-sm text-text/50 mb-3">
              {album.artist}
              {album.year ? ` • ${album.year}` : ''}
              {album.genre ? ` • ${album.genre}` : ''}
            </p>
            <p className="text-xs text-text/30 mb-4">
              {album.trackCount} track{album.trackCount !== 1 ? 's' : ''} •{' '}
              {formatTime(totalDuration)}
            </p>

            <div className="flex items-center gap-5 mt-4">
              {songs.length > 0 && (
                <motion.button
                  whileHover={{ scale: 1.06 }}
                  whileTap={{ scale: 0.94 }}
                  onClick={handlePlayAll}
                  className="w-14 h-14 bg-primary text-zinc-950 rounded-full flex items-center justify-center shadow-lg shadow-primary/25 hover:bg-primary-hover transition-all cursor-pointer shrink-0"
                  title={isAlbumPlaying ? 'Pause' : 'Play'}
                >
                  {isAlbumPlaying ? (
                    <Pause size={24} fill="currentColor" />
                  ) : (
                    <Play size={24} fill="currentColor" className="ml-1" />
                  )}
                </motion.button>
              )}

              {songs.length > 0 && (
                <motion.button
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={handleShuffleToggle}
                  className={`relative w-10 h-10 rounded-full flex items-center justify-center transition-all cursor-pointer ${
                    shuffleMode === 'on'
                      ? 'text-primary hover:text-primary-hover'
                      : 'text-text/50 hover:text-white'
                  }`}
                  title={shuffleMode === 'on' ? 'Disable shuffle' : 'Enable shuffle & play'}
                >
                  <Shuffle size={22} />
                  {shuffleMode === 'on' && (
                    <span className="absolute -bottom-1 w-1.5 h-1.5 rounded-full bg-primary" />
                  )}
                </motion.button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Track list */}
      <div className="space-y-0.5">
        {songs.map((song, index) => {
          const isCurrent = currentSong?.id === song.id;
          return (
            <motion.div
              key={song.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.03 }}
              onDoubleClick={() => handlePlaySong(song)}
              onContextMenu={(event) => {
                event.preventDefault();
                setContextMenu({ song, x: event.clientX, y: event.clientY });
              }}
              className={`group grid grid-cols-[40px_1fr_100px_40px_40px_80px] gap-4 px-4 py-3 rounded-xl cursor-pointer transition-all duration-200 ${
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

              <div className="min-w-0">
                <p className={`text-sm font-medium truncate ${isCurrent ? 'text-primary' : ''}`}>
                  {song.title}
                </p>
                <p className="text-xs text-text/35 truncate">{song.artist}</p>
              </div>

              <div className="flex items-center">
                <span className="text-[10px] px-2 py-0.5 rounded-md bg-white/5 text-text/30 uppercase font-mono">
                  {song.codec}
                  {isLossless(song.codec) && <span className="text-primary ml-1">•</span>}
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
                    isFavoriteSong(song.id)
                      ? 'text-primary'
                      : 'text-text/20 hover:text-text/50 opacity-0 group-hover:opacity-100'
                  }`}
                >
                  <Heart size={14} fill={isFavoriteSong(song.id) ? 'currentColor' : 'none'} />
                </button>
              </div>

              {/* Add to Playlist toggler */}
              <div className="flex items-center justify-center">
                <AddToPlaylistMenu songId={song.id} />
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
