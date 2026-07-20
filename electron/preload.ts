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
};

contextBridge.exposeInMainWorld('electronAPI', electronAPI);
