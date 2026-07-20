import { motion } from 'framer-motion';
import {
  Mic2,
  Music,
  FolderOpen,
  Sparkles,
  ExternalLink,
  Download,
  FileEdit,
  CheckCircle2,
  HelpCircle,
} from 'lucide-react';

export function DocsPage() {
  const openExternal = (url: string) => {
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-10">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-3"
      >
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-xs font-semibold text-primary">
          <Sparkles size={14} />
          <span>Localspo Documentation & Resource Hub</span>
        </div>
        <h1 className="text-4xl font-extrabold text-text tracking-tight">Documentation & Essential Tools</h1>
        <p className="text-base text-text/50 max-w-2xl">
          Everything you need to set up your local music library, download tracks, embed synced Karaoke lyrics, and manage your audio collection.
        </p>
      </motion.div>

      {/* Recommended Downloaders & Tagger Section */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="space-y-4"
      >
        <div className="flex items-center gap-2 text-xl font-bold text-text">
          <Download size={22} className="text-primary" />
          <span>Recommended Music Downloader & Metadata Tagger</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Spotify Downloader */}
          <div className="glass p-6 rounded-2xl border border-white/5 space-y-4 flex flex-col justify-between hover:border-primary/30 transition-all duration-300">
            <div className="space-y-3">
              <div className="w-11 h-11 rounded-xl bg-green-500/15 border border-green-500/20 flex items-center justify-center text-green-400">
                <Download size={22} />
              </div>
              <div>
                <h3 className="text-xl font-bold text-text">Spotify Downloader</h3>
                <p className="text-xs text-text/40 mt-0.5">GitHub Repository by WilliamSchack</p>
              </div>
              <p className="text-sm text-text/60 leading-relaxed">
                Looking to build your local audio collection? Use Spotify Downloader to easily fetch tracks, albums, or playlists and save them directly as local audio files on your device for playback in Localspo.
              </p>
              <ul className="space-y-1.5 text-xs text-text/70 pt-1">
                <li className="flex items-center gap-2">
                  <CheckCircle2 size={14} className="text-green-400 shrink-0" />
                  <span>Downloads full playlists and individual tracks.</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 size={14} className="text-green-400 shrink-0" />
                  <span>Saves audio files directly to your local music directory.</span>
                </li>
              </ul>
            </div>
            <button
              onClick={() => openExternal('https://github.com/WilliamSchack/Spotify-Downloader')}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-black font-semibold text-sm hover:bg-primary/90 transition-all duration-200 shadow-lg shadow-primary/20 mt-2"
            >
              <span>Visit Spotify Downloader Repository</span>
              <ExternalLink size={16} />
            </button>
          </div>

          {/* TagScanner */}
          <div className="glass p-6 rounded-2xl border border-white/5 space-y-4 flex flex-col justify-between hover:border-primary/30 transition-all duration-300">
            <div className="space-y-3">
              <div className="w-11 h-11 rounded-xl bg-blue-500/15 border border-blue-500/20 flex items-center justify-center text-blue-400">
                <FileEdit size={22} />
              </div>
              <div>
                <h3 className="text-xl font-bold text-text">TagScanner (Lyric & Tag Editor)</h3>
                <p className="text-xs text-text/40 mt-0.5">Music Tag & LRC Editor (xdlab.ru)</p>
              </div>
              <p className="text-sm text-text/60 leading-relaxed">
                If your downloaded audio files are missing lyrics, album covers, or ID3 tags, TagScanner is a tool to automatically fetch LRC lyrics online, organize metadata, and embed lyrics directly into your audio files.
              </p>
              <ul className="space-y-1.5 text-xs text-text/70 pt-1">
                <li className="flex items-center gap-2">
                  <CheckCircle2 size={14} className="text-blue-400 shrink-0" />
                  <span>Fetch and embed synced <code className="text-primary font-mono">.lrc</code> lyrics into audio files.</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 size={14} className="text-blue-400 shrink-0" />
                  <span>Organize music tags, album art, and track details automatically.</span>
                </li>
              </ul>
            </div>
            <button
              onClick={() => openExternal('https://www.xdlab.ru/en/download.htm')}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-white/10 text-text font-semibold text-sm hover:bg-white/15 border border-white/10 transition-all duration-200 mt-2"
            >
              <span>Download TagScanner Official Site</span>
              <ExternalLink size={16} />
            </button>
          </div>
        </div>
      </motion.div>

      {/* Localspo Features & Lyrics Guide */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="space-y-4 pt-2"
      >
        <div className="flex items-center gap-2 text-xl font-bold text-text">
          <HelpCircle size={22} className="text-primary" />
          <span>Localspo Features & Lyrics System</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {/* Synced Karaoke */}
          <div className="glass p-6 rounded-2xl border border-white/5 space-y-3">
            <div className="w-10 h-10 rounded-xl bg-primary/15 border border-primary/20 flex items-center justify-center text-primary">
              <Mic2 size={20} />
            </div>
            <h3 className="text-lg font-bold text-text">Synced Karaoke & LRC Engine</h3>
            <p className="text-sm text-text/60 leading-relaxed">
              Supports both standard LRC and Enhanced LRC files. Words highlight smoothly in sync with track playback.
            </p>
            <ul className="space-y-2 text-xs text-text/70 pt-2">
              <li className="flex items-center gap-2">
                <CheckCircle2 size={14} className="text-primary shrink-0" />
                <span><strong>Enhanced LRC:</strong> Exact word timestamps (<code className="text-primary">&lt;00:12.34&gt;</code>).</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 size={14} className="text-primary shrink-0" />
                <span><strong>Weighted Fallback:</strong> Smart word duration weighting for regular LRC.</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 size={14} className="text-primary shrink-0" />
                <span><strong>Interactive Seeking:</strong> Click any word to jump directly.</span>
              </li>
            </ul>
          </div>

          {/* Audio Engine */}
          <div className="glass p-6 rounded-2xl border border-white/5 space-y-3">
            <div className="w-10 h-10 rounded-xl bg-primary/15 border border-primary/20 flex items-center justify-center text-primary">
              <Music size={20} />
            </div>
            <h3 className="text-lg font-bold text-text">Hi-Fi Audio Playback</h3>
            <p className="text-sm text-text/60 leading-relaxed">
              Engineered for high fidelity audio playback with gapless transitions and crossfade capabilities.
            </p>
            <ul className="space-y-2 text-xs text-text/70 pt-2">
              <li className="flex items-center gap-2">
                <CheckCircle2 size={14} className="text-primary shrink-0" />
                <span>Format support: FLAC, MP3, WAV, M4A, OGG, ALAC, AAC.</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 size={14} className="text-primary shrink-0" />
                <span>Crossfade and gapless playback settings.</span>
              </li>
            </ul>
          </div>

          {/* Library Scanner */}
          <div className="glass p-6 rounded-2xl border border-white/5 space-y-3">
            <div className="w-10 h-10 rounded-xl bg-primary/15 border border-primary/20 flex items-center justify-center text-primary">
              <FolderOpen size={20} />
            </div>
            <h3 className="text-lg font-bold text-text">Local Library Management</h3>
            <p className="text-sm text-text/60 leading-relaxed">
              Scan local directories automatically for audio tracks, embedded cover art, metadata, and external <code className="text-primary">.lrc</code> files.
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
