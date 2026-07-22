import { electronPlatform } from './electronPlatform';
import { capacitorPlatform } from './capacitorPlatform';
import type { PlatformAPI } from './types';

// Detect if running inside Electron or Capacitor / Android
const isElectronEnv =
  typeof window !== 'undefined' &&
  window.electronAPI !== undefined &&
  Boolean(window.electronAPI.scanner);

export const platformService: PlatformAPI = isElectronEnv
  ? electronPlatform
  : capacitorPlatform;

export const platform = platformService;

// Attach window.platform globally for direct access
if (typeof window !== 'undefined') {
  (window as any).platform = platformService;
}

export * from './types';
