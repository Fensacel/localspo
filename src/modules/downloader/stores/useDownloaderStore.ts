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
}
