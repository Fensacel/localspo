import { useState } from 'react';
import { Heart, Download, Info, RefreshCw } from 'lucide-react';
import { useDownloaderStore } from '../stores/useDownloaderStore';

export function LikedSongsTab() {
  const { downloadUrl, isAdding } = useDownloaderStore();
  const [url, setUrl] = useState('');

  const handleDownload = async () => {
    if (!url.trim()) return;
    await downloadUrl(url.trim());
    setUrl('');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3 p-4 glass rounded-xl border border-white/5">
        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-pink-500/30 to-rose-500/20 border border-pink-500/20 flex items-center justify-center shrink-0">
          <Heart size={22} className="text-pink-400" fill="currentColor" />
        </div>
        <div>
          <p className="text-sm font-bold text-text">Liked Songs Sync</p>
          <p className="text-xs text-text/50 leading-relaxed mt-0.5">
            Download your Spotify Liked Songs into a local playlist
          </p>
        </div>
      </div>

      {/* Info box */}
      <div className="flex gap-3 p-3 bg-amber-500/5 border border-amber-500/15 rounded-xl">
        <Info size={14} className="text-amber-400 shrink-0 mt-0.5" />
        <div className="text-xs text-text/60 leading-relaxed space-y-1">
          <p>
            To download your Liked Songs, you need to share your personal Spotify Liked Songs URL.
          </p>
          <p>
            Open Spotify → Your Library → Liked Songs → Share → Copy Link, then paste it below.
          </p>
          <p className="text-text/40">
            Format: <code className="bg-white/5 px-1 rounded">https://open.spotify.com/collection/tracks</code> or a playlist link
          </p>
        </div>
      </div>

      {/* URL input */}
      <div className="space-y-2">
        <label className="text-xs font-semibold text-text/60">Liked Songs Playlist URL</label>
        <div className="flex gap-2">
          <input
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleDownload()}
            placeholder="https://open.spotify.com/playlist/..."
            className="flex-1 px-3 py-2.5 glass rounded-xl text-sm text-text placeholder:text-text/30 focus:outline-none focus:ring-1 focus:ring-primary/40 border border-white/5"
          />
          <button
            onClick={handleDownload}
            disabled={isAdding || !url.trim()}
            className="flex items-center gap-2 px-4 py-2.5 bg-primary rounded-xl text-xs font-bold text-zinc-950 shadow-glow hover:bg-primary-hover disabled:opacity-50 transition-all"
          >
            {isAdding ? (
              <RefreshCw size={13} className="animate-spin" />
            ) : (
              <Download size={13} />
            )}
            Download
          </button>
        </div>
      </div>

      {/* Tip */}
      <div className="p-3 glass rounded-xl border border-white/5">
        <p className="text-xs font-semibold text-text/60 mb-2">What happens next?</p>
        <ol className="space-y-1.5 text-xs text-text/50">
          {[
            'All tracks are queued for download',
            'Metadata, artwork, and lyrics are embedded automatically',
            'Songs are imported into your local library',
            'A "Liked Songs" playlist is created automatically',
          ].map((step, i) => (
            <li key={i} className="flex items-start gap-2">
              <span className="w-4 h-4 rounded-full bg-primary/15 text-primary text-[9px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                {i + 1}
              </span>
              {step}
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
