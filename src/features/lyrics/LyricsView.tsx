import { useEffect, useState, useRef, useMemo } from 'react';
import { usePlayerStore, useSettingsStore } from '@/stores';
import { motion } from 'framer-motion';
import { parseLyrics, findCurrentLyricIndex } from '@/services/lyricsParser';
import type { LyricsData } from '@/types';
import { Mic } from 'lucide-react';

export function LyricsView() {
  const { currentSong, currentTime } = usePlayerStore();
  const { seekByLyricsEnabled } = useSettingsStore();
  const [lyrics, setLyrics] = useState<LyricsData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const lineRefs = useRef<Map<number, HTMLDivElement>>(new Map());

  // Load lyrics when song changes
  useEffect(() => {
    if (!currentSong) {
      setLyrics(null);
      return;
    }

    let cancelled = false;
    lineRefs.current.clear();

    const loadLyrics = async () => {
      setIsLoading(true);
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
          setLyrics(parseLyrics(result.content));
        } else {
          setLyrics(null);
        }
      } catch {
        if (!cancelled) setLyrics(null);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    loadLyrics();

    return () => {
      cancelled = true;
    };
  }, [currentSong?.id]);

  // Find current lyric index
  const currentIndex = useMemo(() => {
    if (!lyrics?.synced) return -1;
    return findCurrentLyricIndex(lyrics.lines, currentTime);
  }, [lyrics, currentTime]);

  // Auto-scroll to current lyric line
  useEffect(() => {
    if (currentIndex < 0 || !lyrics?.synced) return;

    const element = lineRefs.current.get(currentIndex);
    if (element && containerRef.current) {
      const container = containerRef.current;
      const containerHeight = container.clientHeight;
      const elementTop = element.offsetTop;
      
      // Place active line at ~35% from the top (matches Spotify style)
      const scrollTarget = elementTop - containerHeight * 0.35;

      container.scrollTo({
        top: Math.max(0, scrollTarget),
        behavior: 'smooth',
      });
    }
  }, [currentIndex, lyrics?.synced]);

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 overflow-y-auto select-none scrollbar-none flex flex-col bg-zinc-950"
    >
      <div className="flex-1 flex flex-col min-h-0 relative">
        {/* Lyrics Content Container */}
        <div className="w-full max-w-4xl mx-auto px-8 md:px-16 pt-[25vh] pb-[45vh] relative z-10">
          
          {/* Loading state */}
          {isLoading && (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <div className="flex items-center gap-1.5">
                {[0, 1, 2].map((i) => (
                  <motion.div
                    key={i}
                    className="w-2 h-2 rounded-full bg-white/40"
                    animate={{ opacity: [0.3, 1, 0.3], scale: [0.8, 1.2, 0.8] }}
                    transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.2 }}
                  />
                ))}
              </div>
              <p className="text-xs text-white/40">Loading lyrics...</p>
            </div>
          )}

          {/* Empty state */}
          {!isLoading && !lyrics && (
            <div className="flex flex-col items-center justify-center py-20 text-center gap-4">
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center bg-white/[0.04] border border-white/5">
                <Mic size={28} className="text-white/20" />
              </div>
              <div>
                <p className="text-lg font-bold text-white/45">No lyrics available</p>
                <p className="text-sm mt-1.5 text-white/30">
                  {currentSong ? `${currentSong.artist} — ${currentSong.title}` : ''}
                </p>
              </div>
            </div>
          )}

          {/* Synced lyrics */}
          {!isLoading && lyrics?.synced && (
            <div className="space-y-7 md:space-y-9">
              {lyrics.lines.map((line, index) => {
                const isActive = index === currentIndex;
                const isPast = currentIndex >= 0 && index < currentIndex;

                // Calm monochrome text styling:
                // Active line is fully opaque white.
                // Inactive/past lines are faded dark gray (matching Spotify's contrast layout).
                const textColorClass = isActive ? 'text-white' : 'text-zinc-600';
                const opacityValue = isActive ? 1 : isPast ? 0.65 : 0.85;

                return (
                  <div
                    key={`${line.time}-${index}`}
                    ref={(el) => {
                      if (el) lineRefs.current.set(index, el);
                    }}
                    className={`transition-all duration-300 transform origin-left ${
                      seekByLyricsEnabled ? 'cursor-pointer hover:scale-[1.015]' : 'cursor-default'
                    }`}
                    onClick={() => {
                      if (!seekByLyricsEnabled) return;
                      console.log('[LyricsView] Line clicked. Seek to:', line.time);
                      const duration = usePlayerStore.getState().duration;
                      const seekTime = Math.max(0, Math.min(line.time, duration - 1.5));
                      usePlayerStore.getState().setCurrentTime(seekTime);
                      window.dispatchEvent(new CustomEvent('player:seek', { detail: seekTime }));
                    }}
                  >
                    <motion.p
                      animate={{
                        opacity: opacityValue,
                        scale: isActive ? 1.025 : 1.0,
                      }}
                      transition={{ duration: 0.3, ease: 'easeOut' }}
                      className={`text-2xl md:text-4xl font-extrabold tracking-tight leading-snug ${textColorClass}`}
                      style={{
                        textShadow: isActive ? '0 4px 20px rgba(255,255,255,0.08)' : 'none',
                      }}
                    >
                      {line.text || '♪'}
                    </motion.p>
                  </div>
                );
              })}
            </div>
          )}

          {/* Plain (unsynced) lyrics */}
          {!isLoading && lyrics && !lyrics.synced && (
            <div className="space-y-4 md:space-y-5 text-center">
              {lyrics.lines.map((line, index) => (
                <p
                  key={index}
                  className="text-xl md:text-2xl font-bold leading-relaxed text-white/70"
                >
                  {line.text || <>&nbsp;</>}
                </p>
              ))}
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
