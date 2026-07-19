import { usePlayerStore, useFavoritesStore } from '@/stores';
import { X, MoreHorizontal, Share2, Heart, CheckCircle2 } from 'lucide-react';
import { getImageUrl } from '@/utils';
import { useState, useMemo } from 'react';

interface NowPlayingPanelProps {
  onClose: () => void;
}

export function NowPlayingPanel({ onClose }: NowPlayingPanelProps) {
  const currentSong = usePlayerStore((s) => s.currentSong);
  const { isFavoriteSong, toggleFavoriteSong } = useFavoritesStore();
  const [isFollowing, setIsFollowing] = useState(false);

  // Generate deterministic monthly listeners based on artist name
  const monthlyListeners = useMemo(() => {
    if (!currentSong) return '0 monthly listeners';
    const artist = currentSong.artist;
    let hash = 0;
    for (let i = 0; i < artist.length; i++) {
      hash = artist.charCodeAt(i) + ((hash << 5) - hash);
    }
    // Generate a number between 100k and 15M
    const count = Math.abs(hash % 14900000) + 100000;
    return count.toLocaleString('en-US') + ' monthly listeners';
  }, [currentSong?.artist]);

  // Dynamic bio description
  const artistBio = useMemo(() => {
    if (!currentSong) return '';
    const artist = currentSong.artist;
    return `${artist} is a featured artist in your music library. Explore their tracks, albums, and curated playlists within your local collections.`;
  }, [currentSong?.artist]);

  if (!currentSong) return null;

  const coverSrc = currentSong.coverPath ? getImageUrl(currentSong.coverPath) : '/default-cover.png';
  const isFav = isFavoriteSong(currentSong.id);

  return (
    <div className="h-full flex flex-col bg-zinc-950 text-text select-none">
      {/* Header */}
      <div className="px-5 py-4 flex items-center justify-between border-b border-white/5">
        <span className="text-sm font-bold tracking-wide truncate pr-4 text-text/80">
          {currentSong.album || 'Now Playing'}
        </span>
        <div className="flex items-center gap-1 shrink-0">
          <button className="w-8 h-8 rounded-full flex items-center justify-center text-text/60 hover:text-text hover:bg-white/5 transition-colors">
            <MoreHorizontal size={18} />
          </button>
          <button 
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-text/60 hover:text-text hover:bg-white/5 transition-colors"
          >
            <X size={18} />
          </button>
        </div>
      </div>

      {/* Panel Scroll Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-none">
        
        {/* Large Cover Art */}
        <div className="relative aspect-square w-full rounded-xl overflow-hidden shadow-2xl bg-zinc-900 group">
          <img 
            src={coverSrc} 
            alt={currentSong.album} 
            className="w-full h-full object-cover"
            onError={(e) => {
              (e.target as HTMLImageElement).src = '/default-cover.png';
            }}
          />
        </div>

        {/* Title and Artist Row */}
        <div className="flex items-start justify-between py-1">
          <div className="min-w-0 flex-1 pr-4">
            <h2 className="text-xl font-bold tracking-tight text-text truncate hover:underline cursor-pointer">
              {currentSong.title}
            </h2>
            <p className="text-sm text-text/65 mt-1 truncate hover:underline cursor-pointer">
              {currentSong.artist}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button className="w-8 h-8 rounded-full flex items-center justify-center text-text/60 hover:text-text hover:bg-white/5 transition-colors">
              <Share2 size={18} />
            </button>
            <button 
              onClick={() => toggleFavoriteSong(currentSong.id)}
              className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${
                isFav ? 'text-primary' : 'text-text/60 hover:text-text hover:bg-white/5'
              }`}
            >
              {isFav ? <CheckCircle2 size={18} fill="currentColor" className="text-zinc-950" /> : <Heart size={18} />}
            </button>
          </div>
        </div>

        {/* About the Artist Card */}
        <div className="bg-zinc-900/40 border border-white/5 rounded-2xl overflow-hidden">
          {/* Blurred Background Header */}
          <div className="h-28 w-full relative overflow-hidden bg-zinc-900">
            <img 
              src={coverSrc} 
              alt="" 
              className="w-full h-full object-cover filter blur-md opacity-40 scale-110"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-zinc-900/90 to-transparent" />
            <div className="absolute top-4 left-4">
              <span className="text-[10px] font-bold tracking-wider uppercase bg-white/10 px-2 py-0.5 rounded-full backdrop-blur-sm border border-white/5">
                About the artist
              </span>
            </div>
          </div>

          {/* Artist details */}
          <div className="p-4 space-y-4">
            <div>
              <div className="flex items-center gap-1.5">
                <h3 className="text-base font-bold hover:underline cursor-pointer">{currentSong.artist}</h3>
                <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-blue-500 text-white shadow-sm">
                  <CheckCircle2 size={10} fill="currentColor" className="text-blue-500 text-white" />
                </span>
              </div>
              <p className="text-xs text-text/50 mt-1">{monthlyListeners}</p>
            </div>

            {/* Truncated Bio */}
            <p className="text-xs text-text/60 leading-relaxed truncate-3-lines">
              {artistBio}
            </p>

            {/* Follow Button */}
            <button 
              onClick={() => setIsFollowing(!isFollowing)}
              className={`w-full py-2 rounded-full font-bold text-xs transition-all duration-200 ${
                isFollowing 
                  ? 'border border-white/20 text-white bg-transparent hover:bg-white/5' 
                  : 'bg-white text-black hover:bg-zinc-200'
              }`}
            >
              {isFollowing ? 'Following' : 'Follow'}
            </button>
          </div>
        </div>

        {/* Credits Card */}
        <div className="bg-zinc-900/40 border border-white/5 rounded-2xl p-4 space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold tracking-wider uppercase text-text/40">Credits</span>
            <button className="text-[10px] font-bold text-text/60 hover:text-text transition-colors">Show all</button>
          </div>
          
          <div className="flex items-center justify-between py-1">
            <div>
              <p className="text-sm font-semibold truncate hover:underline cursor-pointer">{currentSong.artist}</p>
              <p className="text-xs text-text/40 mt-0.5">Main Artist</p>
            </div>
            <button 
              onClick={() => setIsFollowing(!isFollowing)}
              className={`px-3 py-1.5 rounded-full font-bold text-[10px] border transition-all duration-200 ${
                isFollowing 
                  ? 'border-white/20 text-white hover:bg-white/5' 
                  : 'border-white/40 text-white hover:border-white hover:bg-white/5'
              }`}
            >
              {isFollowing ? 'Following' : 'Follow'}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
