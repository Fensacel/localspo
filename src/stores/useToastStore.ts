import { create } from 'zustand';

interface Toast {
  id: string;
  message: string;
  type?: 'success' | 'info' | 'error';
  duration?: number;
}

interface ToastState {
  toasts: Toast[];
  showToast: (message: string, type?: 'success' | 'info' | 'error', duration?: number) => void;
  removeToast: (id: string) => void;
}

let activeTimeout: NodeJS.Timeout | null = null;

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  showToast: (message, type = 'success', duration = 2500) => {
    if (activeTimeout) {
      clearTimeout(activeTimeout);
      activeTimeout = null;
    }

    set((state) => {
      const existing = state.toasts[0];
      const id = existing ? existing.id : Math.random().toString(36).slice(2, 11);

      activeTimeout = setTimeout(() => {
        useToastStore.setState((s) => ({
          toasts: s.toasts.filter((t) => t.id !== id),
        }));
        activeTimeout = null;
      }, duration);

      return {
        toasts: [{ id, message, type, duration }],
      };
    });
  },
  removeToast: (id) => {
    if (activeTimeout) {
      clearTimeout(activeTimeout);
      activeTimeout = null;
    }
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    }));
  },
}));
