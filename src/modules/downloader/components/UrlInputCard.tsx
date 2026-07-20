import { useState } from 'react';
import { motion } from 'framer-motion';
import { Download, Link as LinkIcon, Clipboard, Loader2 } from 'lucide-react';
import { useDownloaderStore } from '../stores/useDownloaderStore';

export function UrlInputCard() {
  const [url, setUrl] = useState('');
  const { downloadUrl, isAdding } = useDownloaderStore();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim() || isAdding) return;
    const success = await downloadUrl(url);
    if (success) {
      setUrl('');
    }
  };

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        setUrl(text);
      }
    } catch (err) {
      console.warn('Clipboard read failed:', err);
    }
  };

  return (
    <div className="glass rounded-2xl p-6 border border-white/10 shadow-glass">
      <div className="flex items-center gap-3 mb-3">
        <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center text-primary">
          <Download size={20} />
        </div>
        <div>
          <h2 className="text-base font-semibold text-text">Download from Spotify</h2>
          <p className="text-xs text-text/40">
            Paste a Spotify Track, Album, Playlist, or Episode link
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="flex gap-3 mt-4">
        <div className="relative flex-1">
          <LinkIcon size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-text/30" />
          <input
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://open.spotify.com/track/..."
            className="w-full pl-11 pr-24 py-3 bg-white/5 border border-white/10 rounded-xl text-sm text-text placeholder:text-text/25 focus:outline-none focus:ring-2 focus:ring-primary/40 transition-all"
          />
          <button
            type="button"
            onClick={handlePaste}
            className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-xs font-medium text-text/60 hover:text-text transition-colors"
          >
            <Clipboard size={12} />
            <span>Paste</span>
          </button>
        </div>

        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          type="submit"
          disabled={!url.trim() || isAdding}
          className="flex items-center gap-2 px-6 py-3 bg-primary rounded-xl text-sm font-semibold text-zinc-950 shadow-glow disabled:opacity-40 disabled:cursor-not-allowed hover:bg-primary-hover transition-colors shrink-0"
        >
          {isAdding ? (
            <>
              <Loader2 size={16} className="animate-spin" />
              <span>Fetching...</span>
            </>
          ) : (
            <>
              <Download size={16} />
              <span>Download</span>
            </>
          )}
        </motion.button>
      </form>
    </div>
  );
}
