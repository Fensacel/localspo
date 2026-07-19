import { create } from 'zustand';
import type { Playlist } from '@/types';

interface PlaylistState {
  playlists: Playlist[];
  isLoaded: boolean;
  loadPlaylists: () => Promise<void>;
  createPlaylist: (name: string, description?: string) => Promise<Playlist>;
  deletePlaylist: (id: string) => Promise<void>;
  updatePlaylist: (
    id: string,
    partial: Partial<Omit<Playlist, 'id' | 'createdAt'>>,
  ) => Promise<void>;
  addSongToPlaylist: (playlistId: string, songId: string) => Promise<void>;
  removeSongFromPlaylist: (playlistId: string, songId: string) => Promise<void>;
  togglePinPlaylist: (id: string) => Promise<void>;
  toggleFavoritePlaylist: (id: string) => Promise<void>;
}

export const usePlaylistStore = create<PlaylistState>((set, get) => ({
  playlists: [],
  isLoaded: false,

  loadPlaylists: async () => {
    try {
      const data = (await window.electronAPI.data.read('playlist.json')) as {
        playlists: Playlist[];
      } | null;
      if (data && Array.isArray(data.playlists)) {
        set({ playlists: data.playlists, isLoaded: true });
      } else {
        set({ playlists: [], isLoaded: true });
      }
    } catch {
      set({ playlists: [], isLoaded: true });
    }
  },

  createPlaylist: async (name, description = '') => {
    const { playlists } = get();
    const newPlaylist: Playlist = {
      id: Math.random().toString(36).slice(2, 11),
      name,
      description,
      coverPath: null,
      songIds: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
      isPinned: false,
      isFavorite: false,
    };

    const updatedPlaylists = [...playlists, newPlaylist];
    set({ playlists: updatedPlaylists });
    await window.electronAPI.data.write('playlist.json', { playlists: updatedPlaylists });
    return newPlaylist;
  },

  deletePlaylist: async (id) => {
    const { playlists } = get();
    const updatedPlaylists = playlists.filter((p) => p.id !== id);
    set({ playlists: updatedPlaylists });
    await window.electronAPI.data.write('playlist.json', { playlists: updatedPlaylists });
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
    await window.electronAPI.data.write('playlist.json', { playlists: updatedPlaylists });
  },

  addSongToPlaylist: async (playlistId, songId) => {
    try {
      const { playlists } = get();
      const updatedPlaylists = playlists.map((p) => {
        if (p.id === playlistId) {
          // Prevent duplicate songs in playlist
          const songIds = p.songIds.includes(songId) ? p.songIds : [...p.songIds, songId];

          // If playlist doesn't have a cover, use the cover of the added song
          let coverPath = p.coverPath;
          if (!coverPath) {
            try {
              const song = useLibraryStore.getState().getSongById(songId);
              if (song && song.coverPath) {
                coverPath = song.coverPath;
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
      await window.electronAPI.data.write('playlist.json', { playlists: updatedPlaylists });

      const targetPlaylist = playlists.find((p) => p.id === playlistId);
      if (targetPlaylist) {
        useToastStore.getState().showToast(`Added to ${targetPlaylist.name}`);
      }
    } catch (err) {
      console.error('Error in addSongToPlaylist:', err);
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
      await window.electronAPI.data.write('playlist.json', { playlists: updatedPlaylists });

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
    await window.electronAPI.data.write('playlist.json', { playlists: updatedPlaylists });
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
    await window.electronAPI.data.write('playlist.json', { playlists: updatedPlaylists });
  },
}));

// Import useLibraryStore inside the file to access song cover metadata
import { useLibraryStore } from './useLibraryStore';
import { useToastStore } from './useToastStore';
