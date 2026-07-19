import { useToastStore } from '@/stores';
import { motion, AnimatePresence } from 'framer-motion';
import { Info, CheckCircle2, AlertCircle } from 'lucide-react';

export function ToastContainer() {
  const toasts = useToastStore((s) => s.toasts);

  return (
    <div className="fixed bottom-28 left-1/2 -translate-x-1/2 flex flex-col gap-2 z-50 pointer-events-none">
      <AnimatePresence>
        {toasts.map((toast) => {
          const Icon = toast.type === 'error' 
            ? AlertCircle 
            : toast.type === 'info'
            ? Info
            : CheckCircle2;

          const colorClass = toast.type === 'error'
            ? 'text-red-500'
            : toast.type === 'info'
            ? 'text-zinc-400'
            : 'text-green-500';

          return (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, y: 24, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -12, scale: 0.9 }}
              transition={{ type: 'spring', stiffness: 350, damping: 25 }}
              className="flex items-center gap-2.5 px-5 py-3 rounded-full bg-zinc-900 border border-white/10 text-text shadow-2xl backdrop-blur-md pointer-events-auto select-none min-w-[240px] justify-center"
            >
              <Icon size={14} className={`${colorClass} shrink-0`} />
              <span className="text-xs font-semibold tracking-wide">{toast.message}</span>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
