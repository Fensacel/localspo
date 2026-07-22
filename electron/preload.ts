import { contextBridge, ipcRenderer } from 'electron';

export interface ElectronAPI {
  // Window controls
  window: {
    minimize: () => void;
    maximize: () => void;
    close: () => void;
    isMaximized: () => Promise<boolean>;
  };
  // Dialog
  dialog: {
    openFolder: () => Promise<string | null>;
    openImage: () => Promise<string | null>;
  };
  // Data persistence
  data: {
    read: (fileName: string) => Promise<unknown>;
    write: (fileName: string, data: unknown) => Promise<boolean>;
  };
  // App info
  app: {
    getVersion: () => Promise<string>;
    getDataPath: () => Promise<string>;
    getUserDataPath: () => Promise<string>;
  };
  // Updater
  updater: {
    check: () => Promise<unknown>;
    download: () => Promise<unknown>;
    quitAndInstall: () => void;
    onStatus: (
      callback: (data: { status: string; version?: string; percent?: number; error?: string }) => void,
    ) => () => void;
  };
  // File system
  fs: {
    readFile: (filePath: string) => Promise<Buffer | null>;
    exists: (filePath: string) => Promise<boolean>;
    readDir: (dirPath: string) => Promise<Array<{ name: string; isDirectory: boolean; path: string }>>;
    stat: (filePath: string) => Promise<{ size: number; mtime: number } | null>;
    writeFile: (filePath: string, data: Buffer | string) => Promise<boolean>;
  };
  // Path utilities
  path: {
    join: (...segments: string[]) => Promise<string>;
    basename: (filePath: string) => Promise<string>;
    dirname: (filePath: string) => Promise<string>;
    extname: (filePath: string) => Promise<string>;
  };
  // Scanner
  scanner: {
    scan: (folderPath: string) => Promise<unknown>;
    getLibrary: () => Promise<unknown>;
    updateTags: (payload: {
      songId: string;
      filePath: string;
      title: string;
      artist: string;
      album: string;
      albumArtist?: string;
      year?: number;
      genre?: string;
      coverPath?: string | null;
      lyrics?: string | null;
      composer?: string;
      conductor?: string;
      copyright?: string;
      publisher?: string;
      isrc?: string;
      encodedBy?: string;
      grouping?: string;
      subtitle?: string;
      comment?: string;
      bpm?: number;
      key?: string;
      originalArtist?: string;
      remixer?: string;
    }) => Promise<{ success: boolean; updatedSong?: any }>;
    onProgress: (callback: (data: unknown) => void) => () => void;
  };
  // Lyrics
  lyrics: {
    read: (
      songId: string,
      audioPath: string,
      lrcPath: string | null,
      hasEmbeddedLyrics: boolean,
      artist?: string,
      title?: string,
      album?: string,
      duration?: number,
    ) => Promise<{ source: string; content: string } | null>;
  };
  // Downloader
  downloader: {
    downloadSpotify: (url: string) => Promise<any>;
    cancelDownload: (id: string) => Promise<boolean>;
    cancelAll: () => Promise<boolean>;
    getQueue: () => Promise<any[]>;
    retryDownload: (id: string) => Promise<boolean>;
    removeDownload: (id: string) => Promise<boolean>;
    clearFinished: () => Promise<boolean>;
    openDownloadFolder: () => Promise<boolean>;
    getSettings: () => Promise<any>;
    updateSettings: (settings: any) => Promise<any>;
    onQueueUpdated: (callback: (queue: any[]) => void) => () => void;
    onAutoImportFolder: (callback: (folder: string) => void) => () => void;
    onPlaylistTrackCompleted: (callback: (data: any) => void) => () => void;
  };
  // Spotify Sync
  spotify: {
    search: (query: string, types?: string[]) => Promise<any>;
    fetchUrl: (url: string) => Promise<string | null>;
    fetchPlaylistMeta: (url: string) => Promise<any>;
    getLinkedPlaylists: () => Promise<any[]>;
    addLinkedPlaylist: (url: string, options?: { autoSync?: boolean; syncInterval?: number }) => Promise<any>;
    removeLinkedPlaylist: (spotifyId: string) => Promise<boolean>;
    toggleAutoSync: (spotifyId: string, autoSync: boolean) => Promise<boolean>;
    setSyncInterval: (spotifyId: string, interval: number) => Promise<boolean>;
    syncPlaylist: (spotifyId: string, localSpotifyIds: string[], keepRemovedSongs: boolean) => Promise<any>;
    cachePlaylistCover: (spotifyId: string, coverUrl: string) => Promise<string | null>;
    updateLocalPlaylistId: (spotifyId: string, localPlaylistId: string) => Promise<boolean>;
    getHistory: () => Promise<any[]>;
    checkDuplicate: (spotifyId: string, isrc?: string, title?: string, artist?: string) => Promise<any>;
    onLinkedPlaylistsUpdated: (callback: (playlists: any[]) => void) => () => void;
    onSyncProgress: (callback: (progress: any) => void) => () => void;
    onAutoSyncTrigger: (callback: (spotifyId: string) => void) => () => void;
  };
  // Streaming
  streaming: {
    resolveUrl: (title: string, artist: string, album?: string, coverUrl?: string, forceRefresh?: boolean, durationSeconds?: number) => Promise<{
      url: string;
      videoId: string;
      expiresAt: number;
      title?: string;
      artist?: string;
      album?: string;
      coverUrl?: string;
      durationSeconds?: number;
    } | null>;
    resolveByVideoId: (videoId: string, forceRefresh?: boolean) => Promise<{ url: string; videoId: string; expiresAt: number } | null>;
    prefetch: (title: string, artist: string) => Promise<boolean>;
    pruneCache: () => Promise<{ cacheSize: number }>;
    clearCache: () => Promise<{ cacheSize: number }>;
    cacheStats: () => Promise<{ size: number }>;
  };
  // OBS Overlay
  obs: {
    getStatus: () => Promise<{
      running: boolean;
      port: number;
      lanAccess: boolean;
      localUrl: string;
      lanUrl: string | null;
      config: any;
    }>;
    startServer: () => Promise<any>;
    stopServer: () => Promise<any>;
    updateConfig: (newConfig: any) => Promise<any>;
    updateState: (payload: any, localCoverPath?: string | null, remoteCoverUrl?: string | null) => void;
  };
}

const electronAPI: ElectronAPI = {
  window: {
    minimize: () => ipcRenderer.send('window:minimize'),
    maximize: () => ipcRenderer.send('window:maximize'),
    close: () => ipcRenderer.send('window:close'),
    isMaximized: () => ipcRenderer.invoke('window:isMaximized'),
  },
  dialog: {
    openFolder: () => ipcRenderer.invoke('dialog:openFolder'),
    openImage: () => ipcRenderer.invoke('dialog:openImage'),
  },
  data: {
    read: (fileName) => ipcRenderer.invoke('data:read', fileName),
    write: (fileName, data) => ipcRenderer.invoke('data:write', fileName, data),
  },
  app: {
    getVersion: () => ipcRenderer.invoke('app:getVersion'),
    getDataPath: () => ipcRenderer.invoke('app:getDataPath'),
    getUserDataPath: () => ipcRenderer.invoke('app:getUserDataPath'),
  },
  updater: {
    check: () => ipcRenderer.invoke('updater:check'),
    download: () => ipcRenderer.invoke('updater:download'),
    quitAndInstall: () => ipcRenderer.send('updater:quitAndInstall'),
    onStatus: (callback) => {
      const handler = (_event: unknown, data: any) => callback(data);
      ipcRenderer.on('updater:status', handler);
      return () => ipcRenderer.removeListener('updater:status', handler);
    },
  },
  fs: {
    readFile: (filePath) => ipcRenderer.invoke('fs:readFile', filePath),
    exists: (filePath) => ipcRenderer.invoke('fs:exists', filePath),
    readDir: (dirPath) => ipcRenderer.invoke('fs:readDir', dirPath),
    stat: (filePath) => ipcRenderer.invoke('fs:stat', filePath),
    writeFile: (filePath, data) => ipcRenderer.invoke('fs:writeFile', filePath, data),
  },
  path: {
    join: (...segments) => ipcRenderer.invoke('path:join', ...segments),
    basename: (filePath) => ipcRenderer.invoke('path:basename', filePath),
    dirname: (filePath) => ipcRenderer.invoke('path:dirname', filePath),
    extname: (filePath) => ipcRenderer.invoke('path:extname', filePath),
  },
  scanner: {
    scan: (folderPath) => ipcRenderer.invoke('scanner:scan', folderPath),
    getLibrary: () => ipcRenderer.invoke('scanner:getLibrary'),
    updateTags: (payload) => ipcRenderer.invoke('scanner:updateTags', payload),
    onProgress: (callback) => {
      const handler = (_event: unknown, data: unknown) => callback(data);
      ipcRenderer.on('scanner:progress', handler);
      return () => ipcRenderer.removeListener('scanner:progress', handler);
    },
  },
  lyrics: {
    read: (songId, audioPath, lrcPath, hasEmbeddedLyrics, artist, title, album, duration) =>
      ipcRenderer.invoke('lyrics:read', songId, audioPath, lrcPath, hasEmbeddedLyrics, artist, title, album, duration),
  },
  downloader: {
    downloadSpotify: (url) => ipcRenderer.invoke('downloader:downloadSpotify', url),
    cancelDownload: (id) => ipcRenderer.invoke('downloader:cancelDownload', id),
    cancelAll: () => ipcRenderer.invoke('downloader:cancelAll'),
    getQueue: () => ipcRenderer.invoke('downloader:getQueue'),
    retryDownload: (id) => ipcRenderer.invoke('downloader:retryDownload', id),
    removeDownload: (id) => ipcRenderer.invoke('downloader:removeDownload', id),
    clearFinished: () => ipcRenderer.invoke('downloader:clearFinished'),
    openDownloadFolder: () => ipcRenderer.invoke('downloader:openDownloadFolder'),
    getSettings: () => ipcRenderer.invoke('downloader:getSettings'),
    updateSettings: (settings) => ipcRenderer.invoke('downloader:updateSettings', settings),
    onQueueUpdated: (callback) => {
      const handler = (_event: unknown, queue: any[]) => callback(queue);
      ipcRenderer.on('downloader:queueUpdated', handler);
      return () => ipcRenderer.removeListener('downloader:queueUpdated', handler);
    },
    onAutoImportFolder: (callback) => {
      const handler = (_event: unknown, folder: string) => callback(folder);
      ipcRenderer.on('scanner:autoImportFolder', handler);
      return () => ipcRenderer.removeListener('scanner:autoImportFolder', handler);
    },
    onPlaylistTrackCompleted: (callback) => {
      const handler = (_event: unknown, data: any) => callback(data);
      ipcRenderer.on('downloader:playlistTrackCompleted', handler);
      return () => ipcRenderer.removeListener('downloader:playlistTrackCompleted', handler);
    },
  },
  spotify: {
    search: (query, types) => ipcRenderer.invoke('spotify:search', query, types),
    fetchUrl: (url) => ipcRenderer.invoke('spotify:fetchUrl', url),
    fetchPlaylistMeta: (url) => ipcRenderer.invoke('spotify:fetchPlaylistMeta', url),
    getLinkedPlaylists: () => ipcRenderer.invoke('spotify:getLinkedPlaylists'),
    addLinkedPlaylist: (url, options) => ipcRenderer.invoke('spotify:addLinkedPlaylist', url, options),
    removeLinkedPlaylist: (spotifyId) => ipcRenderer.invoke('spotify:removeLinkedPlaylist', spotifyId),
    toggleAutoSync: (spotifyId, autoSync) => ipcRenderer.invoke('spotify:toggleAutoSync', spotifyId, autoSync),
    setSyncInterval: (spotifyId, interval) => ipcRenderer.invoke('spotify:setSyncInterval', spotifyId, interval),
    syncPlaylist: (spotifyId, localSpotifyIds, keepRemovedSongs) =>
      ipcRenderer.invoke('spotify:syncPlaylist', spotifyId, localSpotifyIds, keepRemovedSongs),
    cachePlaylistCover: (spotifyId, coverUrl) =>
      ipcRenderer.invoke('spotify:cachePlaylistCover', spotifyId, coverUrl),
    updateLocalPlaylistId: (spotifyId, localPlaylistId) =>
      ipcRenderer.invoke('spotify:updateLocalPlaylistId', spotifyId, localPlaylistId),
    getHistory: () => ipcRenderer.invoke('spotify:getHistory'),
    checkDuplicate: (spotifyId, isrc, title, artist) =>
      ipcRenderer.invoke('spotify:checkDuplicate', spotifyId, isrc, title, artist),
    onLinkedPlaylistsUpdated: (callback) => {
      const handler = (_event: unknown, playlists: any[]) => callback(playlists);
      ipcRenderer.on('spotify:linkedPlaylistsUpdated', handler);
      return () => ipcRenderer.removeListener('spotify:linkedPlaylistsUpdated', handler);
    },
    onSyncProgress: (callback) => {
      const handler = (_event: unknown, progress: any) => callback(progress);
      ipcRenderer.on('spotify:syncProgress', handler);
      return () => ipcRenderer.removeListener('spotify:syncProgress', handler);
    },
    onAutoSyncTrigger: (callback) => {
      const handler = (_event: unknown, spotifyId: string) => callback(spotifyId);
      ipcRenderer.on('spotify:autoSyncTrigger', handler);
      return () => ipcRenderer.removeListener('spotify:autoSyncTrigger', handler);
    },
  },
  streaming: {
    resolveUrl: (title, artist, album, coverUrl, forceRefresh, durationSeconds) =>
      ipcRenderer.invoke('streaming:resolveUrl', title, artist, album, coverUrl, forceRefresh, durationSeconds),
    resolveByVideoId: (videoId, forceRefresh) =>
      ipcRenderer.invoke('streaming:resolveByVideoId', videoId, forceRefresh),
    prefetch: (title, artist) =>
      ipcRenderer.invoke('streaming:prefetch', title, artist),
    pruneCache: () =>
      ipcRenderer.invoke('streaming:pruneCache'),
    clearCache: () =>
      ipcRenderer.invoke('streaming:clearCache'),
    cacheStats: () =>
      ipcRenderer.invoke('streaming:cacheStats'),
  },
  obs: {
    getStatus: () => ipcRenderer.invoke('obs:getStatus'),
    startServer: () => ipcRenderer.invoke('obs:start'),
    stopServer: () => ipcRenderer.invoke('obs:stop'),
    updateConfig: (newConfig) => ipcRenderer.invoke('obs:updateConfig', newConfig),
    updateState: (payload, localCoverPath, remoteCoverUrl) =>
      ipcRenderer.send('obs:updateState', payload, localCoverPath, remoteCoverUrl),
  },
};

contextBridge.exposeInMainWorld('electronAPI', electronAPI);
