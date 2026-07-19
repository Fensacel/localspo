import { useParams } from 'react-router-dom';
import { useLibraryStore, usePlayerStore } from '@/stores';
import { motion } from 'framer-motion';
import { Play, Mic2, Disc3 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useMemo } from 'react';

export function ArtistDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { getArtistById, getArtistAlbums, getArtistSongs } = useLibraryStore();
  const { setQueue } = usePlayerStore();
  const navigate = useNavigate();

  const artist = id ? getArtistById(id) : undefined;
  const artistAlbums = useMemo(() => (id ? getArtistAlbums(id) : []), [id, getArtistAlbums]);
  const artistSongs = useMemo(() => (id ? getArtistSongs(id) : []), [id, getArtistSongs]);

  if (!artist) {
    return (
      <div className="flex items-center justify-center h-[50vh] text-text/40">Artist not found</div>
    );
  }

  return (
    <div>
      {/* Artist header */}
      <div className="flex items-center gap-6 mb-8">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="w-40 h-40 rounded-full glass overflow-hidden shadow-xl shrink-0"
        >
          {artist.coverPath ? (
            <img
              src={`local-image://${encodeURIComponent(artist.coverPath)}`}
              alt={artist.name}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <Mic2 size={56} className="text-text/15" />
            </div>
          )}
        </motion.div>

        <div>
          <p className="text-[10px] uppercase tracking-widest text-primary font-semibold mb-1">
            Artist
          </p>
          <h1 className="text-3xl font-bold mb-2">{artist.name}</h1>
          <p className="text-sm text-text/40 mb-4">
            {artist.totalAlbums} album{artist.totalAlbums !== 1 ? 's' : ''} • {artist.totalSongs}{' '}
            song{artist.totalSongs !== 1 ? 's' : ''}
          </p>

          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => {
              if (artistSongs.length > 0) setQueue(artistSongs, 0, artist.name);
            }}
            className="flex items-center gap-2 px-6 py-2.5 bg-primary rounded-button text-sm font-semibold text-zinc-950 shadow-glow hover:bg-primary-hover transition-colors"
          >
            <Play size={16} fill="currentColor" />
            Play All
          </motion.button>
        </div>
      </div>

      {/* Albums */}
      {artistAlbums.length > 0 && (
        <div className="mb-8">
          <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
            <Disc3 size={18} className="text-primary" />
            Albums
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-5">
            {artistAlbums.map((album) => {
              const coverSrc = album.coverPath
                ? `local-image://${encodeURIComponent(album.coverPath)}`
                : '/default-cover.png';

              return (
                <motion.div
                  key={album.id}
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={() => navigate(`/albums/${album.id}`)}
                  className="group cursor-pointer"
                >
                  <div className="relative rounded-card overflow-hidden aspect-square mb-3 shadow-glass">
                    <img src={coverSrc} alt={album.name} className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all duration-300 flex items-center justify-center">
                      <div className="w-12 h-12 rounded-full bg-primary flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-glow-lg">
                        <Play size={20} fill="white" className="text-white ml-0.5" />
                      </div>
                    </div>
                  </div>
                  <p className="text-sm font-semibold truncate">{album.name}</p>
                  <p className="text-xs text-text/30 mt-0.5">
                    {album.year || 'Unknown Year'} • {album.trackCount} tracks
                  </p>
                </motion.div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
