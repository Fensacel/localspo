import { useEffect, useRef, useState } from 'react';
import { usePlayerStore, useFavoritesStore, useSettingsStore } from '@/stores';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronDown,
  Heart,
  Volume2,
  VolumeX,
  Mic2,
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Shuffle,
  Repeat,
  Repeat1,
  Minimize2,
} from 'lucide-react';
import { parseLyrics, findCurrentLyricIndex } from '@/services/lyricsParser';
import { RomanizationService } from '@/modules/romanization/RomanizationService';
import { formatTime, getImageUrl } from '@/utils';
import type { LyricsData } from '@/types';

// ─── Color extraction via canvas ────────────────────────
function extractColors(src: string): Promise<[[number, number, number], [number, number, number]]> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = 16;
        canvas.height = 16;
        const ctx = canvas.getContext('2d');
        if (!ctx) return resolve([[40, 40, 80], [80, 40, 120]]);
        ctx.drawImage(img, 0, 0, 16, 16);
        const data = ctx.getImageData(0, 0, 16, 16).data;
        let r1 = 0, g1 = 0, b1 = 0, c1 = 0;
        let r2 = 0, g2 = 0, b2 = 0, c2 = 0;
        for (let i = 0; i < data.length; i += 8) {
          if (i < data.length / 2) { r1 += data[i]; g1 += data[i+1]; b1 += data[i+2]; c1++; }
          else { r2 += data[i]; g2 += data[i+1]; b2 += data[i+2]; c2++; }
        }
        resolve([
          [Math.round(r1 / (c1 || 1)), Math.round(g1 / (c1 || 1)), Math.round(b1 / (c1 || 1))],
          [Math.round(r2 / (c2 || 1)), Math.round(g2 / (c2 || 1)), Math.round(b2 / (c2 || 1))],
        ]);
      } catch {
        resolve([[40, 40, 80], [80, 40, 120]]);
      }
    };
    img.onerror = () => resolve([[40, 40, 80], [80, 40, 120]]);
    img.src = src;
  });
}

// ─── Slider Component ────────────────────────────────────
interface SliderProps {
  value: number;       // 0–1
  onChange: (v: number) => void;
  onDragStart?: () => void;
  onDragEnd?: () => void;
  thin?: boolean;
}
function Slider({ value, onChange, onDragStart, onDragEnd, thin = false }: SliderProps) {
  const trackRef = useRef<HTMLDivElement>(null);

  const applyValue = (clientX: number) => {
    if (!trackRef.current) return;
    const rect = trackRef.current.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    onChange(pct);
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    if (onDragStart) onDragStart();
    applyValue(e.clientX);
    const onMove = (ev: PointerEvent) => applyValue(ev.clientX);
    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      if (onDragEnd) onDragEnd();
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  const h = thin ? 'h-[3px]' : 'h-[4px]';

  return (
    <div
      ref={trackRef}
      onPointerDown={handlePointerDown}
      className={`relative ${h} rounded-full bg-white/15 cursor-pointer group w-full`}
    >
      <div
        className={`absolute left-0 top-0 ${h} rounded-full bg-white/80 transition-none`}
        style={{ width: `${value * 100}%` }}
      />
      <div
        className="absolute top-1/2 -translate-y-1/2 w-3.5 h-3.5 rounded-full bg-white shadow-lg
                   opacity-0 group-hover:opacity-100 transition-opacity duration-150"
        style={{ left: `calc(${value * 100}% - 7px)` }}
      />
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────
export function NowPlayingOverlay() {
  const {
    currentSong,
    isPlaying,
    currentTime,
    duration,
    volume,
    isMuted,
    repeatMode,
    shuffleMode,
    showNowPlaying,
    setShowNowPlaying,
    setIsPlaying,
    setVolume,
    toggleRepeat,
    toggleShuffle,
    toggleMute,
  } = usePlayerStore();

  const { isFavoriteSong, toggleFavoriteSong } = useFavoritesStore();
  const { seekByLyricsEnabled, lyricsDisplayMode, updateSettings } = useSettingsStore();

  const showLyrics = true;
  const [lyrics, setLyrics] = useState<LyricsData | null>(null);
  const [isLoadingLyrics, setIsLoadingLyrics] = useState(false);
  const [isSeeking, setIsSeeking] = useState(false);
  const [localTime, setLocalTime] = useState(0);
  const [bgColors, setBgColors] = useState<[[number,number,number],[number,number,number]]>(
    [[20, 20, 40], [60, 20, 100]],
  );

  const lyricsContainerRef = useRef<HTMLDivElement>(null);
  const lyricLineRefs = useRef<Map<number, HTMLDivElement>>(new Map());

  // ── Extract album colors ──────────────────────────────
  useEffect(() => {
    const imgSrc = currentSong?.coverPath
      ? getImageUrl(currentSong.coverPath)
      : currentSong?.remoteCoverUrl || null;

    if (!imgSrc) {
      setBgColors([[20, 20, 40], [60, 20, 100]]);
      return;
    }
    extractColors(imgSrc)
      .then(setBgColors)
      .catch(() => setBgColors([[20, 20, 40], [60, 20, 100]]));
  }, [currentSong?.coverPath, currentSong?.remoteCoverUrl]);


  // ── Load lyrics ───────────────────────────────────────
  useEffect(() => {
    if (!currentSong) { setLyrics(null); return; }
    let cancelled = false;
    lyricLineRefs.current.clear();
    setIsLoadingLyrics(true);
    setLyrics(null);

    window.electronAPI.lyrics
      .read(
        currentSong.id,
        currentSong.path,
        currentSong.lrcPath,
        currentSong.hasEmbeddedLyrics,
        currentSong.artist,
        currentSong.title,
        currentSong.album,
        currentSong.duration,
      )
      .then(async (res: { source: string; content: string } | null) => {
        if (cancelled) return;
        if (res) {
          const parsed = parseLyrics(res.content);
          const processed = await RomanizationService.processLyrics(parsed, currentSong.id);
          if (!cancelled) setLyrics(processed);
        } else {
          setLyrics(null);
        }
      })
      .catch(() => { if (!cancelled) setLyrics(null); })
      .finally(() => { if (!cancelled) setIsLoadingLyrics(false); });

    return () => { cancelled = true; };
  }, [currentSong?.id]);

  // ── Sync time ─────────────────────────────────────────
  useEffect(() => {
    if (!isSeeking) setLocalTime(currentTime);
  }, [currentTime, isSeeking]);

  // ── Current lyric index ───────────────────────────────
  const currentLyricIndex = lyrics?.synced
    ? findCurrentLyricIndex(lyrics.lines, currentTime)
    : -1;

  // ── Auto-scroll lyrics ────────────────────────────────
  useEffect(() => {
    if (currentLyricIndex < 0 || !lyrics?.synced) return;
    const el = lyricLineRefs.current.get(currentLyricIndex);
    const container = lyricsContainerRef.current;
    if (!el || !container) return;
    const target = el.offsetTop - container.clientHeight * 0.38;
    container.scrollTo({ top: Math.max(0, target), behavior: 'smooth' });
  }, [currentLyricIndex, lyrics?.synced]);

  // ── Progress seek ─────────────────────────────────────
  const handleSeek = (pct: number) => {
    const t = pct * duration;
    setLocalTime(t);
    window.dispatchEvent(new CustomEvent('player:seek', { detail: t }));
  };

  const handleVolumeChange = (pct: number) => {
    setVolume(pct);
    window.dispatchEvent(new CustomEvent('player:volume', { detail: pct }));
  };

  if (!showNowPlaying || !currentSong) return null;

  const isStreaming = !currentSong.path && (currentSong.sourceType === 'streaming' || !!currentSong.ytVideoId);
  const coverSrc = currentSong.coverPath
    ? getImageUrl(currentSong.coverPath)
    : (currentSong.remoteCoverUrl || '');

  const isFav = isFavoriteSong(currentSong.id);
  const progressPct = duration > 0 ? localTime / duration : 0;
  const effectiveVolume = isMuted ? 0 : volume;
  const [c1, c2] = bgColors;

  return (
    <AnimatePresence>
      <motion.div
        key="nowplaying-root"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.45, ease: 'easeInOut' }}
        className="fixed inset-0 z-[100] overflow-hidden select-none flex flex-col bg-[#0a0a0c]"
        style={{ fontFamily: "'Inter', -apple-system, sans-serif" }}
      >

        {/* ════ Dynamic Background ════ */}
        <AnimatePresence>
          <motion.div
            key={`bg-${currentSong.id}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.9, ease: 'easeInOut' }}
            className="absolute inset-0 z-0"
          >
            {/* Blurred art */}
            {coverSrc && (
              <img
                src={coverSrc}
                alt=""
                draggable={false}
                referrerPolicy="no-referrer"
                className="absolute inset-0 w-full h-full object-cover scale-[1.3]"
                style={{ filter: 'blur(80px) saturate(200%) brightness(0.45)' }}
              />
            )}
            {/* Dark base */}
            <div className="absolute inset-0 bg-black/50" />
            {/* Color blobs */}
            <div
              className="absolute inset-0"
              style={{
                background: `
                  radial-gradient(ellipse 70% 80% at 15% 60%, rgba(${c1.join(',')},0.45) 0%, transparent 70%),
                  radial-gradient(ellipse 60% 70% at 85% 40%, rgba(${c2.join(',')},0.38) 0%, transparent 70%)
                `,
              }}
            />
            {/* Vignette */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-black/20" />
          </motion.div>
        </AnimatePresence>

        {/* ════ Top Bar ════ */}
        <div className="relative z-10 flex items-center justify-between px-10 md:px-20 lg:px-28 pt-7 pb-2 shrink-0">
          <button
            onClick={() => setShowNowPlaying(false)}
            className="flex items-center gap-2 text-white/50 hover:text-white/90 transition-all duration-200 text-sm font-medium group"
          >
            <motion.div whileHover={{ y: 2 }}>
              <ChevronDown size={18} />
            </motion.div>
            <span>Now Playing</span>
          </button>
        </div>

        {/* ════ Main Grid ════ */}
        <div className={`relative z-10 flex-1 flex min-h-0 px-10 md:px-20 lg:px-28 pb-8 pt-2 gap-12 lg:gap-20 ${showLyrics ? '' : 'justify-center items-center'}`}>

          {/* ── Left Panel (Adaptive scaling) ── */}
          <div className={`${showLyrics ? 'w-full md:w-[38%] lg:w-[35%] max-w-[420px]' : 'w-full max-w-[420px] mx-auto'} flex flex-col justify-center items-center gap-4 sm:gap-6 shrink-0 transition-all duration-300 max-h-[85vh]`}>

            {/* Album Artwork */}
            <AnimatePresence mode="wait">
              <motion.div
                key={`art-${currentSong.id}`}
                initial={{ opacity: 0, scale: 0.88, y: 24 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.88, y: -24 }}
                transition={{ type: 'spring', stiffness: 240, damping: 28 }}
                className="relative aspect-square w-full max-w-[420px] lg:max-w-[460px] max-h-[46vh] min-h-[260px] shrink-0 flex items-center justify-center mx-auto"
              >
                {coverSrc ? (
                  <img
                    src={coverSrc}
                    alt={currentSong.album}
                    draggable={false}
                    className="aspect-square w-full h-full object-cover"
                    style={{
                      borderRadius: '24px',
                      boxShadow: '0 40px 100px rgba(0,0,0,0.65), 0 8px 24px rgba(0,0,0,0.4)',
                    }}
                  />
                ) : (
                  <div
                    className="w-full h-full flex items-center justify-center bg-white/[0.04]"
                    style={{ borderRadius: '20px' }}
                  >
                    <Mic2 size={72} className="text-white/15" />
                  </div>
                )}
              </motion.div>
            </AnimatePresence>

            {/* Progress */}
            <div className="w-full space-y-2">
              <Slider
                value={progressPct}
                onChange={handleSeek}
                onDragStart={() => setIsSeeking(true)}
                onDragEnd={() => setIsSeeking(false)}
              />
              <div className="flex justify-between text-[11px] text-white/35 font-medium tabular-nums">
                <span>{formatTime(localTime)}</span>
                <span>-{formatTime(Math.max(0, duration - localTime))}</span>
              </div>
            </div>

            {/* Song Info */}
            <AnimatePresence mode="wait">
              <motion.div
                key={`info-${currentSong.id}`}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.35 }}
                className="w-full flex items-center justify-between px-2 gap-4"
              >
                <div className="flex-1 min-w-0 text-left">
                  <h1 className="text-[22px] font-bold text-white leading-tight truncate">
                    {currentSong.title}
                  </h1>
                  <p className="text-white/55 text-base truncate mt-0.5">{currentSong.artist}</p>
                  {/* Source Badge */}
                  {isStreaming && (
                    <span className="inline-flex items-center gap-1 mt-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-sky-500/15 text-sky-400 border border-sky-500/20">
                      ☁ Streaming
                    </span>
                  )}
                </div>
                <button
                  onClick={() => toggleFavoriteSong(currentSong.id)}
                  className="transition-all duration-200 shrink-0"
                >
                  <motion.div
                    whileTap={{ scale: 0.85 }}
                    className={isFav ? 'text-primary' : 'text-white/35 hover:text-white/60'}
                  >
                    <Heart size={22} fill={isFav ? 'currentColor' : 'none'} />
                  </motion.div>
                </button>
              </motion.div>
            </AnimatePresence>

            {/* Playback Controls */}
            <div className="flex items-center justify-center gap-7">
              <motion.button
                whileTap={{ scale: 0.88 }}
                onClick={() => toggleShuffle()}
                className={`transition-all duration-200 ${
                  shuffleMode === 'on' ? 'text-white' : 'text-white/25 hover:text-white/55'
                }`}
              >
                <Shuffle size={19} />
              </motion.button>

              <motion.button
                whileTap={{ scale: 0.88 }}
                onClick={() => usePlayerStore.getState().playPrevious()}
                className="text-white/75 hover:text-white transition-colors"
              >
                <SkipBack size={30} />
              </motion.button>

              <motion.button
                whileTap={{ scale: 0.9 }}
                onClick={() => {
                  setIsPlaying(!isPlaying);
                  window.dispatchEvent(new CustomEvent('player:toggle'));
                }}
                className="w-[62px] h-[62px] rounded-full bg-white flex items-center justify-center
                           shadow-2xl hover:bg-white/90 transition-all duration-200"
              >
                {isPlaying
                  ? <Pause size={26} fill="#000" className="text-black" />
                  : <Play size={26} fill="#000" className="text-black ml-1" />
                }
              </motion.button>

              <motion.button
                whileTap={{ scale: 0.88 }}
                onClick={() => usePlayerStore.getState().playNext()}
                className="text-white/75 hover:text-white transition-colors"
              >
                <SkipForward size={30} />
              </motion.button>

              <motion.button
                whileTap={{ scale: 0.88 }}
                onClick={() => toggleRepeat()}
                className={`transition-all duration-200 ${
                  repeatMode !== 'off' ? 'text-white' : 'text-white/25 hover:text-white/55'
                }`}
              >
                {repeatMode === 'one' ? <Repeat1 size={19} /> : <Repeat size={19} />}
              </motion.button>
            </div>

            {/* Volume & Exit Fullscreen */}
            <div className="flex items-center gap-5 w-full">
              <div className="flex items-center gap-3 flex-1">
                <button
                  onClick={() => toggleMute()}
                  className="text-white/35 hover:text-white/65 transition-colors shrink-0"
                >
                  {isMuted || volume === 0 ? <VolumeX size={16} /> : <Volume2 size={16} />}
                </button>
                <Slider value={effectiveVolume} onChange={handleVolumeChange} thin />
              </div>
              <button
                onClick={() => setShowNowPlaying(false)}
                className="text-white/35 hover:text-white/70 hover:scale-105 active:scale-95 transition-all duration-200 shrink-0 p-1"
                title="Exit Fullscreen"
              >
                <Minimize2 size={16} />
              </button>
            </div>

          </div>

          {/* ── Right Panel (65%) — Lyrics ── */}
          {showLyrics && (
            <div className="flex-1 flex flex-col min-h-0 justify-center relative">
              <div
                ref={lyricsContainerRef}
                className="flex-1 overflow-y-auto overflow-x-hidden relative"
                style={{
                  scrollbarWidth: 'none',
                  msOverflowStyle: 'none',
                }}
              >
                {/* Loading */}
                {isLoadingLyrics && (
                  <div className="flex flex-col items-center justify-center h-full gap-4 pt-8">
                    <div className="flex items-center gap-2">
                      {[0, 1, 2].map((i) => (
                        <motion.div
                          key={i}
                          className="w-2 h-2 rounded-full bg-white/40"
                          animate={{ opacity: [0.2, 1, 0.2], scale: [0.8, 1.3, 0.8] }}
                          transition={{ duration: 1.4, repeat: Infinity, delay: i * 0.22 }}
                        />
                      ))}
                    </div>
                    <p className="text-white/25 text-sm tracking-wide">Searching lyrics...</p>
                  </div>
                )}

                {/* Mode Selector Tab (Original | Romanization | Both) */}
                {!isLoadingLyrics && lyrics && lyrics.lines.some(l => l.romanization) && (
                  <div className="flex items-center justify-start pl-4 pt-4 pb-2">
                    <div className="inline-flex items-center p-1 rounded-xl bg-white/[0.06] border border-white/10 backdrop-blur-md">
                      {(['original', 'romanized', 'both'] as const).map((mode) => (
                        <button
                          key={mode}
                          onClick={() => updateSettings({ lyricsDisplayMode: mode })}
                          className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition-all duration-200 ${
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
                {!isLoadingLyrics && lyrics?.synced && (
                  <div className="pt-4 pb-[55vh] pl-2 pr-8 space-y-4">
                    {lyrics.lines.map((line, idx) => {
                      const isActive = idx === currentLyricIndex;
                      const isPast = currentLyricIndex >= 0 && idx < currentLyricIndex;
                      const mode = lyricsDisplayMode || 'both';

                      const displayText = mode === 'romanized'
                        ? (line.romanization || line.text)
                        : line.text;

                      const showSubRomanization = mode === 'both' && !!line.romanization;

                      const tokens = displayText.split(/(\s+)/);
                      const wordsOnly = tokens.filter(t => t.trim().length > 0);
                      const totalChars = wordsOnly.reduce((acc, w) => acc + w.length, 0);
                      const lineStart = line.time;
                      const lineEnd = line.endTime || (line.time + 3.5);
                      const lineDuration = Math.max(0.5, lineEnd - lineStart);
                      
                      let cumulativeChars = 0;

                      return (
                        <div
                          key={idx}
                          ref={(el) => { if (el) lyricLineRefs.current.set(idx, el); }}
                          onClick={() => {
                            if (seekByLyricsEnabled === false) return;
                            usePlayerStore.getState().setCurrentTime(line.time);
                            window.dispatchEvent(new CustomEvent('player:seek', { detail: line.time }));
                          }}
                          className={`px-4 sm:px-5 py-2.5 sm:py-3.5 rounded-2xl transition-all duration-300 bg-transparent border border-transparent hover:bg-white/[0.05] hover:shadow-[0_0_20px_rgba(255,255,255,0.08)] ${seekByLyricsEnabled ? 'cursor-pointer' : 'cursor-default'} font-sans space-y-1`}
                        >
                          {/* Primary Line */}
                          <motion.p
                            animate={{
                              opacity: isActive ? 1 : isPast ? 0.35 : 0.5,
                              color: '#ffffff',
                            }}
                            transition={{ duration: 0.35, ease: [0.25, 0.46, 0.45, 0.94] }}
                            className={`font-sans tracking-tight leading-tight text-white ${
                              isActive
                                ? 'text-2xl sm:text-3xl md:text-4xl lg:text-[40px] font-extrabold'
                                : 'text-base sm:text-lg md:text-xl lg:text-[25px] font-bold'
                            }`}
                          >
                            {isActive ? (
                              totalChars === 0 ? displayText : tokens.map((token, tokenIdx) => {
                                const isWhitespace = token.trim().length === 0;
                                if (isWhitespace) return <span key={tokenIdx}>{token}</span>;

                                const wordLength = token.length;
                                const wordStartOffset = (cumulativeChars / totalChars) * lineDuration;
                                const wordStart = lineStart + wordStartOffset;
                                const isWordActive = currentTime >= wordStart;

                                cumulativeChars += wordLength;

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
                              displayText
                            )}
                          </motion.p>

                          {/* Sub Romanization Line (Both mode) */}
                          {showSubRomanization && (
                            <motion.p
                              animate={{
                                opacity: isActive ? 0.85 : isPast ? 0.3 : 0.42,
                              }}
                              transition={{ duration: 0.35, ease: [0.25, 0.46, 0.45, 0.94] }}
                              className={`font-sans tracking-wide text-white/75 ${
                                isActive
                                  ? 'text-lg sm:text-xl md:text-2xl lg:text-[26px] font-semibold'
                                  : 'text-sm sm:text-base md:text-lg lg:text-[20px] font-medium'
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

                {/* Plain lyrics */}
                {!isLoadingLyrics && lyrics && !lyrics.synced && (
                  <div className="pt-10 pb-16 pl-2 pr-8 space-y-3">
                    {lyrics.lines.map((line, idx) => (
                      <p key={idx} className="text-[20px] font-medium text-white/50 leading-relaxed">
                        {line.text || <>&nbsp;</>}
                      </p>
                    ))}
                  </div>
                )}

                {/* Empty state */}
                {!isLoadingLyrics && !lyrics && (
                  <div className="flex flex-col items-start justify-center h-full pl-2 gap-5">
                    <div className="text-6xl">🎤</div>
                    <div>
                      <p className="text-[28px] font-semibold text-white/30">No lyrics available</p>
                      <p className="text-white/18 text-base mt-2">
                        {currentSong.artist} — {currentSong.title}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

        </div>
      </motion.div>
    </AnimatePresence>
  );
}
