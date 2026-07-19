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

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  showToast: (message, type = 'success', duration = 2500) => {
    const id = Math.random().toString(36).slice(2, 11);
    set((state) => ({
      toasts: [...state.toasts, { id, message, type, duration }],
    }));
    setTimeout(() => {
      set((state) => ({
        toasts: state.toasts.filter((t) => t.id !== id),
      }));
    }, duration);
  },
  removeToast: (id) => {
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    }));
  },
}));
