import { useLibraryStore, usePlayerStore, usePlaylistStore } from '@/stores';
import { motion } from 'framer-motion';
import { Play, Disc3, Music, ListMusic } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { Song, Album, Playlist } from '@/types';
import { getImageUrl } from '@/utils';

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.07 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 18 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.35 } },
};

export function HomePage() {
  const { songs, albums, artists } = useLibraryStore();
  const { playlists } = usePlaylistStore();
  const { setQueue, currentSong, isPlaying, setIsPlaying } = usePlayerStore();
  const navigate = useNavigate();

  const recentlyAdded = [...songs].sort((a, b) => b.addedAt - a.addedAt).slice(0, 10);
  const topAlbums = albums.slice(0, 10);
  const topArtists = artists.slice(0, 10);

  const handlePlaySong = (song: Song) => {
    if (currentSong?.id === song.id) {
      setIsPlaying(!isPlaying);
      window.dispatchEvent(new CustomEvent('player:toggle'));
    } else {
      const idx = recentlyAdded.findIndex((s) => s.id === song.id);
      setQueue(recentlyAdded, idx >= 0 ? idx : 0);
    }
  };

  const handlePlayAlbum = (album: Album) => {
    const albumSongs = useLibraryStore.getState().getAlbumSongs(album.id);
    if (albumSongs.length > 0) setQueue(albumSongs, 0);
  };

  const handlePlayPlaylist = (playlist: Playlist) => {
    const playlistSongs = playlist.songIds
      .map((id) => useLibraryStore.getState().getSongById(id))
      .filter((s): s is Song => s !== undefined);
    if (playlistSongs.length > 0) setQueue(playlistSongs, 0);
  };

  if (songs.length === 0) {
    return <EmptyLibrary />;
  }

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-10 pb-4"
    >
      {/* Hero — Now Playing banner */}
      {currentSong && (
        <motion.div variants={itemVariants}>
          <HeroSection song={currentSong} />
        </motion.div>
      )}

      {/* Your Playlists (Quick Picks replacement) */}
      {playlists.length > 0 && (
        <motion.div variants={itemVariants}>
          <SectionHeader title="Your Playlists" onSeeAll={() => navigate('/playlists')} />
          <div className="flex gap-4 mt-4 overflow-x-auto pb-2 scrollbar-none">
            {playlists.map((playlist) => (
              <PlaylistCard
                key={playlist.id}
                playlist={playlist}
                onPlay={() => handlePlayPlaylist(playlist)}
                onClick={() => navigate(`/playlists/${playlist.id}`)}
              />
            ))}
          </div>
        </motion.div>
      )}

      {/* Recently Added */}
      {recentlyAdded.length > 0 && (
        <motion.div variants={itemVariants}>
          <SectionHeader title="Recently Added" />
          <div className="flex gap-4 mt-4 overflow-x-auto pb-2 scrollbar-none">
            {recentlyAdded.map((song) => (
              <SongCard
                key={song.id}
                song={song}
                onPlay={() => handlePlaySong(song)}
                isPlaying={currentSong?.id === song.id && isPlaying}
              />
            ))}
          </div>
        </motion.div>
      )}

      {/* Albums */}
      {topAlbums.length > 0 && (
        <motion.div variants={itemVariants}>
          <SectionHeader title="Albums" onSeeAll={() => navigate('/albums')} />
          <div className="flex gap-4 mt-4 overflow-x-auto pb-2 scrollbar-none">
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
          <SectionHeader title="Artists" onSeeAll={() => navigate('/artists')} />
          <div className="flex gap-5 mt-4 overflow-x-auto pb-2 scrollbar-none">
            {topArtists.map((artist) => (
              <motion.div
                key={artist.id}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => navigate(`/artists/${artist.id}`)}
                className="flex flex-col items-center gap-2 cursor-pointer shrink-0"
              >
                <div className="w-32 h-32 rounded-full glass flex items-center justify-center overflow-hidden ring-2 ring-white/5">
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
                    <Music size={36} className="text-text/20" />
                  )}
                </div>
                <p className="text-xs font-semibold text-center w-32 truncate">{artist.name}</p>
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

// ─── Sub-components ──────────────────────────────────────

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
        Add a music folder to start building your library. LocalSpo will scan and organize everything
        for you.
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
        className="px-6 py-3 bg-primary rounded-button text-sm font-semibold text-zinc-950 shadow-glow hover:bg-primary-hover transition-colors"
      >
        Add Music Folder
      </motion.button>
    </div>
  );
}

function HeroSection({ song }: { song: Song }) {
  const coverSrc = song.coverPath ? getImageUrl(song.coverPath) : '/default-cover.png';

  return (
    <div className="relative rounded-3xl overflow-hidden h-44 glass">
      <img
        src={coverSrc}
        alt=""
        className="absolute inset-0 w-full h-full object-cover opacity-25 blur-2xl scale-110"
        onError={(e) => {
          (e.target as HTMLImageElement).src = '/default-cover.png';
        }}
      />
      <div className="absolute inset-0 bg-gradient-to-r from-bg/90 via-bg/60 to-transparent" />
      <div className="relative flex items-center gap-6 p-6 h-full">
        <img
          src={coverSrc}
          alt={song.album}
          className="w-28 h-28 rounded-2xl object-cover shadow-xl shrink-0"
          onError={(e) => {
            (e.target as HTMLImageElement).src = '/default-cover.png';
          }}
        />
        <div>
          <p className="text-[10px] uppercase tracking-widest text-primary font-semibold mb-1">
            Now Playing
          </p>
          <h1 className="text-xl font-bold text-text mb-1 truncate max-w-xs">{song.title}</h1>
          <p className="text-sm text-text/50">
            {song.artist} — {song.album}
          </p>
        </div>
      </div>
    </div>
  );
}

function SectionHeader({ title, onSeeAll }: { title: string; onSeeAll?: () => void }) {
  return (
    <div className="flex items-center justify-between">
      <h2 className="text-xl font-bold text-text">{title}</h2>
      {onSeeAll && (
        <button
          onClick={onSeeAll}
          className="text-xs text-text/40 hover:text-primary transition-colors font-semibold"
        >
          See all
        </button>
      )}
    </div>
  );
}

// ─── Playlist Card ───────────────────────────────────────

interface PlaylistCardProps {
  playlist: Playlist;
  onPlay: () => void;
  onClick: () => void;
}

function PlaylistCard({ playlist, onPlay, onClick }: PlaylistCardProps) {
  const coverSrc = playlist.coverPath
    ? `local-image://${encodeURIComponent(playlist.coverPath)}`
    : null;

  return (
    <motion.div
      whileHover={{ scale: 1.03 }}
      whileTap={{ scale: 0.97 }}
      onClick={onClick}
      className="group cursor-pointer shrink-0 w-44"
    >
      <div className="relative rounded-xl overflow-hidden aspect-square mb-3 bg-white/[0.04] border border-white/5">
        {coverSrc ? (
          <img
            src={coverSrc}
            alt={playlist.name}
            className="w-full h-full object-cover"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = 'none';
            }}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <ListMusic size={40} className="text-text/15" />
          </div>
        )}
        {/* Play overlay */}
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all duration-200 flex items-end justify-end p-3">
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={(e) => {
              e.stopPropagation();
              onPlay();
            }}
            className="w-11 h-11 rounded-full bg-primary flex items-center justify-center shadow-glow opacity-0 group-hover:opacity-100 translate-y-2 group-hover:translate-y-0 transition-all duration-200"
          >
            <Play size={18} fill="currentColor" className="text-zinc-950 ml-0.5" />
          </motion.button>
        </div>
      </div>
      <p className="text-sm font-semibold truncate">{playlist.name}</p>
      <p className="text-xs text-text/35 mt-0.5">
        {playlist.songIds.length} song{playlist.songIds.length !== 1 ? 's' : ''}
      </p>
    </motion.div>
  );
}

// ─── Song Card ───────────────────────────────────────────

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
      className="group cursor-pointer shrink-0 w-40"
    >
      <div className="relative rounded-xl overflow-hidden aspect-square mb-3 shadow-md">
        <img
          src={coverSrc}
          alt={song.album}
          className="w-full h-full object-cover"
          onError={(e) => {
            (e.target as HTMLImageElement).src = '/default-cover.png';
          }}
        />
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all duration-200 flex items-end justify-end p-3">
          <motion.div
            className="w-10 h-10 rounded-full bg-primary flex items-center justify-center shadow-glow opacity-0 group-hover:opacity-100 translate-y-2 group-hover:translate-y-0 transition-all duration-200"
          >
            {isPlaying ? (
              <div className="flex gap-0.5 items-end h-4 px-1">
                {[1, 2, 3].map((i) => (
                  <motion.div
                    key={i}
                    className="w-0.5 bg-zinc-950 rounded-full"
                    animate={{ height: ['30%', '100%', '30%'] }}
                    transition={{ duration: 0.8, repeat: Infinity, delay: i * 0.15 }}
                  />
                ))}
              </div>
            ) : (
              <Play size={16} fill="currentColor" className="text-zinc-950 ml-0.5" />
            )}
          </motion.div>
        </div>
      </div>
      <p className="text-sm font-semibold truncate">{song.title}</p>
      <p className="text-xs text-text/40 truncate">{song.artist}</p>
    </motion.div>
  );
}

// ─── Album Card ──────────────────────────────────────────

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
      className="group cursor-pointer shrink-0 w-40"
    >
      <div className="relative rounded-xl overflow-hidden aspect-square mb-3 shadow-md">
        <img
          src={coverSrc}
          alt={album.name}
          className="w-full h-full object-cover"
          onError={(e) => {
            (e.target as HTMLImageElement).src = '/default-cover.png';
          }}
        />
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all duration-200 flex items-end justify-end p-3">
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={(e) => {
              e.stopPropagation();
              onPlay();
            }}
            className="w-10 h-10 rounded-full bg-primary flex items-center justify-center shadow-glow opacity-0 group-hover:opacity-100 translate-y-2 group-hover:translate-y-0 transition-all duration-200"
          >
            <Play size={16} fill="currentColor" className="text-zinc-950 ml-0.5" />
          </motion.button>
        </div>
      </div>
      <p className="text-sm font-semibold truncate">{album.name}</p>
      <p className="text-xs text-text/40 truncate">{album.artist}</p>
    </motion.div>
  );
}

// Import for Disc3 kept for future use
export { Disc3 };
