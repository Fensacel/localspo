import { useEffect, useState, useRef, useMemo } from 'react';
import { usePlayerStore } from '@/stores';
import { motion, AnimatePresence } from 'framer-motion';
import { parseLyrics, findCurrentLyricIndex } from '@/services/lyricsParser';
import type { LyricsData } from '@/types';
import { Mic2 } from 'lucide-react';

export function LyricsPanel() {
  const { currentSong, currentTime, showLyrics } = usePlayerStore();
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

    const loadLyrics = async () => {
      setIsLoading(true);
      try {
        const result = await window.electronAPI.lyrics.read(
          currentSong.id,
          currentSong.lrcPath,
          currentSong.hasEmbeddedLyrics,
        );

        if (result) {
          const parsed = parseLyrics(result.content);
          setLyrics(parsed);
        } else {
          setLyrics(null);
        }
      } catch {
        setLyrics(null);
      } finally {
        setIsLoading(false);
      }
    };

    loadLyrics();
  }, [currentSong]);

  // Find current lyric index
  const currentIndex = useMemo(() => {
    if (!lyrics?.synced) return -1;
    return findCurrentLyricIndex(lyrics.lines, currentTime);
  }, [lyrics, currentTime]);

  // Auto-scroll to current lyric
  useEffect(() => {
    if (currentIndex < 0 || !lyrics?.synced) return;

    const element = lineRefs.current.get(currentIndex);
    if (element && containerRef.current) {
      const container = containerRef.current;
      const elementTop = element.offsetTop;
      const containerHeight = container.clientHeight;
      const scrollTarget = elementTop - containerHeight / 2 + element.clientHeight / 2;

      container.scrollTo({
        top: scrollTarget,
        behavior: 'smooth',
      });
    }
  }, [currentIndex, lyrics?.synced]);

  if (!showLyrics) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: 20 }}
        transition={{ duration: 0.25, ease: 'easeOut' }}
        className="w-[400px] h-full glass-heavy flex flex-col shrink-0"
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-white/5 flex items-center gap-2">
          <Mic2 size={16} className="text-primary" />
          <span className="text-sm font-semibold text-text/70">Lyrics</span>
        </div>

        {/* Lyrics content */}
        <div ref={containerRef} className="flex-1 overflow-y-auto px-5 py-8 relative">
          {isLoading && (
            <div className="flex items-center justify-center h-full">
              <div className="w-6 h-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
            </div>
          )}

          {!isLoading && !lyrics && (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <Mic2 size={32} className="text-text/10 mb-3" />
              <p className="text-sm text-text/25">No lyrics available</p>
            </div>
          )}

          {!isLoading && lyrics && lyrics.synced && (
            <div className="space-y-4 py-20">
              {lyrics.lines.map((line, index) => {
                const isActive = index === currentIndex;
                const isPast = currentIndex >= 0 && index < currentIndex;
                const isFuture = currentIndex >= 0 && index > currentIndex;

                return (
                  <div
                    key={`${line.time}-${index}`}
                    ref={(el) => {
                      if (el) lineRefs.current.set(index, el);
                    }}
                    className="cursor-pointer transition-all duration-300"
                    onClick={() => {
                      window.dispatchEvent(new CustomEvent('player:seek', { detail: line.time }));
                    }}
                  >
                    <motion.p
                      animate={{
                        fontSize: isActive ? '32px' : '20px',
                        fontWeight: isActive ? 700 : 600,
                        opacity: isActive ? 1 : isPast ? 0.3 : isFuture ? 0.4 : 0.5,
                        color: isActive ? '#FFFFFF' : '#94A3B8',
                      }}
                      transition={{ duration: 0.3, ease: 'easeOut' }}
                      className={`leading-relaxed ${isActive ? 'text-glow-blue' : ''}`}
                    >
                      {line.text}
                    </motion.p>
                  </div>
                );
              })}
            </div>
          )}

          {!isLoading && lyrics && !lyrics.synced && (
            <div className="space-y-3 py-8">
              {lyrics.lines.map((line, index) => (
                <p key={index} className="text-base text-text/60 leading-relaxed text-center">
                  {line.text}
                </p>
              ))}
            </div>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
