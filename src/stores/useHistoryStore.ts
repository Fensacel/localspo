import { create } from 'zustand';
import type { Song, HistoryEntry } from '@/types';
import { platformService } from '@/platform';

interface HistoryState {
  entries: HistoryEntry[];
  isLoaded: boolean;
  loadHistory: () => Promise<void>;
  addHistoryEntry: (song: Song) => Promise<void>;
  clearHistory: () => Promise<void>;
  removeFromHistory: (songId: string) => Promise<void>;
}

export const useHistoryStore = create<HistoryState>((set, get) => ({
  entries: [],
  isLoaded: false,

  loadHistory: async () => {
    try {
      const data = (await platformService.data.read('history.json')) as {
        entries: HistoryEntry[];
      } | null;
      if (data && Array.isArray(data.entries)) {
        set({ entries: data.entries, isLoaded: true });
      } else {
        set({ entries: [], isLoaded: true });
      }
    } catch {
      set({ entries: [], isLoaded: true });
    }
  },

  addHistoryEntry: async (song) => {
    const { entries } = get();
    const now = Date.now();

    // Prevent duplicate entry if the most recent history entry is for the same song within 60 seconds
    if (entries.length > 0) {
      const lastEntry = entries[0];
      if (lastEntry.songId === song.id && now - lastEntry.playedAt < 60000) {
        return;
      }
    }

    // Create new entry
    const newEntry: HistoryEntry = {
      songId: song.id,
      playedAt: now,
      duration: song.duration,
      songData: song,
    };

    const updatedEntries = [newEntry, ...entries].slice(0, 1000);
    set({ entries: updatedEntries });
    await platformService.data.write('history.json', { entries: updatedEntries });
  },

  clearHistory: async () => {
    set({ entries: [] });
    await platformService.data.write('history.json', { entries: [] });
  },

  removeFromHistory: async (songId: string) => {
    const { entries } = get();
    const updatedEntries = entries.filter((e) => e.songId !== songId);
    set({ entries: updatedEntries });
    await platformService.data.write('history.json', { entries: updatedEntries });
  },
}));

