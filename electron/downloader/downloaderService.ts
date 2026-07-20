import { app, BrowserWindow, shell } from 'electron';
import fs from 'fs';
import path from 'path';
import http from 'http';
import https from 'https';
import { spawn, ChildProcess } from 'child_process';
import { SpotifyApiExtractor, SpotifyTrackMeta } from './spotifyApi';
import { YouTubeApiExtractor } from './youtubeApi';
import { YTMusicApi } from './ytMusicApi';
import { LyricsApi } from './lyricsApi';
import { AudioTagger } from './tagger';
import { getBinaryPaths } from './binaryManager';

async function downloadImageBuffer(urlStr: string): Promise<Buffer | null> {
  return new Promise((resolve) => {
    const request = (currentUrl: string, redirects = 0) => {
      if (redirects > 5) return resolve(null);
      const client = currentUrl.startsWith('https') ? https : http;

      const req = client.get(
        currentUrl,
        {
          headers: {
            'User-Agent':
              'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
          },
        },
        (res) => {
          if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
            return request(res.headers.location, redirects + 1);
          }
          if (res.statusCode !== 200) {
            return resolve(null);
          }
          const chunks: Buffer[] = [];
          res.on('data', (chunk) => chunks.push(chunk));
          res.on('end', () => resolve(Buffer.concat(chunks)));
          res.on('error', () => resolve(null));
        }
      );
      req.on('error', () => resolve(null));
      req.end();
    };

    request(urlStr);
  });
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
  progress: number; // 0 - 100
  speed: string;
  eta: string;
  errorMessage?: string;
  outputPath?: string;
  addedAt: number;
  attempts: number;

  // Extended ID3 Metadata
  releaseDate?: string;
  trackNumber?: number;
  discNumber?: number;
  isrc?: string;
  publisher?: string;
  copyright?: string;
  composer?: string;
  bpm?: number;
  key?: string;
}

export class DownloaderService {
  private getDataPath: () => string;
  private settings: DownloaderSettings;
  private queue: DownloadItem[] = [];
  private activeProcesses: Map<string, ChildProcess> = new Map();
  private isProcessing = false;

  constructor(getDataPath: () => string) {
    this.getDataPath = getDataPath;
    this.settings = this.loadSettings();
    this.loadQueueFromDisk();
  }

  public getSettings(): DownloaderSettings {
    return { ...this.settings };
  }

  public updateSettings(partial: Partial<DownloaderSettings>): DownloaderSettings {
    this.settings = { ...this.settings, ...partial };
    this.saveSettings();
    return this.getSettings();
  }

  public getQueue(): DownloadItem[] {
    return [...this.queue];
  }

  public async addUrl(urlStr: string): Promise<DownloadItem[]> {
    let meta;
    if (YouTubeApiExtractor.parseUrl(urlStr)) {
      meta = await YouTubeApiExtractor.fetchMetadata(urlStr);
    } else {
      meta = await SpotifyApiExtractor.fetchMetadata(urlStr);
    }
    const addedItems: DownloadItem[] = [];

    for (const track of meta.tracks) {
      // Check if already in queue and completed/downloading
      const existing = this.queue.find((item) => item.spotifyId === track.id && item.status !== 'failed');
      if (existing) {
        continue;
      }

      const item: DownloadItem = {
        id: `dl_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        spotifyUrl: track.spotifyUrl,
        spotifyId: track.id,
        title: track.title,
        artist: track.artist,
        album: track.album,
        coverUrl: track.coverUrl,
        status: 'queued',
        progress: 0,
        speed: '0 KB/s',
        eta: '--:--',
        addedAt: Date.now(),
        attempts: 0,

        releaseDate: track.releaseDate,
        trackNumber: track.trackNumber,
        discNumber: track.discNumber,
        isrc: track.isrc,
        publisher: track.publisher,
        copyright: track.copyright,
        composer: track.composer,
        bpm: track.bpm,
        key: track.key,
      };

      this.queue.push(item);
      addedItems.push(item);
    }

    this.saveQueueToDisk();
    this.broadcastStatus();
    this.processQueue();

    return addedItems;
  }

  public cancelDownload(id: string): void {
    const item = this.queue.find((i) => i.id === id);
    if (!item) return;

    if (item.status === 'downloading' || item.status === 'tagging') {
      const proc = this.activeProcesses.get(id);
      if (proc) {
        proc.kill('SIGTERM');
        this.activeProcesses.delete(id);
      }
    }

    item.status = 'cancelled';
    item.progress = 0;
    item.speed = '0 KB/s';
    item.eta = '--:--';
    item.errorMessage = 'Download cancelled';

    this.saveQueueToDisk();
    this.broadcastStatus();
    this.processQueue();
  }

  public cancelAllDownloads(): void {
    for (const item of this.queue) {
      if (item.status === 'downloading' || item.status === 'tagging' || item.status === 'queued') {
        const proc = this.activeProcesses.get(item.id);
        if (proc) {
          try {
            proc.kill('SIGTERM');
          } catch {}
          this.activeProcesses.delete(item.id);
        }
        item.status = 'cancelled';
        item.progress = 0;
        item.speed = '0 KB/s';
        item.eta = '--:--';
        item.errorMessage = 'Cancelled by user';
      }
    }
    this.saveQueueToDisk();
    this.broadcastStatus();
  }

  public retryDownload(id: string): void {
    const item = this.queue.find((i) => i.id === id);
    if (!item) return;

    item.status = 'queued';
    item.progress = 0;
    item.speed = '0 KB/s';
    item.eta = '--:--';
    item.errorMessage = undefined;
    item.attempts = 0;

    this.saveQueueToDisk();
    this.broadcastStatus();
    this.processQueue();
  }

  public removeDownload(id: string): void {
    this.cancelDownload(id);
    this.queue = this.queue.filter((i) => i.id !== id);
    this.saveQueueToDisk();
    this.broadcastStatus();
  }

  public clearFinished(): void {
    this.queue = this.queue.filter((i) => i.status !== 'completed' && i.status !== 'cancelled');
    this.saveQueueToDisk();
    this.broadcastStatus();
  }

  public openDownloadFolder(): void {
    const folder = this.getDownloadDirectory();
    if (!fs.existsSync(folder)) {
      fs.mkdirSync(folder, { recursive: true });
    }
    shell.openPath(folder);
  }

  private getDownloadDirectory(): string {
    if (this.settings.downloadFolder && fs.existsSync(this.settings.downloadFolder)) {
      return this.settings.downloadFolder;
    }
    const defaultFolder = path.join(app.getPath('music'), 'LocalSpo Downloads');
    if (!fs.existsSync(defaultFolder)) {
      fs.mkdirSync(defaultFolder, { recursive: true });
    }
    return defaultFolder;
  }

  private async processQueue(): Promise<void> {
    if (this.isProcessing) return;
    this.isProcessing = true;

    try {
      const activeCount = this.queue.filter((i) => i.status === 'downloading' || i.status === 'tagging').length;
      const availableSlots = this.settings.concurrentDownloads - activeCount;

      if (availableSlots <= 0) {
        this.isProcessing = false;
        return;
      }

      const pendingItems = this.queue.filter((i) => i.status === 'queued').slice(0, availableSlots);

      for (const item of pendingItems) {
        this.downloadItem(item);
      }
    } finally {
      this.isProcessing = false;
    }
  }

  private async downloadItem(item: DownloadItem): Promise<void> {
    item.status = 'downloading';
    item.attempts += 1;
    item.progress = 5;
    this.broadcastStatus();

    const binaries = getBinaryPaths(this.getDataPath);
    const downloadDir = this.getDownloadDirectory();

    const safeTitle = this.sanitizeFileName(item.title);
    const safeArtist = this.sanitizeFileName(item.artist);
    const fileNameBase = `${safeArtist} - ${safeTitle}`;
    const ext = `.${this.settings.audioFormat}`;
    const targetFilePath = path.join(downloadDir, `${fileNameBase}${ext}`);

    // Create a dedicated OS temp folder for downloading and tagging
    const osTempDir = path.join(app.getPath('temp'), 'localspo_downloads');
    if (!fs.existsSync(osTempDir)) {
      fs.mkdirSync(osTempDir, { recursive: true });
    }
    const tempAudioFile = path.join(osTempDir, `dl_${Date.now()}_${Math.random().toString(36).slice(2, 7)}${ext}`);

    try {
      // 1. Search YouTube audio target
      let searchTarget = `ytsearch1:${item.artist} - ${item.title} official audio`;

      if (
        item.spotifyUrl.includes('youtube.com/') ||
        item.spotifyUrl.includes('youtu.be/') ||
        item.spotifyId.startsWith('yt_')
      ) {
        // Direct YouTube link pasted by user
        searchTarget = item.spotifyUrl;
      } else {
        const ytResult = await YTMusicApi.searchVideo(item.artist, item.title, item.album);
        if (ytResult && ytResult.videoId) {
          searchTarget = `https://www.youtube.com/watch?v=${ytResult.videoId}`;
        }
      }

      // 2. Download audio via yt-dlp to OS temp directory
      const args = [
        '-x',
        '--audio-format', this.settings.audioFormat,
        '--audio-quality', '0',
        '-o', tempAudioFile,
        '--ffmpeg-location', binaries.ffmpeg,
        '--newline',
        searchTarget,
      ];

      const ytDlpProc = spawn(binaries.ytdlp, args, { windowsHide: true });
      this.activeProcesses.set(item.id, ytDlpProc);

      let stderrText = '';

      ytDlpProc.stdout.on('data', (chunk: Buffer) => {
        const text = chunk.toString('utf-8');
        this.parseYtDlpProgress(item, text);
      });

      ytDlpProc.stderr.on('data', (chunk: Buffer) => {
        stderrText += chunk.toString('utf-8');
      });

      const exitCode = await new Promise<number>((resolve) => {
        ytDlpProc.on('close', (code) => resolve(code ?? 1));
        ytDlpProc.on('error', (err) => {
          console.error('yt-dlp spawn error:', err);
          stderrText += ` (${err.message})`;
          resolve(1);
        });
      });

      this.activeProcesses.delete(item.id);

      if (exitCode !== 0 || !fs.existsSync(tempAudioFile)) {
        const lastErr = stderrText.trim().split('\n').filter(Boolean).pop();
        throw new Error(lastErr ? `yt-dlp download failed: ${lastErr}` : 'yt-dlp audio download failed');
      }

      // 3. Tagging phase inside temp directory
      item.status = 'tagging';
      item.progress = 80;
      this.broadcastStatus();

      // Download official Spotify Cover image inside OS temp directory
      let localCoverPath: string | null = null;
      if (item.coverUrl) {
        const coverBuffer = await downloadImageBuffer(item.coverUrl);
        if (coverBuffer && coverBuffer.length > 0) {
          localCoverPath = path.join(osTempDir, `cover_${Date.now()}_${Math.random().toString(36).slice(2, 7)}.jpg`);
          fs.writeFileSync(localCoverPath, coverBuffer);
        }
      }

      // Fetch lyrics if enabled
      let lyricsContent: string | null = null;
      if (this.settings.getLyrics) {
        const lyricsRes = await LyricsApi.fetchLyrics(item.artist, item.title, item.album);
        if (lyricsRes.syncedLyrics || lyricsRes.plainLyrics) {
          lyricsContent = lyricsRes.syncedLyrics || lyricsRes.plainLyrics;

          if (this.settings.createLrcFile && lyricsRes.syncedLyrics) {
            const lrcFilePath = path.join(downloadDir, `${fileNameBase}.lrc`);
            fs.writeFileSync(lrcFilePath, lyricsRes.syncedLyrics, 'utf-8');
          }
        }
      }

      // Embed tags using AudioTagger on the temp file
      await AudioTagger.embedTags(tempAudioFile, binaries.ffmpeg, {
        title: item.title,
        artist: item.artist,
        album: item.album,
        year: item.releaseDate ? item.releaseDate.slice(0, 4) : undefined,
        trackNumber: item.trackNumber,
        discNumber: item.discNumber,
        coverPath: localCoverPath,
        lyrics: lyricsContent,

        isrc: item.isrc,
        publisher: item.publisher,
        copyright: item.copyright,
        composer: item.composer,
        bpm: item.bpm,
        key: item.key,
      });

      // Cleanup local cover temp file
      if (localCoverPath && fs.existsSync(localCoverPath)) {
        try {
          fs.unlinkSync(localCoverPath);
        } catch {}
      }

      // 4. Move only the final tagged song to target download folder
      if (!fs.existsSync(downloadDir)) {
        fs.mkdirSync(downloadDir, { recursive: true });
      }

      // Remove any existing file with same base name regardless of extension (e.g. .mp3 vs .flac)
      try {
        const existingFiles = fs.readdirSync(downloadDir);
        for (const file of existingFiles) {
          const fileBase = path.basename(file, path.extname(file));
          if (fileBase.toLowerCase() === fileNameBase.toLowerCase()) {
            const oldPath = path.join(downloadDir, file);
            if (fs.existsSync(oldPath)) {
              fs.unlinkSync(oldPath);
            }
          }
        }
      } catch (e) {
        console.warn('Could not clean old format files:', e);
      }

      if (fs.existsSync(targetFilePath)) {
        fs.unlinkSync(targetFilePath);
      }
      fs.copyFileSync(tempAudioFile, targetFilePath);
      try {
        fs.unlinkSync(tempAudioFile);
      } catch {}

      item.status = 'completed';
      item.progress = 100;
      item.speed = 'Done';
      item.eta = '00:00';
      item.outputPath = targetFilePath;

      // Auto-import into LocalSpo library if enabled
      if (this.settings.autoImport) {
        this.triggerAutoImport(downloadDir);
      }
    } catch (err: any) {
      console.error(`Download failed for ${item.title}:`, err);
      if (item.attempts < this.settings.retryCount && (item.status as string) !== 'cancelled') {
        item.status = 'queued';
        item.progress = 0;
      } else {
        item.status = 'failed';
        item.errorMessage = err?.message || 'Download error';
      }
    }

    this.saveQueueToDisk();
    this.broadcastStatus();
    this.processQueue();
  }

  private parseYtDlpProgress(item: DownloadItem, line: string): void {
    // Example: [download]  45.2% of  5.20MiB at  1.20MiB/s ETA 00:04
    const match = line.match(/\[download\]\s+([\d.]+)%\s+of\s+\S+\s+at\s+(\S+)\s+ETA\s+(\S+)/);
    if (match) {
      const pct = parseFloat(match[1]);
      item.progress = Math.min(79, Math.max(10, Math.round(pct * 0.75)));
      item.speed = match[2];
      item.eta = match[3];
      this.broadcastStatus();
    }
  }

  private sanitizeFileName(str: string): string {
    return str.replace(/[\\/:*?"<>|]/g, '_').trim();
  }

  private triggerAutoImport(folder: string): void {
    // Dispatch scan folder event via MainWindow if available
    const windows = BrowserWindow.getAllWindows();
    if (windows.length > 0) {
      windows[0].webContents.send('scanner:autoImportFolder', folder);
    }
  }

  private broadcastStatus(): void {
    const windows = BrowserWindow.getAllWindows();
    if (windows.length > 0) {
      windows[0].webContents.send('downloader:queueUpdated', this.getQueue());
    }
  }

  private loadSettings(): DownloaderSettings {
    const settingsPath = path.join(this.getDataPath(), 'downloader.json');
    const defaultSettings: DownloaderSettings = {
      downloadFolder: path.join(app.getPath('music'), 'LocalSpo Downloads'),
      audioFormat: 'mp3',
      audioBitrate: '320k',
      getLyrics: true,
      createLrcFile: false,
      autoImport: true,
      concurrentDownloads: 2,
      retryCount: 3,
    };

    if (fs.existsSync(settingsPath)) {
      try {
        const raw = fs.readFileSync(settingsPath, 'utf-8');
        return { ...defaultSettings, ...JSON.parse(raw) };
      } catch {
        return defaultSettings;
      }
    }
    return defaultSettings;
  }

  private saveSettings(): void {
    const settingsPath = path.join(this.getDataPath(), 'downloader.json');
    try {
      fs.writeFileSync(settingsPath, JSON.stringify(this.settings, null, 2), 'utf-8');
    } catch (err) {
      console.error('Error saving downloader settings:', err);
    }
  }

  private loadQueueFromDisk(): void {
    const queuePath = path.join(this.getDataPath(), 'downloader_queue.json');
    if (fs.existsSync(queuePath)) {
      try {
        const raw = fs.readFileSync(queuePath, 'utf-8');
        const loaded: DownloadItem[] = JSON.parse(raw);
        // Reset any leftover downloading status to queued
        this.queue = loaded.map((item) => ({
          ...item,
          status: item.status === 'downloading' || item.status === 'tagging' ? 'queued' : item.status,
        }));
      } catch {
        this.queue = [];
      }
    }
  }

  private saveQueueToDisk(): void {
    const queuePath = path.join(this.getDataPath(), 'downloader_queue.json');
    try {
      fs.writeFileSync(queuePath, JSON.stringify(this.queue, null, 2), 'utf-8');
    } catch (err) {
      console.error('Error saving downloader queue:', err);
    }
  }
}
