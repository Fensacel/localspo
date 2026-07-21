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
  isUserQueued?: boolean;

  // Extended ID3 Metadata
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

  // Spotify linkage (optional — only set for Spotify-synced playlists)
  spotifyId?: string;
  spotifyOwner?: string;
  spotifyDescription?: string;
  lastSpotifySync?: number;
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
  romanizationMode: 'off' | 'auto' | 'always';
  lyricsDisplayMode: 'original' | 'romanized' | 'both';
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

export type RomanizationMode = 'off' | 'auto' | 'always';
export type LyricsDisplayMode = 'original' | 'romanized' | 'both';

// ─── Lyrics ─────────────────────────────────────────────

export interface LyricWord {
  text: string;
  startTime: number;
  endTime: number;
}

export interface LyricLine {
  time: number;
  text: string;
  romanization?: string;
  words?: LyricWord[];
  romanizationWords?: LyricWord[];
  endTime?: number;
  isEnhanced?: boolean;
}

export interface LyricsData {
  synced: boolean;
  lines: LyricLine[];
  rawText: string;
  detectedScript?: string;
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
