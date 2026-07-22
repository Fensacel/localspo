import type { PlatformAPI } from './types';

export const electronPlatform: PlatformAPI = {
  isElectron: true,
  isAndroid: false,

  dialog: {
    openFolder: () => window.electronAPI?.dialog?.openFolder?.() ?? Promise.resolve(null),
    openImage: () => window.electronAPI?.dialog?.openImage?.() ?? Promise.resolve(null),
  },

  data: {
    read: <T = unknown>(key: string) => window.electronAPI?.data?.read?.(key) as Promise<T | null>,
    write: <T = unknown>(key: string, value: T) => window.electronAPI?.data?.write?.(key, value) as Promise<boolean>,
  },

  scanner: {
    scanFolder: (path: string) => window.electronAPI?.scanner?.scan?.(path) ?? Promise.resolve(null),
    getLibrary: () => window.electronAPI?.scanner?.getLibrary?.() ?? Promise.resolve(null),
    updateTags: (params: any) => window.electronAPI?.scanner?.updateTags?.(params) ?? Promise.resolve(null),
    onProgress: (callback: (data: any) => void) => window.electronAPI?.scanner?.onProgress?.(callback) ?? (() => { }),
  },

  lyrics: {
    read: (...args: any[]) => window.electronAPI?.lyrics?.read?.(...args) ?? Promise.resolve(null),
  },

  app: {
    getVersion: () => window.electronAPI?.app?.getVersion?.() ?? Promise.resolve('2.0.1'),
  },

  updater: {
    isAvailable: true,
    check: () => window.electronAPI?.updater?.check?.(),
    quitAndInstall: () => window.electronAPI?.updater?.quitAndInstall?.(),
    onStatus: (callback: (data: any) => void) => window.electronAPI?.updater?.onStatus?.(callback) ?? (() => { }),
  },

  downloader: {
    isAvailable: true,
    getQueue: () => window.electronAPI?.downloader?.getQueue?.() ?? Promise.resolve([]),
    getSettings: () => window.electronAPI?.downloader?.getSettings?.() ?? Promise.resolve(null),
    downloadSpotify: (url: string) => window.electronAPI?.downloader?.downloadSpotify?.(url) ?? Promise.resolve([]),
    cancelDownload: (id: string) => window.electronAPI?.downloader?.cancelDownload?.(id) ?? Promise.resolve(null),
    cancelAll: () => window.electronAPI?.downloader?.cancelAll?.() ?? Promise.resolve(null),
    retryDownload: (id: string) => window.electronAPI?.downloader?.retryDownload?.(id) ?? Promise.resolve(null),
    removeDownload: (id: string) => window.electronAPI?.downloader?.removeDownload?.(id) ?? Promise.resolve(null),
    clearFinished: () => window.electronAPI?.downloader?.clearFinished?.() ?? Promise.resolve(null),
    openDownloadFolder: () => window.electronAPI?.downloader?.openDownloadFolder?.() ?? Promise.resolve(null),
    updateSettings: (partial: any) => window.electronAPI?.downloader?.updateSettings?.(partial) ?? Promise.resolve(null),
    onQueueUpdated: (callback: (queue: any[]) => void) => window.electronAPI?.downloader?.onQueueUpdated?.(callback) ?? (() => { }),
    onAutoImportFolder: (callback: (folder: string) => void) => window.electronAPI?.downloader?.onAutoImportFolder?.(callback) ?? (() => { }),
  },
};
