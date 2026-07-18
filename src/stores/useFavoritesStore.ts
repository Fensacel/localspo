import { create } from 'zustand';
import type { FavoritesData } from '@/types';

interface FavoritesState extends FavoritesData {
  isLoaded: boolean;
  loadFavorites: () => Promise<void>;
  toggleFavoriteSong: (songId: string) => Promise<void>;
  toggleFavoriteAlbum: (albumId: string) => Promise<void>;
  toggleFavoriteArtist: (artistId: string) => Promise<void>;
  isFavoriteSong: (songId: string) => boolean;
  isFavoriteAlbum: (albumId: string) => boolean;
  isFavoriteArtist: (artistId: string) => boolean;
}

const defaultFavorites: FavoritesData = {
  songIds: [],
  albumIds: [],
  artistIds: [],
};

export const useFavoritesStore = create<FavoritesState>((set, get) => ({
  ...defaultFavorites,
  isLoaded: false,

  loadFavorites: async () => {
    try {
      const data = (await window.electronAPI.data.read('favorites.json')) as FavoritesData | null;
      if (data) {
        set({
          songIds: data.songIds || [],
          albumIds: data.albumIds || [],
          artistIds: data.artistIds || [],
          isLoaded: true,
        });
      } else {
        set({ ...defaultFavorites, isLoaded: true });
      }
    } catch {
      set({ ...defaultFavorites, isLoaded: true });
    }
  },

  toggleFavoriteSong: async (songId) => {
    const { songIds, albumIds, artistIds } = get();
    const isFav = songIds.includes(songId);
    const newSongIds = isFav ? songIds.filter((id) => id !== songId) : [...songIds, songId];

    set({ songIds: newSongIds });
    await window.electronAPI.data.write('favorites.json', {
      songIds: newSongIds,
      albumIds,
      artistIds,
    });
  },

  toggleFavoriteAlbum: async (albumId) => {
    const { songIds, albumIds, artistIds } = get();
    const isFav = albumIds.includes(albumId);
    const newAlbumIds = isFav ? albumIds.filter((id) => id !== albumId) : [...albumIds, albumId];

    set({ albumIds: newAlbumIds });
    await window.electronAPI.data.write('favorites.json', {
      songIds,
      albumIds: newAlbumIds,
      artistIds,
    });
  },

  toggleFavoriteArtist: async (artistId) => {
    const { songIds, albumIds, artistIds } = get();
    const isFav = artistIds.includes(artistId);
    const newArtistIds = isFav
      ? artistIds.filter((id) => id !== artistId)
      : [...artistIds, artistId];

    set({ artistIds: newArtistIds });
    await window.electronAPI.data.write('favorites.json', {
      songIds,
      albumIds,
      artistIds: newArtistIds,
    });
  },

  isFavoriteSong: (songId) => get().songIds.includes(songId),
  isFavoriteAlbum: (albumId) => get().albumIds.includes(albumId),
  isFavoriteArtist: (artistId) => get().artistIds.includes(artistId),
}));
