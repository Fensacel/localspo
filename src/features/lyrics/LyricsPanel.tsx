import { useEffect, useState, useRef, useMemo } from 'react';
import { usePlayerStore, useSettingsStore } from '@/stores';
import { motion, AnimatePresence } from 'framer-motion';
import { parseLyrics, findCurrentLyricIndex } from '@/services/lyricsParser';
import type { LyricsData } from '@/types';
import { Mic2 } from 'lucide-react';

import { RomanizationService } from '@/modules/romanization/RomanizationService';

export function LyricsPanel() {
  const { currentSong, currentTime, showLyrics } = usePlayerStore();
  const { seekByLyricsEnabled, lyricsDisplayMode, updateSettings } = useSettingsStore();
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
        const timeoutPromise = new Promise<null>((resolve) =>
          setTimeout(() => resolve(null), 15000)
        );

        const result = await Promise.race([
          window.electronAPI.lyrics.read(
            currentSong.id,
            currentSong.path,
            currentSong.lrcPath,
            currentSong.hasEmbeddedLyrics,
            currentSong.artist,
            currentSong.title,
            currentSong.album,
            currentSong.duration
          ),
          timeoutPromise,
        ]);

        if (cancelled) return;

        if (result && result.content) {
          const parsed = parseLyrics(result.content, currentSong.artist);
          setLyrics(parsed);
          RomanizationService.clearCache(currentSong.id);
          RomanizationService.processLyrics(parsed, currentSong.id, true).then((processed) => {
            if (!cancelled && processed) setLyrics(processed);
          });
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

  // Auto-scroll to current lyric
  useEffect(() => {
    if (currentIndex < 0 || !lyrics?.synced) return;

    const element = lineRefs.current.get(currentIndex);
    if (element && containerRef.current) {
      const container = containerRef.current;
      const containerHeight = container.clientHeight;
      // offsetTop is relative to the container (which has position:relative)
      const elementTop = element.offsetTop;
      // Place active line at ~38% from top (not exact center, so past lines still visible)
      const scrollTarget = elementTop - containerHeight * 0.38;

      container.scrollTo({
        top: Math.max(0, scrollTarget), // never go negative (first lines stay at top)
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

          {/* Loading state */}
          {isLoading && (
            <div className="flex flex-col items-center justify-center h-full gap-3">
              <div className="flex items-center gap-1.5">
                {[0, 1, 2].map((i) => (
                  <motion.div
                    key={i}
                    className="w-1.5 h-1.5 rounded-full bg-primary/60"
                    animate={{ opacity: [0.3, 1, 0.3], scale: [0.8, 1.2, 0.8] }}
                    transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.2 }}
                  />
                ))}
              </div>
              <p className="text-xs text-text/30">Searching lyrics...</p>
            </div>
          )}

          {/* Empty state */}
          {!isLoading && !lyrics && (
            <div className="flex flex-col items-center justify-center h-full text-center gap-3">
              <div className="w-14 h-14 rounded-2xl bg-white/[0.03] border border-white/5 flex items-center justify-center">
                <Mic2 size={24} className="text-text/15" />
              </div>
              <div>
                <p className="text-sm font-medium text-text/25">No lyrics found</p>
                <p className="text-xs text-text/15 mt-1">
                  {currentSong ? `${currentSong.artist} — ${currentSong.title}` : ''}
                </p>
              </div>
            </div>
          )}

          {/* Mode Selector Tab */}
          {!isLoading && lyrics && lyrics.lines.some(l => l.romanization) && (
            <div className="flex items-center justify-center pt-2 pb-4">
              <div className="inline-flex items-center p-0.5 rounded-lg bg-white/[0.06] border border-white/10">
                {(['original', 'romanized', 'both'] as const).map((mode) => (
                  <button
                    key={mode}
                    onClick={() => updateSettings({ lyricsDisplayMode: mode })}
                    className={`px-2.5 py-1 rounded-md text-[11px] font-semibold capitalize transition-all duration-200 ${
                      (lyricsDisplayMode || 'both') === mode
                        ? 'bg-white text-black shadow-sm'
                        : 'text-white/60 hover:text-white'
                    }`}
                  >
                    {mode === 'original' ? 'Original' : mode === 'romanized' ? 'Romanization' : 'Both'}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Synced lyrics */}
          {!isLoading && lyrics?.synced && (
            <div className="space-y-6 pt-4 pb-40">
              {lyrics.lines.map((line, index) => {
                const isActive = index === currentIndex;
                const isPast = currentIndex >= 0 && index < currentIndex;
                const mode = lyricsDisplayMode || 'both';

                const displayText = mode === 'romanized'
                  ? (line.romanization || line.text)
                  : line.text;

                const showSubRomanization = mode === 'both' && !!line.romanization;

                return (
                  <div
                    key={`${line.time}-${index}`}
                    ref={(el) => {
                      if (el) lineRefs.current.set(index, el);
                    }}
                    className={`space-y-1 ${seekByLyricsEnabled ? 'cursor-pointer' : 'cursor-default'}`}
                    onClick={() => {
                      if (seekByLyricsEnabled === false) return;
                      usePlayerStore.getState().setCurrentTime(line.time);
                      window.dispatchEvent(new CustomEvent('player:seek', { detail: line.time }));
                    }}
                  >
                    {/* Primary Line */}
                    <motion.p
                      animate={{
                        fontSize: isActive ? '32px' : '22px',
                        fontWeight: isActive ? 800 : 600,
                        opacity: isActive ? 1 : isPast ? 0.22 : 0.38,
                        color: '#FFFFFF',
                      }}
                      transition={{ duration: 0.35, ease: 'easeOut' }}
                      className="leading-snug font-sans"
                    >
                      {displayText || '♪'}
                    </motion.p>

                    {/* Sub Romanization Line (Both mode) */}
                    {showSubRomanization && (
                      <motion.p
                        animate={{
                          fontSize: isActive ? '20px' : '15px',
                          fontWeight: 500,
                          opacity: isActive ? 0.82 : isPast ? 0.2 : 0.32,
                        }}
                        transition={{ duration: 0.35, ease: 'easeOut' }}
                        className="leading-snug text-white/70 font-sans"
                      >
                        {line.romanization}
                      </motion.p>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Plain (unsynced) lyrics */}
          {!isLoading && lyrics && !lyrics.synced && (
            <div className="space-y-3 py-8">
              {lyrics.lines.map((line, index) => (
                <p key={index} className="text-base text-text/60 leading-relaxed text-center">
                  {line.text || <>&nbsp;</>}
                </p>
              ))}
            </div>
          )}

        </div>
      </motion.div>
    </AnimatePresence>
  );
}
