import { create } from 'zustand';
import { usePlayerStore } from './usePlayerStore';
import { parseLyrics, findCurrentLyricIndex } from '@/services/lyricsParser';
import type { LyricsData } from '@/types';

export interface OBSOverlayConfig {
  enabled: boolean;
  port: number;
  lanAccess: boolean;
  theme: 'classic' | 'spotify' | 'minimal' | 'glass' | 'rgb' | 'neon' | 'transparent' | 'rounded' | 'dark' | 'light';
  fontFamily: string;
  fontSize: 'small' | 'medium' | 'large' | 'xlarge';
  textColor: string;
  accentColor: string;
  bgColor: string;
  bgOpacity: number;
  bgBlur: number;
  cornerRadius: number;
  artworkSize: number;
  artworkShape: 'square' | 'rounded' | 'circle';
  artworkSpin: boolean;
  artworkGlow: boolean;
  showArtwork: boolean;
  showProgressBar: boolean;
  showTime: boolean;
  showLyrics: boolean;
  showNextSong: boolean;
  marqueeText: boolean;
  animation: 'fade' | 'slide' | 'scale' | 'none';
}

export const DEFAULT_OBS_CONFIG: OBSOverlayConfig = {
  enabled: true,
  port: 4785,
  lanAccess: false,
  theme: 'spotify',
  fontFamily: 'Inter, system-ui, sans-serif',
  fontSize: 'medium',
  textColor: '#ffffff',
  accentColor: '#1db954',
  bgColor: '#121212',
  bgOpacity: 85,
  bgBlur: 16,
  cornerRadius: 16,
  artworkSize: 64,
  artworkShape: 'rounded',
  artworkSpin: false,
  artworkGlow: true,
  showArtwork: true,
  showProgressBar: true,
  showTime: true,
  showLyrics: true,
  showNextSong: true,
  marqueeText: true,
  animation: 'slide',
};

interface OBSStatus {
  running: boolean;
  port: number;
  lanAccess: boolean;
  localUrl: string;
  lanUrl: string | null;
}

interface OBSStoreState {
  status: OBSStatus;
  config: OBSOverlayConfig;
  isLoading: boolean;

  // Actions
  loadStatus: () => Promise<void>;
  toggleServer: () => Promise<void>;
  updateConfig: (newConfig: Partial<OBSOverlayConfig>) => Promise<void>;
  syncPlayerState: () => void;
}

let activeLyricsSongId: string | null = null;
let activeParsedLyrics: LyricsData | null = null;

async function fetchLyricsForSong(song: any) {
  if (!song || !window.electronAPI?.lyrics?.read) return;
  if (activeLyricsSongId === song.id) return;

  activeLyricsSongId = song.id;
  activeParsedLyrics = null;

  try {
    const res = await window.electronAPI.lyrics.read(
      song.id,
      song.path || '',
      song.lrcPath || null,
      !!song.hasEmbeddedLyrics,
      song.artist,
      song.title,
      song.album,
      song.duration
    );
    if (res && res.content) {
      activeParsedLyrics = parseLyrics(res.content, song.artist);
    }
  } catch (e) {
    activeParsedLyrics = null;
  }
}

export const useObsStore = create<OBSStoreState>((set, get) => ({
  status: {
    running: false,
    port: 4785,
    lanAccess: false,
    localUrl: 'http://127.0.0.1:4785',
    lanUrl: null,
  },
  config: { ...DEFAULT_OBS_CONFIG },
  isLoading: false,

  loadStatus: async () => {
    if (!window.electronAPI?.obs) return;
    set({ isLoading: true });
    try {
      const res = await window.electronAPI.obs.getStatus();
      if (res) {
        set({
          status: {
            running: res.running,
            port: res.port,
            lanAccess: res.lanAccess,
            localUrl: res.localUrl,
            lanUrl: res.lanUrl,
          },
          config: res.config || { ...DEFAULT_OBS_CONFIG },
        });
        get().syncPlayerState();
      }
    } catch (e) {
      console.error('Failed to load OBS status:', e);
    } finally {
      set({ isLoading: false });
    }
  },

  toggleServer: async () => {
    if (!window.electronAPI?.obs) return;
    const { running } = get().status;
    set({ isLoading: true });
    try {
      let res;
      if (running) {
        res = await window.electronAPI.obs.stopServer();
        get().updateConfig({ enabled: false });
      } else {
        res = await window.electronAPI.obs.startServer();
        get().updateConfig({ enabled: true });
      }
      if (res) {
        set({
          status: {
            running: res.running,
            port: res.port,
            lanAccess: res.lanAccess,
            localUrl: res.localUrl,
            lanUrl: res.lanUrl,
          },
        });
      }
    } catch (e) {
      console.error('Failed to toggle OBS server:', e);
    } finally {
      set({ isLoading: false });
    }
  },

  updateConfig: async (newConfig) => {
    if (!window.electronAPI?.obs) return;
    try {
      const res = await window.electronAPI.obs.updateConfig(newConfig);
      if (res) {
        set({
          status: {
            running: res.running,
            port: res.port,
            lanAccess: res.lanAccess,
            localUrl: res.localUrl,
            lanUrl: res.lanUrl,
          },
          config: res.config || { ...get().config, ...newConfig },
        });
      }
    } catch (e) {
      console.error('Failed updating OBS config:', e);
    }
  },

  syncPlayerState: () => {
    if (!window.electronAPI?.obs) return;

    const playerState = usePlayerStore.getState();
    const currentSong = playerState.currentSong;
    const queue = playerState.queue;
    const queueIndex = playerState.queueIndex;
    const nextSong = queue[queueIndex + 1] || null;

    if (currentSong && activeLyricsSongId !== currentSong.id) {
      fetchLyricsForSong(currentSong);
    }

    let currentLyric = '';
    let nextLyric = '';

    if (activeParsedLyrics && activeParsedLyrics.synced && activeParsedLyrics.lines.length > 0) {
      const idx = findCurrentLyricIndex(activeParsedLyrics.lines, playerState.currentTime);
      if (idx >= 0) {
        currentLyric = activeParsedLyrics.lines[idx].text;
        if (idx + 1 < activeParsedLyrics.lines.length) {
          nextLyric = activeParsedLyrics.lines[idx + 1].text;
        }
      }
    }

    const progress = playerState.duration > 0 ? playerState.currentTime / playerState.duration : 0;

    const payload = {
      title: currentSong?.title || 'No Song Playing',
      artist: currentSong?.artist || 'LocalSpo',
      album: currentSong?.album || '',
      currentTime: Math.floor(playerState.currentTime),
      duration: Math.floor(playerState.duration),
      progress: Math.min(1, Math.max(0, progress)),
      isPlaying: playerState.isPlaying,
      repeatMode: playerState.repeatMode,
      shuffleMode: playerState.shuffleMode,
      isStreaming: !!(currentSong?.ytVideoId || !currentSong?.path),
      sourceType: currentSong?.sourceType || 'offline',
      quality: 'High Quality',
      isFavorite: false,
      lyrics: activeParsedLyrics?.rawText || '',
      currentLyric,
      nextLyric,
      nextSong: nextSong ? { title: nextSong.title, artist: nextSong.artist } : null,
    };

    window.electronAPI.obs.updateState(
      payload,
      currentSong?.coverPath || null,
      currentSong?.remoteCoverUrl || null,
    );
  },
}));

// Subscribe to player store changes to push real-time updates to OBS
usePlayerStore.subscribe(() => {
  useObsStore.getState().syncPlayerState();
});
