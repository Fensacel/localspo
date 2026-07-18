import { create } from 'zustand';
import type { Settings } from '@/types';

interface SettingsState extends Settings {
  isLoaded: boolean;
  loadSettings: () => Promise<void>;
  updateSettings: (partial: Partial<Settings>) => Promise<void>;
  addMusicFolder: (folder: string) => Promise<void>;
  removeMusicFolder: (folder: string) => Promise<void>;
}

const defaultSettings: Settings = {
  musicFolders: [],
  theme: 'blue-neon',
  accentColor: '#3B82F6',
  gapless: true,
  crossfade: false,
  crossfadeDuration: 3,
  visualizer: 'spectrum',
  lyricsEnabled: true,
  equalizerPreset: 'flat',
  equalizerBands: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  volume: 0.8,
  playbackSpeed: 1,
};

export const useSettingsStore = create<SettingsState>((set, get) => ({
  ...defaultSettings,
  isLoaded: false,

  loadSettings: async () => {
    try {
      const data = (await window.electronAPI.data.read('settings.json')) as Settings | null;
      if (data) {
        set({ ...defaultSettings, ...data, isLoaded: true });
      } else {
        set({ ...defaultSettings, isLoaded: true });
      }
    } catch {
      set({ ...defaultSettings, isLoaded: true });
    }
  },

  updateSettings: async (partial) => {
    const current = get();
    const updated = { ...current, ...partial };
    set(partial);
    await window.electronAPI.data.write('settings.json', {
      musicFolders: updated.musicFolders,
      theme: updated.theme,
      accentColor: updated.accentColor,
      gapless: updated.gapless,
      crossfade: updated.crossfade,
      crossfadeDuration: updated.crossfadeDuration,
      visualizer: updated.visualizer,
      lyricsEnabled: updated.lyricsEnabled,
      equalizerPreset: updated.equalizerPreset,
      equalizerBands: updated.equalizerBands,
      volume: updated.volume,
      playbackSpeed: updated.playbackSpeed,
    });
  },

  addMusicFolder: async (folder) => {
    const { musicFolders, updateSettings } = get();
    if (!musicFolders.includes(folder)) {
      await updateSettings({ musicFolders: [...musicFolders, folder] });
    }
  },

  removeMusicFolder: async (folder) => {
    const { musicFolders, updateSettings } = get();
    await updateSettings({
      musicFolders: musicFolders.filter((f) => f !== folder),
    });
  },
}));
