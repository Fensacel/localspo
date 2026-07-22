import type { PlatformAPI } from './types';

export const webPlatform: PlatformAPI = {
  isElectron: false,
  isAndroid: false,

  dialog: {
    openFolder: async () => {
      return new Promise((resolve) => {
        const input = document.createElement('input');
        input.type = 'file';
        input.multiple = true;
        input.accept = 'audio/*';
        input.onchange = async (e: any) => {
          const files: File[] = Array.from(e.target.files || []);
          if (files.length === 0) {
            resolve(null);
            return;
          }

          const value = localStorage.getItem('web_library.json');
          let existingSongs: any[] = [];
          let existingAlbums: any[] = [];
          let existingArtists: any[] = [];

          if (value) {
            try {
              const parsed = JSON.parse(value);
              existingSongs = parsed.songs || [];
              existingAlbums = parsed.albums || [];
              existingArtists = parsed.artists || [];
            } catch {
              // start fresh if corrupt
            }
          }

          const newSongs: any[] = [];
          const albumMap = new Map<string, any>();
          existingAlbums.forEach((a) => albumMap.set(a.id, a));

          const artistMap = new Map<string, any>();
          existingArtists.forEach((a) => artistMap.set(a.id, a));

          for (let i = 0; i < files.length; i++) {
            const file = files[i];
            const url = URL.createObjectURL(file);
            const fileName = file.name.replace(/\.[^/.]+$/, '');
            const parts = fileName.split('-').map((s) => s.trim());

            let artistName = 'Unknown Artist';
            let title = fileName;
            if (parts.length >= 2) {
              artistName = parts[0];
              title = parts.slice(1).join(' - ');
            }

            const albumName = 'Local Music';
            const songId = 'web_' + Math.random().toString(36).slice(2, 9);
            const albumId = 'album_' + artistName.toLowerCase().replace(/\s+/g, '_');
            const artistId = 'artist_' + artistName.toLowerCase().replace(/\s+/g, '_');

            const song = {
              id: songId,
              title,
              artist: artistName,
              album: albumName,
              albumArtist: artistName,
              path: url,
              duration: 180,
              trackNumber: i + 1,
              year: new Date().getFullYear(),
              genre: 'Music',
              coverPath: null,
              fileSize: file.size,
              format: file.type.split('/')[1] || 'mp3',
              addedAt: Date.now(),
              playCount: 0,
            };

            newSongs.push(song);

            if (!albumMap.has(albumId)) {
              albumMap.set(albumId, {
                id: albumId,
                name: albumName,
                artist: artistName,
                coverPath: null,
                year: new Date().getFullYear(),
                songIds: [songId],
              });
            } else {
              albumMap.get(albumId).songIds.push(songId);
            }

            if (!artistMap.has(artistId)) {
              artistMap.set(artistId, {
                id: artistId,
                name: artistName,
                albumIds: [albumId],
                songIds: [songId],
              });
            } else {
              const art = artistMap.get(artistId);
              if (!art.albumIds.includes(albumId)) art.albumIds.push(albumId);
              art.songIds.push(songId);
            }
          }

          const combinedSongs = [...existingSongs, ...newSongs];
          const library = {
            songs: combinedSongs,
            albums: Array.from(albumMap.values()),
            artists: Array.from(artistMap.values()),
            lastScan: Date.now(),
          };

          localStorage.setItem('web_library.json', JSON.stringify(library));
          resolve(`Imported ${files.length} song(s)`);
        };
        input.click();
      });
    },

    openImage: async () => {
      return new Promise((resolve) => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.onchange = (e: any) => {
          const files = e.target.files;
          if (files && files.length > 0) {
            const file = files[0];
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = () => resolve(null);
            reader.readAsDataURL(file);
          } else {
            resolve(null);
          }
        };
        input.click();
      });
    },
  },

  data: {
    read: async <T = unknown>(key: string): Promise<T | null> => {
      try {
        const value = localStorage.getItem(key);
        if (!value) return null;
        return JSON.parse(value) as T;
      } catch {
        return null;
      }
    },

    write: async <T = unknown>(key: string, value: T): Promise<boolean> => {
      try {
        localStorage.setItem(key, JSON.stringify(value));
        return true;
      } catch {
        return false;
      }
    },
  },

  scanner: {
    scanFolder: async (_path: string) => {
      const value = localStorage.getItem('web_library.json');
      if (!value) return { songs: [], albums: [], artists: [] };
      try {
        return JSON.parse(value);
      } catch {
        return { songs: [], albums: [], artists: [] };
      }
    },
    getLibrary: async () => {
      const value = localStorage.getItem('web_library.json');
      if (!value) return { songs: [], albums: [], artists: [] };
      try {
        return JSON.parse(value);
      } catch {
        return { songs: [], albums: [], artists: [] };
      }
    },
    updateTags: async () => null,
    onProgress: (_callback: (data: any) => void) => () => { },
  },

  lyrics: {
    read: async () => null,
  },

  app: {
    getVersion: async () => '2.0.2-web',
  },

  updater: {
    isAvailable: false,
    check: () => {
      console.log('[Web] Auto update is disabled on Web');
    },
  },

  downloader: {
    isAvailable: false,
  },

  mediaSession: {
    updateMetadata: (song) => {
      if ('mediaSession' in navigator) {
        try {
          navigator.mediaSession.metadata = new MediaMetadata({
            title: song.title,
            artist: song.artist,
            album: song.album || '',
            artwork: song.coverUrl
              ? [{ src: song.coverUrl, sizes: '512x512', type: 'image/jpeg' }]
              : [],
          });
        } catch (e) {
          console.warn('[MediaSession] Metadata update error:', e);
        }
      }
    },

    updatePlaybackState: (isPlaying) => {
      if ('mediaSession' in navigator) {
        try {
          navigator.mediaSession.playbackState = isPlaying ? 'playing' : 'paused';
        } catch (e) {
          console.warn('[MediaSession] Playback state error:', e);
        }
      }
    },

    setActionHandlers: (handlers) => {
      if (!('mediaSession' in navigator)) return;
      const actions: MediaSessionAction[] = ['play', 'pause', 'previoustrack', 'nexttrack', 'seekto'];
      actions.forEach((action) => {
        try {
          if (action === 'play' && handlers.play) {
            navigator.mediaSession.setActionHandler('play', handlers.play);
          } else if (action === 'pause' && handlers.pause) {
            navigator.mediaSession.setActionHandler('pause', handlers.pause);
          } else if (action === 'previoustrack' && handlers.previoustrack) {
            navigator.mediaSession.setActionHandler('previoustrack', handlers.previoustrack);
          } else if (action === 'nexttrack' && handlers.nexttrack) {
            navigator.mediaSession.setActionHandler('nexttrack', handlers.nexttrack);
          } else if (action === 'seekto' && handlers.seekto) {
            navigator.mediaSession.setActionHandler('seekto', (details) => {
              if (details.seekTime !== undefined && handlers.seekto) {
                handlers.seekto({ seekTime: details.seekTime });
              }
            });
          }
        } catch (e) {
          console.warn(`[MediaSession] Failed to set action handler ${action}:`, e);
        }
      });
    },
  },

  backButton: {
    onBackButton: (callback) => {
      const handler = () => {
        callback();
      };
      window.addEventListener('popstate', handler);
      return () => window.removeEventListener('popstate', handler);
    },
  },

  network: {
    onStatusChange: (callback) => {
      const handleOnline = () => callback(true);
      const handleOffline = () => callback(false);
      window.addEventListener('online', handleOnline);
      window.addEventListener('offline', handleOffline);
      return () => {
        window.removeEventListener('online', handleOnline);
        window.removeEventListener('offline', handleOffline);
      };
    },
  },
};
