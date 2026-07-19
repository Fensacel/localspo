// ─── Song ───────────────────────────────────────────────

export interface Song {
  id: string;
  title: string;
  artist: string;
  album: string;
  albumArtist: string;
  genre: string;
  disc: number;
  track: number;
  year: number;
  duration: number;
  bitrate: number;
  bitDepth: number;
  sampleRate: number;
  codec: string;
  channels: number;
  path: string;
  fileSize: number;
  hash: string;
  coverPath: string | null;
  hasEmbeddedCover: boolean;
  hasEmbeddedLyrics: boolean;
  lrcPath: string | null;
  addedAt: number;
  playCount: number;
}

// ─── Album ──────────────────────────────────────────────

export interface Album {
  id: string;
  name: string;
  artist: string;
  albumArtist: string;
  year: number;
  genre: string;
  coverPath: string | null;
  songIds: string[];
  totalDuration: number;
  trackCount: number;
  discCount: number;
}

// ─── Artist ─────────────────────────────────────────────

export interface Artist {
  id: string;
  name: string;
  coverPath: string | null;
  albumIds: string[];
  songIds: string[];
  totalSongs: number;
  totalAlbums: number;
}

// ─── Playlist ───────────────────────────────────────────

export interface Playlist {
  id: string;
  name: string;
  description: string;
  coverPath: string | null;
  songIds: string[];
  createdAt: number;
  updatedAt: number;
  isPinned: boolean;
  isFavorite: boolean;
}

// ─── History Entry ──────────────────────────────────────

export interface HistoryEntry {
  songId: string;
  playedAt: number;
  duration: number;
}

// ─── Favorites ──────────────────────────────────────────

export interface FavoritesData {
  songIds: string[];
  albumIds: string[];
  artistIds: string[];
}

// ─── Library ────────────────────────────────────────────

export interface LibraryData {
  songs: Song[];
  albums: Album[];
  artists: Artist[];
  lastScan: number | null;
}

// ─── Settings ───────────────────────────────────────────

export interface Settings {
  musicFolders: string[];
  theme: string;
  accentColor: string;
  gapless: boolean;
  crossfade: boolean;
  crossfadeDuration: number;
  visualizer: VisualizerType;
  lyricsEnabled: boolean;
  seekByLyricsEnabled: boolean;
  equalizerPreset: string;
  equalizerBands: number[];
  volume: number;
  playbackSpeed: number;
}

// ─── Enums ──────────────────────────────────────────────

export type RepeatMode = 'off' | 'all' | 'one';

export type ShuffleMode = 'off' | 'on';

export type VisualizerType = 'waveform' | 'spectrum' | 'particle' | 'circular' | 'none';

export type ViewMode = 'grid' | 'list';

// ─── Lyrics ─────────────────────────────────────────────

export interface LyricLine {
  time: number;
  text: string;
  endTime?: number;
}

export interface LyricsData {
  synced: boolean;
  lines: LyricLine[];
  rawText: string;
}

// ─── Audio Info ─────────────────────────────────────────

export interface AudioInfo {
  codec: string;
  bitrate: number;
  bitDepth: number;
  sampleRate: number;
  channels: number;
  duration: number;
  fileSize: number;
  lossless: boolean;
}

// ─── Scan Progress ──────────────────────────────────────

export interface ScanProgress {
  status: 'idle' | 'scanning' | 'processing' | 'done' | 'error';
  totalFiles: number;
  processedFiles: number;
  currentFile: string;
  message: string;
}
