import { create } from 'zustand';
import type { Playlist, Song } from '@/types';
import { platformService } from '@/platform';
import { useLibraryStore } from './useLibraryStore';
import { useStreamingStore } from './useStreamingStore';

interface PlaylistState {
  playlists: Playlist[];
  isLoaded: boolean;
  loadPlaylists: () => Promise<void>;
  createPlaylist: (name: string, description?: string, coverPath?: string | null) => Promise<Playlist>;
  deletePlaylist: (id: string) => Promise<void>;
  updatePlaylist: (
    id: string,
    partial: Partial<Omit<Playlist, 'id' | 'createdAt'>>,
  ) => Promise<void>;
  addSongToPlaylist: (playlistId: string, songOrId: string | Song) => Promise<void>;
  addSongsToPlaylist: (playlistId: string, songsOrIds: (string | Song)[]) => Promise<void>;
  removeSongFromPlaylist: (playlistId: string, songId: string) => Promise<void>;
  togglePinPlaylist: (id: string) => Promise<void>;
  toggleFavoritePlaylist: (id: string) => Promise<void>;
}

export const usePlaylistStore = create<PlaylistState>((set, get) => ({
  playlists: [],
  isLoaded: false,

  loadPlaylists: async () => {
    try {
      const data = (await platformService.data.read('playlist.json')) as {
        playlists: Playlist[];
      } | null;
      if (data && Array.isArray(data.playlists)) {
        set({ playlists: data.playlists, isLoaded: true });

        // Pre-stream playlist songs in background on launch
        setTimeout(() => {
          const allSongs = useLibraryStore.getState().songs;
          const streamingStore = useStreamingStore.getState();
          const songsToPrestream: Song[] = [];

          data.playlists.forEach((pl) => {
            pl.songIds.forEach((sId) => {
              const found = allSongs.find((s) => s.id === sId);
              if (found && !found.path) {
                songsToPrestream.push(found);
              }
            });
          });

          if (songsToPrestream.length > 0) {
            streamingStore.prefetchPlaylist(songsToPrestream);
          }
        }, 1200);
      } else {
        set({ playlists: [], isLoaded: true });
      }
    } catch {
      set({ playlists: [], isLoaded: true });
    }
  },

  createPlaylist: async (name, description = '', coverPath = null) => {
    const { playlists } = get();
    const newPlaylist: Playlist = {
      id: Math.random().toString(36).slice(2, 11),
      name,
      description,
      coverPath: coverPath ?? null,
      songIds: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
      isPinned: false,
      isFavorite: false,
    };

    const updatedPlaylists = [...playlists, newPlaylist];
    set({ playlists: updatedPlaylists });
    await platformService.data.write('playlist.json', { playlists: updatedPlaylists });
    return newPlaylist;
  },

  deletePlaylist: async (id) => {
    const { playlists } = get();
    const updatedPlaylists = playlists.filter((p) => p.id !== id);
    set({ playlists: updatedPlaylists });
    await platformService.data.write('playlist.json', { playlists: updatedPlaylists });
  },

  updatePlaylist: async (id, partial) => {
    const { playlists } = get();
    const updatedPlaylists = playlists.map((p) => {
      if (p.id === id) {
        return {
          ...p,
          ...partial,
          updatedAt: Date.now(),
        };
      }
      return p;
    });

    set({ playlists: updatedPlaylists });
    await platformService.data.write('playlist.json', { playlists: updatedPlaylists });
  },

  addSongToPlaylist: async (playlistId, songOrId) => {
    return get().addSongsToPlaylist(playlistId, [songOrId]);
  },

  addSongsToPlaylist: async (playlistId, songsOrIds) => {
    try {
      const newSongIds: string[] = [];
      const libraryStore = useLibraryStore.getState();

      for (const item of songsOrIds) {
        if (typeof item === 'string') {
          newSongIds.push(item);
        } else if (item && item.id) {
          newSongIds.push(item.id);
          libraryStore.addStreamSong(item);
        }
      }
      const { playlists } = get();
      const updatedPlaylists = playlists.map((p) => {
        if (p.id === playlistId) {
          const uniqueNewIds = newSongIds.filter((id) => !p.songIds.includes(id));
          if (uniqueNewIds.length === 0) return p;

          const songIds = [...p.songIds, ...uniqueNewIds];

          let coverPath = p.coverPath;
          if (!coverPath && songIds.length > 0) {
            try {
              const firstSong = useLibraryStore.getState().getSongById(songIds[0]);
              if (firstSong && firstSong.coverPath) {
                coverPath = firstSong.coverPath;
              }
            } catch (coverErr) {
              console.warn('Library store cover retrieval failed:', coverErr);
            }
          }

          return {
            ...p,
            songIds,
            coverPath,
            updatedAt: Date.now(),
          };
        }
        return p;
      });

      set({ playlists: updatedPlaylists });
      await platformService.data.write('playlist.json', { playlists: updatedPlaylists });

      const targetPlaylist = playlists.find((p) => p.id === playlistId);
      if (targetPlaylist && newSongIds.length === 1) {
        useToastStore.getState().showToast(`Added to ${targetPlaylist.name}`);
      } else if (targetPlaylist && newSongIds.length > 1) {
        useToastStore.getState().showToast(`Added ${newSongIds.length} songs to ${targetPlaylist.name}`);
      }
    } catch (err) {
      console.error('Error in addSongsToPlaylist:', err);
      useToastStore.getState().showToast(`Failed: ${(err as Error).message}`, 'error');
    }
  },

  removeSongFromPlaylist: async (playlistId, songId) => {
    try {
      const { playlists } = get();
      const updatedPlaylists = playlists.map((p) => {
        if (p.id === playlistId) {
          const songIds = p.songIds.filter((id) => id !== songId);

          // Update cover path if the cover song was removed and we have other songs
          let coverPath = p.coverPath;
          if (songIds.length === 0) {
            coverPath = null;
          } else if (p.coverPath) {
            // If the removed song was the source of the cover, optionally update it to the first song in list
            try {
              const firstSong = useLibraryStore.getState().getSongById(songIds[0]);
              if (firstSong && firstSong.coverPath) {
                coverPath = firstSong.coverPath;
              }
            } catch (coverErr) {
              console.warn('Library store cover retrieval failed:', coverErr);
            }
          }

          return {
            ...p,
            songIds,
            coverPath,
            updatedAt: Date.now(),
          };
        }
        return p;
      });

      set({ playlists: updatedPlaylists });
      await platformService.data.write('playlist.json', { playlists: updatedPlaylists });

      const targetPlaylist = playlists.find((p) => p.id === playlistId);
      if (targetPlaylist) {
        useToastStore.getState().showToast(`Removed from ${targetPlaylist.name}`, 'info');
      }
    } catch (err) {
      console.error('Error in removeSongFromPlaylist:', err);
      useToastStore.getState().showToast(`Failed: ${(err as Error).message}`, 'error');
    }
  },

  togglePinPlaylist: async (id) => {
    const { playlists } = get();
    const updatedPlaylists = playlists.map((p) => {
      if (p.id === id) {
        return {
          ...p,
          isPinned: !p.isPinned,
          updatedAt: Date.now(),
        };
      }
      return p;
    });

    set({ playlists: updatedPlaylists });
    await platformService.data.write('playlist.json', { playlists: updatedPlaylists });
  },

  toggleFavoritePlaylist: async (id) => {
    const { playlists } = get();
    const updatedPlaylists = playlists.map((p) => {
      if (p.id === id) {
        return {
          ...p,
          isFavorite: !p.isFavorite,
          updatedAt: Date.now(),
        };
      }
      return p;
    });

    set({ playlists: updatedPlaylists });
    await platformService.data.write('playlist.json', { playlists: updatedPlaylists });
  },
}));

// Import useToastStore inside the file to access toast notifications
import { useToastStore } from './useToastStore';
