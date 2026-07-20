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
  updateSongTags: (
    songId: string,
    payload: {
      path: string;
      title: string;
      artist: string;
      album: string;
      albumArtist?: string;
      year?: number;
      genre?: string;
      coverPath?: string | null;
      lyrics?: string | null;
      composer?: string;
      conductor?: string;
      copyright?: string;
      publisher?: string;
      isrc?: string;
      encodedBy?: string;
      grouping?: string;
      subtitle?: string;
      comment?: string;
      bpm?: number;
      key?: string;
      originalArtist?: string;
      remixer?: string;
    },
  ) => Promise<boolean>;
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

  updateSongTags: async (songId, payload) => {
    if (window.electronAPI?.scanner?.updateTags) {
      try {
        const res: any = await window.electronAPI.scanner.updateTags({
          songId,
          filePath: payload.path,
          title: payload.title,
          artist: payload.artist,
          album: payload.album,
          albumArtist: payload.albumArtist,
          year: payload.year,
          genre: payload.genre,
          coverPath: payload.coverPath,
          lyrics: payload.lyrics,
        });

        if (res?.success) {
          const freshData: any = res.library || (await window.electronAPI.scanner.getLibrary());
          if (freshData) {
            get().setLibraryData(freshData);
          }

          // Sync current playing song if edited
          const { usePlayerStore } = await import('./usePlayerStore');
          const playerState = usePlayerStore.getState();
          if (
            playerState.currentSong &&
            (playerState.currentSong.id === songId || playerState.currentSong.path === payload.path)
          ) {
            const updated = res.updatedSong || get().songs.find((s) => s.path === payload.path);
            if (updated) {
              playerState.setCurrentSong({ ...playerState.currentSong, ...updated });
            }
          }

          return true;
        }
      } catch (err) {
        console.error('Failed to update song tags:', err);
      }
    }
    return false;
  },
}));
