import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  Music,
  Info,
  HardDrive,
  Radio,
  Copy,
  Check,
  Disc,
  Sparkles,
} from 'lucide-react';
import { getImageUrl, formatTime, formatFileSize, formatBitrate, formatSampleRate, formatBitDepth, isLossless } from '@/utils';
import { useToastStore } from '@/stores';
import type { Song } from '@/types';

interface SongDetailsModalProps {
  song: Song | null;
  isOpen: boolean;
  onClose: () => void;
}

export function SongDetailsModal({ song, isOpen, onClose }: SongDetailsModalProps) {
  const { showToast } = useToastStore();
  const [copiedPath, setCopiedPath] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !song) return null;

  const handleCopyPath = () => {
    navigator.clipboard.writeText(song.path);
    setCopiedPath(true);
    showToast('File path copied to clipboard', 'info');
    setTimeout(() => setCopiedPath(false), 2000);
  };

  const lossless = isLossless(song.codec || '');
  const codecName = (song.codec || 'Audio').toUpperCase();

  return createPortal(
    <AnimatePresence>
      <div
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md"
      >
        <motion.div
          onClick={(e) => e.stopPropagation()}
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          className="w-full max-w-xl glass-panel rounded-2xl border border-white/10 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-white/5">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-primary/20 flex items-center justify-center text-primary border border-primary/20">
                <Info size={18} />
              </div>
              <div>
                <h2 className="text-base font-bold text-text">Track & File Properties</h2>
                <p className="text-xs text-text/50 truncate max-w-xs">{song.title}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onClose();
              }}
              className="p-2 text-text/40 hover:text-text hover:bg-white/10 rounded-xl transition-colors"
            >
              <X size={18} />
            </button>
          </div>

          {/* Modal Content */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6 text-xs">
            {/* Top Overview Section */}
            <div className="flex items-center gap-5 p-4 rounded-2xl glass border border-white/5 bg-white/[0.02]">
              <div className="w-24 h-24 rounded-xl overflow-hidden shrink-0 glass border border-white/10 relative shadow-lg">
                {song.coverPath ? (
                  <img
                    src={getImageUrl(song.coverPath)}
                    alt={song.title}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-zinc-900 text-text/30">
                    <Music size={32} />
                  </div>
                )}
              </div>

              <div className="space-y-1.5 min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-0.5 rounded-md font-bold text-[10px] uppercase tracking-wider ${
                    lossless
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                      : 'bg-primary/20 text-primary border border-primary/30'
                  }`}>
                    {codecName}
                  </span>
                  {lossless && (
                    <span className="flex items-center gap-1 text-[10px] font-semibold text-emerald-400">
                      <Sparkles size={11} /> Hi-Res Lossless
                    </span>
                  )}
                </div>
                <h3 className="text-base font-bold text-text truncate">{song.title}</h3>
                <p className="text-xs text-text/60 truncate font-medium">{song.artist}</p>
                <p className="text-xs text-text/40 truncate">{song.album || 'Unknown Album'}</p>
              </div>
            </div>

            {/* Audio Specifications Grid */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold text-text/70 uppercase tracking-wider flex items-center gap-2">
                <Radio size={14} className="text-primary" />
                <span>Audio Technical Specs</span>
              </h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="p-3 rounded-xl bg-white/5 border border-white/5 space-y-1">
                  <span className="text-[10px] text-text/40 uppercase font-semibold">Format</span>
                  <p className="font-mono text-sm font-bold text-text">{codecName}</p>
                </div>

                <div className="p-3 rounded-xl bg-white/5 border border-white/5 space-y-1">
                  <span className="text-[10px] text-text/40 uppercase font-semibold">Bitrate</span>
                  <p className="font-mono text-sm font-bold text-text">
                    {song.bitrate ? formatBitrate(song.bitrate) : 'N/A'}
                  </p>
                </div>

                <div className="p-3 rounded-xl bg-white/5 border border-white/5 space-y-1">
                  <span className="text-[10px] text-text/40 uppercase font-semibold">Sample Rate</span>
                  <p className="font-mono text-sm font-bold text-text">
                    {song.sampleRate ? formatSampleRate(song.sampleRate) : 'N/A'}
                  </p>
                </div>

                <div className="p-3 rounded-xl bg-white/5 border border-white/5 space-y-1">
                  <span className="text-[10px] text-text/40 uppercase font-semibold">Bit Depth</span>
                  <p className="font-mono text-sm font-bold text-text">
                    {song.bitDepth ? formatBitDepth(song.bitDepth) : '16-bit'}
                  </p>
                </div>
              </div>
            </div>

            {/* Metadata Information Grid */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold text-text/70 uppercase tracking-wider flex items-center gap-2">
                <Disc size={14} className="text-primary" />
                <span>Track Metadata</span>
              </h4>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                <div className="p-3 rounded-xl bg-white/5 border border-white/5 space-y-1">
                  <span className="text-[10px] text-text/40 uppercase font-semibold">Duration</span>
                  <p className="font-mono text-xs font-semibold text-text">{formatTime(song.duration)}</p>
                </div>

                <div className="p-3 rounded-xl bg-white/5 border border-white/5 space-y-1">
                  <span className="text-[10px] text-text/40 uppercase font-semibold">File Size</span>
                  <p className="font-mono text-xs font-semibold text-text">
                    {song.fileSize ? formatFileSize(song.fileSize) : 'N/A'}
                  </p>
                </div>

                <div className="p-3 rounded-xl bg-white/5 border border-white/5 space-y-1">
                  <span className="text-[10px] text-text/40 uppercase font-semibold">Year</span>
                  <p className="font-mono text-xs font-semibold text-text">{song.year || 'N/A'}</p>
                </div>

                <div className="p-3 rounded-xl bg-white/5 border border-white/5 space-y-1">
                  <span className="text-[10px] text-text/40 uppercase font-semibold">Genre</span>
                  <p className="font-mono text-xs font-semibold text-text truncate">{song.genre || 'N/A'}</p>
                </div>

                <div className="p-3 rounded-xl bg-white/5 border border-white/5 space-y-1">
                  <span className="text-[10px] text-text/40 uppercase font-semibold">Channels</span>
                  <p className="font-mono text-xs font-semibold text-text">
                    {song.channels === 1 ? 'Mono (1 ch)' : 'Stereo (2 ch)'}
                  </p>
                </div>

                <div className="p-3 rounded-xl bg-white/5 border border-white/5 space-y-1">
                  <span className="text-[10px] text-text/40 uppercase font-semibold">Lyrics Status</span>
                  <p className="font-mono text-xs font-semibold text-text flex items-center gap-1">
                    {song.hasEmbeddedLyrics || song.lrcPath ? (
                      <span className="text-emerald-400 font-semibold">Available</span>
                    ) : (
                      <span className="text-text/40">None</span>
                    )}
                  </p>
                </div>
              </div>
            </div>

            {/* File Path Section */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold text-text/70 uppercase tracking-wider flex items-center gap-2">
                <HardDrive size={14} className="text-primary" />
                <span>File Location</span>
              </h4>
              <div className="p-3.5 rounded-xl bg-white/5 border border-white/5 space-y-2.5">
                <p className="font-mono text-[11px] text-text/70 break-all select-all leading-relaxed">
                  {song.path}
                </p>
                <div className="flex items-center justify-end gap-2 pt-1 border-t border-white/5">
                  <button
                    type="button"
                    onClick={handleCopyPath}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/15 text-text font-semibold transition-colors text-xs"
                  >
                    {copiedPath ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                    <span>{copiedPath ? 'Copied!' : 'Copy Path'}</span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end px-6 py-3 border-t border-white/10 bg-white/5">
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onClose();
              }}
              className="px-5 py-2 rounded-xl bg-primary text-zinc-950 font-bold shadow-glow hover:bg-primary/90 transition-all text-xs"
            >
              Close
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>,
    document.body
  );
}
