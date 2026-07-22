import { create } from 'zustand';
import type {
  SpotifyLinkedPlaylist,
  SpotifySearchResults,
  SpotifySearchType,
  DownloadHistoryItem,
  SyncProgress,
} from '../types';
import { useToastStore } from '@/stores/useToastStore';
import { useStreamingStore } from '@/stores/useStreamingStore';
import { useLibraryStore } from '@/stores/useLibraryStore';
import { createStreamSong } from '@/types/music';

interface SpotifyState {
  // Search
  searchQuery: string;
  searchType: SpotifySearchType;
  searchResults: SpotifySearchResults | null;
  isSearching: boolean;

  // Linked playlists
  linkedPlaylists: SpotifyLinkedPlaylist[];
  isLoadingPlaylists: boolean;

  // Download history
  history: DownloadHistoryItem[];
  isLoadingHistory: boolean;

  // Sync progress
  syncProgress: Record<string, SyncProgress>; // keyed by spotifyPlaylistId

  // Actions
  setSearchQuery: (q: string) => void;
  setSearchType: (t: SpotifySearchType) => void;
  search: (query?: string, type?: SpotifySearchType) => Promise<void>;
  clearSearch: () => void;

  loadLinkedPlaylists: () => Promise<void>;
  addLinkedPlaylist: (
    url: string,
    options?: { autoSync?: boolean; syncInterval?: number },
  ) => Promise<SpotifyLinkedPlaylist | null>;
  removeLinkedPlaylist: (spotifyId: string) => Promise<void>;
  toggleAutoSync: (spotifyId: string, autoSync: boolean) => Promise<void>;
  setSyncInterval: (spotifyId: string, interval: number) => Promise<void>;
  syncPlaylist: (
    spotifyId: string,
    localSpotifyIds: string[],
    keepRemovedSongs: boolean,
  ) => Promise<any>;

  loadHistory: () => Promise<void>;
}

export const useSpotifyStore = create<SpotifyState>((set, get) => ({
  searchQuery: '',
  searchType: 'track',
  searchResults: null,
  isSearching: false,
  linkedPlaylists: [],
  isLoadingPlaylists: false,
  history: [],
  isLoadingHistory: false,
  syncProgress: {},

  setSearchQuery: (q) => set({ searchQuery: q }),
  setSearchType: (t) => set({ searchType: t }),

  search: async (query, type) => {
    const q = query ?? get().searchQuery;
    const t = type ?? get().searchType;
    if (!q.trim()) return;

    set({ isSearching: true, searchResults: null });
    try {
      if (!window.electronAPI?.spotify) throw new Error('Spotify API not available');

      // Determine which types to search based on selected type
      const types =
        t === 'track'
          ? ['track']
          : t === 'album'
            ? ['album']
            : t === 'artist'
              ? ['artist']
              : t === 'playlist'
                ? ['playlist']
                : ['track', 'album', 'artist', 'playlist'];

      const results = await window.electronAPI.spotify.search(q, types);

      // Save user search query to localStorage for dynamic homepage Quick Picks
      try {
        const clean = q.trim();
        if (clean && clean.length >= 2) {
          const raw = localStorage.getItem('localspo_user_searches');
          const existing: string[] = raw ? JSON.parse(raw) : [];
          const updated = [clean, ...existing.filter((item) => item.toLowerCase() !== clean.toLowerCase())].slice(0, 30);
          localStorage.setItem('localspo_user_searches', JSON.stringify(updated));
        }
      } catch {}

      set({
        searchResults: {
          tracks: results.tracks || [],
          albums: results.albums || [],
          artists: results.artists || [],
          playlists: results.playlists || [],
        },
        isSearching: false,
      });

      // Background pre-stream top 5 search result tracks for instant play
      if (results.tracks && results.tracks.length > 0) {
        const streamingStore = useStreamingStore.getState();
        const libraryStore = useLibraryStore.getState();
        const songsToPrestream = results.tracks.slice(0, 5).map((t: any) => {
          const s = createStreamSong({
            id: `stream_${t.ytVideoId || t.id || t.spotifyId}`,
            title: t.title || t.name,
            artist: t.artist || t.artists?.[0]?.name || 'Unknown',
            album: t.album?.name || t.album || '',
            duration: (t.durationMs || t.duration_ms || 180000) / 1000,
            coverUrl: t.coverUrl || t.album?.images?.[0]?.url,
            ytVideoId: t.ytVideoId || undefined,
          });
          libraryStore.addStreamSong(s);
          return s;
        });
        streamingStore.prefetchPlaylist(songsToPrestream);
      }

    } catch (err: any) {
      console.error('Spotify search failed:', err);
      useToastStore.getState().showToast(`Search failed: ${err?.message || 'Unknown error'}`, 'error');
      set({ isSearching: false });
    }
  },

  clearSearch: () => set({ searchQuery: '', searchResults: null }),

  loadLinkedPlaylists: async () => {
    set({ isLoadingPlaylists: true });
    try {
      if (!window.electronAPI?.spotify) return;
      const playlists = await window.electronAPI.spotify.getLinkedPlaylists();
      set({ linkedPlaylists: playlists || [], isLoadingPlaylists: false });
    } catch (err) {
      console.error('Failed loading linked playlists:', err);
      set({ isLoadingPlaylists: false });
    }
  },

  addLinkedPlaylist: async (url, options) => {
    try {
      if (!window.electronAPI?.spotify) return null;
      const linked = await window.electronAPI.spotify.addLinkedPlaylist(url, options);
      await get().loadLinkedPlaylists();
      useToastStore.getState().showToast(`Playlist "${linked.name}" added to sync`, 'success');
      return linked;
    } catch (err: any) {
      console.error('Failed adding linked playlist:', err);
      useToastStore.getState().showToast(`Failed: ${err?.message || 'Could not add playlist'}`, 'error');
      return null;
    }
  },

  removeLinkedPlaylist: async (spotifyId) => {
    try {
      if (!window.electronAPI?.spotify) return;
      await window.electronAPI.spotify.removeLinkedPlaylist(spotifyId);
      set((state) => ({
        linkedPlaylists: state.linkedPlaylists.filter((p) => p.spotifyId !== spotifyId),
      }));
      useToastStore.getState().showToast('Playlist removed from sync', 'info');
    } catch (err) {
      console.error('Failed removing linked playlist:', err);
    }
  },

  toggleAutoSync: async (spotifyId, autoSync) => {
    try {
      if (!window.electronAPI?.spotify) return;
      await window.electronAPI.spotify.toggleAutoSync(spotifyId, autoSync);
      set((state) => ({
        linkedPlaylists: state.linkedPlaylists.map((p) =>
          p.spotifyId === spotifyId ? { ...p, autoSync } : p,
        ),
      }));
    } catch (err) {
      console.error('Failed toggling auto sync:', err);
    }
  },

  setSyncInterval: async (spotifyId, interval) => {
    try {
      if (!window.electronAPI?.spotify) return;
      await window.electronAPI.spotify.setSyncInterval(spotifyId, interval);
      set((state) => ({
        linkedPlaylists: state.linkedPlaylists.map((p) =>
          p.spotifyId === spotifyId ? { ...p, syncInterval: interval as any } : p,
        ),
      }));
    } catch (err) {
      console.error('Failed setting sync interval:', err);
    }
  },

  syncPlaylist: async (spotifyId, localSpotifyIds, keepRemovedSongs) => {
    try {
      if (!window.electronAPI?.spotify) return null;
      // Set syncing progress immediately
      set((state) => ({
        syncProgress: {
          ...state.syncProgress,
          [spotifyId]: {
            spotifyPlaylistId: spotifyId,
            phase: 'fetching',
            message: 'Fetching Spotify playlist...',
            newTracks: 0,
            removedTracks: 0,
            totalTracks: 0,
            downloadedTracks: 0,
          },
        },
      }));

      // Dynamically load other stores to resolve local playlist track IDs to avoid redundant downloads
      const { usePlaylistStore } = await import('@/stores/usePlaylistStore');
      const { useLibraryStore } = await import('@/stores/useLibraryStore');
      const { useDownloaderStore } = await import('./useDownloaderStore');

      const { playlists } = usePlaylistStore.getState();
      const { songs } = useLibraryStore.getState();
      const { queue } = useDownloaderStore.getState();
      const linked = get().linkedPlaylists.find((p) => p.spotifyId === spotifyId);

      let resolvedLocalSpotifyIds = localSpotifyIds;
      if (resolvedLocalSpotifyIds.length === 0 && linked && linked.localPlaylistId) {
        const localPlaylist = playlists.find((p) => p.id === linked.localPlaylistId);
        if (localPlaylist) {
          resolvedLocalSpotifyIds = localPlaylist.songIds
            .map((songId) => {
              const song = songs.find((s) => s.id === songId);
              if (!song) return null;
              const normalizedPath = song.path.replace(/\\/g, '/').toLowerCase();
              const queueMatch = queue.find(
                (item) => item.outputPath && item.outputPath.replace(/\\/g, '/').toLowerCase() === normalizedPath
              );
              return queueMatch?.spotifyId || null;
            })
            .filter(Boolean) as string[];
        }
      }

      const result = await window.electronAPI.spotify.syncPlaylist(
        spotifyId,
        resolvedLocalSpotifyIds,
        keepRemovedSongs,
      );
      // Update last sync time
      set((state) => ({
        linkedPlaylists: state.linkedPlaylists.map((p) =>
          p.spotifyId === spotifyId ? { ...p, lastSync: Date.now() } : p,
        ),
      }));
      useToastStore
        .getState()
        .showToast(
          `Sync complete: ${result?.newTrackIds?.length ?? 0} new tracks queued`,
          'success',
        );
      return result;
    } catch (err: any) {
      console.error('Playlist sync failed:', err);
      useToastStore.getState().showToast(`Sync failed: ${err?.message || 'Unknown error'}`, 'error');
      return null;
    }
  },

  loadHistory: async () => {
    set({ isLoadingHistory: true });
    try {
      if (!window.electronAPI?.spotify) return;
      const history = await window.electronAPI.spotify.getHistory();
      set({ history: history || [], isLoadingHistory: false });
    } catch (err) {
      console.error('Failed loading download history:', err);
      set({ isLoadingHistory: false });
    }
  },
}));

// ─── IPC Subscriptions ───────────────────────────────────────────────────────

if (typeof window !== 'undefined' && window.electronAPI?.spotify) {
  window.electronAPI.spotify.onLinkedPlaylistsUpdated((playlists: SpotifyLinkedPlaylist[]) => {
    useSpotifyStore.setState({ linkedPlaylists: playlists });
  });

  window.electronAPI.spotify.onSyncProgress((progress: SyncProgress) => {
    useSpotifyStore.setState((state) => ({
      syncProgress: {
        ...state.syncProgress,
        [progress.spotifyPlaylistId]: progress,
      },
    }));
  });

  window.electronAPI.spotify.onAutoSyncTrigger(async (spotifyId: string) => {
    // Auto-sync trigger from main process interval scheduler.
    // Dispatches a custom event so the Playlists tab can handle it with full local context.
    window.dispatchEvent(new CustomEvent('spotify:autoSyncTrigger', { detail: { spotifyId } }));
  });
}
