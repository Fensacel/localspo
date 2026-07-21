import fs from 'fs';
import path from 'path';
import http from 'http';
import https from 'https';
import { BrowserWindow } from 'electron';
import { SpotifyApiExtractor } from './spotifyApi';

// ─── Types ───────────────────────────────────────────────────────────────────

export type SyncInterval = 0 | 15 | 30 | 60 | 1440;

export interface SpotifyLinkedPlaylist {
  spotifyId: string;
  name: string;
  description: string;
  owner: string;
  coverUrl: string | null;
  trackCount: number;
  localPlaylistId: string | null;
  lastSync: number | null;
  autoSync: boolean;
  syncInterval: SyncInterval;
  isLikedSongs: boolean;
  addedAt: number;
}

export interface SyncProgress {
  spotifyPlaylistId: string;
  phase: 'fetching' | 'comparing' | 'downloading' | 'updating' | 'done' | 'error';
  message: string;
  newTracks: number;
  removedTracks: number;
  totalTracks: number;
  downloadedTracks: number;
}

export interface PlaylistSyncResult {
  spotifyPlaylistId: string;
  newTrackIds: string[];      // Spotify track IDs to download
  removedTrackIds: string[];  // Spotify track IDs removed from playlist
  reorderedTrackIds: string[]; // New ordered list of all Spotify IDs
  meta: {
    name: string;
    description: string;
    owner: string;
    coverUrl: string | null;
  };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function downloadImageBuffer(urlStr: string): Promise<Buffer | null> {
  return new Promise((resolve) => {
    const request = (currentUrl: string, redirects = 0) => {
      if (redirects > 5) return resolve(null);
      const client = currentUrl.startsWith('https') ? https : http;
      const req = client.get(
        currentUrl,
        {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            Accept: 'image/*,*/*;q=0.8',
          },
        },
        (res) => {
          if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
            return request(res.headers.location, redirects + 1);
          }
          if (res.statusCode !== 200) return resolve(null);
          const chunks: Buffer[] = [];
          res.on('data', (chunk) => chunks.push(chunk));
          res.on('end', () => resolve(Buffer.concat(chunks)));
          res.on('error', () => resolve(null));
        },
      );
      req.on('error', () => resolve(null));
      req.end();
    };
    request(urlStr);
  });
}

// ─── PlaylistSyncService ──────────────────────────────────────────────────────

export class PlaylistSyncService {
  private getDataPath: () => string;
  private linkedPlaylists: SpotifyLinkedPlaylist[] = [];
  private syncTimers: Map<string, NodeJS.Timeout> = new Map();
  private isSyncing: Set<string> = new Set();

  constructor(getDataPath: () => string) {
    this.getDataPath = getDataPath;
    this.loadLinkedPlaylists();
  }

  // ─── Persistence ───────────────────────────────────────────────────────────

  private getLinkedPlaylistsPath(): string {
    return path.join(this.getDataPath(), 'spotify_playlists.json');
  }

  public loadLinkedPlaylists(): SpotifyLinkedPlaylist[] {
    const filePath = this.getLinkedPlaylistsPath();
    if (fs.existsSync(filePath)) {
      try {
        const raw = fs.readFileSync(filePath, 'utf-8');
        this.linkedPlaylists = JSON.parse(raw);
      } catch {
        this.linkedPlaylists = [];
      }
    }
    return this.linkedPlaylists;
  }

  private saveLinkedPlaylists(): void {
    const filePath = this.getLinkedPlaylistsPath();
    try {
      fs.writeFileSync(filePath, JSON.stringify(this.linkedPlaylists, null, 2), 'utf-8');
    } catch (err) {
      console.error('Error saving linked playlists:', err);
    }
  }

  public getLinkedPlaylists(): SpotifyLinkedPlaylist[] {
    return [...this.linkedPlaylists];
  }

  // ─── Manage Linked Playlists ────────────────────────────────────────────────

  public async addLinkedPlaylist(
    spotifyUrl: string,
    options: { autoSync?: boolean; syncInterval?: SyncInterval } = {},
  ): Promise<SpotifyLinkedPlaylist> {
    const parsed = SpotifyApiExtractor.parseUrl(spotifyUrl);
    if (!parsed || parsed.type !== 'playlist') {
      throw new Error('Invalid Spotify playlist URL');
    }

    const existing = this.linkedPlaylists.find((p) => p.spotifyId === parsed.id);
    if (existing) {
      return existing;
    }

    // Fetch metadata preview (no download yet)
    const meta = await SpotifyApiExtractor.fetchMetadata(spotifyUrl);

    const linked: SpotifyLinkedPlaylist = {
      spotifyId: parsed.id,
      name: meta.title,
      description: meta.description || '',
      owner: meta.owner || '',
      coverUrl: meta.coverUrl,
      trackCount: meta.tracks.length,
      localPlaylistId: null,
      lastSync: null,
      autoSync: options.autoSync ?? true,
      syncInterval: options.syncInterval ?? 0,
      isLikedSongs: false,
      addedAt: Date.now(),
    };

    this.linkedPlaylists.push(linked);
    this.saveLinkedPlaylists();
    this.broadcastLinkedPlaylists();

    // Start interval timer if needed
    if (linked.autoSync && linked.syncInterval > 0) {
      this.scheduleIntervalSync(linked.spotifyId, linked.syncInterval);
    }

    return linked;
  }

  public removeLinkedPlaylist(spotifyId: string): void {
    this.stopIntervalSync(spotifyId);
    this.linkedPlaylists = this.linkedPlaylists.filter((p) => p.spotifyId !== spotifyId);
    this.saveLinkedPlaylists();
    this.broadcastLinkedPlaylists();
  }

  public toggleAutoSync(spotifyId: string, autoSync: boolean): void {
    const playlist = this.linkedPlaylists.find((p) => p.spotifyId === spotifyId);
    if (!playlist) return;
    playlist.autoSync = autoSync;
    this.saveLinkedPlaylists();
    this.broadcastLinkedPlaylists();

    if (autoSync && playlist.syncInterval > 0) {
      this.scheduleIntervalSync(spotifyId, playlist.syncInterval);
    } else {
      this.stopIntervalSync(spotifyId);
    }
  }

  public setSyncInterval(spotifyId: string, interval: SyncInterval): void {
    const playlist = this.linkedPlaylists.find((p) => p.spotifyId === spotifyId);
    if (!playlist) return;
    playlist.syncInterval = interval;
    this.saveLinkedPlaylists();
    this.broadcastLinkedPlaylists();

    this.stopIntervalSync(spotifyId);
    if (playlist.autoSync && interval > 0) {
      this.scheduleIntervalSync(spotifyId, interval);
    }
  }

  public updateLocalPlaylistId(spotifyId: string, localPlaylistId: string): void {
    const playlist = this.linkedPlaylists.find((p) => p.spotifyId === spotifyId);
    if (!playlist) return;
    playlist.localPlaylistId = localPlaylistId;
    playlist.lastSync = Date.now();
    this.saveLinkedPlaylists();
    this.broadcastLinkedPlaylists();
  }

  // ─── Sync Diff ─────────────────────────────────────────────────────────────

  /**
   * Compares Spotify playlist against a list of local Spotify IDs already present.
   * Returns what needs to be downloaded, removed, and the new full order.
   */
  public async diffPlaylist(
    spotifyPlaylistId: string,
    localSpotifyIds: string[], // spotify track IDs already in local playlist
    settings: { keepRemovedSongs: boolean },
    downloaderService?: any,
  ): Promise<PlaylistSyncResult> {
    this.broadcastSyncProgress({
      spotifyPlaylistId,
      phase: 'fetching',
      message: 'Fetching latest Spotify playlist...',
      newTracks: 0,
      removedTracks: 0,
      totalTracks: 0,
      downloadedTracks: 0,
    });

    const meta = await SpotifyApiExtractor.fetchMetadata(`https://open.spotify.com/playlist/${spotifyPlaylistId}`);
    const spotifyTrackIds = meta.tracks.map((t) => t.id);

    this.broadcastSyncProgress({
      spotifyPlaylistId,
      phase: 'comparing',
      message: `Comparing ${spotifyTrackIds.length} Spotify tracks with local library...`,
      newTracks: 0,
      removedTracks: 0,
      totalTracks: spotifyTrackIds.length,
      downloadedTracks: 0,
    });

    const localSet = new Set(localSpotifyIds);
    const spotifySet = new Set(spotifyTrackIds);

    const newTrackIds = meta.tracks
      .filter((t) => {
        if (localSet.has(t.id)) return false;
        if (downloaderService && typeof downloaderService.isTrackDownloaded === 'function') {
          if (downloaderService.isTrackDownloaded(t.id, t.isrc, t.title, t.artist)) {
            return false;
          }
        }
        return true;
      })
      .map((t) => t.id);

    const removedTrackIds = settings.keepRemovedSongs
      ? []
      : localSpotifyIds.filter((id) => !spotifySet.has(id));

    return {
      spotifyPlaylistId,
      newTrackIds,
      removedTrackIds,
      reorderedTrackIds: spotifyTrackIds,
      meta: {
        name: meta.title,
        description: meta.description || '',
        owner: meta.owner || '',
        coverUrl: meta.coverUrl,
      },
    };
  }

  // ─── Cover Cache ────────────────────────────────────────────────────────────

  /**
   * Downloads and caches a Spotify playlist cover image locally.
   * Returns the local file path, or null on failure.
   */
  public async cachePlaylistCover(spotifyId: string, coverUrl: string): Promise<string | null> {
    const coverDir = path.join(this.getDataPath(), 'cache', 'cover');
    if (!fs.existsSync(coverDir)) {
      fs.mkdirSync(coverDir, { recursive: true });
    }

    const localPath = path.join(coverDir, `spotify_playlist_${spotifyId}.jpg`);
    if (fs.existsSync(localPath)) {
      return localPath; // Already cached
    }

    const buffer = await downloadImageBuffer(coverUrl);
    if (buffer && buffer.length > 0) {
      fs.writeFileSync(localPath, buffer);
      return localPath;
    }
    return null;
  }

  // ─── Startup Auto Sync ──────────────────────────────────────────────────────

  /**
   * Called on app startup. Syncs all playlists with autoSync = true.
   * Returns list of spotify IDs that need new downloads.
   */
  public getAutoSyncPlaylists(): SpotifyLinkedPlaylist[] {
    return this.linkedPlaylists.filter((p) => p.autoSync);
  }

  // ─── Interval Scheduling ────────────────────────────────────────────────────

  public scheduleAllIntervalSyncs(): void {
    for (const playlist of this.linkedPlaylists) {
      if (playlist.autoSync && playlist.syncInterval > 0) {
        this.scheduleIntervalSync(playlist.spotifyId, playlist.syncInterval);
      }
    }
  }

  private scheduleIntervalSync(spotifyId: string, intervalMinutes: number): void {
    this.stopIntervalSync(spotifyId);
    const ms = intervalMinutes * 60 * 1000;
    const timer = setInterval(() => {
      this.broadcastSyncRequest(spotifyId);
    }, ms);
    this.syncTimers.set(spotifyId, timer);
  }

  private stopIntervalSync(spotifyId: string): void {
    const timer = this.syncTimers.get(spotifyId);
    if (timer) {
      clearInterval(timer);
      this.syncTimers.delete(spotifyId);
    }
  }

  public markSyncComplete(spotifyId: string, trackCount?: number): void {
    const playlist = this.linkedPlaylists.find((p) => p.spotifyId === spotifyId);
    if (!playlist) return;
    playlist.lastSync = Date.now();
    if (trackCount !== undefined) playlist.trackCount = trackCount;
    this.saveLinkedPlaylists();
    this.broadcastLinkedPlaylists();
  }

  // ─── IPC Broadcasts ─────────────────────────────────────────────────────────

  private broadcastLinkedPlaylists(): void {
    const windows = BrowserWindow.getAllWindows();
    if (windows.length > 0) {
      windows[0].webContents.send('spotify:linkedPlaylistsUpdated', this.linkedPlaylists);
    }
  }

  private broadcastSyncProgress(progress: SyncProgress): void {
    const windows = BrowserWindow.getAllWindows();
    if (windows.length > 0) {
      windows[0].webContents.send('spotify:syncProgress', progress);
    }
  }

  private broadcastSyncRequest(spotifyId: string): void {
    const windows = BrowserWindow.getAllWindows();
    if (windows.length > 0) {
      windows[0].webContents.send('spotify:autoSyncTrigger', spotifyId);
    }
  }

  public broadcastSyncDone(spotifyId: string, result: PlaylistSyncResult): void {
    this.broadcastSyncProgress({
      spotifyPlaylistId: spotifyId,
      phase: 'done',
      message: `Sync complete. ${result.newTrackIds.length} new, ${result.removedTrackIds.length} removed.`,
      newTracks: result.newTrackIds.length,
      removedTracks: result.removedTrackIds.length,
      totalTracks: result.reorderedTrackIds.length,
      downloadedTracks: result.newTrackIds.length,
    });
  }
}
