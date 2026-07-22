import { ipcMain } from 'electron';
import { PlaylistSyncService, SyncInterval } from '../downloader/playlistSyncService';
import { SpotifyApiExtractor } from '../downloader/spotifyApi';
import { DownloaderService } from '../downloader/downloaderService';

let syncServiceInstance: PlaylistSyncService | null = null;

export function registerPlaylistSyncIpc(
  getDataPath: () => string,
  downloaderService: DownloaderService,
): PlaylistSyncService {
  if (!syncServiceInstance) {
    syncServiceInstance = new PlaylistSyncService(getDataPath);
  }

  const service = syncServiceInstance;

  // ─── Spotify Search ────────────────────────────────────────────────────────

  ipcMain.handle('spotify:search', async (_event, query: string, types?: string[]) => {
    try {
      const searchTypes = (types || ['track', 'album', 'artist', 'playlist']) as (
        | 'track'
        | 'album'
        | 'artist'
        | 'playlist'
      )[];
      return await SpotifyApiExtractor.searchSpotify(query, searchTypes, 20);
    } catch (err: any) {
      console.error('Spotify search error:', err);
      throw new Error(err?.message || 'Spotify search failed');
    }
  });

  // ─── Fetch Playlist Metadata (no download) ─────────────────────────────────

  ipcMain.handle('spotify:fetchUrl', async (_event, url: string) => {
    try {
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
        },
      });
      if (!res.ok) return null;
      return await res.text();
    } catch (err) {
      console.error('Fetch URL error:', err);
      return null;
    }
  });

  ipcMain.handle('spotify:fetchPlaylistMeta', async (_event, url: string) => {
    try {
      const meta = await SpotifyApiExtractor.fetchMetadata(url);
      return {
        id: meta.id,
        title: meta.title,
        owner: meta.owner || '',
        description: meta.description || '',
        coverUrl: meta.coverUrl,
        trackCount: meta.tracks ? meta.tracks.length : 0,
        type: meta.type,
        tracks: meta.tracks || [],
      };
    } catch (err: any) {
      console.error('Fetch playlist meta error:', err);
      throw new Error(err?.message || 'Failed to fetch Spotify metadata');
    }
  });

  // ─── Linked Playlists ──────────────────────────────────────────────────────

  ipcMain.handle('spotify:getLinkedPlaylists', async () => {
    return service.getLinkedPlaylists();
  });

  ipcMain.handle(
    'spotify:addLinkedPlaylist',
    async (
      _event,
      spotifyUrl: string,
      options: { autoSync?: boolean; syncInterval?: SyncInterval } = {},
    ) => {
      const linked = await service.addLinkedPlaylist(spotifyUrl, options);
      return linked;
    },
  );

  ipcMain.handle('spotify:removeLinkedPlaylist', async (_event, spotifyId: string) => {
    service.removeLinkedPlaylist(spotifyId);
    return true;
  });

  ipcMain.handle('spotify:toggleAutoSync', async (_event, spotifyId: string, autoSync: boolean) => {
    service.toggleAutoSync(spotifyId, autoSync);
    return true;
  });

  ipcMain.handle(
    'spotify:setSyncInterval',
    async (_event, spotifyId: string, interval: SyncInterval) => {
      service.setSyncInterval(spotifyId, interval);
      return true;
    },
  );

  // ─── Manual Sync Trigger ───────────────────────────────────────────────────

  ipcMain.handle(
    'spotify:syncPlaylist',
    async (
      _event,
      spotifyId: string,
      localSpotifyIds: string[],
      keepRemovedSongs: boolean,
    ) => {
      try {
        const result = await service.diffPlaylist(
          spotifyId,
          localSpotifyIds,
          { keepRemovedSongs },
          downloaderService,
        );

        // Queue new tracks for download with the playlist job ID attached
        if (result.newTrackIds.length > 0) {
          for (const trackId of result.newTrackIds) {
            try {
              await downloaderService.addUrl(
                `https://open.spotify.com/track/${trackId}`,
                spotifyId, // playlistJobId
              );
            } catch (e) {
              console.warn(`Failed queuing track ${trackId}:`, e);
            }
          }
        }

        service.markSyncComplete(spotifyId, result.reorderedTrackIds.length);
        service.broadcastSyncDone(spotifyId, result);

        return result;
      } catch (err: any) {
        console.error('Sync playlist error:', err);
        throw new Error(err?.message || 'Playlist sync failed');
      }
    },
  );

  // ─── Cover Cache ───────────────────────────────────────────────────────────

  ipcMain.handle(
    'spotify:cachePlaylistCover',
    async (_event, spotifyId: string, coverUrl: string) => {
      return await service.cachePlaylistCover(spotifyId, coverUrl);
    },
  );

  // ─── Update Local Playlist ID (called after auto-creation) ────────────────

  ipcMain.handle(
    'spotify:updateLocalPlaylistId',
    async (_event, spotifyId: string, localPlaylistId: string) => {
      service.updateLocalPlaylistId(spotifyId, localPlaylistId);
      return true;
    },
  );

  // ─── Download History ──────────────────────────────────────────────────────

  ipcMain.handle('spotify:getHistory', async () => {
    const historyPath = require('path').join(getDataPath(), 'downloader_history.json');
    const fs = require('fs');
    if (fs.existsSync(historyPath)) {
      try {
        const raw = fs.readFileSync(historyPath, 'utf-8');
        return JSON.parse(raw);
      } catch {
        return [];
      }
    }
    return [];
  });

  // ─── Duplicate Check ───────────────────────────────────────────────────────

  ipcMain.handle(
    'spotify:checkDuplicate',
    async (_event, spotifyId: string, isrc?: string, title?: string, artist?: string) => {
      return downloaderService.checkDuplicate(spotifyId, isrc, title, artist);
    },
  );

  return service;
}

export function getPlaylistSyncService(): PlaylistSyncService | null {
  return syncServiceInstance;
}
