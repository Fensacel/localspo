import { create } from 'zustand';
import type { Song, Album, Artist, LibraryData, ScanProgress } from '@/types';

interface LibraryState {
  songs: Song[];
  albums: Album[];
  artists: Artist[];
  lastScan: number | null;
  isLoading: boolean;
  scanProgress: ScanProgress;

  setSongs: (songs: Song[]) => void;
  setAlbums: (albums: Album[]) => void;
  setArtists: (artists: Artist[]) => void;
  setLibraryData: (data: LibraryData) => void;
  setScanProgress: (progress: Partial<ScanProgress>) => void;
  setLoading: (loading: boolean) => void;

  getSongById: (id: string) => Song | undefined;
  getAlbumById: (id: string) => Album | undefined;
  getArtistById: (id: string) => Artist | undefined;
  getAlbumSongs: (albumId: string) => Song[];
  getArtistSongs: (artistId: string) => Song[];
  getArtistAlbums: (artistId: string) => Album[];
  getRecentlyAdded: (limit?: number) => Song[];
}

export const useLibraryStore = create<LibraryState>((set, get) => ({
  songs: [],
  albums: [],
  artists: [],
  lastScan: null,
  isLoading: false,
  scanProgress: {
    status: 'idle',
    totalFiles: 0,
    processedFiles: 0,
    currentFile: '',
    message: '',
  },

  setSongs: (songs) => set({ songs }),
  setAlbums: (albums) => set({ albums }),
  setArtists: (artists) => set({ artists }),

  setLibraryData: (data) =>
    set({
      songs: data.songs,
      albums: data.albums,
      artists: data.artists,
      lastScan: data.lastScan,
    }),

  setScanProgress: (progress) =>
    set((state) => ({
      scanProgress: { ...state.scanProgress, ...progress },
    })),

  setLoading: (isLoading) => set({ isLoading }),

  getSongById: (id) => get().songs.find((s) => s.id === id),
  getAlbumById: (id) => get().albums.find((a) => a.id === id),
  getArtistById: (id) => get().artists.find((a) => a.id === id),

  getAlbumSongs: (albumId) => {
    const album = get().albums.find((a) => a.id === albumId);
    if (!album) return [];
    const songMap = new Map(get().songs.map((s) => [s.id, s]));
    return album.songIds
      .map((id) => songMap.get(id))
      .filter((s): s is Song => s !== undefined)
      .sort((a, b) => a.disc - b.disc || a.track - b.track);
  },

  getArtistSongs: (artistId) => {
    const artist = get().artists.find((a) => a.id === artistId);
    if (!artist) return [];
    const songMap = new Map(get().songs.map((s) => [s.id, s]));
    return artist.songIds.map((id) => songMap.get(id)).filter((s): s is Song => s !== undefined);
  },

  getArtistAlbums: (artistId) => {
    const artist = get().artists.find((a) => a.id === artistId);
    if (!artist) return [];
    const albumMap = new Map(get().albums.map((a) => [a.id, a]));
    return artist.albumIds.map((id) => albumMap.get(id)).filter((a): a is Album => a !== undefined);
  },

  getRecentlyAdded: (limit = 20) => {
    return [...get().songs].sort((a, b) => b.addedAt - a.addedAt).slice(0, limit);
  },
}));
