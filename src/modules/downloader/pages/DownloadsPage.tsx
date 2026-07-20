import { useEffect, useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import { Download, Settings, Trash2, FolderOpen, ListCheck, Play, AlertCircle, CheckCircle2, Ban } from 'lucide-react';
import { useDownloaderStore } from '../stores/useDownloaderStore';
import { UrlInputCard } from '../components/UrlInputCard';
import { DownloadItemCard } from '../components/DownloadItemCard';
import { DownloaderSettingsModal } from '../components/DownloaderSettingsModal';

export function DownloadsPage() {
  const { queue, loadQueue, loadSettings, clearFinished, openDownloadFolder, cancelAll } = useDownloaderStore();
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  useEffect(() => {
    loadQueue();
    loadSettings();
  }, [loadQueue, loadSettings]);

  const activeCount = queue.filter((i) => i.status === 'downloading' || i.status === 'tagging').length;
  const queuedCount = queue.filter((i) => i.status === 'queued').length;
  const completedCount = queue.filter((i) => i.status === 'completed').length;
  const failedCount = queue.filter((i) => i.status === 'failed').length;

  return (
    <div className="space-y-8 pb-10">
      {/* Top Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2.5 text-text">
            <Download size={26} className="text-primary" />
            Spotify Downloader
          </h1>
          <p className="text-sm text-text/40 mt-1">
            Download tracks, albums, playlists, or episodes natively into your library
          </p>
        </div>

        <div className="flex items-center gap-3">
          {(activeCount > 0 || queuedCount > 0) && (
            <button
              onClick={cancelAll}
              className="flex items-center gap-2 px-4 py-2.5 bg-rose-500/15 border border-rose-500/20 hover:bg-rose-500/25 rounded-xl text-xs font-bold text-rose-400 transition-all shadow-sm"
            >
              <Ban size={16} />
              <span>Cancel All</span>
            </button>
          )}

          <button
            onClick={openDownloadFolder}
            className="flex items-center gap-2 px-4 py-2.5 glass rounded-xl text-xs font-semibold text-text/80 hover:text-text hover:bg-white/10 transition-colors"
          >
            <FolderOpen size={16} />
            <span>Open Folder</span>
          </button>

          <button
            onClick={() => setIsSettingsOpen(true)}
            className="flex items-center gap-2 px-4 py-2.5 glass rounded-xl text-xs font-semibold text-text/80 hover:text-text hover:bg-white/10 transition-colors"
          >
            <Settings size={16} />
            <span>Settings</span>
          </button>

          {(completedCount > 0 || queue.some((i) => i.status === 'cancelled')) && (
            <button
              onClick={clearFinished}
              className="flex items-center gap-2 px-4 py-2.5 bg-white/5 hover:bg-white/10 rounded-xl text-xs font-semibold text-text/60 hover:text-text transition-colors"
            >
              <Trash2 size={16} />
              <span>Clear Finished</span>
            </button>
          )}
        </div>
      </div>

      {/* URL Input Form */}
      <UrlInputCard />

      {/* Stats Summary Bar */}
      {queue.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="glass rounded-xl p-4 border border-white/5 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-amber-500/10 text-amber-400 flex items-center justify-center">
              <ListCheck size={18} />
            </div>
            <div>
              <p className="text-xs text-text/40">In Queue</p>
              <p className="text-lg font-bold text-text">{queuedCount}</p>
            </div>
          </div>

          <div className="glass rounded-xl p-4 border border-white/5 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
              <Play size={18} />
            </div>
            <div>
              <p className="text-xs text-text/40">Active</p>
              <p className="text-lg font-bold text-text">{activeCount}</p>
            </div>
          </div>

          <div className="glass rounded-xl p-4 border border-white/5 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
              <CheckCircle2 size={18} />
            </div>
            <div>
              <p className="text-xs text-text/40">Completed</p>
              <p className="text-lg font-bold text-text">{completedCount}</p>
            </div>
          </div>

          <div className="glass rounded-xl p-4 border border-white/5 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-rose-500/10 text-rose-400 flex items-center justify-center">
              <AlertCircle size={18} />
            </div>
            <div>
              <p className="text-xs text-text/40">Failed</p>
              <p className="text-lg font-bold text-text">{failedCount}</p>
            </div>
          </div>
        </div>
      )}

      {/* Queue List */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-text/50 uppercase tracking-wider">
          Download Queue ({queue.length})
        </h2>

        {queue.length > 0 ? (
          <div className="space-y-3">
            <AnimatePresence>
              {queue.map((item) => (
                <DownloadItemCard key={item.id} item={item} />
              ))}
            </AnimatePresence>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-48 glass rounded-2xl border border-white/5">
            <Download size={36} className="text-text/15 mb-3" />
            <p className="text-sm text-text/40">No active or past downloads in queue</p>
            <p className="text-xs text-text/25 mt-1">Paste a Spotify link above to start downloading</p>
          </div>
        )}
      </div>

      {/* Downloader Settings Modal */}
      <DownloaderSettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
    </div>
  );
}
