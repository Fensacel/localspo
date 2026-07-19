import { create } from 'zustand';
import type { HistoryEntry } from '@/types';

interface HistoryState {
  entries: HistoryEntry[];
  isLoaded: boolean;
  loadHistory: () => Promise<void>;
  addHistoryEntry: (songId: string, duration: number) => Promise<void>;
  clearHistory: () => Promise<void>;
}

export const useHistoryStore = create<HistoryState>((set, get) => ({
  entries: [],
  isLoaded: false,

  loadHistory: async () => {
    try {
      const data = (await window.electronAPI.data.read('history.json')) as {
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

  addHistoryEntry: async (songId, duration) => {
    const { entries } = get();
    // Create new entry
    const newEntry: HistoryEntry = {
      songId,
      playedAt: Date.now(),
      duration,
    };

    // Filter out duplicates within a short timeframe or just keep the last 1000 entries
    const updatedEntries = [newEntry, ...entries].slice(0, 1000);

    set({ entries: updatedEntries });
    await window.electronAPI.data.write('history.json', { entries: updatedEntries });

    // Also update play count in the library store and write back to library.json
    try {
      const { songs, albums, artists, lastScan } = useLibraryStore.getState();
      const updatedSongs = songs.map((s) => {
        if (s.id === songId) {
          return { ...s, playCount: (s.playCount || 0) + 1 };
        }
        return s;
      });

      // Update library state
      useLibraryStore.setState({ songs: updatedSongs });

      // Save to library.json
      await window.electronAPI.data.write('library.json', {
        songs: updatedSongs,
        albums,
        artists,
        lastScan,
      });
    } catch (err) {
      console.error('Failed to update song play count:', err);
    }
  },

  clearHistory: async () => {
    set({ entries: [] });
    await window.electronAPI.data.write('history.json', { entries: [] });
  },
}));

// We need to import useLibraryStore inside the file to perform library.json updates
import { useLibraryStore } from './useLibraryStore';
