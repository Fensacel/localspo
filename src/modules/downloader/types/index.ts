// ─── Download Status ─────────────────────────────────────

export type DownloadStatus =
  | 'queued'
  | 'downloading'
  | 'tagging'
  | 'lyrics'
  | 'importing'
  | 'completed'
  | 'failed'
  | 'cancelled'
  | 'skipped'; // already exists in library

// ─── Download Item ───────────────────────────────────────

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

  // Playlist job linkage
  playlistJobId?: string; // spotifyId of the playlist this track belongs to

  // Extended ID3 metadata (synced from Spotify)
  isrc?: string;
  releaseDate?: string;
  trackNumber?: number;
  discNumber?: number;
  publisher?: string;
  copyright?: string;
  composer?: string;
  bpm?: number;
  key?: string;
}

// ─── Download History ────────────────────────────────────

export interface DownloadHistoryItem {
  id: string;
  spotifyId: string;
  title: string;
  artist: string;
  album: string;
  coverUrl: string | null;
  status: 'completed' | 'failed' | 'skipped';
  outputPath?: string;
  errorMessage?: string;
  downloadedAt: number;
  playlistJobId?: string;
}

// ─── Downloader Settings ─────────────────────────────────

export interface DownloaderSettings {
  downloadFolder: string;
  audioFormat: 'mp3' | 'flac' | 'm4a' | 'wav';
  audioBitrate: '320k' | '256k' | '192k' | '128k';
  getLyrics: boolean;
  createLrcFile: boolean;
  autoImport: boolean;
  concurrentDownloads: number;
  retryCount: number;

  // Playlist sync settings
  autoCreatePlaylist: boolean;
  keepRemovedSongs: boolean;
  autoEmbedMetadata: boolean;
  autoSyncOnStartup: boolean;
  syncIntervalMinutes: number; // 0 = off, 15, 30, 60, 1440 (daily)
}

// ─── Spotify Linked Playlist ─────────────────────────────

export type SyncInterval = 0 | 15 | 30 | 60 | 1440;

export interface SpotifyLinkedPlaylist {
  spotifyId: string;
  name: string;
  description: string;
  owner: string;
  coverUrl: string | null;
  trackCount: number;
  localPlaylistId: string | null; // null until first sync completes
  lastSync: number | null;        // timestamp
  autoSync: boolean;
  syncInterval: SyncInterval;     // minutes, 0 = startup only
  isLikedSongs: boolean;
  addedAt: number;
}

// ─── Spotify Search ──────────────────────────────────────

export interface SpotifySearchTrack {
  id: string;
  title: string;
  artist: string;
  artistNames: string[];
  album: string;
  coverUrl: string | null;
  durationMs: number;
  spotifyUrl: string;
}

export interface SpotifySearchAlbum {
  id: string;
  name: string;
  artist: string;
  coverUrl: string | null;
  trackCount: number;
  releaseDate: string;
  spotifyUrl: string;
}

export interface SpotifySearchArtist {
  id: string;
  name: string;
  coverUrl: string | null;
  genres: string[];
  spotifyUrl: string;
}

export interface SpotifySearchPlaylist {
  id: string;
  name: string;
  description: string;
  owner: string;
  coverUrl: string | null;
  trackCount: number;
  spotifyUrl: string;
}

export interface SpotifySearchResults {
  tracks: SpotifySearchTrack[];
  albums: SpotifySearchAlbum[];
  artists: SpotifySearchArtist[];
  playlists: SpotifySearchPlaylist[];
}

export type SpotifySearchType = 'track' | 'album' | 'artist' | 'playlist';

// ─── Sync Progress ───────────────────────────────────────

export interface SyncProgress {
  spotifyPlaylistId: string;
  phase: 'fetching' | 'comparing' | 'downloading' | 'updating' | 'done' | 'error';
  message: string;
  newTracks: number;
  removedTracks: number;
  totalTracks: number;
  downloadedTracks: number;
}
