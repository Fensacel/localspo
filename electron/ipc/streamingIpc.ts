import { ipcMain, BrowserWindow } from 'electron';
import { StreamingService } from '../downloader/streamingService';

let streamingServiceInstance: StreamingService | null = null;

export function registerStreamingIpc(
  getDataPath: () => string,
  getMainWindow: () => BrowserWindow | null,
): StreamingService {
  const service = new StreamingService(getDataPath);
  streamingServiceInstance = service;

  /**
   * Resolve a streaming URL by title + artist search.
   * Returns: { url, videoId, expiresAt, title, artist, album, coverUrl, durationSeconds } | null
   */
  ipcMain.handle(
    'streaming:resolveUrl',
    async (
      _event,
      title: string,
      artist: string,
      album?: string,
      coverUrl?: string,
      forceRefresh?: boolean,
    ) => {
      console.log(`[StreamingIpc] Resolving stream for: ${artist} - ${title} (forceRefresh: ${!!forceRefresh})`);
      const result = await service.resolveBySearch(title, artist, album, coverUrl, forceRefresh);
      return result;
    },
  );

  /**
   * Resolve a streaming URL by YouTube videoId directly.
   */
  ipcMain.handle('streaming:resolveByVideoId', async (_event, videoId: string, forceRefresh?: boolean) => {
    console.log(`[StreamingIpc] Resolving stream by videoId: ${videoId} (forceRefresh: ${!!forceRefresh})`);
    return service.resolveByVideoId(videoId, forceRefresh);
  });

  /**
   * Prefetch stream URL in background (fire-and-forget from renderer).
   * No return value — just warms the cache.
   */
  ipcMain.handle(
    'streaming:prefetch',
    async (_event, title: string, artist: string) => {
      console.log(`[StreamingIpc] Prefetching stream for: ${artist} - ${title}`);
      // fire and forget
      service.resolveBySearch(title, artist).catch(() => {});
      return true;
    },
  );

  /**
   * Prune expired cache entries.
   */
  ipcMain.handle('streaming:pruneCache', async () => {
    service.pruneCache();
    return { cacheSize: service.getCacheSize() };
  });

  /**
   * Get cache stats.
   */
  ipcMain.handle('streaming:cacheStats', async () => {
    return { size: service.getCacheSize() };
  });

  // Prune cache every hour
  setInterval(
    () => {
      service.pruneCache();
    },
    60 * 60 * 1000,
  );

  return service;
}

export function getStreamingService(): StreamingService | null {
  return streamingServiceInstance;
}
