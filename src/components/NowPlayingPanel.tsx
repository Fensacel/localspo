import { useEffect, useState, useRef } from 'react';
import { usePlayerStore, useFavoritesStore, useSettingsStore } from '@/stores';
import { X, MoreHorizontal, Share2, Heart, CheckCircle2, SkipForward, Mic2, ExternalLink } from 'lucide-react';
import { getImageUrl } from '@/utils';
import { parseLyrics, findCurrentLyricIndex } from '@/services/lyricsParser';
import { RomanizationService } from '@/modules/romanization/RomanizationService';
import type { LyricsData } from '@/types';

interface NowPlayingPanelProps {
  onClose: () => void;
}

export function NowPlayingPanel({ onClose }: NowPlayingPanelProps) {
  const { currentSong, currentTime, queue, queueIndex, playNext } = usePlayerStore();
  const { isFavoriteSong, toggleFavoriteSong } = useFavoritesStore();
  const { lyricsDisplayMode } = useSettingsStore();

  const [lyrics, setLyrics] = useState<LyricsData | null>(null);
  const [lyricsLoading, setLyricsLoading] = useState(false);
  const lyricsContainerRef = useRef<HTMLDivElement>(null);

  // Load lyrics when song changes
  useEffect(() => {
    if (!currentSong) {
      setLyrics(null);
      return;
    }

    let cancelled = false;
    const loadLyrics = async () => {
      setLyricsLoading(true);
      setLyrics(null);

      try {
        const result = await window.electronAPI.lyrics.read(
          currentSong.id,
          currentSong.path,
          currentSong.lrcPath,
          currentSong.hasEmbeddedLyrics,
          currentSong.artist,
          currentSong.title,
          currentSong.album,
          currentSong.duration,
        );

        if (cancelled) return;

        if (result) {
          const parsed = parseLyrics(result.content);
          const processed = await RomanizationService.processLyrics(parsed, currentSong.id);
          if (!cancelled) setLyrics(processed);
        }
      } catch (err) {
        console.warn('[NowPlayingPanel] Failed to load lyrics:', err);
      } finally {
        if (!cancelled) setLyricsLoading(false);
      }
    };

    loadLyrics();

    return () => {
      cancelled = true;
    };
  }, [currentSong?.id]);

  if (!currentSong) return null;

  const coverSrc = currentSong.coverPath ? getImageUrl(currentSong.coverPath) : '/default-cover.png';
  const isFav = isFavoriteSong(currentSong.id);

  // Next in queue
  const nextSong = queueIndex >= 0 && queueIndex < queue.length - 1 ? queue[queueIndex + 1] : null;

  // Active lyric index
  const activeIndex = lyrics ? findCurrentLyricIndex(lyrics.lines, currentTime) : -1;

  // Scroll active lyric line into view in the side panel
  useEffect(() => {
    if (lyricsContainerRef.current && activeIndex >= 0) {
      const activeEl = lyricsContainerRef.current.children[activeIndex] as HTMLElement;
      if (activeEl) {
        lyricsContainerRef.current.scrollTo({
          top: activeEl.offsetTop - 40,
          behavior: 'smooth',
        });
      }
    }
  }, [activeIndex, lyrics]);

  const handleLyricsClick = () => {
    usePlayerStore.getState().toggleLyrics();
  };

  return (
    <div className="h-full flex flex-col bg-zinc-950 text-text select-none border-l border-white/5">
      {/* Header */}
      <div className="px-5 py-4 flex items-center justify-between border-b border-white/5">
        <span className="text-xs font-bold tracking-wider uppercase text-text/50 truncate pr-4">
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
      <div className="flex-1 overflow-y-auto p-4 space-y-5 scrollbar-none pb-24">
        
        {/* Large Cover Art */}
        <div className="relative aspect-square w-full rounded-2xl overflow-hidden shadow-2xl bg-zinc-900 group">
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

        {/* Syncing Lyrics Card */}
        {!lyricsLoading && lyrics && (
          <div 
            onClick={handleLyricsClick}
            className="bg-primary/10 hover:bg-primary/15 border border-primary/20 hover:border-primary/30 rounded-2xl p-4 cursor-pointer transition-all duration-300 group"
          >
            <div className="flex items-center justify-between mb-3 text-primary">
              <span className="text-xs font-bold uppercase tracking-wider flex items-center gap-1.5">
                <Mic2 size={14} />
                Lyrics
              </span>
              <span className="text-[10px] text-primary/60 group-hover:text-primary transition-colors flex items-center gap-0.5">
                Fullscreen
                <ExternalLink size={10} className="ml-1" />
              </span>
            </div>
            <div 
              ref={lyricsContainerRef}
              className="max-h-[140px] overflow-y-auto space-y-3 scrollbar-none pr-1 select-none pointer-events-none"
            >
              {lyrics.lines.map((line, index) => {
                const isActive = index === activeIndex;
                const mode = lyricsDisplayMode || 'both';
                const displayText = mode === 'romanized' ? (line.romanization || line.text) : line.text;
                
                return (
                  <p 
                    key={index}
                    className={`text-sm font-bold tracking-tight leading-snug transition-all duration-300 ${
                      isActive 
                        ? 'text-white scale-[1.02] origin-left' 
                        : 'text-white/40'
                    }`}
                  >
                    {displayText}
                  </p>
                );
              })}
            </div>
          </div>
        )}

        {/* Next Up Card */}
        {nextSong && (
          <div className="bg-white/[0.03] border border-white/5 rounded-2xl p-4">
            <span className="text-xs font-bold text-text/40 uppercase tracking-wider block mb-3">
              Next in Queue
            </span>
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <img 
                  src={nextSong.coverPath ? getImageUrl(nextSong.coverPath) : '/default-cover.png'}
                  alt={nextSong.title}
                  className="w-12 h-12 rounded-lg object-cover bg-zinc-800"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = '/default-cover.png';
                  }}
                />
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-text truncate">
                    {nextSong.title}
                  </p>
                  <p className="text-xs text-text/50 truncate mt-0.5">
                    {nextSong.artist}
                  </p>
                </div>
              </div>
              <button 
                onClick={playNext}
                className="w-9 h-9 rounded-full bg-white/5 hover:bg-white/10 text-text/80 hover:text-text flex items-center justify-center shrink-0 transition-colors"
                title="Skip Next"
              >
                <SkipForward size={16} />
              </button>
            </div>
          </div>
        )}

        {/* About the Artist Card */}
        <div className="bg-white/[0.03] border border-white/5 rounded-2xl overflow-hidden group/artist">
          <div className="relative h-28 bg-zinc-900 overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/40 to-transparent z-10" />
            <img 
              src={coverSrc}
              alt=""
              className="w-full h-full object-cover blur-md scale-110 opacity-40"
            />
            <div className="absolute bottom-3 left-4 z-20">
              <span className="text-[10px] font-bold uppercase tracking-wider text-text/50">
                Artist
              </span>
              <h3 className="text-base font-bold text-white mt-0.5 group-hover/artist:underline cursor-pointer">
                {currentSong.artist}
              </h3>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
