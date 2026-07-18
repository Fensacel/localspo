import type { ElectronAPI } from '../electron/preload';

declare global {
  interface Window {
    electronAPI: ElectronAPI;
    __bluetune_analyser?: AnalyserNode;
    __bluetune_audioContext?: AudioContext;
  }
}

export {};
