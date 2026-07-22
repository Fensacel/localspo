import { create } from 'zustand';
import type { Song } from '@/types';
import { useToastStore } from './useToastStore';

interface StreamCacheEntry {
  url: string;
  videoId: string;
  expiresAt: number;
}

interface StreamingState {
  /** Cache: songId -> resolved stream entry */
  cache: Map<string, StreamCacheEntry>;
  /** Set of songIds currently being resolved */
  resolving: Set<string>;
  /** Error map: songId -> error message */
  errors: Record<string, string>;
  /** Whether streaming is globally enabled */
  enabled: boolean;

  // Actions
  resolveStreamUrl: (song: Song, forceRefresh?: boolean) => Promise<string | null>;
  prefetchNext: (song: Song) => void;
  prefetchPlaylist: (songs: Song[]) => void;
  getCachedUrl: (songId: string) => string | null;
  isResolving: (songId: string) => boolean;
  clearError: (songId: string) => void;
  setEnabled: (enabled: boolean) => void;
}

export const useStreamingStore = create<StreamingState>((set, get) => ({
  cache: new Map(),
  resolving: new Set(),
  errors: {},
  enabled: true,

  setEnabled: (enabled) => set({ enabled }),

  getCachedUrl: (songId) => {
    const entry = get().cache.get(songId);
    if (!entry) return null;
    // Check expiry (with 60s buffer)
    if (Date.now() >= entry.expiresAt - 60_000) {
      // Expired — remove from cache
      const cache = new Map(get().cache);
      cache.delete(songId);
      set({ cache });
      return null;
    }
    return entry.url;
  },

  isResolving: (songId) => get().resolving.has(songId),

  clearError: (songId) => {
    const errors = { ...get().errors };
    delete errors[songId];
    set({ errors });
  },

  resolveStreamUrl: async (song: Song, forceRefresh = false): Promise<string | null> => {
    if (!get().enabled) return null;
    if (!window.electronAPI?.streaming) return null;

    const songId = song.id;

    // If song has a local path, no need for streaming
    if (song.path) return null;

    if (forceRefresh) {
      console.log(`[StreamingStore] Force refresh requested for: ${song.artist} - ${song.title}`);
      const cache = new Map(get().cache);
      cache.delete(songId);
      set({ cache });
    } else {
      // Return from cache if valid
      const cached = get().getCachedUrl(songId);
      if (cached) {
        console.log(`[StreamingStore] Cache hit for: ${song.artist} - ${song.title}`);
        return cached;
      }
    }

    // Already resolving?
    if (get().resolving.has(songId)) {
      console.log(`[StreamingStore] Already resolving: ${song.artist} - ${song.title}`);
      // Wait up to 30s for resolution to complete
      return new Promise((resolve) => {
        let attempts = 0;
        const check = setInterval(() => {
          attempts++;
          const url = get().getCachedUrl(songId);
          if (url || attempts > 30) {
            clearInterval(check);
            resolve(url);
          }
        }, 1000);
      });
    }

    // Mark as resolving
    const resolving = new Set(get().resolving);
    resolving.add(songId);
    set({ resolving });

    // Clear any previous error
    const errors = { ...get().errors };
    delete errors[songId];
    set({ errors });

    try {
      console.log(`[StreamingStore] Resolving stream for: ${song.artist} - ${song.title}`);

      let result = null;
      const isValidYtId = song.ytVideoId && song.ytVideoId.length === 11 && !song.ytVideoId.includes(' ') && /^[a-zA-Z0-9_-]{11}$/.test(song.ytVideoId);
      if (isValidYtId) {
        result = await window.electronAPI.streaming.resolveByVideoId(song.ytVideoId!, forceRefresh);
      }

      if (!result) {
        result = await window.electronAPI.streaming.resolveUrl(
          song.title,
          song.artist,
          song.album || undefined,
          (song.remoteCoverUrl || song.coverPath) ?? undefined,
          forceRefresh,
        );
      }

      if (result?.url) {
        console.log(`[StreamingStore] Resolved URL for: ${song.artist} - ${song.title}`);
        const cache = new Map(get().cache);
        cache.set(songId, {
          url: result.url,
          videoId: result.videoId,
          expiresAt: result.expiresAt,
        });
        set({ cache });
        return result.url;
      }

      const errMsg = 'Stream URL not available';
      set({ errors: { ...get().errors, [songId]: errMsg } });
      useToastStore
        .getState()
        .showToast(`Cannot stream "${song.title}" — no URL found`, 'error');
      return null;
    } catch (err: any) {
      const errMsg = err?.message || 'Stream resolution failed';
      set({ errors: { ...get().errors, [songId]: errMsg } });
      useToastStore.getState().showToast(`Stream error: ${errMsg}`, 'error');
      return null;
    } finally {
      const resolving = new Set(get().resolving);
      resolving.delete(songId);
      set({ resolving });
    }
  },

  prefetchNext: (song: Song) => {
    if (!get().enabled) return;
    if (!window.electronAPI?.streaming) return;
    if (song.path) return; // Already local
    if (get().getCachedUrl(song.id)) return; // Already cached
    if (get().resolving.has(song.id)) return; // Already resolving

    console.log(`[StreamingStore] Prefetching next stream: ${song.artist} - ${song.title}`);
    get().resolveStreamUrl(song).catch(() => {});
  },

  prefetchPlaylist: (songs: Song[]) => {
    if (!get().enabled) return;
    if (!window.electronAPI?.streaming) return;

    const toResolve = songs
      .filter((s) => s && !s.path && (s.ytVideoId || s.sourceType === 'streaming' || s.id.startsWith('stream_')))
      .filter((s) => !get().getCachedUrl(s.id) && !get().resolving.has(s.id))
      .slice(0, 15);

    if (toResolve.length === 0) return;

    console.log(`[StreamingStore] Background pre-streaming ${toResolve.length} tracks...`);
    (async () => {
      for (const song of toResolve) {
        try {
          await get().resolveStreamUrl(song);
          await new Promise((r) => setTimeout(r, 400));
        } catch {}
      }
    })();
  },

}));
