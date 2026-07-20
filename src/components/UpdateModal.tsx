import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, RefreshCw, X, CheckCircle2, Download } from 'lucide-react';

interface UpdateData {
  status: 'checking' | 'available' | 'not-available' | 'downloading' | 'downloaded' | 'error';
  version?: string;
  percent?: number;
  error?: string;
}

export function UpdateModal() {
  const [updateInfo, setUpdateInfo] = useState<UpdateData | null>(null);
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [dismissedVersion, setDismissedVersion] = useState<string | null>(null);

  useEffect(() => {
    if (!window.electronAPI?.updater?.onStatus) return;

    const cleanup = window.electronAPI.updater.onStatus((data: UpdateData) => {
      console.log('[AutoUpdater] Received status:', data);
      
      if (data.status === 'available' || data.status === 'downloading' || data.status === 'downloaded') {
        setUpdateInfo(data);
        if (data.version && data.version !== dismissedVersion) {
          setIsOpen(true);
        }
      }
    });

    return () => cleanup();
  }, [dismissedVersion]);

  useEffect(() => {
    const handleTestEvent = (e: Event) => {
      const customEvent = e as CustomEvent;
      setUpdateInfo(customEvent.detail || { status: 'downloaded', version: '1.0.5' });
      setIsOpen(true);
    };

    window.addEventListener('test:showUpdateModal', handleTestEvent);
    return () => window.removeEventListener('test:showUpdateModal', handleTestEvent);
  }, []);

  const handleDismiss = () => {
    if (updateInfo?.version) {
      setDismissedVersion(updateInfo.version);
    }
    setIsOpen(false);
  };

  if (!isOpen || !updateInfo) return null;

  const isDownloaded = updateInfo.status === 'downloaded';
  const isDownloading = updateInfo.status === 'downloading' || updateInfo.status === 'available';

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
          className="relative w-full max-w-md glass-heavy border border-white/10 rounded-2xl p-6 shadow-2xl backdrop-blur-2xl text-text"
        >
          {/* Close button */}
          <button
            onClick={handleDismiss}
            className="absolute top-4 right-4 p-1 rounded-lg text-text/40 hover:text-text hover:bg-white/5 transition-colors"
          >
            <X size={18} />
          </button>

          {/* Header Icon */}
          <div className="w-12 h-12 rounded-xl bg-primary/20 flex items-center justify-center text-primary mb-4 border border-primary/20">
            {isDownloaded ? <CheckCircle2 size={24} /> : <Sparkles size={24} />}
          </div>

          {/* Title & Version */}
          <h2 className="text-xl font-bold text-text tracking-tight">
            {isDownloaded ? 'Update Ready to Install' : 'New Update Available!'}
          </h2>

          <p className="text-xs text-text/60 mt-1.5 leading-relaxed">
            {isDownloaded
              ? `LocalSpo v${updateInfo.version || ''} has been downloaded. Restart the application now to complete installation.`
              : `LocalSpo v${updateInfo.version || ''} is available and currently downloading in the background.`}
          </p>

          {/* Progress bar if downloading */}
          {isDownloading && (
            <div className="mt-5 space-y-2">
              <div className="flex justify-between text-xs font-medium text-text/70">
                <span className="flex items-center gap-1.5">
                  <Download size={13} className="text-primary animate-bounce" />
                  Downloading update...
                </span>
                <span className="font-semibold text-primary">{updateInfo.percent || 0}%</span>
              </div>
              <div className="w-full h-2 rounded-full bg-white/10 overflow-hidden">
                <motion.div
                  className="h-full bg-primary"
                  initial={{ width: 0 }}
                  animate={{ width: `${updateInfo.percent || 0}%` }}
                  transition={{ duration: 0.3 }}
                />
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center gap-3 mt-6">
            {isDownloaded ? (
              <>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => window.electronAPI.updater.quitAndInstall()}
                  className="flex-1 py-3 px-4 bg-primary text-zinc-950 font-bold text-xs rounded-xl shadow-glow hover:bg-primary-hover transition-colors flex items-center justify-center gap-2"
                >
                  <RefreshCw size={15} />
                  <span>Restart & Install Update</span>
                </motion.button>

                <button
                  onClick={handleDismiss}
                  className="py-3 px-4 bg-white/5 border border-white/10 text-text/70 font-semibold text-xs rounded-xl hover:bg-white/10 hover:text-text transition-colors"
                >
                  Later
                </button>
              </>
            ) : (
              <button
                onClick={handleDismiss}
                className="w-full py-2.5 px-4 bg-white/10 text-text font-semibold text-xs rounded-xl hover:bg-white/15 transition-colors"
              >
                Hide Notification
              </button>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
