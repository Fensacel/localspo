import { useLibraryStore, usePlayerStore } from '@/stores';
import { motion } from 'framer-motion';
import { Play, Disc3 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { Album } from '@/types';

export function AlbumsPage() {
  const { albums } = useLibraryStore();
  const navigate = useNavigate();

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Albums</h1>
        <p className="text-sm text-text/40 mt-1">
          {albums.length} album{albums.length !== 1 ? 's' : ''}
        </p>
      </div>

      <motion.div
        initial="hidden"
        animate="visible"
        variants={{
          hidden: { opacity: 0 },
          visible: { opacity: 1, transition: { staggerChildren: 0.04 } },
        }}
        className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-5"
      >
        {albums.map((album) => (
          <AlbumGridCard
            key={album.id}
            album={album}
            onClick={() => navigate(`/albums/${album.id}`)}
          />
        ))}
      </motion.div>

      {albums.length === 0 && (
        <div className="flex flex-col items-center justify-center h-[50vh]">
          <div className="w-24 h-24 glass rounded-2xl flex items-center justify-center mb-4">
            <Disc3 size={36} className="text-text/20" />
          </div>
          <p className="text-text/40 text-sm">No albums found</p>
        </div>
      )}
    </div>
  );
}

function AlbumGridCard({ album, onClick }: { album: Album; onClick: () => void }) {
  const { setQueue } = usePlayerStore();
  const coverSrc = album.coverPath
    ? `local-image://${encodeURIComponent(album.coverPath)}`
    : '/default-cover.png';

  const handlePlay = (e: React.MouseEvent) => {
    e.stopPropagation();
    const albumSongs = useLibraryStore.getState().getAlbumSongs(album.id);
    if (albumSongs.length > 0) setQueue(albumSongs, 0);
  };

  return (
    <motion.div
      variants={{
        hidden: { opacity: 0, y: 20 },
        visible: { opacity: 1, y: 0 },
      }}
      whileHover={{ scale: 1.03 }}
      whileTap={{ scale: 0.97 }}
      onClick={onClick}
      className="group cursor-pointer"
    >
      <div className="relative rounded-card overflow-hidden aspect-square mb-3 shadow-glass">
        <img
          src={coverSrc}
          alt={album.name}
          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
        />
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all duration-300 flex items-center justify-center">
          <motion.button
            initial={{ scale: 0, opacity: 0 }}
            whileHover={{ scale: 1.1 }}
            className="w-12 h-12 rounded-full bg-primary flex items-center justify-center opacity-0 group-hover:opacity-100 group-hover:scale-100 transition-all duration-300 shadow-glow-lg"
            onClick={handlePlay}
          >
            <Play size={20} fill="white" className="text-white ml-0.5" />
          </motion.button>
        </div>
      </div>
      <p className="text-sm font-semibold truncate">{album.name}</p>
      <p className="text-xs text-text/40 truncate mt-0.5">
        {album.artist} {album.year ? `• ${album.year}` : ''}
      </p>
    </motion.div>
  );
}
