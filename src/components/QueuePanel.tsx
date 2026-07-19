import { usePlayerStore } from '@/stores';
import { motion } from 'framer-motion';
import { Play, Pause, Trash2, X, Music, ChevronUp, ChevronDown, ListMusic } from 'lucide-react';
import { formatTime, getImageUrl } from '@/utils';
import { useRef, useEffect } from 'react';

interface QueuePanelProps {
  onClose?: () => void;
  isOverlay?: boolean;
}

export function QueuePanel({ onClose, isOverlay = false }: QueuePanelProps) {
  const {
    queue,
    queueIndex,
    currentSong,
    isPlaying,
    setQueue,
    removeFromQueue,
    moveInQueue,
    setIsPlaying,
    toggleQueue,
    clearUserQueue,
    sourceName,
  } = usePlayerStore();

  const activeRowRef = useRef<HTMLDivElement | null>(null);

  // Auto-scroll to active playing track on mount or change
  useEffect(() => {
    if (activeRowRef.current) {
      activeRowRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
      });
    }
  }, [queueIndex]);

  const handlePlaySong = (index: number) => {
    if (index === queueIndex) {
      setIsPlaying(!isPlaying);
      window.dispatchEvent(new CustomEvent('player:toggle'));
    } else {
      setQueue(queue, index);
    }
  };

  const handleMoveUp = (index: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (index > 0) {
      moveInQueue(index, index - 1);
    }
  };

  const handleMoveDown = (index: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (index < queue.length - 1) {
      moveInQueue(index, index + 1);
    }
  };

  // Simple HTML5 Drag and Drop handlers for reordering
  const handleDragStart = (e: React.DragEvent, index: number) => {
    e.dataTransfer.setData('text/plain', index.toString());
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent, toIndex: number) => {
    e.preventDefault();
    const fromIndexStr = e.dataTransfer.getData('text/plain');
    if (!fromIndexStr) return;
    const fromIndex = parseInt(fromIndexStr, 10);
    if (fromIndex === toIndex) return;
    moveInQueue(fromIndex, toIndex);
  };

  if (queue.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center p-6">
        <ListMusic size={36} className="text-text/20 mb-3" />
        <p className="text-sm text-text/40">Queue is empty</p>
        <p className="text-xs text-text/25 mt-1">Add some tracks to start listening</p>
      </div>
    );
  }

  // Segment queue: previous, current, next
  const nextSongs = queue.slice(queueIndex + 1);

  // Split into manual user queue and regular next up
  const userQueuedSongs = nextSongs.filter((s) => s.isUserQueued);
  const nextUpSongs = nextSongs.filter((s) => !s.isUserQueued);

  return (
    <div className="flex flex-col h-full min-h-0 text-left">
      {/* Header */}
      {!isOverlay && (
        <div className="flex items-center justify-between p-4 border-b border-white/5 shrink-0">
          <div className="flex items-center gap-2">
            <ListMusic size={16} className="text-primary" />
            <h3 className="text-sm font-bold uppercase tracking-wider">Play Queue</h3>
          </div>
          <button
            onClick={onClose || toggleQueue}
            className="p-1 rounded-lg hover:bg-white/5 text-text/40 hover:text-text transition-colors"
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* Queue items list */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 pr-1 scrollbar-thin">
        {/* Current Song Section */}
        {currentSong && (
          <div>
            <h4 className="text-[10px] uppercase font-bold text-primary tracking-widest mb-2 px-1">
              Now Playing
            </h4>
            <div
              ref={activeRowRef}
              className="flex items-center gap-3 p-2.5 rounded-xl bg-primary/10 border border-primary/20"
            >
              <div className="relative w-10 h-10 rounded-lg overflow-hidden shrink-0 bg-white/[0.02] flex items-center justify-center">
                {currentSong.coverPath ? (
                  <img
                    src={getImageUrl(currentSong.coverPath)}
                    alt=""
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <Music size={14} className="text-text/20" />
                )}
                <button
                  onClick={() => handlePlaySong(queueIndex)}
                  className="absolute inset-0 bg-black/40 flex items-center justify-center text-white"
                >
                  {isPlaying ? (
                    <Pause size={12} fill="currentColor" className="text-primary" />
                  ) : (
                    <Play size={12} fill="currentColor" />
                  )}
                </button>
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold text-primary truncate">{currentSong.title}</p>
                <p className="text-[10px] text-text/50 truncate font-semibold">
                  {currentSong.artist}
                </p>
              </div>
              {/* Dynamic playing frequency bars */}
              {isPlaying && (
                <div className="flex gap-0.5 items-end h-3.5 mr-1 shrink-0">
                  {[1, 2, 3].map((i) => (
                    <motion.div
                      key={i}
                      className="w-0.5 bg-primary rounded-full"
                      animate={{ height: ['20%', '100%', '20%'] }}
                      transition={{ duration: 0.7, repeat: Infinity, delay: i * 0.12 }}
                    />
                  ))}
                </div>
              )}
              <span className="text-[10px] text-primary/75 font-mono select-none shrink-0 font-semibold">
                {formatTime(currentSong.duration)}
              </span>
            </div>
          </div>
        )}

        {/* Next in Queue Section */}
        {userQueuedSongs.length > 0 && (
          <div>
            <div className="flex justify-between items-center mb-2 px-1">
              <h4 className="text-[10px] uppercase font-bold text-text/30 tracking-widest">
                Next in queue
              </h4>
              <button
                onClick={clearUserQueue}
                className="text-[10px] font-semibold text-text/40 hover:text-primary transition-colors cursor-pointer"
              >
                Clear queue
              </button>
            </div>
            <div className="space-y-0.5">
              {userQueuedSongs.map((song, idx) => {
                const actualIndex = queue.indexOf(song, queueIndex + 1);
                const coverSrc = song.coverPath ? getImageUrl(song.coverPath) : null;
                return (
                  <div
                    key={`user-queue-${song.id}-${idx}`}
                    onDoubleClick={() => handlePlaySong(actualIndex)}
                    draggable
                    onDragStart={(e) => handleDragStart(e, actualIndex)}
                    onDragOver={handleDragOver}
                    onDrop={(e) => handleDrop(e, actualIndex)}
                    className="group flex items-center gap-3 p-2 rounded-xl hover:bg-white/[0.02] cursor-pointer border-l-2 border-transparent transition-all"
                  >
                    <div className="relative w-8 h-8 rounded-lg overflow-hidden shrink-0 bg-white/[0.02] flex items-center justify-center">
                      {coverSrc ? (
                        <img src={coverSrc} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <Music size={12} className="text-text/20" />
                      )}
                      <button
                        onClick={() => handlePlaySong(actualIndex)}
                        className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-white"
                      >
                        <Play size={10} fill="currentColor" />
                      </button>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold text-text/80 truncate">{song.title}</p>
                      <p className="text-[10px] text-text/40 truncate">{song.artist}</p>
                    </div>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={(e) => handleMoveUp(actualIndex, e)}
                        className="p-1 hover:text-primary text-text/30"
                      >
                        <ChevronUp size={12} />
                      </button>
                      <button
                        onClick={(e) => handleMoveDown(actualIndex, e)}
                        disabled={actualIndex === queue.length - 1}
                        className="p-1 hover:text-primary text-text/30 disabled:opacity-20"
                      >
                        <ChevronDown size={12} />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          removeFromQueue(actualIndex);
                        }}
                        className="p-1 hover:text-danger text-text/30"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                    <span className="text-[10px] text-text/25 font-mono group-hover:hidden select-none shrink-0">
                      {formatTime(song.duration)}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Next Up Section */}
        {nextUpSongs.length > 0 && (
          <div>
            <h4 className="text-[10px] uppercase font-bold text-text/30 tracking-widest mb-2 px-1">
              Next from: {sourceName || currentSong?.album || 'Current Source'}
            </h4>
            <div className="space-y-0.5">
              {nextUpSongs.map((song, idx) => {
                const actualIndex = queue.indexOf(song, queueIndex + 1);
                const coverSrc = song.coverPath ? getImageUrl(song.coverPath) : null;
                return (
                  <div
                    key={`next-up-${song.id}-${idx}`}
                    onDoubleClick={() => handlePlaySong(actualIndex)}
                    draggable
                    onDragStart={(e) => handleDragStart(e, actualIndex)}
                    onDragOver={handleDragOver}
                    onDrop={(e) => handleDrop(e, actualIndex)}
                    className="group flex items-center gap-3 p-2 rounded-xl hover:bg-white/[0.02] cursor-pointer border-l-2 border-transparent transition-all"
                  >
                    <div className="relative w-8 h-8 rounded-lg overflow-hidden shrink-0 bg-white/[0.02] flex items-center justify-center">
                      {coverSrc ? (
                        <img src={coverSrc} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <Music size={12} className="text-text/20" />
                      )}
                      <button
                        onClick={() => handlePlaySong(actualIndex)}
                        className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-white"
                      >
                        <Play size={10} fill="currentColor" />
                      </button>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold text-text/80 truncate">{song.title}</p>
                      <p className="text-[10px] text-text/40 truncate">{song.artist}</p>
                    </div>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={(e) => handleMoveUp(actualIndex, e)}
                        className="p-1 hover:text-primary text-text/30"
                      >
                        <ChevronUp size={12} />
                      </button>
                      <button
                        onClick={(e) => handleMoveDown(actualIndex, e)}
                        disabled={actualIndex === queue.length - 1}
                        className="p-1 hover:text-primary text-text/30 disabled:opacity-20"
                      >
                        <ChevronDown size={12} />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          removeFromQueue(actualIndex);
                        }}
                        className="p-1 hover:text-danger text-text/30"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                    <span className="text-[10px] text-text/25 font-mono group-hover:hidden select-none shrink-0">
                      {formatTime(song.duration)}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
