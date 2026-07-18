import { useLibraryStore, usePlayerStore } from '@/stores';
import { motion } from 'framer-motion';
import { Play, Clock, Disc3, Music, Sparkles, RefreshCw } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Song, Album } from '@/types';
import { getImageUrl } from '@/utils';

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.06 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
};

export function HomePage() {
  const { songs, albums, artists } = useLibraryStore();
  const { setQueue, currentSong } = usePlayerStore();
  const navigate = useNavigate();

  const recentlyAdded = [...songs].sort((a, b) => b.addedAt - a.addedAt).slice(0, 8);

  const [randomPicks, setRandomPicks] = useState<Song[]>([]);

  // Local helper to save picks to localStorage
  const savePicks = (picks: Song[], dateStr: string, libSizeStr: string) => {
    const ids = picks.map((s) => s.id);
    localStorage.setItem('bluetune_quick_picks_ids', JSON.stringify(ids));
    localStorage.setItem('bluetune_quick_picks_date', dateStr);
    localStorage.setItem('bluetune_quick_picks_lib_size', libSizeStr);
  };

  // Local helper to select random picks
  const getRandomPicks = (songsList: Song[], count: number): Song[] => {
    const shuffled = [...songsList].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, Math.min(count, songsList.length));
  };

  useEffect(() => {
    if (songs.length === 0) return;

    const storedIds = localStorage.getItem('bluetune_quick_picks_ids');
    const storedDate = localStorage.getItem('bluetune_quick_picks_date');
    const storedLibSize = localStorage.getItem('bluetune_quick_picks_lib_size');

    const currentDateStr = new Date().toDateString();
    const currentLibSizeStr = songs.length.toString();

    let idsToUse: string[] = [];

    if (storedIds && storedDate === currentDateStr && storedLibSize === currentLibSizeStr) {
      try {
        idsToUse = JSON.parse(storedIds);
      } catch {
        idsToUse = [];
      }
    }

    let picks = idsToUse
      .map((id) => songs.find((s) => s.id === id))
      .filter((s): s is Song => s !== undefined);

    if (picks.length < Math.min(6, songs.length) && songs.length > 0) {
      picks = getRandomPicks(songs, 6);
      savePicks(picks, currentDateStr, currentLibSizeStr);
    }

    setRandomPicks(picks);
  }, [songs]);

  const handleRefreshPicks = () => {
    if (songs.length === 0) return;
    const picks = getRandomPicks(songs, 6);
    savePicks(picks, new Date().toDateString(), songs.length.toString());
    setRandomPicks(picks);
  };

  const topAlbums = albums.slice(0, 8);
  const topArtists = artists.slice(0, 6);

  const handlePlaySong = (song: Song, songList: Song[]) => {
    const index = songList.findIndex((s) => s.id === song.id);
    setQueue(songList, index);
  };

  const handlePlayAlbum = (album: Album) => {
    const albumSongs = useLibraryStore.getState().getAlbumSongs(album.id);
    if (albumSongs.length > 0) {
      setQueue(albumSongs, 0);
    }
  };

  if (songs.length === 0) {
    return <EmptyLibrary />;
  }

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-8"
    >
      {/* Hero */}
      {currentSong && (
        <motion.div variants={itemVariants}>
          <HeroSection song={currentSong} />
        </motion.div>
      )}

      {/* Quick Picks */}
      {randomPicks.length > 0 && (
        <motion.div variants={itemVariants}>
          <div className="flex items-center justify-between">
            <SectionHeader icon={Sparkles} title="Quick Picks" />
            <button
              onClick={handleRefreshPicks}
              className="px-2.5 py-1 rounded-lg glass text-text/55 hover:text-primary hover:bg-white/5 transition-all flex items-center gap-1.5 text-xs font-semibold"
              title="Refresh Quick Picks"
            >
              <RefreshCw size={12} />
              Refresh
            </button>
          </div>
          <div className="grid grid-cols-3 gap-3 mt-3">
            {randomPicks.map((song) => (
              <QuickPickCard
                key={song.id}
                song={song}
                onPlay={() => handlePlaySong(song, randomPicks)}
                isPlaying={currentSong?.id === song.id}
              />
            ))}
          </div>
        </motion.div>
      )}

      {/* Recently Added */}
      {recentlyAdded.length > 0 && (
        <motion.div variants={itemVariants}>
          <SectionHeader icon={Clock} title="Recently Added" />
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 mt-3">
            {recentlyAdded.map((song) => (
              <SongCard
                key={song.id}
                song={song}
                onPlay={() => handlePlaySong(song, recentlyAdded)}
                isPlaying={currentSong?.id === song.id}
              />
            ))}
          </div>
        </motion.div>
      )}

      {/* Top Albums */}
      {topAlbums.length > 0 && (
        <motion.div variants={itemVariants}>
          <SectionHeader icon={Disc3} title="Albums" onSeeAll={() => navigate('/albums')} />
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 mt-3">
            {topAlbums.map((album) => (
              <AlbumCard
                key={album.id}
                album={album}
                onPlay={() => handlePlayAlbum(album)}
                onClick={() => navigate(`/albums/${album.id}`)}
              />
            ))}
          </div>
        </motion.div>
      )}

      {/* Artists */}
      {topArtists.length > 0 && (
        <motion.div variants={itemVariants}>
          <SectionHeader icon={Music} title="Artists" onSeeAll={() => navigate('/artists')} />
          <div className="flex gap-4 mt-3 overflow-x-auto pb-2">
            {topArtists.map((artist) => (
              <motion.div
                key={artist.id}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => navigate(`/artists/${artist.id}`)}
                className="flex flex-col items-center gap-2 cursor-pointer shrink-0"
              >
                <div className="w-28 h-28 rounded-full glass flex items-center justify-center overflow-hidden">
                  {artist.coverPath ? (
                    <img
                      src={getImageUrl(artist.coverPath)}
                      alt={artist.name}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = 'none';
                      }}
                    />
                  ) : (
                    <Music size={32} className="text-text/20" />
                  )}
                </div>
                <p className="text-xs text-text/70 font-medium text-center w-28 truncate">
                  {artist.name}
                </p>
                <p className="text-[10px] text-text/30">
                  {artist.totalAlbums} album{artist.totalAlbums !== 1 ? 's' : ''}
                </p>
              </motion.div>
            ))}
          </div>
        </motion.div>
      )}
    </motion.div>
  );
}

// ─── Sub-components ─────────────────────────────────────

function EmptyLibrary() {
  return (
    <div className="flex flex-col items-center justify-center h-[60vh] text-center">
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 200, damping: 20 }}
        className="w-32 h-32 glass rounded-3xl flex items-center justify-center mb-6"
      >
        <Music size={48} className="text-primary/50" />
      </motion.div>
      <h2 className="text-2xl font-bold text-text mb-2">No Music Yet</h2>
      <p className="text-text/40 mb-6 max-w-sm">
        Add a music folder to start building your library. BlueTune will scan and organize
        everything for you.
      </p>
      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={async () => {
          const folder = await window.electronAPI.dialog.openFolder();
          if (folder) {
            window.dispatchEvent(new CustomEvent('scan-folder', { detail: folder }));
          }
        }}
        className="px-6 py-3 bg-primary rounded-button text-sm font-semibold text-white shadow-glow hover:bg-primary-hover transition-colors"
      >
        Add Music Folder
      </motion.button>
    </div>
  );
}

function HeroSection({ song }: { song: Song }) {
  const coverSrc = song.coverPath ? getImageUrl(song.coverPath) : '/default-cover.png';

  return (
    <div className="relative rounded-3xl overflow-hidden h-48 glass">
      <img
        src={coverSrc}
        alt=""
        className="absolute inset-0 w-full h-full object-cover opacity-30 blur-2xl scale-110"
        onError={(e) => {
          (e.target as HTMLImageElement).src = '/default-cover.png';
        }}
      />
      <div className="absolute inset-0 bg-gradient-to-r from-bg/90 via-bg/60 to-transparent" />
      <div className="relative flex items-center gap-6 p-6 h-full">
        <img
          src={coverSrc}
          alt={song.album}
          className="w-32 h-32 rounded-2xl object-cover shadow-xl"
          onError={(e) => {
            (e.target as HTMLImageElement).src = '/default-cover.png';
          }}
        />
        <div>
          <p className="text-[10px] uppercase tracking-widest text-primary font-semibold mb-1">
            Now Playing
          </p>
          <h1 className="text-2xl font-bold text-text mb-1">{song.title}</h1>
          <p className="text-sm text-text/50">
            {song.artist} — {song.album}
          </p>
        </div>
      </div>
    </div>
  );
}

interface SectionHeaderProps {
  icon: React.ElementType;
  title: string;
  onSeeAll?: () => void;
}

function SectionHeader({ icon: Icon, title, onSeeAll }: SectionHeaderProps) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <Icon size={18} className="text-primary" strokeWidth={1.8} />
        <h2 className="text-lg font-bold text-text">{title}</h2>
      </div>
      {onSeeAll && (
        <button
          onClick={onSeeAll}
          className="text-xs text-text/40 hover:text-primary transition-colors font-medium"
        >
          See All
        </button>
      )}
    </div>
  );
}

interface QuickPickCardProps {
  song: Song;
  onPlay: () => void;
  isPlaying: boolean;
}

function QuickPickCard({ song, onPlay, isPlaying }: QuickPickCardProps) {
  const coverSrc = song.coverPath ? getImageUrl(song.coverPath) : '/default-cover.png';

  return (
    <motion.div
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      onClick={onPlay}
      className={`flex items-center gap-3 p-2 rounded-xl cursor-pointer transition-colors ${
        isPlaying ? 'bg-primary/15 border border-primary/20' : 'glass hover:bg-white/5'
      }`}
    >
      <img
        src={coverSrc}
        alt={song.album}
        className="w-12 h-12 rounded-lg object-cover"
        onError={(e) => {
          (e.target as HTMLImageElement).src = '/default-cover.png';
        }}
      />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold truncate">{song.title}</p>
        <p className="text-xs text-text/40 truncate">{song.artist}</p>
      </div>
      {isPlaying ? (
        <div className="flex gap-0.5 items-end h-4">
          {[1, 2, 3].map((i) => (
            <motion.div
              key={i}
              className="w-0.5 bg-primary rounded-full"
              animate={{ height: ['30%', '100%', '30%'] }}
              transition={{
                duration: 0.8,
                repeat: Infinity,
                delay: i * 0.15,
              }}
            />
          ))}
        </div>
      ) : (
        <Play size={14} className="text-text/30 shrink-0" />
      )}
    </motion.div>
  );
}

interface SongCardProps {
  song: Song;
  onPlay: () => void;
  isPlaying: boolean;
}

function SongCard({ song, onPlay, isPlaying }: SongCardProps) {
  const coverSrc = song.coverPath ? getImageUrl(song.coverPath) : '/default-cover.png';

  return (
    <motion.div
      whileHover={{ scale: 1.03 }}
      whileTap={{ scale: 0.97 }}
      onClick={onPlay}
      className="group cursor-pointer"
    >
      <div className="relative rounded-card overflow-hidden aspect-square mb-3">
        <img
          src={coverSrc}
          alt={song.album}
          className="w-full h-full object-cover"
          onError={(e) => {
            (e.target as HTMLImageElement).src = '/default-cover.png';
          }}
        />
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center">
          <motion.div
            initial={{ scale: 0 }}
            whileHover={{ scale: 1 }}
            className="w-12 h-12 rounded-full bg-primary/90 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-glow-lg"
          >
            <Play size={20} fill="white" className="text-white ml-0.5" />
          </motion.div>
        </div>
        {isPlaying && (
          <div className="absolute bottom-2 right-2 flex gap-0.5 items-end h-4">
            {[1, 2, 3].map((i) => (
              <motion.div
                key={i}
                className="w-1 bg-primary rounded-full"
                animate={{ height: ['30%', '100%', '30%'] }}
                transition={{
                  duration: 0.8,
                  repeat: Infinity,
                  delay: i * 0.15,
                }}
              />
            ))}
          </div>
        )}
      </div>
      <p className="text-sm font-semibold truncate">{song.title}</p>
      <p className="text-xs text-text/40 truncate">{song.artist}</p>
    </motion.div>
  );
}

interface AlbumCardProps {
  album: Album;
  onPlay: () => void;
  onClick: () => void;
}

function AlbumCard({ album, onPlay, onClick }: AlbumCardProps) {
  const coverSrc = album.coverPath ? getImageUrl(album.coverPath) : '/default-cover.png';

  return (
    <motion.div
      whileHover={{ scale: 1.03 }}
      whileTap={{ scale: 0.97 }}
      onClick={onClick}
      className="group cursor-pointer"
    >
      <div className="relative rounded-card overflow-hidden aspect-square mb-3">
        <img
          src={coverSrc}
          alt={album.name}
          className="w-full h-full object-cover"
          onError={(e) => {
            (e.target as HTMLImageElement).src = '/default-cover.png';
          }}
        />
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center">
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={(e) => {
              e.stopPropagation();
              onPlay();
            }}
            className="w-12 h-12 rounded-full bg-primary/90 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-glow-lg"
          >
            <Play size={20} fill="white" className="text-white ml-0.5" />
          </motion.button>
        </div>
      </div>
      <p className="text-sm font-semibold truncate">{album.name}</p>
      <p className="text-xs text-text/40 truncate">{album.artist}</p>
    </motion.div>
  );
}
