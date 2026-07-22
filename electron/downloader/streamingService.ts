import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import { getBinaryPaths } from './binaryManager';
import { YTMusicApi } from './ytMusicApi';

export interface StreamUrlResult {
  url: string;
  videoId: string;
  expiresAt: number; // unix timestamp ms, ~6h from now
  title?: string;
  artist?: string;
  album?: string;
  coverUrl?: string;
  durationSeconds?: number;
}

interface CacheEntry {
  result: StreamUrlResult;
  cachedAt: number;
}

const URL_TTL_MS = 4 * 60 * 60 * 1000; // 4 hours

export class StreamingService {
  private getDataPath: () => string;
  private memoryCache = new Map<string, CacheEntry>(); // videoId -> CacheEntry
  private resolvingIds = new Set<string>(); // prevent concurrent duplicate resolves

  constructor(getDataPath: () => string) {
    this.getDataPath = getDataPath;
    this.loadDiskCache();
  }

  // ─── Public API ───────────────────────────────────────────────────────────

  /**
   * Resolve a direct audio stream URL by YouTube Music search (title + artist).
   * Returns a cached result if available and not expired.
   */
  public async resolveBySearch(
    title: string,
    artist: string,
    album?: string,
    coverUrl?: string,
    forceRefresh = false,
  ): Promise<StreamUrlResult | null> {
    const cacheKey = this.makeCacheKey(title, artist);

    if (forceRefresh) {
      console.log(`[Streaming] Force refresh requested for: ${artist} - ${title}`);
      this.memoryCache.delete(cacheKey);
    } else {
      const cached = this.memoryCache.get(cacheKey);
      if (cached && Date.now() < cached.result.expiresAt - 60_000) {
        console.log(`[Streaming] Cache hit for: ${artist} - ${title}`);
        return cached.result;
      }
    }

    if (this.resolvingIds.has(cacheKey)) {
      console.log(`[Streaming] Already resolving: ${artist} - ${title}, waiting...`);
      // wait a few seconds and retry from cache
      await this.sleep(3000);
      const retried = this.memoryCache.get(cacheKey);
      return retried ? retried.result : null;
    }

    this.resolvingIds.add(cacheKey);
    try {
      // 1. Search YouTube Music for the best matching video
      console.log(`[Streaming] Searching YouTube Music for: ${artist} - ${title}`);
      let videoId: string | null = null;
      let durationSec = 0;
      let finalTitle = title;
      let finalArtist = artist;

      const ytResult = await YTMusicApi.searchVideo(artist, title);
      if (ytResult?.videoId) {
        videoId = ytResult.videoId;
        finalTitle = ytResult.title || title;
        finalArtist = ytResult.artist || artist;
        durationSec = ytResult.durationSeconds || 0;
      } else {
        console.log(`[Streaming] YTMusicApi returned null. Falling back to yt-dlp search for: ${artist} - ${title}`);
        videoId = await this.resolveVideoIdByYtDlpSearch(artist, title);
      }

      if (!videoId) {
        console.warn(`[Streaming] No videoId found via YTMusicApi or yt-dlp for: ${artist} - ${title}`);
        return null;
      }

      console.log(`[Streaming] Found videoId: ${videoId} for: ${artist} - ${title}`);

      // 2. Resolve direct audio URL with yt-dlp
      const url = await this.resolveVideoUrl(videoId);
      if (!url) {
        console.error(`[Streaming] yt-dlp failed to resolve URL for videoId: ${videoId}`);
        return null;
      }

      const result: StreamUrlResult = {
        url,
        videoId,
        expiresAt: Date.now() + URL_TTL_MS,
        title: finalTitle,
        artist: finalArtist,
        album: album,
        coverUrl: coverUrl || `https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg`,
        durationSeconds: durationSec,
      };

      this.memoryCache.set(cacheKey, { result, cachedAt: Date.now() });
      this.saveDiskCache();
      return result;
    } catch (err) {
      console.error(`[Streaming] Error resolving stream for: ${artist} - ${title}`, err);
      return null;
    } finally {
      this.resolvingIds.delete(cacheKey);
    }
  }


  /**
   * Resolve a direct audio stream URL by videoId.
   * Returns a cached result if available and not expired.
   */
  public async resolveByVideoId(videoId: string, forceRefresh = false): Promise<StreamUrlResult | null> {
    const cleanId = (videoId || '').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 11);
    if (cleanId.length !== 11) {
      console.warn(`[Streaming] resolveByVideoId called with invalid videoId: "${videoId}"`);
      return null;
    }

    const cacheKey = `vid:${cleanId}`;

    if (forceRefresh) {
      console.log(`[Streaming] Force refresh requested for videoId: ${cleanId}`);
      this.memoryCache.delete(cacheKey);
    } else {
      const cached = this.memoryCache.get(cacheKey);
      if (cached && Date.now() < cached.result.expiresAt - 60_000) {
        console.log(`[Streaming] Cache hit for videoId: ${videoId}`);
        return cached.result;
      }
    }

    if (this.resolvingIds.has(cacheKey)) {
      await this.sleep(3000);
      const retried = this.memoryCache.get(cacheKey);
      return retried ? retried.result : null;
    }

    this.resolvingIds.add(cacheKey);
    try {
      const url = await this.resolveVideoUrl(videoId);
      if (!url) return null;

      const result: StreamUrlResult = {
        url,
        videoId,
        expiresAt: Date.now() + URL_TTL_MS,
        coverUrl: `https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg`,
      };

      this.memoryCache.set(cacheKey, { result, cachedAt: Date.now() });
      this.saveDiskCache();
      return result;
    } finally {
      this.resolvingIds.delete(cacheKey);
    }
  }

  /** Clear all expired entries from cache */
  public pruneCache(): void {
    const now = Date.now();
    for (const [key, entry] of this.memoryCache.entries()) {
      if (now >= entry.result.expiresAt) {
        this.memoryCache.delete(key);
      }
    }
    this.saveDiskCache();
  }

  public getCacheSize(): number {
    return this.memoryCache.size;
  }

  // ─── yt-dlp URL Resolution ────────────────────────────────────────────────

  private resolveVideoUrl(videoId: string): Promise<string | null> {
    return new Promise((resolve) => {
      const { ytdlp } = getBinaryPaths(this.getDataPath);
      const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;

      const args = [
        '--no-warnings',
        '--no-playlist',
        '--extractor-args',
        'youtube:player_client=android,mweb,web',
        '-f',
        'bestaudio[ext=webm]/bestaudio[ext=m4a]/bestaudio/ba/b',
        '--get-url',
        videoUrl,
      ];

      console.log(`[Streaming] Running yt-dlp --get-url for videoId: ${videoId}`);

      const proc = spawn(ytdlp, args, {
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      let stdout = '';
      let stderr = '';

      proc.stdout.on('data', (chunk: Buffer) => {
        stdout += chunk.toString();
      });

      proc.stderr.on('data', (chunk: Buffer) => {
        stderr += chunk.toString();
      });

      const timeout = setTimeout(() => {
        proc.kill('SIGTERM');
        console.error(`[Streaming] yt-dlp timed out for videoId: ${videoId}`);
        resolve(null);
      }, 30_000);

      proc.on('close', (code) => {
        clearTimeout(timeout);
        const url = stdout.split(/\r?\n/).map((s) => s.trim()).find((s) => s.startsWith('http')) || '';
        if (code === 0 && url) {
          console.log(`[Streaming] Resolved URL (${url.slice(0, 80)}...) for videoId: ${videoId}`);
          resolve(url);
        } else {
          console.error(`[Streaming] yt-dlp exited with code ${code} for videoId: ${videoId}. stderr: ${stderr.slice(0, 300)}`);
          resolve(null);
        }
      });

      proc.on('error', (err) => {
        clearTimeout(timeout);
        console.error(`[Streaming] yt-dlp spawn error for videoId: ${videoId}`, err);
        resolve(null);
      });
    });
  }

  private resolveVideoIdByYtDlpSearch(artist: string, title: string): Promise<string | null> {
    return new Promise((resolve) => {
      const { ytdlp } = getBinaryPaths(this.getDataPath);
      const query = `ytsearch1:${artist} - ${title}`;

      const args = [
        '--no-warnings',
        '--no-playlist',
        '--extractor-args',
        'youtube:player_client=android,mweb,web',
        '--get-id',
        query,
      ];
      console.log(`[Streaming] Running yt-dlp search for query: "${query}"`);
      const proc = spawn(ytdlp, args, { stdio: ['ignore', 'pipe', 'pipe'] });

      let stdout = '';
      proc.stdout.on('data', (chunk: Buffer) => {
        stdout += chunk.toString();
      });

      const timeout = setTimeout(() => {
        proc.kill('SIGTERM');
        console.error(`[Streaming] yt-dlp search timed out for: ${query}`);
        resolve(null);
      }, 15_000);

      proc.on('close', (code) => {
        clearTimeout(timeout);
        const rawLine = stdout.split(/\r?\n/).map((s) => s.trim()).find((s) => s.length >= 8) || '';
        const videoId = rawLine.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 11);
        if (code === 0 && videoId && videoId.length === 11) {
          console.log(`[Streaming] yt-dlp search found videoId: ${videoId} for: ${artist} - ${title}`);
          resolve(videoId);
        } else {
          console.warn(`[Streaming] yt-dlp search invalid videoId: "${videoId}" (raw: "${rawLine}")`);
          resolve(null);
        }
      });

      proc.on('error', (err) => {
        clearTimeout(timeout);
        console.error(`[Streaming] yt-dlp search spawn error:`, err);
        resolve(null);
      });
    });
  }

  // ─── Disk Cache ──────────────────────────────────────────────────────────

  private getCacheFilePath(): string {
    return path.join(this.getDataPath(), 'stream_cache.json');
  }

  private loadDiskCache(): void {
    try {
      const filePath = this.getCacheFilePath();
      if (!fs.existsSync(filePath)) return;
      const raw = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      const now = Date.now();
      let loaded = 0;
      for (const [key, entry] of Object.entries(raw)) {
        const e = entry as CacheEntry;
        if (e.result && e.result.expiresAt > now) {
          this.memoryCache.set(key, e);
          loaded++;
        }
      }
      console.log(`[Streaming] Loaded ${loaded} valid stream URL cache entries from disk.`);
    } catch {
      // silently ignore corrupted cache
    }
  }

  private saveDiskCache(): void {
    try {
      const filePath = this.getCacheFilePath();
      const obj: Record<string, CacheEntry> = {};
      for (const [key, entry] of this.memoryCache.entries()) {
        obj[key] = entry;
      }
      fs.writeFileSync(filePath, JSON.stringify(obj, null, 2), 'utf-8');
    } catch {
      // non-critical
    }
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  private makeCacheKey(title: string, artist: string): string {
    return `${artist.toLowerCase().trim()}::${title.toLowerCase().trim()}`;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
