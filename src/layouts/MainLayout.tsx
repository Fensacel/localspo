import { Outlet } from 'react-router-dom';
import { Titlebar } from '@/components/Titlebar';
import { Sidebar } from '@/components/Sidebar';
import { MiniPlayer } from '@/components/MiniPlayer';
import { usePlayerStore } from '@/stores';
import { AnimatePresence, motion } from 'framer-motion';
import { useState, useEffect } from 'react';
import { extractDominantColor, getImageUrl } from '@/utils';
import { NowPlayingOverlay } from '@/features/player/NowPlayingOverlay';
import { QueuePanel } from '@/components/QueuePanel';

export function MainLayout() {
  const currentSong = usePlayerStore((s) => s.currentSong);
  const showNowPlaying = usePlayerStore((s) => s.showNowPlaying);
  const showQueue = usePlayerStore((s) => s.showQueue);
  const toggleQueue = usePlayerStore((s) => s.toggleQueue);
  const [bgColor, setBgColor] = useState<[number, number, number]>([59, 130, 246]);

  // Dynamic background based on album cover
  useEffect(() => {
    if (currentSong?.coverPath) {
      const src = getImageUrl(currentSong.coverPath);
      extractDominantColor(src).then(setBgColor);
    } else {
      setBgColor([59, 130, 246]);
    }
  }, [currentSong?.coverPath]);

  return (
    <div className="w-full h-full flex flex-col relative overflow-hidden">
      {/* Dynamic background overlay */}
      <motion.div
        className="absolute inset-0 pointer-events-none z-0"
        animate={{
          background: `radial-gradient(ellipse at 30% 20%, rgba(${bgColor[0]},${bgColor[1]},${bgColor[2]},0.12) 0%, transparent 60%)`,
        }}
        transition={{ duration: 0.7 }}
      />

      {/* Titlebar */}
      <Titlebar />

      {/* Main content area */}
      <div className="flex flex-1 min-h-0 relative z-10">
        {/* Sidebar */}
        <Sidebar />

        {/* Content */}
        <main className="flex-1 overflow-y-auto overflow-x-hidden relative">
          <AnimatePresence mode="wait">
            <motion.div
              key={location.pathname}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              className="p-6 pb-4"
            >
              <Outlet />
            </motion.div>
          </AnimatePresence>
        </main>

        {/* Queue Sidebar */}
        <AnimatePresence>
          {showQueue && (
            <motion.aside
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 320, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              className="h-full border-l border-white/5 bg-white/[0.01] backdrop-blur-md flex flex-col shrink-0 overflow-hidden relative z-20"
            >
              <div className="w-[320px] h-full flex flex-col">
                <QueuePanel onClose={toggleQueue} />
              </div>
            </motion.aside>
          )}
        </AnimatePresence>
      </div>

      {/* Mini Player */}
      <AnimatePresence>{currentSong && !showNowPlaying && <MiniPlayer />}</AnimatePresence>

      {/* Now Playing Fullscreen Overlay */}
      <AnimatePresence>{showNowPlaying && <NowPlayingOverlay />}</AnimatePresence>
    </div>
  );
}
