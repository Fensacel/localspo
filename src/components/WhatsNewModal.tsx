import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, Check, PartyPopper, X, Music2, ShieldCheck, Zap } from 'lucide-react';

// Current app release version
const CURRENT_VERSION = '2.0.1';

export function WhatsNewModal() {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    try {
      const lastSeen = localStorage.getItem('localspo_last_seen_version');
      if (lastSeen !== CURRENT_VERSION) {
        // Show what's new modal on first launch of this version
        setIsOpen(true);
      }
    } catch {}
  }, []);

  const handleClose = () => {
    try {
      localStorage.setItem('localspo_last_seen_version', CURRENT_VERSION);
    } catch {}
    setIsOpen(false);
  };

  useEffect(() => {
    const handleOpenManual = () => setIsOpen(true);
    window.addEventListener('app:showWhatsNew', handleOpenManual);
    return () => window.removeEventListener('app:showWhatsNew', handleOpenManual);
  }, []);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          transition={{ duration: 0.25, ease: 'easeOut' }}
          className="relative w-full max-w-lg glass-heavy border border-white/10 rounded-2xl p-6 shadow-2xl backdrop-blur-2xl text-text overflow-hidden"
        >
          {/* Top Decorative Glow */}
          <div className="absolute -top-16 -right-16 w-40 h-40 bg-sky-500/20 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-16 -left-16 w-40 h-40 bg-primary/20 rounded-full blur-3xl pointer-events-none" />

          {/* Close button */}
          <button
            onClick={handleClose}
            className="absolute top-4 right-4 p-1.5 rounded-xl text-text/40 hover:text-text hover:bg-white/10 transition-colors"
          >
            <X size={18} />
          </button>

          {/* Header Icon */}
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-2xl bg-sky-500/20 border border-sky-500/30 flex items-center justify-center text-sky-400 shrink-0">
              <PartyPopper size={24} />
            </div>
            <div>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-sky-500/15 border border-sky-500/30 text-sky-400 tracking-wide">
                <Sparkles size={11} />
                WHAT'S NEW
              </span>
              <h2 className="text-xl font-extrabold text-white tracking-tight mt-0.5">
                LocalSpo v{CURRENT_VERSION}
              </h2>
            </div>
          </div>

          <p className="text-xs text-text/60 mb-5 leading-relaxed">
            Selamat datang di versi terbaru LocalSpo! Berikut adalah sorotan perbaikan dan fitur baru pada rilis ini:
          </p>

          {/* Feature Highlights List */}
          <div className="space-y-3 mb-6 max-h-[260px] overflow-y-auto pr-1 custom-scrollbar">
            <div className="flex items-start gap-3 p-3 rounded-xl bg-white/[0.03] border border-white/5">
              <div className="p-2 rounded-lg bg-emerald-500/15 text-emerald-400 shrink-0 mt-0.5">
                <Music2 size={16} />
              </div>
              <div>
                <h4 className="text-xs font-bold text-white">Fix Online Streaming Playback</h4>
                <p className="text-[11px] text-text/50 mt-0.5 leading-snug">
                  Putar lagu streaming hasil pencarian secara instan! Klik baris lagu atau tombol Play untuk langsung mendengarkan musik favorit tanpa hambatan.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-3 rounded-xl bg-white/[0.03] border border-white/5">
              <div className="p-2 rounded-lg bg-sky-500/15 text-sky-400 shrink-0 mt-0.5">
                <Zap size={16} />
              </div>
              <div>
                <h4 className="text-xs font-bold text-white">Faster YouTube Stream Resolution</h4>
                <p className="text-[11px] text-text/50 mt-0.5 leading-snug">
                  Peningkatan pencarian audio otomatis untuk lagu-lagu tanpa ID video bawaan agar diputar secara mulus.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-3 rounded-xl bg-white/[0.03] border border-white/5">
              <div className="p-2 rounded-lg bg-amber-500/15 text-amber-400 shrink-0 mt-0.5">
                <ShieldCheck size={16} />
              </div>
              <div>
                <h4 className="text-xs font-bold text-white">Optimized Desktop Audio Engine</h4>
                <p className="text-[11px] text-text/50 mt-0.5 leading-snug">
                  Stabilitas mesin pemutar musik lokal & streaming pada Windows Desktop ditingkatkan secara signifikan.
                </p>
              </div>
            </div>
          </div>

          {/* Action Button */}
          <button
            onClick={handleClose}
            className="w-full py-3 px-4 bg-sky-500 hover:bg-sky-400 text-zinc-950 font-extrabold text-xs rounded-xl transition-all shadow-glow flex items-center justify-center gap-2 cursor-pointer"
          >
            <Check size={16} />
            <span>Mulai Mendengarkan</span>
          </button>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
