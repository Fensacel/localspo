import { usePlayerStore } from '@/stores';
import { formatTime, getImageUrl } from '@/utils';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Shuffle,
  Repeat,
  Repeat1,
  Volume2,
  VolumeX,
  Volume1,
  ListMusic,
  Mic2,
  ChevronUp,
  PanelRight,
} from 'lucide-react';
import { useRef, useState, useEffect } from 'react';

export function MiniPlayer() {
  const {
    currentSong,
    isPlaying,
    currentTime,
    duration,
    volume,
    isMuted,
    repeatMode,
    shuffleMode,
    showLyrics,
    showNowPlayingSidebar,
    setIsPlaying,
    setCurrentTime,
    setVolume,
    toggleMute,
    toggleRepeat,
    toggleShuffle,
    toggleQueue,
    toggleLyrics,
    toggleNowPlaying,
    toggleNowPlayingSidebar,
    setIsSeeking: setStoreIsSeeking,
    playNext,
    playPrevious,
  } = usePlayerStore();

  const progressRef = useRef<HTMLDivElement>(null);
  const volumeRef = useRef<HTMLDivElement>(null);
  const [isSeeking, setIsSeeking] = useState(false);
  const [localTime, setLocalTime] = useState(0);

  useEffect(() => {
    if (!isSeeking) {
      setLocalTime(currentTime);
    }
  }, [currentTime, isSeeking]);

  useEffect(() => {
    setStoreIsSeeking(isSeeking);
  }, [isSeeking, setStoreIsSeeking]);

  const progress = duration > 0 ? (localTime / duration) * 100 : 0;



  const handleProgressMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!progressRef.current || !duration) return;
    setIsSeeking(true);

    const applySeek = (seekTime: number) => {
      setCurrentTime(seekTime);
      window.dispatchEvent(new CustomEvent('player:seek', { detail: seekTime }));
    };

    const updateTimeFromEvent = (clientX: number) => {
      if (!progressRef.current) return;
      const rect = progressRef.current.getBoundingClientRect();
      const percent = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
      const seekTime = percent * duration;
      setLocalTime(seekTime);
      applySeek(seekTime);
    };

    updateTimeFromEvent(e.clientX);

    const handleMouseMove = (moveEvent: MouseEvent) => {
      updateTimeFromEvent(moveEvent.clientX);
    };

    const handleMouseUp = (upEvent: MouseEvent) => {
      setIsSeeking(false);

      if (progressRef.current) {
        const rect = progressRef.current.getBoundingClientRect();
        const percent = Math.max(0, Math.min(1, (upEvent.clientX - rect.left) / rect.width));
        const seekTime = percent * duration;
        applySeek(seekTime);
      }

      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  const handleVolumeMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!volumeRef.current) return;

    const updateVolumeFromEvent = (clientX: number) => {
      if (!volumeRef.current) return;
      const rect = volumeRef.current.getBoundingClientRect();
      const percent = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
      setVolume(percent);
      window.dispatchEvent(new CustomEvent('player:volume', { detail: percent }));
    };

    updateVolumeFromEvent(e.clientX);

    const handleMouseMove = (moveEvent: MouseEvent) => {
      updateVolumeFromEvent(moveEvent.clientX);
    };

    const handleMouseUp = () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  const getVolumeIcon = () => {
    if (isMuted || volume === 0) return VolumeX;
    if (volume < 0.5) return Volume1;
    return Volume2;
  };

  const VolumeIcon = getVolumeIcon();

  if (!currentSong) return null;

  const coverSrc = currentSong.coverPath
    ? getImageUrl(currentSong.coverPath)
    : '/default-cover.png';

  return (
    <motion.div
      initial={{ y: 100, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: 100, opacity: 0 }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      className="h-[90px] glass-heavy border-t border-white/5 flex flex-col shrink-0 z-50"
    >
      {/* Progress bar */}
      <div
        ref={progressRef}
        onMouseDown={handleProgressMouseDown}
        className="relative w-full h-1 cursor-pointer group"
      >
        <div className="absolute inset-0 bg-white/5" />
        <motion.div
          className="absolute left-0 top-0 h-full bg-gradient-to-r from-primary to-accent"
          style={{ width: `${progress}%` }}
          transition={isSeeking ? { duration: 0 } : { duration: 0.1 }}
        />
        <div
          className="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-primary rounded-full shadow-glow opacity-0 group-hover:opacity-100 transition-opacity"
          style={{ left: `calc(${progress}% - 6px)` }}
        />
      </div>

      {/* Controls */}
      <div className="flex-1 flex items-center px-4 gap-4">
        {/* Song info */}
        <div
          className="flex items-center gap-3 w-[280px] min-w-0 cursor-pointer"
          onClick={toggleNowPlaying}
        >
          <motion.img
            key={currentSong.id}
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            src={coverSrc}
            alt={currentSong.album}
            className="w-12 h-12 rounded-lg object-cover shadow-lg"
            onError={(e) => {
              (e.target as HTMLImageElement).src = '/default-cover.png';
            }}
          />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-text truncate">{currentSong.title}</p>
            <p className="text-xs text-text/50 truncate">{currentSong.artist}</p>
          </div>
          <ChevronUp size={16} className="text-text/30 shrink-0" />
        </div>

        {/* Center controls */}
        <div className="flex-1 flex items-center justify-center gap-3">
          <ControlButton onClick={toggleShuffle} active={shuffleMode === 'on'} size="sm">
            <Shuffle size={16} strokeWidth={1.8} />
          </ControlButton>

          <ControlButton onClick={playPrevious}>
            <SkipBack size={18} strokeWidth={1.8} />
          </ControlButton>

          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={() => {
              setIsPlaying(!isPlaying);
              window.dispatchEvent(new CustomEvent('player:toggle'));
            }}
            className="w-10 h-10 rounded-full bg-primary flex items-center justify-center text-white shadow-glow hover:bg-primary-hover transition-colors"
          >
            <AnimatePresence mode="wait">
              <motion.div
                key={isPlaying ? 'pause' : 'play'}
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.5, opacity: 0 }}
                transition={{ duration: 0.15 }}
              >
                {isPlaying ? (
                  <Pause size={18} strokeWidth={1.8} fill="#000" className="text-black" />
                ) : (
                  <Play size={18} strokeWidth={1.8} fill="#000" className="text-black ml-0.5" />
                )}
              </motion.div>
            </AnimatePresence>
          </motion.button>

          <ControlButton onClick={playNext}>
            <SkipForward size={18} strokeWidth={1.8} />
          </ControlButton>

          <ControlButton onClick={toggleRepeat} active={repeatMode !== 'off'} size="sm">
            {repeatMode === 'one' ? (
              <Repeat1 size={16} strokeWidth={1.8} />
            ) : (
              <Repeat size={16} strokeWidth={1.8} />
            )}
          </ControlButton>
        </div>

        {/* Right controls */}
        <div className="flex items-center gap-3 w-[280px] justify-end">
          <span className="text-[10px] text-text/40 font-mono tabular-nums">
            {formatTime(currentTime)}
          </span>
          <span className="text-[10px] text-text/20">/</span>
          <span className="text-[10px] text-text/40 font-mono tabular-nums">
            {formatTime(duration)}
          </span>

          <ControlButton onClick={toggleNowPlayingSidebar} active={showNowPlayingSidebar} size="sm">
            <PanelRight size={15} strokeWidth={1.8} />
          </ControlButton>

          <ControlButton onClick={toggleLyrics} active={showLyrics} size="sm">
            <Mic2 size={15} strokeWidth={1.8} />
          </ControlButton>

          <ControlButton onClick={toggleQueue} size="sm">
            <ListMusic size={15} strokeWidth={1.8} />
          </ControlButton>

          {/* Volume */}
          <div className="flex items-center gap-2">
            <button onClick={toggleMute} className="text-text/50 hover:text-text transition-colors">
              <VolumeIcon size={16} strokeWidth={1.8} />
            </button>
            <div
              ref={volumeRef}
              onMouseDown={handleVolumeMouseDown}
              className="relative w-20 h-1 bg-white/10 rounded-full cursor-pointer group"
            >
              <div
                className="absolute left-0 top-0 h-full bg-primary rounded-full"
                style={{ width: `${(isMuted ? 0 : volume) * 100}%` }}
              />
              <div
                className="absolute top-1/2 -translate-y-1/2 w-2.5 h-2.5 bg-primary rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-glow"
                style={{ left: `calc(${(isMuted ? 0 : volume) * 100}% - 5px)` }}
              />
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

interface ControlButtonProps {
  children: React.ReactNode;
  onClick: () => void;
  active?: boolean;
  size?: 'sm' | 'md';
}

function ControlButton({ children, onClick, active = false, size = 'md' }: ControlButtonProps) {
  return (
    <motion.button
      whileTap={{ scale: 0.9 }}
      onClick={onClick}
      className={`flex items-center justify-center rounded-full transition-colors duration-200 ${
        size === 'sm' ? 'w-8 h-8' : 'w-9 h-9'
      } ${
        active ? 'text-primary hover:text-primary-light' : 'text-text/50 hover:text-text/80'
      } hover:bg-white/5`}
    >
      {children}
    </motion.button>
  );
}
