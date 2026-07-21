export interface PlatformAPI {
  isElectron: boolean;
  isAndroid: boolean;

  dialog: {
    openFolder: () => Promise<string | null>;
    openImage: () => Promise<string | null>;
  };

  data: {
    read: <T = unknown>(key: string) => Promise<T | null>;
    write: <T = unknown>(key: string, value: T) => Promise<boolean>;
  };

  scanner: {
    scanFolder: (path: string) => Promise<any>;
    getLibrary: () => Promise<any>;
    updateTags?: (params: any) => Promise<any>;
    onProgress: (callback: (data: any) => void) => () => void;
  };

  lyrics: {
    read: (...args: any[]) => Promise<{ source: string; content: string } | null>;
  };

  app: {
    getVersion: () => Promise<string>;
  };

  updater?: {
    isAvailable: boolean;
    check: () => void;
    quitAndInstall?: () => void;
    onStatus?: (callback: (data: any) => void) => () => void;
  };

  downloader?: {
    isAvailable: boolean;
    getQueue?: () => Promise<any[]>;
    getSettings?: () => Promise<any>;
    downloadSpotify?: (url: string) => Promise<any>;
    cancelDownload?: (id: string) => Promise<any>;
    cancelAll?: () => Promise<any>;
    retryDownload?: (id: string) => Promise<any>;
    removeDownload?: (id: string) => Promise<any>;
    clearFinished?: () => Promise<any>;
    openDownloadFolder?: () => Promise<any>;
    updateSettings?: (partial: any) => Promise<any>;
    onQueueUpdated?: (callback: (queue: any[]) => void) => () => void;
    onAutoImportFolder?: (callback: (folder: string) => void) => () => void;
  };
}
