import { create } from 'zustand';
import type { Song, RepeatMode, ShuffleMode } from '@/types';

interface PlayerState {
  // Current playback
  currentSong: Song | null;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  isMuted: boolean;
  playbackSpeed: number;

  // Queue
  queue: Song[];
  originalQueue: Song[];
  queueIndex: number;
  history: Song[];

  // Modes
  repeatMode: RepeatMode;
  shuffleMode: ShuffleMode;

  // UI state
  showQueue: boolean;
  showLyrics: boolean;
  showNowPlaying: boolean;

  // Actions
  setCurrentSong: (song: Song | null) => void;
  setIsPlaying: (playing: boolean) => void;
  setCurrentTime: (time: number) => void;
  setDuration: (duration: number) => void;
  setVolume: (volume: number) => void;
  toggleMute: () => void;
  setPlaybackSpeed: (speed: number) => void;

  // Queue actions
  setQueue: (songs: Song[], startIndex?: number) => void;
  addToQueue: (song: Song) => void;
  removeFromQueue: (index: number) => void;
  clearQueue: () => void;
  playNext: () => Song | null;
  playPrevious: () => Song | null;
  moveInQueue: (from: number, to: number) => void;

  // Mode actions
  toggleRepeat: () => void;
  toggleShuffle: () => void;

  // UI actions
  toggleQueue: () => void;
  toggleLyrics: () => void;
  toggleNowPlaying: () => void;
  setShowNowPlaying: (show: boolean) => void;
}

function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

export const usePlayerStore = create<PlayerState>((set, get) => ({
  currentSong: null,
  isPlaying: false,
  currentTime: 0,
  duration: 0,
  volume: 0.8,
  isMuted: false,
  playbackSpeed: 1,

  queue: [],
  originalQueue: [],
  queueIndex: -1,
  history: [],

  repeatMode: 'off',
  shuffleMode: 'off',

  showQueue: false,
  showLyrics: false,
  showNowPlaying: false,

  setCurrentSong: (song) => set({ currentSong: song }),
  setIsPlaying: (isPlaying) => set({ isPlaying }),
  setCurrentTime: (currentTime) => set({ currentTime }),
  setDuration: (duration) => set({ duration }),
  setVolume: (volume) => set({ volume, isMuted: false }),

  toggleMute: () => set((state) => ({ isMuted: !state.isMuted })),

  setPlaybackSpeed: (playbackSpeed) => set({ playbackSpeed }),

  setQueue: (songs, startIndex = 0) => {
    const state = get();
    const originalQueue = [...songs];
    let queue: Song[];
    let queueIndex: number;

    if (state.shuffleMode === 'on') {
      const currentSong = songs[startIndex];
      const rest = songs.filter((_, i) => i !== startIndex);
      queue = [currentSong, ...shuffleArray(rest)];
      queueIndex = 0;
    } else {
      queue = [...songs];
      queueIndex = startIndex;
    }

    set({
      queue,
      originalQueue,
      queueIndex,
      currentSong: queue[queueIndex] ?? null,
      isPlaying: true,
    });
  },

  addToQueue: (song) =>
    set((state) => ({
      queue: [...state.queue, song],
      originalQueue: [...state.originalQueue, song],
    })),

  removeFromQueue: (index) =>
    set((state) => {
      const queue = state.queue.filter((_, i) => i !== index);
      const queueIndex = index < state.queueIndex ? state.queueIndex - 1 : state.queueIndex;
      return { queue, queueIndex };
    }),

  clearQueue: () =>
    set({
      queue: [],
      originalQueue: [],
      queueIndex: -1,
    }),

  playNext: () => {
    const state = get();
    const { queue, queueIndex, repeatMode } = state;

    if (queue.length === 0) return null;

    let nextIndex: number;

    if (repeatMode === 'one') {
      nextIndex = queueIndex;
    } else if (queueIndex < queue.length - 1) {
      nextIndex = queueIndex + 1;
    } else if (repeatMode === 'all') {
      nextIndex = 0;
    } else {
      set({ isPlaying: false });
      return null;
    }

    const nextSong = queue[nextIndex];
    set({
      queueIndex: nextIndex,
      currentSong: nextSong,
      currentTime: 0,
      isPlaying: true,
      history: state.currentSong ? [...state.history, state.currentSong] : state.history,
    });
    return nextSong;
  },

  playPrevious: () => {
    const state = get();
    const { queue, queueIndex, currentTime } = state;

    if (queue.length === 0) return null;

    // If more than 3 seconds in, restart current song
    if (currentTime > 3) {
      set({ currentTime: 0 });
      return state.currentSong;
    }

    const prevIndex = queueIndex > 0 ? queueIndex - 1 : queue.length - 1;
    const prevSong = queue[prevIndex];

    set({
      queueIndex: prevIndex,
      currentSong: prevSong,
      currentTime: 0,
      isPlaying: true,
    });
    return prevSong;
  },

  moveInQueue: (from, to) =>
    set((state) => {
      const queue = [...state.queue];
      const [moved] = queue.splice(from, 1);
      queue.splice(to, 0, moved);

      let queueIndex = state.queueIndex;
      if (from === queueIndex) {
        queueIndex = to;
      } else if (from < queueIndex && to >= queueIndex) {
        queueIndex--;
      } else if (from > queueIndex && to <= queueIndex) {
        queueIndex++;
      }

      return { queue, queueIndex };
    }),

  toggleRepeat: () =>
    set((state) => {
      const modes: RepeatMode[] = ['off', 'all', 'one'];
      const currentIndex = modes.indexOf(state.repeatMode);
      return { repeatMode: modes[(currentIndex + 1) % modes.length] };
    }),

  toggleShuffle: () =>
    set((state) => {
      if (state.shuffleMode === 'off') {
        const currentSong = state.currentSong;
        const rest = state.queue.filter((s) => s.id !== currentSong?.id);
        const shuffledRest = shuffleArray(rest);
        const newQueue = currentSong ? [currentSong, ...shuffledRest] : shuffledRest;
        return {
          shuffleMode: 'on',
          queue: newQueue,
          queueIndex: 0,
        };
      } else {
        const currentSong = state.currentSong;
        const originalIndex = currentSong
          ? state.originalQueue.findIndex((s) => s.id === currentSong.id)
          : 0;
        return {
          shuffleMode: 'off',
          queue: [...state.originalQueue],
          queueIndex: Math.max(0, originalIndex),
        };
      }
    }),

  toggleQueue: () => set((state) => ({ showQueue: !state.showQueue })),
  toggleLyrics: () => set((state) => ({ showLyrics: !state.showLyrics })),
  toggleNowPlaying: () =>
    set((state) => ({
      showNowPlaying: !state.showNowPlaying,
    })),
  setShowNowPlaying: (show) => set({ showNowPlaying: show }),
}));
