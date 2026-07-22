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
    durationSeconds?: number,
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
      console.log(`[Streaming] Searching YouTube Music for: ${artist} - ${title} (Duration: ${durationSeconds || 'N/A'}s)`);
      let videoId: string | null = null;
      let durationSec = durationSeconds || 0;
      let finalTitle = title;
      let finalArtist = artist;

      const ytResult = await YTMusicApi.searchVideo(artist, title, album, durationSeconds);
      if (ytResult?.videoId) {
        videoId = ytResult.videoId;
        finalTitle = ytResult.title || title;
        finalArtist = ytResult.artist || artist;
        durationSec = ytResult.durationSeconds || durationSeconds || 0;
      } else {
        console.log(`[StreamingEngine] YTMusicApi returned null. Falling back to yt-dlp search for: ${artist} - ${title}`);
        videoId = await this.resolveVideoIdByYtDlpSearch(artist, title, album, durationSeconds);
      }

      if (!videoId) {
        console.warn(`[Streaming] No videoId found via YTMusicApi or yt-dlp for: ${artist} - ${title}`);
        return null;
      }

      if (!videoId || videoId.length !== 11) {
        throw new Error(`STREAM INTEGRITY ERROR: Invalid videoId resolved!`);
      }

      // 2. Resolve direct audio URL with yt-dlp using LOCKED videoId ONLY
      const url = await this.resolveVideoUrl(videoId);
      if (!url) {
        console.error(`[Streaming] yt-dlp failed to resolve URL for videoId: ${videoId}`);
        return null;
      }

      console.log('====================================================');
      console.log('[SINGLE SOURCE OF TRUTH VERIFICATION]');
      console.log(`Selected Metadata    : "${artist} - ${title}"`);
      console.log(`Selected videoId     : ${videoId}`);
      console.log(`Locked Target URL    : https://www.youtube.com/watch?v=${videoId}`);
      console.log(`yt-dlp Stream URL    : ${url.slice(0, 80)}...`);
      console.log(`Final Playback ID    : ${videoId}`);
      console.log('====================================================');

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

  public clearAllCache(): void {
    this.memoryCache.clear();
    try {
      const filePath = this.getCacheFilePath();
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    } catch {}
    console.log('[StreamingService] Cleared all memory and disk streaming cache.');
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

  private resolveVideoIdByYtDlpSearch(artist: string, title: string, album?: string, durationSec?: number): Promise<string | null> {
    return new Promise((resolve) => {
      const { ytdlp } = getBinaryPaths(this.getDataPath);
      const query = `ytsearch10:${artist} ${title} official audio`;

      const args = [
        '--no-warnings',
        '--no-playlist',
        '--extractor-args',
        'youtube:player_client=android,mweb,web',
        '--flat-playlist',
        '--print',
        '%(id)s\t%(title)s\t%(channel)s\t%(duration)s',
        query,
      ];
      console.log(`[StreamingEngine] Query: "${artist} - ${title}" (Album: ${album || 'N/A'})`);
      const proc = spawn(ytdlp, args, { stdio: ['ignore', 'pipe', 'pipe'] });

      let stdout = '';
      proc.stdout.on('data', (chunk: Buffer) => {
        stdout += chunk.toString();
      });

      const timeout = setTimeout(() => {
        proc.kill('SIGTERM');
        console.error(`[StreamingEngine] yt-dlp search timed out for query: "${query}"`);
        resolve(null);
      }, 14_000);

      proc.on('close', (code) => {
        clearTimeout(timeout);
        const lines = stdout.split(/\r?\n/).map((s) => s.trim()).filter(Boolean);

        const normReqTitle = title.toLowerCase().trim();
        const normReqArtist = artist.toLowerCase().split(',')[0].replace(/ feat\..*$/i, '').replace(/ ft\..*$/i, '').trim();
        const normReqAlbum = (album || '').toLowerCase().trim();

        const reqHasExtended = /\b(extended|10 minute|10 min|10-minute)\b/i.test(title);
        const reqHasLive = /\b(live|concert)\b/i.test(title);
        const reqHasRemix = /\b(remix)\b/i.test(title);

        interface Candidate {
          videoId: string;
          title: string;
          channel: string;
          duration: number;
          score: number;
          reasons: string[];
          rejectedReason?: string;
        }

        const candidates: Candidate[] = [];

        for (const line of lines) {
          const parts = line.split('\t');
          const candId = parts[0]?.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 11);
          const candTitle = parts[1] || '';
          const candChannel = parts[2] || '';
          const candDur = parseFloat(parts[3] || '0') || 0;

          if (!candId || candId.length !== 11) continue;

          const normCandTitle = candTitle.toLowerCase().trim();
          const normCandChannel = candChannel.toLowerCase().trim();
          const fullCandText = (normCandTitle + ' ' + normCandChannel).toLowerCase();

          let score = 0;
          const reasons: string[] = [];
          let rejectedReason: string | undefined = undefined;

          // 1. ARTIST IDENTITY VALIDATION GATE (STRICT FIRST CONSTRAINT)
          const isGenericArtist = /\b(unknown artist|various artists|ai music|cover artist|fan upload|random channel|cover band|tribute band)\b/i.test(normCandChannel);
          let artistScore = 0;
          let isArtistValid = false;

          if (normReqArtist) {
            if (isGenericArtist) {
              score -= 5000;
              reasons.push('Generic/Unknown/Cover Artist Rejected (-5000)');
              rejectedReason = `Rejected Generic Artist "${candChannel}"`;
            } else if (normCandChannel === normReqArtist || normCandChannel.includes(normReqArtist) || normReqArtist.includes(normCandChannel) || fullCandText.includes(normReqArtist)) {
              artistScore = 1000;
              isArtistValid = true;
              reasons.push('Artist EXACT Match (+1000)');
            } else {
              score -= 5000;
              reasons.push('Artist Mismatch Penalty (-5000)');
              rejectedReason = `Artist Mismatch ("${candChannel}" vs "${artist}")`;
            }
          }

          if (!isArtistValid && normReqArtist) {
            candidates.push({
              videoId: candId,
              title: candTitle,
              channel: candChannel,
              duration: candDur,
              score: score - 5000,
              reasons,
              rejectedReason: rejectedReason || `Artist Mismatch ("${candChannel}" vs "${artist}")`,
            });
            continue;
          }

          score += artistScore;

          // 2. NEGATIVE PENALTIES & HARD REJECTIONS
          if (/\b(ai|ai cover|ai version|ai generated|ai voice|ai song)\b/i.test(fullCandText) && !/\bai\b/i.test(normReqTitle)) {
            score -= 1000;
            reasons.push('AI / AI Cover (-1000)');
            rejectedReason = 'AI Cover / AI Generated detected';
          }
          if (/\bkaraoke\b/i.test(fullCandText) && !/\bkaraoke\b/i.test(normReqTitle)) {
            score -= 1000;
            reasons.push('Karaoke (-1000)');
            rejectedReason = 'Karaoke version detected';
          }
          if (/\breaction\b/i.test(fullCandText) && !/\breaction\b/i.test(normReqTitle)) {
            score -= 1000;
            reasons.push('Reaction (-1000)');
            rejectedReason = 'Reaction video detected';
          }
          if (/\bpodcast\b/i.test(fullCandText) && !/\bpodcast\b/i.test(normReqTitle)) {
            score -= 1000;
            reasons.push('Podcast (-1000)');
            rejectedReason = 'Podcast detected';
          }

          if (/\b(instrumental|backing track|minus one|piano cover|guitar cover|violin cover|orchestral)\b/i.test(fullCandText) && !/\binstrumental\b/i.test(normReqTitle)) {
            score -= 700;
            reasons.push('Instrumental (-700)');
          }
          if (/\b(fanmade|fan-made|fan made)\b/i.test(fullCandText) && !/\bfanmade\b/i.test(normReqTitle)) {
            score -= 700;
            reasons.push('Fanmade (-700)');
          }

          if (/\bcover\b/i.test(fullCandText) && !/\bcover\b/i.test(normReqTitle)) {
            score -= 500;
            reasons.push('Cover (-500)');
          }
          if (/\bremix\b/i.test(fullCandText) && !reqHasRemix) {
            score -= 500;
            reasons.push('Remix (-500)');
          }
          if (/\b(sped up|speed up)\b/i.test(fullCandText) && !/\b(sped up|speed up)\b/i.test(normReqTitle)) {
            score -= 500;
            reasons.push('Sped Up (-500)');
          }
          if (/\b(slowed|reverb)\b/i.test(fullCandText) && !/\b(slowed|reverb)\b/i.test(normReqTitle)) {
            score -= 500;
            reasons.push('Slowed/Reverb (-500)');
          }
          if (/\bnightcore\b/i.test(fullCandText) && !/\bnightcore\b/i.test(normReqTitle)) {
            score -= 500;
            reasons.push('Nightcore (-500)');
          }
          if (/\b(8d|8d audio)\b/i.test(fullCandText) && !/\b8d\b/i.test(normReqTitle)) {
            score -= 500;
            reasons.push('8D Audio (-500)');
          }
          if (/\bbass boosted\b/i.test(fullCandText) && !/\bbass boosted\b/i.test(normReqTitle)) {
            score -= 500;
            reasons.push('Bass Boosted (-500)');
          }

          if (/\b(lyrics|lyric video)\b/i.test(fullCandText) && !/\blyrics\b/i.test(normReqTitle)) {
            score -= 300;
            reasons.push('Lyrics Video (-300)');
          }
          if (/\bextended\b/i.test(fullCandText) && !reqHasExtended) {
            score -= 300;
            reasons.push('Extended (-300)');
          }
          if (/\bloop\b/i.test(fullCandText) && !/\bloop\b/i.test(normReqTitle)) {
            score -= 300;
            reasons.push('Loop (-300)');
          }

          if (/\b(live|concert)\b/i.test(fullCandText) && !reqHasLive) {
            score -= 200;
            reasons.push('Live / Concert (-200)');
          }

          // 2. POSITIVE SCORING
          if (normReqArtist) {
            if (normCandChannel === normReqArtist || normCandChannel.includes(normReqArtist) || normReqArtist.includes(normCandChannel)) {
              score += 500;
              reasons.push('Artist EXACT Match (+500)');
            } else {
              score -= 1000;
              reasons.push('Artist Mismatch Penalty (-1000)');
              rejectedReason = `Artist Mismatch ("${candChannel}" vs "${artist}")`;
            }
          }

          if (normCandTitle === normReqTitle || normCandTitle.includes(normReqTitle) || normReqTitle.includes(normCandTitle)) {
            score += 300;
            reasons.push('Title EXACT Match (+300)');
          } else {
            score -= 5000;
            reasons.push('Title Mismatch Penalty (-5000)');
            if (!rejectedReason) rejectedReason = `Title Mismatch ("${candTitle}" vs "${title}")`;
          }

          if (normReqAlbum && (normCandTitle.includes(normReqAlbum) || normCandChannel.includes(normReqAlbum))) {
            score += 100;
            reasons.push('Album Match (+100)');
          }

          if (normCandChannel.includes('official') || normCandChannel.includes('vevo')) {
            score += 300;
            reasons.push('Official Artist Channel (+300)');
          } else if (normCandChannel.includes('topic') || normCandChannel.endsWith('- topic')) {
            score += 250;
            reasons.push('Official Topic Channel (+250)');
          } else {
            score += 150;
            reasons.push('Verified Artist / Channel (+150)');
          }

          if (durationSec && durationSec > 0 && candDur > 0) {
            const diff = Math.abs(candDur - durationSec);
            if (diff <= 2) {
              score += 100;
              reasons.push(`Duration within 2s (${candDur}s vs ${durationSec}s) (+100)`);
            } else if (diff <= 5) {
              score += 50;
              reasons.push(`Duration within 5s (${candDur}s vs ${durationSec}s) (+50)`);
            } else if (diff > 10) {
              score -= 1000;
              reasons.push(`Duration Mismatch > 10s (${candDur}s vs ${durationSec}s, diff ${diff.toFixed(1)}s) (-1000)`);
              if (!rejectedReason) rejectedReason = `Duration difference ${diff.toFixed(1)}s > 10s`;
            }
          }

          candidates.push({
            videoId: candId,
            title: candTitle,
            channel: candChannel,
            duration: candDur,
            score,
            reasons,
            rejectedReason,
          });
        }

        candidates.sort((a, b) => b.score - a.score);

        // DEBUG PANEL PRINTING
        console.log('====================================================');
        console.log('[YT-DLP FALLBACK SEARCH DEBUG PANEL]');
        console.log(`Search Query     : "${query}"`);
        console.log(`Requested Track  : "${artist} - ${title}" (Album: ${album || 'N/A'}, Duration: ${durationSec || 'N/A'}s)`);
        console.log(`Total Candidates : ${candidates.length}`);
        console.log('----------------------------------------------------');
        for (let idx = 0; idx < candidates.length; idx++) {
          const c = candidates[idx];
          console.log(`Candidate #${idx + 1} [Score: ${c.score}]`);
          console.log(`  ├─ VideoId         : ${c.videoId}`);
          console.log(`  ├─ Matched Title   : "${c.title}"`);
          console.log(`  ├─ Matched Artist  : "${c.channel}"`);
          console.log(`  ├─ Duration        : ${c.duration}s`);
          console.log(`  ├─ Score Breakdown : ${c.reasons.join(' | ')}`);
          if (c.rejectedReason && c.score < 400) {
            console.log(`  └─ Rejected Reason : ${c.rejectedReason}`);
          }
        }

        const CONFIDENCE_THRESHOLD = 400;

        if (candidates.length > 0 && candidates[0].score >= CONFIDENCE_THRESHOLD) {
          const best = candidates[0];
          console.log('----------------------------------------------------');
          console.log(`[SELECTED RESULT] VideoId: ${best.videoId} ("${best.title}" by "${best.channel}") with Final Score: ${best.score}`);
          console.log('====================================================');
          resolve(best.videoId);
        } else {
          console.log('----------------------------------------------------');
          console.warn(`[YT-DLP FALLBACK] Highest score was ${candidates[0]?.score ?? 0} (< ${CONFIDENCE_THRESHOLD} threshold).`);
          console.warn('RESULT: "No official version found."');
          console.log('====================================================');
          resolve(null);
        }
      });

      proc.on('error', (err) => {
        clearTimeout(timeout);
        console.error(`[StreamingEngine] yt-dlp search spawn error:`, err);
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
        const resTitle = (e.result?.title || '').toLowerCase();
        const vid = (e.result?.videoId || '');

        const isBadEntry =
          vid === '8rcyZC6YEh0' ||
          resTitle.includes('instrumental') ||
          resTitle.includes('karaoke') ||
          resTitle.includes('piano cover') ||
          resTitle.includes('backing track') ||
          resTitle.includes('ai cover') ||
          resTitle.includes('ai generated') ||
          resTitle.includes('ai voice') ||
          resTitle.includes('fanmade') ||
          /(\b|_|\()ai(\b|_|\))/i.test(resTitle);

        if (e.result && e.result.expiresAt > now && !isBadEntry) {
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
