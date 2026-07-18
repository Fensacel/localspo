import { useEffect, useRef, useState } from 'react';
import { usePlayerStore, useFavoritesStore } from '@/stores';
import { motion, AnimatePresence } from 'framer-motion';
import { Minimize2, Heart, Volume2, ListMusic, Mic2, Play, Pause } from 'lucide-react';
import {
  formatFileSize,
  formatBitrate,
  formatSampleRate,
  formatBitDepth,
} from '@/utils';
import { parseLyrics, findCurrentLyricIndex } from '@/services/lyricsParser';
import type { LyricsData } from '@/types';
import { QueuePanel } from '@/components/QueuePanel';

export function NowPlayingOverlay() {
  const {
    currentSong,
    isPlaying,
    currentTime,
    volume,
    showNowPlaying,
    setShowNowPlaying,
    setIsPlaying,
  } = usePlayerStore();

  const { isFavoriteSong, toggleFavoriteSong } = useFavoritesStore();

  const [activeTab, setActiveTab] = useState<'lyrics' | 'queue'>('lyrics');
  const [visualizerType, setVisualizerType] = useState<
    'spectrum' | 'waveform' | 'circular' | 'particle'
  >('circular');
  const [lyrics, setLyrics] = useState<LyricsData | null>(null);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const lyricsContainerRef = useRef<HTMLDivElement>(null);
  const lyricLineRefs = useRef<Map<number, HTMLDivElement>>(new Map());

  // Load lyrics
  useEffect(() => {
    if (!currentSong) return;

    window.electronAPI.lyrics
      .read(currentSong.id, currentSong.lrcPath, currentSong.hasEmbeddedLyrics)
      .then((res: { source: string; content: string } | null) => {
        if (res) {
          setLyrics(parseLyrics(res.content));
        } else {
          setLyrics(null);
        }
      })
      .catch(() => setLyrics(null));
  }, [currentSong]);

  // Sync lyrics scroll
  const currentLyricIndex = lyrics?.synced ? findCurrentLyricIndex(lyrics.lines, currentTime) : -1;
  useEffect(() => {
    if (currentLyricIndex < 0 || !lyrics?.synced) return;
    const element = lyricLineRefs.current.get(currentLyricIndex);
    if (element && lyricsContainerRef.current) {
      const container = lyricsContainerRef.current;
      const scrollTarget =
        element.offsetTop - container.clientHeight / 2 + element.clientHeight / 2;
      container.scrollTo({ top: scrollTarget, behavior: 'smooth' });
    }
  }, [currentLyricIndex, lyrics?.synced]);

  // Visualizer loop
  useEffect(() => {
    if (!showNowPlaying) return;

    let animationFrameId: number;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resizeCanvas = () => {
      canvas.width = canvas.parentElement?.clientWidth || 800;
      canvas.height = canvas.parentElement?.clientHeight || 500;
    };
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    // Particle system state
    const particles: Array<{
      x: number;
      y: number;
      size: number;
      speedY: number;
      speedX: number;
      alpha: number;
    }> = [];
    for (let i = 0; i < 60; i++) {
      particles.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        size: Math.random() * 3 + 1,
        speedY: -(Math.random() * 1 + 0.5),
        speedX: (Math.random() - 0.5) * 0.5,
        alpha: Math.random() * 0.5 + 0.1,
      });
    }

    const draw = () => {
      animationFrameId = requestAnimationFrame(draw);

      const analyser = window.__bluetune_analyser;
      if (!analyser) {
        // Draw empty visualizer if not playing
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        return;
      }

      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      if (visualizerType === 'waveform') {
        analyser.getByteTimeDomainData(dataArray);
      } else {
        analyser.getByteFrequencyData(dataArray);
      }

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Bass energy for audio-reactive motion
      let bassSum = 0;
      for (let i = 0; i < bufferLength; i++) {
        if (i < 10) bassSum += dataArray[i]; // Low frequencies
      }
      const bassEnergy = bassSum / 10;
      const bassRatio = bassEnergy / 255;

      // Draw active visualizer
      if (visualizerType === 'spectrum') {
        const barWidth = (canvas.width / bufferLength) * 2.5;
        let x = 0;

        for (let i = 0; i < bufferLength; i++) {
          const barHeight = (dataArray[i] / 255) * canvas.height * 0.7;

          // Glowing blue-neon gradient
          const grad = ctx.createLinearGradient(0, canvas.height, 0, canvas.height - barHeight);
          grad.addColorStop(0, 'rgba(59, 130, 246, 0.1)');
          grad.addColorStop(0.5, 'rgba(96, 165, 250, 0.5)');
          grad.addColorStop(1, 'rgba(147, 197, 253, 0.8)');

          ctx.fillStyle = grad;
          ctx.fillRect(x, canvas.height - barHeight, barWidth - 2, barHeight);

          x += barWidth;
        }
      } else if (visualizerType === 'waveform') {
        ctx.lineWidth = 3;
        // Neon blue stroke
        ctx.strokeStyle = 'rgba(96, 165, 250, 0.8)';
        ctx.shadowBlur = 15;
        ctx.shadowColor = '#3B82F6';
        ctx.beginPath();

        const sliceWidth = canvas.width / bufferLength;
        let x = 0;

        for (let i = 0; i < bufferLength; i++) {
          const v = dataArray[i] / 128.0;
          const y = (v * canvas.height) / 2;

          if (i === 0) {
            ctx.moveTo(x, y);
          } else {
            ctx.lineTo(x, y);
          }

          x += sliceWidth;
        }

        ctx.lineTo(canvas.width, canvas.height / 2);
        ctx.stroke();
        ctx.shadowBlur = 0; // Reset
      } else if (visualizerType === 'circular') {
        const centerX = canvas.width / 2;
        const centerY = canvas.height / 2;
        const baseRadius = Math.min(canvas.width, canvas.height) * 0.22 + bassRatio * 20;

        ctx.shadowBlur = 20;
        ctx.shadowColor = 'rgba(59, 130, 246, 0.6)';

        // Draw outer glowing ring
        ctx.beginPath();
        ctx.arc(centerX, centerY, baseRadius, 0, 2 * Math.PI);
        ctx.strokeStyle = 'rgba(59, 130, 246, 0.15)';
        ctx.lineWidth = 10;
        ctx.stroke();

        // Draw reactive bars outward
        const numBars = 120;
        for (let i = 0; i < numBars; i++) {
          const angle = (i / numBars) * Math.PI * 2;
          const dataIndex = Math.floor((i / numBars) * bufferLength * 0.6);
          const value = dataArray[dataIndex] || 0;
          const barLen = (value / 255) * 80;

          const startX = centerX + Math.cos(angle) * baseRadius;
          const startY = centerY + Math.sin(angle) * baseRadius;
          const endX = centerX + Math.cos(angle) * (baseRadius + barLen);
          const endY = centerY + Math.sin(angle) * (baseRadius + barLen);

          const grad = ctx.createLinearGradient(startX, startY, endX, endY);
          grad.addColorStop(0, 'rgba(59, 130, 246, 0.8)');
          grad.addColorStop(1, 'rgba(147, 197, 253, 0.2)');

          ctx.beginPath();
          ctx.moveTo(startX, startY);
          ctx.lineTo(endX, endY);
          ctx.strokeStyle = grad;
          ctx.lineWidth = 3;
          ctx.stroke();
        }

        ctx.shadowBlur = 0;
      } else if (visualizerType === 'particle') {
        // Draw connection lines for close particles
        ctx.strokeStyle = 'rgba(59, 130, 246, 0.05)';
        ctx.lineWidth = 1;
        for (let i = 0; i < particles.length; i++) {
          for (let j = i + 1; j < particles.length; j++) {
            const dist = Math.hypot(
              particles[i].x - particles[j].x,
              particles[i].y - particles[j].y,
            );
            if (dist < 100) {
              ctx.beginPath();
              ctx.moveTo(particles[i].x, particles[i].y);
              ctx.lineTo(particles[j].x, particles[j].y);
              ctx.stroke();
            }
          }
        }

        // Draw and update particles reactively
        particles.forEach((p) => {
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size * (1 + bassRatio * 1.5), 0, Math.PI * 2);
          ctx.fillStyle = `rgba(96, 165, 250, ${p.alpha * (1 + bassRatio)})`;
          ctx.shadowBlur = bassRatio * 15;
          ctx.shadowColor = '#3B82F6';
          ctx.fill();

          // Move
          p.y += p.speedY * (1 + bassRatio * 3);
          p.x += p.speedX;

          // Wrap around edges
          if (p.y < 0) {
            p.y = canvas.height;
            p.x = Math.random() * canvas.width;
          }
          if (p.x < 0 || p.x > canvas.width) {
            p.x = Math.random() * canvas.width;
          }
        });
        ctx.shadowBlur = 0;
      }
    };

    draw();

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', resizeCanvas);
    };
  }, [showNowPlaying, visualizerType]);

  if (!showNowPlaying || !currentSong) return null;

  const coverSrc = currentSong.coverPath
    ? `local-image://${encodeURIComponent(currentSong.coverPath)}`
    : '/default-cover.png';

  const isFav = isFavoriteSong(currentSong.id);

  return (
    <AnimatePresence>
      <motion.div
        initial={{ y: '100%', opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: '100%', opacity: 0 }}
        transition={{ type: 'spring', damping: 26, stiffness: 170 }}
        className="fixed inset-0 z-[100] bg-bg flex flex-col overflow-hidden p-6 select-none"
      >
        {/* Blurred album backdrop */}
        <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
          <img
            src={coverSrc}
            alt=""
            className="w-full h-full object-cover opacity-15 blur-[120px] scale-125"
          />
        </div>

        {/* Titlebar header inside fullscreen overlay */}
        <div className="relative z-10 flex items-center justify-between shrink-0 h-12 border-b border-white/5 mb-6">
          <button
            onClick={() => setShowNowPlaying(false)}
            className="flex items-center gap-2 text-text/50 hover:text-text transition-colors text-sm font-medium"
          >
            <Minimize2 size={16} />
            Back to Library
          </button>
          <div className="flex bg-white/5 rounded-xl p-0.5 border border-white/5">
            {['spectrum', 'waveform', 'circular', 'particle'].map((type) => (
              <button
                key={type}
                onClick={() =>
                  setVisualizerType(type as 'spectrum' | 'waveform' | 'circular' | 'particle')
                }
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold uppercase tracking-wider transition-all duration-200 ${
                  visualizerType === type
                    ? 'bg-primary text-white shadow-glow'
                    : 'text-text/40 hover:text-text/70'
                }`}
              >
                {type}
              </button>
            ))}
          </div>
          <div className="w-24" /> {/* Spacer */}
        </div>

        {/* Main interactive grid */}
        <div className="relative z-10 flex-1 grid grid-cols-12 gap-8 min-h-0">
          {/* Left panel: Album and Metadata */}
          <div className="col-span-4 flex flex-col justify-center items-center min-w-0">
            <motion.div
              animate={{ rotate: isPlaying ? 360 : 0 }}
              transition={
                isPlaying ? { repeat: Infinity, duration: 30, ease: 'linear' } : { duration: 0.5 }
              }
              className="relative w-72 h-72 xl:w-[360px] xl:h-[360px] rounded-full overflow-hidden shadow-glow-xl border border-white/10 group mb-6 shrink-0"
            >
              <img src={coverSrc} alt={currentSong.album} className="w-full h-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <button
                  onClick={() => setIsPlaying(!isPlaying)}
                  className="w-16 h-16 rounded-full bg-primary/95 text-white flex items-center justify-center shadow-glow hover:scale-105 active:scale-95 transition-all duration-200"
                >
                  {isPlaying ? (
                    <Pause size={24} fill="currentColor" />
                  ) : (
                    <Play size={24} fill="currentColor" className="ml-1" />
                  )}
                </button>
              </div>
            </motion.div>

            <div className="text-center w-full max-w-sm px-4">
              <h2 className="text-2xl font-bold truncate text-glow-blue">{currentSong.title}</h2>
              <p className="text-text/50 text-sm truncate mt-1">{currentSong.artist}</p>
              <p className="text-text/30 text-xs truncate mt-0.5">{currentSong.album}</p>
            </div>

            <div className="flex gap-4 mt-6">
              <button
                onClick={() => toggleFavoriteSong(currentSong.id)}
                className={`p-3 rounded-full glass hover:scale-105 active:scale-95 transition-all ${
                  isFav ? 'text-primary' : 'text-text/30 hover:text-text/60'
                }`}
              >
                <Heart size={20} fill={isFav ? 'currentColor' : 'none'} />
              </button>
            </div>
          </div>

          {/* Middle panel: Visualizer Canvas */}
          <div className="col-span-4 relative flex items-center justify-center overflow-hidden">
            <canvas ref={canvasRef} className="w-full h-full object-contain pointer-events-none" />
          </div>

          {/* Right panel: Tabbed lyrics / queue */}
          <div className="col-span-4 flex flex-col min-h-0 bg-white/[0.02] border border-white/5 rounded-3xl p-5">
            {/* Tabs header */}
            <div className="flex border-b border-white/5 pb-3 mb-4 shrink-0">
              <button
                onClick={() => setActiveTab('lyrics')}
                className={`flex-1 pb-2 text-center text-sm font-bold border-b-2 transition-all ${
                  activeTab === 'lyrics'
                    ? 'border-primary text-text'
                    : 'border-transparent text-text/40 hover:text-text/70'
                }`}
              >
                <span className="flex items-center justify-center gap-1.5">
                  <Mic2 size={14} /> Lyrics
                </span>
              </button>
              <button
                onClick={() => setActiveTab('queue')}
                className={`flex-1 pb-2 text-center text-sm font-bold border-b-2 transition-all ${
                  activeTab === 'queue'
                    ? 'border-primary text-text'
                    : 'border-transparent text-text/40 hover:text-text/70'
                }`}
              >
                <span className="flex items-center justify-center gap-1.5">
                  <ListMusic size={14} /> Queue
                </span>
              </button>
            </div>

            {/* Tab content */}
            <div className="flex-1 overflow-hidden min-h-0">
              {activeTab === 'lyrics' ? (
                <div
                  ref={lyricsContainerRef}
                  className="w-full h-full overflow-y-auto px-2 relative py-8"
                >
                  {lyrics ? (
                    lyrics.synced ? (
                      <div className="space-y-4 py-24">
                        {lyrics.lines.map((line, idx) => {
                          const isActive = idx === currentLyricIndex;
                          const isPast = currentLyricIndex >= 0 && idx < currentLyricIndex;
                          return (
                            <div
                              key={idx}
                              ref={(el) => {
                                if (el) lyricLineRefs.current.set(idx, el);
                              }}
                              onClick={() => {
                                window.dispatchEvent(
                                  new CustomEvent('player:seek', { detail: line.time }),
                                );
                              }}
                              className="cursor-pointer"
                            >
                              <motion.p
                                animate={{
                                  fontSize: isActive ? '28px' : '18px',
                                  fontWeight: isActive ? 700 : 600,
                                  opacity: isActive ? 1 : isPast ? 0.35 : 0.45,
                                  color: isActive ? '#3B82F6' : '#94A3B8',
                                }}
                                transition={{ duration: 0.25 }}
                                className={`leading-relaxed text-center ${
                                  isActive ? 'text-glow-blue font-bold' : ''
                                }`}
                              >
                                {line.text}
                              </motion.p>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="space-y-4 text-center py-4">
                        {lyrics.lines.map((line, idx) => (
                          <p key={idx} className="text-sm text-text/60 leading-relaxed">
                            {line.text}
                          </p>
                        ))}
                      </div>
                    )
                  ) : (
                    <div className="flex flex-col items-center justify-center h-full text-center">
                      <Mic2 size={32} className="text-text/10 mb-2" />
                      <span className="text-xs text-text/30">No lyrics available</span>
                    </div>
                  )}
                </div>
              ) : (
                <QueuePanel isOverlay />
              )}
            </div>
          </div>
        </div>

        {/* Footer specs */}
        <div className="relative z-10 flex items-center justify-between shrink-0 h-10 border-t border-white/5 pt-4 text-[10px] text-text/35 font-mono">
          <div className="flex gap-4">
            <span>
              Codec: <span className="text-primary font-bold">{currentSong.codec}</span>
            </span>
            <span>
              Bitrate: <span className="text-text/60">{formatBitrate(currentSong.bitrate)}</span>
            </span>
            <span>
              Sample Rate:{' '}
              <span className="text-text/60">{formatSampleRate(currentSong.sampleRate)}</span>
            </span>
            {currentSong.bitDepth > 0 && (
              <span>
                Bit Depth:{' '}
                <span className="text-text/60">{formatBitDepth(currentSong.bitDepth)}</span>
              </span>
            )}
            <span>
              Channels:{' '}
              <span className="text-text/60">{currentSong.channels === 1 ? 'Mono' : 'Stereo'}</span>
            </span>
            <span>
              Size: <span className="text-text/60">{formatFileSize(currentSong.fileSize)}</span>
            </span>
          </div>

          <div className="flex items-center gap-2">
            <Volume2 size={12} />
            <div className="w-20 h-1 bg-white/10 rounded-full relative cursor-pointer">
              <div
                className="absolute left-0 top-0 h-full bg-primary rounded-full"
                style={{ width: `${volume * 100}%` }}
              />
            </div>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
