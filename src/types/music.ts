// ─── Song ───────────────────────────────────────────────

/** Source of audio playback for this song */
export type SongSourceType = 'offline' | 'streaming' | 'cache';

/** Download status for hybrid mode */
export type SongDownloadStatus = 'none' | 'downloading' | 'downloaded' | 'failed';

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

  // ── Hybrid Streaming Fields ──────────────────────────
  /** Resolved HTTPS streaming URL (expires after ~4h) */
  streamUrl?: string;
  /** Expiry timestamp (ms) for streamUrl */
  streamExpiry?: number;
  /** Source type for current playback session */
  sourceType?: SongSourceType;
  /** Download status in the downloader */
  downloadStatus?: SongDownloadStatus;
  /** YouTube videoId for streaming/re-resolving */
  ytVideoId?: string;
  /** Remote cover URL (for streaming-only songs without local cover) */
  remoteCoverUrl?: string;
}

/**
 * A lightweight song object created from a search result.
 * Has no local file — played via streaming URL resolution.
 * Treated as a Song in the player queue.
 */
export interface StreamSong extends Omit<Song, 'path' | 'hash' | 'fileSize' | 'bitrate' | 'bitDepth' | 'sampleRate' | 'codec' | 'channels' | 'hasEmbeddedCover' | 'hasEmbeddedLyrics' | 'addedAt' | 'playCount'> {
  /** Always empty string — no local file */
  path: '';
  hash: '';
  fileSize: 0;
  bitrate: 0;
  bitDepth: 0;
  sampleRate: 0;
  codec: 'stream';
  channels: 2;
  hasEmbeddedCover: false;
  hasEmbeddedLyrics: false;
  addedAt: number;
  playCount: 0;
  sourceType: 'streaming';
  /** Required for StreamSong — must have ytVideoId or streamUrl */
  ytVideoId: string;
}

/** Create a StreamSong from search result data */
export function createStreamSong(data: {
  id: string;
  title: string;
  artist: string;
  album?: string;
  duration?: number;
  coverUrl?: string;
  ytVideoId: string;
  year?: number;
}): StreamSong {
  return {
    id: data.id || `stream_${data.ytVideoId}_${Date.now()}`,
    title: data.title,
    artist: data.artist,
    album: data.album || '',
    albumArtist: data.artist,
    genre: '',
    disc: 1,
    track: 0,
    year: data.year || 0,
    duration: data.duration || 0,
    bitrate: 0,
    bitDepth: 0,
    sampleRate: 0,
    codec: 'stream',
    channels: 2,
    path: '',
    fileSize: 0,
    hash: '',
    coverPath: null,
    remoteCoverUrl: data.coverUrl,
    hasEmbeddedCover: false,
    hasEmbeddedLyrics: false,
    lrcPath: null,
    addedAt: Date.now(),
    playCount: 0,
    sourceType: 'streaming',
    ytVideoId: data.ytVideoId,
    downloadStatus: 'none',
  };
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
  songData?: Song;
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
