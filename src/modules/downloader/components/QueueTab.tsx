import { AnimatePresence } from 'framer-motion';
import { Download, Trash2, FolderOpen, Ban, ListCheck, Play, AlertCircle, CheckCircle2 } from 'lucide-react';
import { useDownloaderStore } from '../stores/useDownloaderStore';
import { UrlInputCard } from './UrlInputCard';
import { DownloadItemCard } from './DownloadItemCard';


export function QueueTab() {
  const { queue, clearFinished, openDownloadFolder, cancelAll } = useDownloaderStore();

  const activeCount = queue.filter((i) => i.status === 'downloading' || i.status === 'tagging').length;
  const queuedCount = queue.filter((i) => i.status === 'queued').length;
  const completedCount = queue.filter((i) => i.status === 'completed').length;
  const failedCount = queue.filter((i) => i.status === 'failed').length;

  return (
    <div className="space-y-6">
      {/* Actions */}
      <div className="flex items-center gap-2 flex-wrap">
        {(activeCount > 0 || queuedCount > 0) && (
          <button
            onClick={cancelAll}
            className="flex items-center gap-2 px-3 py-2 bg-rose-500/15 border border-rose-500/20 hover:bg-rose-500/25 rounded-xl text-xs font-bold text-rose-400 transition-all"
          >
            <Ban size={14} />
            Cancel All
          </button>
        )}
        <button
          onClick={openDownloadFolder}
          className="flex items-center gap-2 px-3 py-2 glass rounded-xl text-xs font-semibold text-text/80 hover:text-text hover:bg-white/10 transition-colors"
        >
          <FolderOpen size={14} />
          Open Folder
        </button>
        {(completedCount > 0 || queue.some((i) => i.status === 'cancelled')) && (
          <button
            onClick={clearFinished}
            className="flex items-center gap-2 px-3 py-2 bg-white/5 hover:bg-white/10 rounded-xl text-xs font-semibold text-text/60 hover:text-text transition-colors"
          >
            <Trash2 size={14} />
            Clear Finished
          </button>
        )}
      </div>

      {/* URL Input */}
      <UrlInputCard />

      {/* Stats */}
      {queue.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard icon={ListCheck} iconClass="bg-amber-500/10 text-amber-400" label="In Queue" value={queuedCount} />
          <StatCard icon={Play} iconClass="bg-primary/10 text-primary" label="Active" value={activeCount} />
          <StatCard icon={CheckCircle2} iconClass="bg-emerald-500/10 text-emerald-400" label="Completed" value={completedCount} />
          <StatCard icon={AlertCircle} iconClass="bg-rose-500/10 text-rose-400" label="Failed" value={failedCount} />
        </div>
      )}

      {/* Queue List */}
      <div className="space-y-2">
        {queue.length > 0 ? (
          <AnimatePresence>
            {queue.map((item) => (
              <DownloadItemCard key={item.id} item={item} />
            ))}
          </AnimatePresence>
        ) : (
          <div className="flex flex-col items-center justify-center h-48 glass rounded-2xl border border-white/5">
            <Download size={36} className="text-text/15 mb-3" />
            <p className="text-sm text-text/40">No downloads in queue</p>
            <p className="text-xs text-text/25 mt-1">Paste a Spotify link above or search to download</p>
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({
  icon: Icon,
  iconClass,
  label,
  value,
}: {
  icon: React.ElementType;
  iconClass: string;
  label: string;
  value: number;
}) {
  return (
    <div className="glass rounded-xl p-4 border border-white/5 flex items-center gap-3">
      <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${iconClass}`}>
        <Icon size={16} />
      </div>
      <div>
        <p className="text-xs text-text/40">{label}</p>
        <p className="text-lg font-bold text-text">{value}</p>
      </div>
    </div>
  );
}
