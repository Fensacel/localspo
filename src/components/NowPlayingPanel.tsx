import { usePlayerStore, useFavoritesStore } from '@/stores';
import { X, MoreHorizontal, Share2, Heart, CheckCircle2 } from 'lucide-react';
import { getImageUrl } from '@/utils';

interface NowPlayingPanelProps {
  onClose: () => void;
}

export function NowPlayingPanel({ onClose }: NowPlayingPanelProps) {
  const currentSong = usePlayerStore((s) => s.currentSong);
  const { isFavoriteSong, toggleFavoriteSong } = useFavoritesStore();

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



      </div>
    </div>
  );
}
