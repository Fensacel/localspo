import { useState, useMemo } from 'react';
import { useLibraryStore, usePlayerStore } from '@/stores';
import { motion, AnimatePresence } from 'framer-motion';
import { Search as SearchIcon, X, Music, Disc3, Mic2 } from 'lucide-react';
import { formatTime } from '@/utils';
import { useNavigate } from 'react-router-dom';

export function SearchPage() {
  const [query, setQuery] = useState('');
  const { songs, albums, artists } = useLibraryStore();
  const { setQueue, currentSong } = usePlayerStore();
  const navigate = useNavigate();

  const results = useMemo(() => {
    if (!query.trim()) return { songs: [], albums: [], artists: [] };

    const q = query.toLowerCase().trim();

    return {
      songs: songs
        .filter(
          (s) =>
            s.title.toLowerCase().includes(q) ||
            s.artist.toLowerCase().includes(q) ||
            s.album.toLowerCase().includes(q) ||
            s.genre.toLowerCase().includes(q),
        )
        .slice(0, 20),
      albums: albums
        .filter((a) => a.name.toLowerCase().includes(q) || a.artist.toLowerCase().includes(q))
        .slice(0, 8),
      artists: artists.filter((a) => a.name.toLowerCase().includes(q)).slice(0, 6),
    };
  }, [query, songs, albums, artists]);

  const hasResults =
    results.songs.length > 0 || results.albums.length > 0 || results.artists.length > 0;

  return (
    <div>
      {/* Search input */}
      <div className="relative mb-6">
        <SearchIcon size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-text/30" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search songs, albums, artists..."
          autoFocus
          className="w-full pl-12 pr-10 py-3.5 glass rounded-2xl text-sm text-text placeholder:text-text/25 focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all"
        />
        {query && (
          <button
            onClick={() => setQuery('')}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-text/30 hover:text-text/60 transition-colors"
          >
            <X size={16} />
          </button>
        )}
      </div>

      <AnimatePresence mode="wait">
        {!query.trim() ? (
          <motion.div
            key="empty"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-col items-center justify-center h-[40vh]"
          >
            <SearchIcon size={48} className="text-text/10 mb-4" />
            <p className="text-text/30 text-sm">Start typing to search your library</p>
          </motion.div>
        ) : !hasResults ? (
          <motion.div
            key="no-results"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-col items-center justify-center h-[40vh]"
          >
            <Music size={48} className="text-text/10 mb-4" />
            <p className="text-text/30 text-sm">No results for "{query}"</p>
          </motion.div>
        ) : (
          <motion.div
            key="results"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="space-y-8"
          >
            {/* Artists */}
            {results.artists.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-text/50 uppercase tracking-wider mb-3 flex items-center gap-2">
                  <Mic2 size={14} /> Artists
                </h3>
                <div className="flex gap-4 overflow-x-auto pb-2">
                  {results.artists.map((artist) => (
                    <motion.div
                      key={artist.id}
                      whileHover={{ scale: 1.05 }}
                      onClick={() => navigate(`/artists/${artist.id}`)}
                      className="flex flex-col items-center gap-2 cursor-pointer shrink-0"
                    >
                      <div className="w-20 h-20 rounded-full glass flex items-center justify-center overflow-hidden">
                        {artist.coverPath ? (
                          <img
                            src={`local-image://${encodeURIComponent(artist.coverPath)}`}
                            alt={artist.name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <Mic2 size={24} className="text-text/20" />
                        )}
                      </div>
                      <p className="text-xs font-medium text-text/70 text-center w-20 truncate">
                        {artist.name}
                      </p>
                    </motion.div>
                  ))}
                </div>
              </div>
            )}

            {/* Albums */}
            {results.albums.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-text/50 uppercase tracking-wider mb-3 flex items-center gap-2">
                  <Disc3 size={14} /> Albums
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                  {results.albums.map((album) => {
                    const coverSrc = album.coverPath
                      ? `local-image://${encodeURIComponent(album.coverPath)}`
                      : '/default-cover.png';

                    return (
                      <motion.div
                        key={album.id}
                        whileHover={{ scale: 1.03 }}
                        onClick={() => navigate(`/albums/${album.id}`)}
                        className="group cursor-pointer"
                      >
                        <div className="rounded-card overflow-hidden aspect-square mb-2">
                          <img
                            src={coverSrc}
                            alt={album.name}
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <p className="text-sm font-semibold truncate">{album.name}</p>
                        <p className="text-xs text-text/35 truncate">{album.artist}</p>
                      </motion.div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Songs */}
            {results.songs.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-text/50 uppercase tracking-wider mb-3 flex items-center gap-2">
                  <Music size={14} /> Songs
                </h3>
                <div className="space-y-0.5">
                  {results.songs.map((song) => {
                    const isCurrent = currentSong?.id === song.id;
                    const coverSrc = song.coverPath
                      ? `local-image://${encodeURIComponent(song.coverPath)}`
                      : null;

                    return (
                      <motion.div
                        key={song.id}
                        whileTap={{ scale: 0.995 }}
                        onClick={() => {
                          const index = results.songs.findIndex((s) => s.id === song.id);
                          setQueue(results.songs, index >= 0 ? index : 0, 'Search Results');
                        }}
                        className={`group flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer transition-colors ${
                          isCurrent ? 'bg-primary/10' : 'hover:bg-white/[0.03]'
                        }`}
                      >
                        {coverSrc && (
                          <img
                            src={coverSrc}
                            alt=""
                            className="w-10 h-10 rounded-lg object-cover"
                          />
                        )}
                        <div className="min-w-0 flex-1">
                          <p
                            className={`text-sm font-medium truncate ${isCurrent ? 'text-primary' : ''}`}
                          >
                            {song.title}
                          </p>
                          <p className="text-xs text-text/35 truncate">
                            {song.artist} • {song.album}
                          </p>
                        </div>
                        <span className="text-xs text-text/25 font-mono tabular-nums">
                          {formatTime(song.duration)}
                        </span>
                      </motion.div>
                    );
                  })}
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
