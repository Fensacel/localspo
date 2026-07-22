import { useEffect } from 'react';
import { motion } from 'framer-motion';
import { History, CheckCircle2, AlertCircle, SkipForward, RefreshCw, Music } from 'lucide-react';
import { useSpotifyStore } from '../stores/useSpotifyStore';
import { useDownloaderStore } from '../stores/useDownloaderStore';
import type { DownloadHistoryItem } from '../types';

const STATUS_CONFIG = {
  completed: { icon: CheckCircle2, color: 'text-emerald-400', bg: 'bg-emerald-500/10', label: 'Downloaded' },
  failed: { icon: AlertCircle, color: 'text-rose-400', bg: 'bg-rose-500/10', label: 'Failed' },
  skipped: { icon: SkipForward, color: 'text-amber-400', bg: 'bg-amber-500/10', label: 'Skipped' },
} as const;

function formatDate(ts: number): string {
  const d = new Date(ts);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  if (diff < 60000) return 'just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return d.toLocaleDateString();
}

export function HistoryTab() {
  const { history, isLoadingHistory, loadHistory } = useSpotifyStore();
  const { downloadUrl } = useDownloaderStore();

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  const handleRetry = async (item: DownloadHistoryItem) => {
    await downloadUrl(item.spotifyId.startsWith('yt_')
      ? `https://youtube.com/watch?v=${item.spotifyId}`
      : `https://open.spotify.com/track/${item.spotifyId}`);
  };

  if (isLoadingHistory) {
    return (
      <div className="flex items-center justify-center h-48">
        <RefreshCw size={20} className="text-primary animate-spin" />
      </div>
    );
  }

  if (history.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <div className="w-14 h-14 rounded-2xl bg-white/5 border border-white/5 flex items-center justify-center">
          <History size={22} className="text-text/20" />
        </div>
        <p className="text-sm font-semibold text-text/40">No download history yet</p>
        <p className="text-xs text-text/25">Completed downloads will appear here</p>
      </div>
    );
  }

  const completedCount = history.filter((h) => h.status === 'completed').length;
  const failedCount = history.filter((h) => h.status === 'failed').length;

  return (
    <div className="space-y-5">
      {/* Summary */}
      <div className="flex items-center gap-4 text-xs text-text/50">
        <span className="flex items-center gap-1.5">
          <CheckCircle2 size={12} className="text-emerald-400" />
          <span className="text-emerald-400 font-semibold">{completedCount}</span> downloaded
        </span>
        {failedCount > 0 && (
          <span className="flex items-center gap-1.5">
            <AlertCircle size={12} className="text-rose-400" />
            <span className="text-rose-400 font-semibold">{failedCount}</span> failed
          </span>
        )}
        <span className="ml-auto">{history.length} total entries</span>
      </div>

      {/* History List */}
      <div className="space-y-2">
        {history.map((item, i) => {
          const cfg = STATUS_CONFIG[item.status];
          const Icon = cfg.icon;
          return (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(i * 0.02, 0.3) }}
              className="flex items-center gap-3 p-3 glass rounded-xl border border-white/5 group"
            >
              {/* Cover */}
              {item.coverUrl ? (
                <img src={item.coverUrl} alt="" referrerPolicy="no-referrer" className="w-9 h-9 rounded-lg object-cover shrink-0" />
              ) : (
                <div className="w-9 h-9 rounded-lg bg-white/5 flex items-center justify-center shrink-0">
                  <Music size={13} className="text-text/30" />
                </div>
              )}

              {/* Info */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-text truncate">{item.title}</p>
                <p className="text-xs text-text/50 truncate">{item.artist} · {item.album}</p>
              </div>

              {/* Status */}
              <div className="flex items-center gap-2 shrink-0">
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold ${cfg.bg} ${cfg.color}`}>
                  <Icon size={10} />
                  {cfg.label}
                </span>
                <span className="text-xs text-text/30">{formatDate(item.downloadedAt)}</span>

                {item.status === 'failed' && (
                  <button
                    onClick={() => handleRetry(item)}
                    className="p-1.5 rounded-lg text-primary hover:bg-primary/10 opacity-0 group-hover:opacity-100 transition-all"
                    title="Retry"
                  >
                    <RefreshCw size={12} />
                  </button>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
