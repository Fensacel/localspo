import { useHistoryStore, useLibraryStore, usePlayerStore } from '@/stores';
import { Clock, Trash2, Play, Music } from 'lucide-react';
import { motion } from 'framer-motion';
import { formatTime } from '@/utils';
import type { Song } from '@/types';

export function HistoryPage() {
  const { entries, clearHistory } = useHistoryStore();
  const { getSongById } = useLibraryStore();
  const { setQueue, currentSong } = usePlayerStore();

  // Map history entries to song objects and filter out any undefined songs (if they were removed from library)
  const historySongs = entries
    .map((entry) => {
      const song = getSongById(entry.songId);
      return song ? { ...song, playedAt: entry.playedAt } : null;
    })
    .filter((song): song is NonNullable<typeof song> => song !== null);

  const handlePlaySong = (song: Song & { playedAt: number }) => {
    // Play single song or set queue starting from this song
    const songList = historySongs.map((hs) => ({ ...hs }));
    const index = songList.findIndex((s) => s.id === song.id);
    setQueue(songList, index >= 0 ? index : 0);
  };

  const formatPlayedAt = (timestamp: number) => {
    const diff = Date.now() - timestamp;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;

    const date = new Date(timestamp);
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Clock size={24} className="text-primary" />
            Recently Played
          </h1>
          <p className="text-sm text-text/40 mt-1">
            {historySongs.length} song{historySongs.length !== 1 ? 's' : ''} in history
          </p>
        </div>
        {historySongs.length > 0 && (
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={clearHistory}
            className="flex items-center gap-2 px-4 py-2 glass rounded-button text-sm font-medium text-text/60 hover:text-danger transition-colors"
          >
            <Trash2 size={14} />
            Clear History
          </motion.button>
        )}
      </div>

      {historySongs.length > 0 ? (
        <div className="space-y-1">
          {historySongs.map((song, index) => {
            const isCurrent = currentSong?.id === song.id;
            const coverSrc = song.coverPath
              ? `local-image://${encodeURIComponent(song.coverPath)}`
              : null;

            return (
              <motion.div
                key={`${song.id}-${song.playedAt}-${index}`}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.02 }}
                onDoubleClick={() => handlePlaySong(song)}
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
                    <Play size={16} fill="white" />
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
                  <span className="text-xs text-text/30 font-medium">
                    {formatPlayedAt(song.playedAt)}
                  </span>
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
            <Clock size={36} className="text-text/20" />
          </div>
          <p className="text-text/40 text-sm">No listening history yet</p>
          <p className="text-text/20 text-xs mt-1">Songs you play will appear here</p>
        </div>
      )}
    </div>
  );
}
