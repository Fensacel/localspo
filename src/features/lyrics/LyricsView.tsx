import { useEffect, useState, useRef, useMemo } from 'react';
import { usePlayerStore, useSettingsStore } from '@/stores';
import { motion } from 'framer-motion';
import { parseLyrics, findCurrentLyricIndex } from '@/services/lyricsParser';
import type { LyricsData } from '@/types';
import { Mic } from 'lucide-react';

import { RomanizationService } from '@/modules/romanization/RomanizationService';

export function LyricsView() {
  const { currentSong, currentTime } = usePlayerStore();
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

          {/* Mode Selector Tab (Original | Romanization | Both) */}
          {!isLoading && lyrics && lyrics.lines.some(l => l.romanization) && (
            <div className="flex items-center justify-center mb-8 gap-2">
              <div className="inline-flex items-center p-1 rounded-xl bg-white/[0.06] border border-white/10 backdrop-blur-md">
                {(['original', 'romanized', 'both'] as const).map((mode) => (
                  <button
                    key={mode}
                    onClick={() => updateSettings({ lyricsDisplayMode: mode })}
                    className={`px-3 py-1 rounded-lg text-xs font-semibold capitalize transition-all duration-200 ${
                      (lyricsDisplayMode || 'both') === mode
                        ? 'bg-white text-black shadow-md'
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
            <div className="space-y-6 md:space-y-8">
              {lyrics.lines.map((line, index) => {
                const isActive = index === currentIndex;
                const isPast = currentIndex >= 0 && index < currentIndex;
                const mode = lyricsDisplayMode || 'both';

                const displayText = mode === 'romanized'
                  ? (line.romanization || line.text)
                  : line.text;

                const showSubRomanization = mode === 'both' && !!line.romanization;

                const tokens = displayText.split(/(\s+)/);
                let wordIndex = 0;

                return (
                  <div
                    key={`${line.time}-${index}`}
                    ref={(el) => {
                      if (el) lineRefs.current.set(index, el);
                    }}
                    className={`transition-all duration-300 transform origin-left space-y-1.5 ${
                      seekByLyricsEnabled ? 'cursor-pointer hover:scale-[1.015]' : 'cursor-default'
                    }`}
                    onClick={() => {
                      if (seekByLyricsEnabled === false) return;
                      usePlayerStore.getState().setCurrentTime(line.time);
                      window.dispatchEvent(new CustomEvent('player:seek', { detail: line.time }));
                    }}
                  >
                    {/* Primary Line */}
                    <motion.p
                      animate={{ opacity: isActive ? 1 : isPast ? 0.35 : 0.5, scale: isActive ? 1.02 : 1.0 }}
                      transition={{ duration: 0.35, ease: 'easeOut' }}
                      className={`font-extrabold tracking-tight leading-snug text-white ${
                        isActive ? 'text-3xl md:text-5xl' : 'text-xl md:text-3xl'
                      }`}
                      style={isActive ? { textShadow: '0 4px 20px rgba(255,255,255,0.08)' } : undefined}
                    >
                      {isActive ? (
                        tokens.map((token, tokenIdx) => {
                          const isWhitespace = token.trim().length === 0;
                          if (isWhitespace) return <span key={tokenIdx}>{token}</span>;
                          const wordObj = line.words ? line.words[wordIndex++] : null;
                          const wordStart = wordObj ? wordObj.startTime : line.time;
                          const isWordActive = currentTime >= wordStart;
                          return (
                            <motion.span
                              key={tokenIdx}
                              animate={{
                                color: isWordActive ? '#ffffff' : 'rgba(255, 255, 255, 0.35)',
                                textShadow: isWordActive ? '0 0 12px rgba(255, 255, 255, 0.4)' : 'none',
                              }}
                              transition={{ duration: 0.15 }}
                              className="inline-block"
                              onClick={(e) => {
                                if (seekByLyricsEnabled === false) return;
                                e.stopPropagation();
                                usePlayerStore.getState().setCurrentTime(wordStart);
                                window.dispatchEvent(new CustomEvent('player:seek', { detail: wordStart }));
                              }}
                            >
                              {token}
                            </motion.span>
                          );
                        })
                      ) : (
                        displayText || '♪'
                      )}
                    </motion.p>

                    {/* Sub Romanization Line (Both mode) */}
                    {showSubRomanization && (
                      <motion.p
                        animate={{ opacity: isActive ? 0.88 : isPast ? 0.3 : 0.45 }}
                        transition={{ duration: 0.35, ease: 'easeOut' }}
                        className={`font-semibold tracking-wide text-white/75 ${
                          isActive ? 'text-xl md:text-3xl' : 'text-base md:text-xl'
                        }`}
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
