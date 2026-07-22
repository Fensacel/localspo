import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, FolderOpen, Save, Settings } from 'lucide-react';
import { useDownloaderStore } from '../stores/useDownloaderStore';
import type { DownloaderSettings } from '../types';

interface DownloaderSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function DownloaderSettingsModal({ isOpen, onClose }: DownloaderSettingsModalProps) {
  const { settings, updateSettings } = useDownloaderStore();
  const [form, setForm] = useState<DownloaderSettings | null>(null);

  useEffect(() => {
    if (settings) {
      setForm({ ...settings });
    }
  }, [settings]);

  if (!isOpen || !form) return null;

  const handleSelectFolder = async () => {
    try {
      const folder = await window.electronAPI.dialog.openFolder();
      if (folder) {
        setForm((prev) => (prev ? { ...prev, downloadFolder: folder } : null));
      }
    } catch (err) {
      console.error('Folder dialog error:', err);
    }
  };

  const handleSave = async () => {
    if (form) {
      await updateSettings(form);
      onClose();
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="w-full max-w-lg glass-heavy rounded-2xl p-6 border border-white/10 shadow-2xl space-y-6"
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-white/5 pb-4">
            <div className="flex items-center gap-2.5">
              <Settings size={20} className="text-primary" />
              <h2 className="text-lg font-bold text-text">Downloader Settings</h2>
            </div>
            <button
              onClick={onClose}
              className="p-1 rounded-lg text-text/40 hover:text-text hover:bg-white/10 transition-colors"
            >
              <X size={18} />
            </button>
          </div>

          <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
            {/* Download Folder */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-text/60">Download Location</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={form.downloadFolder}
                  onChange={(e) => setForm({ ...form, downloadFolder: e.target.value })}
                  className="flex-1 px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-xs text-text focus:outline-none focus:ring-1 focus:ring-primary/40"
                />
                <button
                  type="button"
                  onClick={handleSelectFolder}
                  className="flex items-center gap-1.5 px-3 py-2 bg-white/10 hover:bg-white/15 rounded-xl text-xs font-medium text-text transition-colors"
                >
                  <FolderOpen size={14} />
                  <span>Browse</span>
                </button>
              </div>
            </div>

            {/* Audio Format & Bitrate */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-text/60">Audio Format</label>
                <select
                  value={form.audioFormat}
                  onChange={(e) =>
                    setForm({ ...form, audioFormat: e.target.value as DownloaderSettings['audioFormat'] })
                  }
                  className="w-full px-3 py-2 bg-zinc-900 border border-white/10 rounded-xl text-xs text-text focus:outline-none focus:ring-1 focus:ring-primary/40"
                >
                  <option value="mp3">MP3</option>
                  <option value="flac">FLAC (Lossless)</option>
                  <option value="m4a">M4A (AAC)</option>
                  <option value="wav">WAV</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-text/60">Audio Bitrate</label>
                <select
                  value={form.audioBitrate}
                  onChange={(e) =>
                    setForm({ ...form, audioBitrate: e.target.value as DownloaderSettings['audioBitrate'] })
                  }
                  className="w-full px-3 py-2 bg-zinc-900 border border-white/10 rounded-xl text-xs text-text focus:outline-none focus:ring-1 focus:ring-primary/40"
                >
                  <option value="320k">320 kbps (High Quality)</option>
                  <option value="256k">256 kbps</option>
                  <option value="192k">192 kbps</option>
                  <option value="128k">128 kbps</option>
                </select>
              </div>
            </div>

            {/* Toggles */}
            <div className="space-y-3 pt-2">
              <label className="flex items-center justify-between cursor-pointer">
                <div>
                  <p className="text-xs font-semibold text-text">Fetch Lyrics</p>
                  <p className="text-[11px] text-text/40">Query LRCLIB for synced & plain lyrics</p>
                </div>
                <input
                  type="checkbox"
                  checked={form.getLyrics}
                  onChange={(e) => setForm({ ...form, getLyrics: e.target.checked })}
                  className="accent-primary w-4 h-4 rounded cursor-pointer"
                />
              </label>

              <label className="flex items-center justify-between cursor-pointer">
                <div>
                  <p className="text-xs font-semibold text-text">Create .LRC File</p>
                  <p className="text-[11px] text-text/40">Save separate .lrc file alongside audio</p>
                </div>
                <input
                  type="checkbox"
                  checked={form.createLrcFile}
                  onChange={(e) => setForm({ ...form, createLrcFile: e.target.checked })}
                  className="accent-primary w-4 h-4 rounded cursor-pointer"
                />
              </label>

              <label className="flex items-center justify-between cursor-pointer">
                <div>
                  <p className="text-xs font-semibold text-text">Auto Import to LocalSpo</p>
                  <p className="text-[11px] text-text/40">Automatically index completed songs in library</p>
                </div>
                <input
                  type="checkbox"
                  checked={form.autoImport}
                  onChange={(e) => setForm({ ...form, autoImport: e.target.checked })}
                  className="accent-primary w-4 h-4 rounded cursor-pointer"
                />
              </label>
            </div>

            {/* Concurrent Downloads & Retry Count */}
            <div className="grid grid-cols-2 gap-4 pt-2 border-t border-white/5">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-text/60">Concurrent Downloads</label>
                <input
                  type="number"
                  min={1}
                  max={5}
                  value={form.concurrentDownloads}
                  onChange={(e) => setForm({ ...form, concurrentDownloads: parseInt(e.target.value) || 1 })}
                  className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-xs text-text focus:outline-none focus:ring-1 focus:ring-primary/40"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-text/60">Max Retries</label>
                <input
                  type="number"
                  min={0}
                  max={5}
                  value={form.retryCount}
                  onChange={(e) => setForm({ ...form, retryCount: parseInt(e.target.value) || 0 })}
                  className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-xs text-text focus:outline-none focus:ring-1 focus:ring-primary/40"
                />
              </div>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-white/5">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-medium text-text/60 hover:text-text hover:bg-white/5 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="flex items-center gap-1.5 px-5 py-2 bg-primary rounded-xl text-xs font-semibold text-zinc-950 shadow-glow hover:bg-primary-hover transition-colors"
            >
              <Save size={14} />
              <span>Save Settings</span>
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
