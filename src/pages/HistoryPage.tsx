import { useHistoryStore, useLibraryStore, usePlayerStore } from '@/stores';
import { Clock, Trash2, Play, Music, BarChart2, Award } from 'lucide-react';
import { motion } from 'framer-motion';
import { formatTime } from '@/utils';
import type { Song } from '@/types';
import { useState, useMemo } from 'react';

type Tab = 'recent' | 'stats';
type Period = 'day' | 'week' | 'month';

export function HistoryPage() {
  const { entries, clearHistory } = useHistoryStore();
  const { getSongById } = useLibraryStore();
  const { setQueue, currentSong } = usePlayerStore();
  const [activeTab, setActiveTab] = useState<Tab>('recent');
  const [activePeriod, setActivePeriod] = useState<Period>('week');

  // Map history entries to song objects and filter out any undefined songs
  const historySongs = useMemo(() => {
    return entries
      .map((entry) => {
        const song = getSongById(entry.songId);
        return song ? { ...song, playedAt: entry.playedAt } : null;
      })
      .filter((song): song is Song & { playedAt: number } => song !== null);
  }, [entries, getSongById]);

  // Compute most played stats
  const statsSongs = useMemo(() => {
    const now = Date.now();
    let periodMs = 7 * 24 * 60 * 60 * 1000; // default week
    if (activePeriod === 'day') periodMs = 24 * 60 * 60 * 1000;
    if (activePeriod === 'month') periodMs = 30 * 24 * 60 * 60 * 1000;

    const filtered = entries.filter((e) => now - e.playedAt <= periodMs);

    const counts: Record<string, number> = {};
    for (const entry of filtered) {
      counts[entry.songId] = (counts[entry.songId] || 0) + 1;
    }

    return Object.entries(counts)
      .map(([songId, count]) => {
        const song = getSongById(songId);
        return song ? { ...song, playCountInPeriod: count } : null;
      })
      .filter((song): song is Song & { playCountInPeriod: number } => song !== null)
      .sort((a, b) => b.playCountInPeriod - a.playCountInPeriod);
  }, [entries, activePeriod, getSongById]);

  const handlePlaySong = (song: Song & { playedAt: number }) => {
    const songList = historySongs.map((hs) => ({ ...hs }));
    const index = songList.findIndex((s) => s.id === song.id);
    setQueue(songList, index >= 0 ? index : 0);
  };

  const handlePlayStatsSong = (song: Song) => {
    setQueue([song], 0);
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
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Clock size={24} className="text-primary" />
            Listening History
          </h1>
          <p className="text-sm text-text/40 mt-1">
            Track and analyze your favorite tracks
          </p>
        </div>
        {historySongs.length > 0 && activeTab === 'recent' && (
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

      {/* Tabs */}
      <div className="flex gap-2 border-b border-white/5 pb-4 mb-6">
        <button
          onClick={() => setActiveTab('recent')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
            activeTab === 'recent'
              ? 'bg-white/10 text-text'
              : 'text-text/40 hover:text-text/70'
          }`}
        >
          <Clock size={16} />
          Recently Played
        </button>
        <button
          onClick={() => setActiveTab('stats')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
            activeTab === 'stats'
              ? 'bg-white/10 text-text'
              : 'text-text/40 hover:text-text/70'
          }`}
        >
          <BarChart2 size={16} />
          Most Played Recap
        </button>
      </div>

      {activeTab === 'recent' ? (
        // Chronological List
        historySongs.length > 0 ? (
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
                      <img
                        src={coverSrc}
                        alt=""
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = '/default-cover.png';
                        }}
                      />
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
        )
      ) : (
        // Most Played Recap Tab
        <div>
          {/* Period selector */}
          <div className="flex gap-1.5 p-1 glass rounded-xl w-fit mb-6">
            {(['day', 'week', 'month'] as const).map((period) => (
              <button
                key={period}
                onClick={() => setActivePeriod(period)}
                className={`px-4 py-1.5 rounded-lg text-xs font-semibold uppercase tracking-wider transition-all ${
                  activePeriod === period
                    ? 'bg-white/10 text-text'
                    : 'text-text/40 hover:text-text/70'
                }`}
              >
                {period === 'day' ? 'Today' : period === 'week' ? 'This Week' : 'This Month'}
              </button>
            ))}
          </div>

          {statsSongs.length > 0 ? (
            <div className="space-y-1">
              {statsSongs.map((song, index) => {
                const isCurrent = currentSong?.id === song.id;
                const coverSrc = song.coverPath
                  ? `local-image://${encodeURIComponent(song.coverPath)}`
                  : null;

                return (
                  <motion.div
                    key={`${song.id}-stat-${index}`}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.02 }}
                    onDoubleClick={() => handlePlayStatsSong(song)}
                    className={`group flex items-center gap-4 px-4 py-3 rounded-xl cursor-pointer transition-colors ${
                      isCurrent ? 'bg-primary/10' : 'hover:bg-white/[0.03]'
                    }`}
                  >
                    {/* Rank Number / Trophy for top 3 */}
                    <div className="w-6 flex items-center justify-center font-semibold text-sm tabular-nums text-text/30 shrink-0">
                      {index === 0 ? (
                        <Award size={16} className="text-amber-500" />
                      ) : index === 1 ? (
                        <Award size={16} className="text-slate-400" />
                      ) : index === 2 ? (
                        <Award size={16} className="text-amber-700" />
                      ) : (
                        index + 1
                      )}
                    </div>

                    <div className="relative w-10 h-10 rounded-lg overflow-hidden shrink-0 shadow-md">
                      {coverSrc ? (
                        <img
                          src={coverSrc}
                          alt=""
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = '/default-cover.png';
                          }}
                        />
                      ) : (
                        <div className="w-full h-full glass flex items-center justify-center">
                          <Music size={16} className="text-text/30" />
                        </div>
                      )}
                      <button
                        onClick={() => handlePlayStatsSong(song)}
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
                      {/* Play count badge */}
                      <span className="text-xs px-2.5 py-1 rounded-full bg-white/5 border border-white/5 font-semibold text-primary">
                        {song.playCountInPeriod} {song.playCountInPeriod === 1 ? 'play' : 'plays'}
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
            <div className="flex flex-col items-center justify-center h-[40vh] text-center">
              <div className="w-20 h-20 glass rounded-2xl flex items-center justify-center mb-4">
                <BarChart2 size={30} className="text-text/20" />
              </div>
              <p className="text-text/40 text-sm">No recap data for this period</p>
              <p className="text-text/20 text-xs mt-1">Play some music to generate your stats!</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
