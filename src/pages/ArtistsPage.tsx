import { useLibraryStore } from '@/stores';
import { motion } from 'framer-motion';
import { Mic2, Music } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export function ArtistsPage() {
  const { artists } = useLibraryStore();
  const navigate = useNavigate();

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Artists</h1>
        <p className="text-sm text-text/40 mt-1">
          {artists.length} artist{artists.length !== 1 ? 's' : ''}
        </p>
      </div>

      <motion.div
        initial="hidden"
        animate="visible"
        variants={{
          hidden: { opacity: 0 },
          visible: { opacity: 1, transition: { staggerChildren: 0.04 } },
        }}
        className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-6"
      >
        {artists.map((artist) => (
          <motion.div
            key={artist.id}
            variants={{
              hidden: { opacity: 0, y: 20 },
              visible: { opacity: 1, y: 0 },
            }}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => navigate(`/artists/${artist.id}`)}
            className="flex flex-col items-center gap-3 cursor-pointer group"
          >
            <div className="w-full aspect-square rounded-full glass overflow-hidden shadow-glass group-hover:glow-blue transition-shadow duration-300">
              {artist.coverPath ? (
                <img
                  src={`local-image://${encodeURIComponent(artist.coverPath)}`}
                  alt={artist.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <Mic2 size={40} className="text-text/15" />
                </div>
              )}
            </div>
            <div className="text-center">
              <p className="text-sm font-semibold truncate w-full">{artist.name}</p>
              <p className="text-xs text-text/30 mt-0.5">
                {artist.totalAlbums} album{artist.totalAlbums !== 1 ? 's' : ''} •{' '}
                {artist.totalSongs} song{artist.totalSongs !== 1 ? 's' : ''}
              </p>
            </div>
          </motion.div>
        ))}
      </motion.div>

      {artists.length === 0 && (
        <div className="flex flex-col items-center justify-center h-[50vh]">
          <div className="w-24 h-24 glass rounded-2xl flex items-center justify-center mb-4">
            <Music size={36} className="text-text/20" />
          </div>
          <p className="text-text/40 text-sm">No artists found</p>
        </div>
      )}
    </div>
  );
}
