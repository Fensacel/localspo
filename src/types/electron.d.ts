import type { ElectronAPI } from '../electron/preload';
import type { PlatformAPI } from '../platform/types';

declare global {
  interface Window {
    electronAPI: ElectronAPI;
    platform: PlatformAPI;
    __bluetune_analyser?: AnalyserNode;
    __bluetune_audioContext?: AudioContext;
  }
}

export {};
