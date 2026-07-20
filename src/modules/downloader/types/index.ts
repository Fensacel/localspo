export type DownloadStatus = 'queued' | 'downloading' | 'tagging' | 'completed' | 'failed' | 'cancelled';

export interface DownloadItem {
  id: string;
  spotifyUrl: string;
  spotifyId: string;
  title: string;
  artist: string;
  album: string;
  coverUrl: string | null;
  status: DownloadStatus;
  progress: number;
  speed: string;
  eta: string;
  errorMessage?: string;
  outputPath?: string;
  addedAt: number;
  attempts: number;
}

export interface DownloaderSettings {
  downloadFolder: string;
  audioFormat: 'mp3' | 'flac' | 'm4a' | 'wav';
  audioBitrate: '320k' | '256k' | '192k' | '128k';
  getLyrics: boolean;
  createLrcFile: boolean;
  autoImport: boolean;
  concurrentDownloads: number;
  retryCount: number;
}
