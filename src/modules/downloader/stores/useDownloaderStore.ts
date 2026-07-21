import { create } from 'zustand';
import type { DownloadItem, DownloaderSettings } from '../types';
import { useToastStore } from '@/stores/useToastStore';

interface DownloaderState {
  queue: DownloadItem[];
  settings: DownloaderSettings | null;
  isLoading: boolean;
  isAdding: boolean;

  loadQueue: () => Promise<void>;
  loadSettings: () => Promise<void>;
  downloadUrl: (url: string) => Promise<boolean>;
  cancelDownload: (id: string) => Promise<void>;
  cancelAll: () => Promise<void>;
  retryDownload: (id: string) => Promise<void>;
  removeDownload: (id: string) => Promise<void>;
  clearFinished: () => Promise<void>;
  openDownloadFolder: () => Promise<void>;
  updateSettings: (partial: Partial<DownloaderSettings>) => Promise<void>;
}

export const useDownloaderStore = create<DownloaderState>((set, get) => ({
  queue: [],
  settings: null,
  isLoading: false,
  isAdding: false,

  loadQueue: async () => {
    try {
      if (!window.electronAPI?.downloader) return;
      const queue = await window.electronAPI.downloader.getQueue();
      set({ queue: queue || [] });
    } catch (err) {
      console.error('Failed loading downloader queue:', err);
    }
  },

  loadSettings: async () => {
    try {
      if (!window.electronAPI?.downloader) return;
      const settings = await window.electronAPI.downloader.getSettings();
      set({ settings });
    } catch (err) {
      console.error('Failed loading downloader settings:', err);
    }
  },

  downloadUrl: async (url: string) => {
    if (!url.trim()) return false;
    set({ isAdding: true });
    try {
      const addedItems = await window.electronAPI.downloader.downloadSpotify(url);
      if (addedItems && addedItems.length > 0) {
        useToastStore.getState().showToast(`Added ${addedItems.length} track(s) to queue`, 'success');
        await get().loadQueue();
        return true;
      } else {
        useToastStore.getState().showToast('No new tracks added (already in queue or invalid URL)', 'info');
        return false;
      }
    } catch (err: any) {
      console.error('Failed adding download:', err);
      useToastStore.getState().showToast(`Error: ${err?.message || 'Failed to fetch Spotify metadata'}`, 'error');
      return false;
    } finally {
      set({ isAdding: false });
    }
  },

  cancelDownload: async (id: string) => {
    try {
      await window.electronAPI.downloader.cancelDownload(id);
      await get().loadQueue();
    } catch (err) {
      console.error('Error cancelling download:', err);
    }
  },

  cancelAll: async () => {
    try {
      if (window.electronAPI?.downloader?.cancelAll) {
        await window.electronAPI.downloader.cancelAll();
        await get().loadQueue();
        useToastStore.getState().showToast('Cancelled all active & queued downloads', 'info');
      }
    } catch (err) {
      console.error('Error cancelling all downloads:', err);
    }
  },

  retryDownload: async (id: string) => {
    try {
      await window.electronAPI.downloader.retryDownload(id);
      await get().loadQueue();
    } catch (err) {
      console.error('Error retrying download:', err);
    }
  },

  removeDownload: async (id: string) => {
    try {
      await window.electronAPI.downloader.removeDownload(id);
      await get().loadQueue();
    } catch (err) {
      console.error('Error removing download:', err);
    }
  },

  clearFinished: async () => {
    try {
      await window.electronAPI.downloader.clearFinished();
      await get().loadQueue();
      useToastStore.getState().showToast('Cleared completed & cancelled downloads', 'info');
    } catch (err) {
      console.error('Error clearing finished downloads:', err);
    }
  },

  openDownloadFolder: async () => {
    try {
      await window.electronAPI.downloader.openDownloadFolder();
    } catch (err) {
      console.error('Error opening download folder:', err);
    }
  },

  updateSettings: async (partial: Partial<DownloaderSettings>) => {
    try {
      const updated = await window.electronAPI.downloader.updateSettings(partial);
      set({ settings: updated });
      useToastStore.getState().showToast('Downloader settings saved', 'success');
    } catch (err) {
      console.error('Error updating downloader settings:', err);
    }
  },
}));

// Setup IPC listener subscriptions
if (typeof window !== 'undefined' && window.electronAPI?.downloader) {
  window.electronAPI.downloader.onQueueUpdated((queue: any[]) => {
    useDownloaderStore.setState({ queue });
  });

  window.electronAPI.downloader.onAutoImportFolder(async (folder: string) => {
    try {
      // Add folder to music folders & scan
      await window.electronAPI.scanner.scan(folder);
    } catch (err) {
      console.error('Auto import scan error:', err);
    }
  });

  // Auto playlist creation helper with race condition prevention
  const activeSyncJobs = new Set<string>();
  const createdPlaylistsCache = new Map<string, string>(); // spotifyId -> localPlaylistId or 'PENDING'

  const syncPlaylistJobLocal = async (playlistJobId: string) => {
    if (activeSyncJobs.has(playlistJobId)) {
      return;
    }

    if (createdPlaylistsCache.get(playlistJobId) === 'PENDING') {
      return;
    }

    activeSyncJobs.add(playlistJobId);

    try {
      const { queue } = useDownloaderStore.getState();
      const settings = useDownloaderStore.getState().settings;
      if (!settings?.autoCreatePlaylist) return;

      const jobTracks = queue.filter((i) => i.playlistJobId === playlistJobId);
      const pendingTracks = jobTracks.filter(
        (i) => i.status === 'queued' || i.status === 'downloading' || i.status === 'tagging',
      );

      // Only proceed when all tracks in this job are completed, failed, or cancelled
      if (pendingTracks.length > 0 || jobTracks.length === 0) return;

      // Import stores dynamically to avoid circular dependencies
      const { usePlaylistStore } = await import('@/stores/usePlaylistStore');
      const { useSpotifyStore } = await import('./useSpotifyStore');
      const { useLibraryStore } = await import('@/stores/useLibraryStore');

      const linkedPlaylists = useSpotifyStore.getState().linkedPlaylists;
      const linkedPlaylist = linkedPlaylists.find((p) => p.spotifyId === playlistJobId);
      if (!linkedPlaylist) return;

      const completedTracks = jobTracks.filter((i) => i.status === 'completed' && i.outputPath);
      if (completedTracks.length === 0) return;

      const allSongs = useLibraryStore.getState().songs;
      const songIds: string[] = [];
      for (const track of completedTracks) {
        if (!track.outputPath) continue;
        const normalizedPath = track.outputPath.replace(/\\/g, '/').toLowerCase();
        const match = allSongs.find(
          (s) => s.path && s.path.replace(/\\/g, '/').toLowerCase() === normalizedPath,
        );
        if (match) songIds.push(match.id);
      }

      // If we matched no songs, it means the scanner hasn't indexed them yet.
      // We will try again when a scanner done event is fired.
      if (songIds.length === 0) {
        console.log(`[AutoPlaylist] No songs indexed yet for job ${playlistJobId}, waiting for scanner...`);
        return;
      }

      const { playlists, createPlaylist, addSongToPlaylist, updatePlaylist } = usePlaylistStore.getState();

      const cachedLocalId = createdPlaylistsCache.get(playlistJobId);
      let existingLocal = cachedLocalId && cachedLocalId !== 'PENDING'
        ? playlists.find((p) => p.id === cachedLocalId)
        : null;

      if (!existingLocal) {
        existingLocal = linkedPlaylist.localPlaylistId
          ? playlists.find((p) => p.id === linkedPlaylist.localPlaylistId)
          : playlists.find((p) => p.spotifyId === playlistJobId);
      }

      if (existingLocal) {
        const newIds = songIds.filter((id) => !existingLocal.songIds.includes(id));
        for (const songId of newIds) {
          await addSongToPlaylist(existingLocal.id, songId);
        }
        console.log(`[AutoPlaylist] Added ${newIds.length} new songs to existing local playlist: ${existingLocal.name}`);
      } else {
        const playlistName = linkedPlaylist.name || 'Spotify Playlist';
        
        // Mark as pending creation in cache
        createdPlaylistsCache.set(playlistJobId, 'PENDING');

        const newPlaylist = await createPlaylist(playlistName, linkedPlaylist.description || '');
        
        // Update cache with the actual ID
        createdPlaylistsCache.set(playlistJobId, newPlaylist.id);

        await updatePlaylist(newPlaylist.id, {
          spotifyId: playlistJobId,
          spotifyOwner: linkedPlaylist.owner,
          spotifyDescription: linkedPlaylist.description,
          lastSpotifySync: Date.now(),
        });

        for (const songId of songIds) {
          await addSongToPlaylist(newPlaylist.id, songId);
        }

        if (window.electronAPI?.spotify) {
          await window.electronAPI.spotify.updateLocalPlaylistId(playlistJobId, newPlaylist.id);
        }
        console.log(`[AutoPlaylist] Created new local playlist "${playlistName}" with ${songIds.length} songs`);
      }
    } catch (err) {
      console.error('[AutoPlaylist] Error syncing playlist job locally:', err);
    } finally {
      activeSyncJobs.delete(playlistJobId);
    }
  };

  // Listen to track completion and run the sync
  window.electronAPI.downloader.onPlaylistTrackCompleted(async (data: { playlistJobId?: string }) => {
    const { playlistJobId } = data;
    if (!playlistJobId) return;
    
    // Delay slightly to let the queue store status update
    setTimeout(() => {
      syncPlaylistJobLocal(playlistJobId);
    }, 1000);
  });

  // Listen to library scanner finished event to run any pending playlist creations
  window.addEventListener('spotify:libraryScanCompleted', () => {
    console.log('[AutoPlaylist] Library scan completed, checking for pending playlist jobs...');
    const { queue } = useDownloaderStore.getState();
    const jobIds = [...new Set(queue.map((i) => i.playlistJobId).filter(Boolean))] as string[];
    
    for (const jobId of jobIds) {
      syncPlaylistJobLocal(jobId);
    }
  });
}


