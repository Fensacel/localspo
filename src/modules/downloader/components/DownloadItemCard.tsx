import { motion } from 'framer-motion';
import { DownloadItem } from '../types';
import { useDownloaderStore } from '../stores/useDownloaderStore';
import { getImageUrl } from '@/utils';
import { Music, RefreshCw, X, Trash2, CheckCircle2, AlertCircle, Clock, FolderOpen } from 'lucide-react';

interface DownloadItemCardProps {
  item: DownloadItem;
}

export function DownloadItemCard({ item }: DownloadItemCardProps) {
  const { cancelDownload, retryDownload, removeDownload, openDownloadFolder } = useDownloaderStore();

  const getStatusBadge = () => {
    switch (item.status) {
      case 'queued':
        return (
          <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-500/15 text-amber-400 border border-amber-500/20">
            <Clock size={12} />
            <span>Queued</span>
          </span>
        );
      case 'downloading':
        return (
          <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-primary/15 text-primary border border-primary/20">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
            >
              <RefreshCw size={12} />
            </motion.div>
            <span>Downloading</span>
          </span>
        );
      case 'tagging':
        return (
          <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-purple-500/15 text-purple-400 border border-purple-500/20">
            <RefreshCw size={12} className="animate-spin" />
            <span>Embedding Metadata</span>
          </span>
        );
      case 'completed':
        return (
          <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-500/15 text-emerald-400 border border-emerald-500/20">
            <CheckCircle2 size={12} />
            <span>Completed</span>
          </span>
        );
      case 'failed':
        return (
          <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-rose-500/15 text-rose-400 border border-rose-500/20">
            <AlertCircle size={12} />
            <span>Failed</span>
          </span>
        );
      case 'cancelled':
        return (
          <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-zinc-500/15 text-zinc-400 border border-zinc-500/20">
            <X size={12} />
            <span>Cancelled</span>
          </span>
        );
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="glass rounded-xl p-4 border border-white/5 hover:border-white/10 transition-all space-y-3"
    >
      <div className="flex items-center justify-between gap-4">
        {/* Track Details */}
        <div className="flex items-center gap-3.5 min-w-0 flex-1">
          <div className="w-12 h-12 rounded-lg overflow-hidden shrink-0 glass flex items-center justify-center relative shadow-md">
            {item.coverUrl ? (
              <img
                src={getImageUrl(item.coverUrl)}
                alt=""
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover"
              />
            ) : (
              <Music size={20} className="text-text/30" />
            )}
          </div>

          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold truncate text-text">{item.title}</p>
            <p className="text-xs text-text/40 truncate">
              {item.artist} • {item.album}
            </p>
          </div>
        </div>

        {/* Status Badge & Actions */}
        <div className="flex items-center gap-3 shrink-0">
          {getStatusBadge()}

          <div className="flex items-center gap-1">
            {item.status === 'completed' && (
              <button
                onClick={openDownloadFolder}
                title="Open Folder"
                className="p-2 rounded-lg hover:bg-white/10 text-text/60 hover:text-text transition-colors"
              >
                <FolderOpen size={16} />
              </button>
            )}

            {(item.status === 'failed' || item.status === 'cancelled') && (
              <button
                onClick={() => retryDownload(item.id)}
                title="Retry Download"
                className="p-2 rounded-lg hover:bg-primary/20 text-primary transition-colors"
              >
                <RefreshCw size={16} />
              </button>
            )}

            {(item.status === 'downloading' || item.status === 'queued') && (
              <button
                onClick={() => cancelDownload(item.id)}
                title="Cancel Download"
                className="p-2 rounded-lg hover:bg-rose-500/20 text-rose-400 transition-colors"
              >
                <X size={16} />
              </button>
            )}

            <button
              onClick={() => removeDownload(item.id)}
              title="Remove from list"
              className="p-2 rounded-lg hover:bg-white/10 text-text/40 hover:text-rose-400 transition-colors"
            >
              <Trash2 size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* Progress bar and metrics */}
      {(item.status === 'downloading' || item.status === 'tagging') && (
        <div className="space-y-1 pt-1">
          <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-primary rounded-full shadow-glow"
              initial={{ width: 0 }}
              animate={{ width: `${item.progress}%` }}
              transition={{ duration: 0.3 }}
            />
          </div>
          <div className="flex items-center justify-between text-[11px] text-text/40 font-mono">
            <span>{item.progress}%</span>
            <div className="flex gap-3">
              {item.speed && <span>Speed: {item.speed}</span>}
              {item.eta && <span>ETA: {item.eta}</span>}
            </div>
          </div>
        </div>
      )}

      {/* Error Message */}
      {item.status === 'failed' && item.errorMessage && (
        <p className="text-xs text-rose-400/80 bg-rose-500/10 px-3 py-1.5 rounded-lg">
          {item.errorMessage}
        </p>
      )}
    </motion.div>
  );
}
