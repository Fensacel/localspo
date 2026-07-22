import { create } from 'zustand';
import { platform } from '@/platform';

interface NetworkState {
  isOnline: boolean;
  setOnline: (online: boolean) => void;
}

export const useNetworkStore = create<NetworkState>((set) => ({
  isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
  setOnline: (online: boolean) => set({ isOnline: online }),
}));

// Initialize network status listener
if (typeof window !== 'undefined') {
  const updateStatus = (online: boolean) => {
    useNetworkStore.getState().setOnline(online);
  };

  if (platform.network?.onStatusChange) {
    platform.network.onStatusChange(updateStatus);
  } else {
    window.addEventListener('online', () => updateStatus(true));
    window.addEventListener('offline', () => updateStatus(false));
  }
}
