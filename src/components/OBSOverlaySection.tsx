import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Tv,
  Copy,
  ExternalLink,
  QrCode,
  Radio,
  Check,
  Sliders,
  Palette,
  Eye,
  Settings2,
  X,
} from 'lucide-react';
import { useObsStore, usePlayerStore, useToastStore } from '@/stores';
import { getImageUrl } from '@/utils';

const THEMES = [
  { id: 'spotify', name: 'Spotify Style', bg: 'bg-[#121212]', border: 'border-[#1db954]/40' },
  { id: 'classic', name: 'Classic Card', bg: 'bg-[#1e1e22]', border: 'border-white/10' },
  { id: 'minimal', name: 'Minimal Pill', bg: 'bg-black/60', border: 'border-white/5' },
  { id: 'glass', name: 'Glassmorphism', bg: 'bg-white/10 backdrop-blur-md', border: 'border-white/20' },
  { id: 'rgb', name: 'Gaming RGB', bg: 'bg-gradient-to-r from-red-500 via-green-500 to-blue-500 p-[1px]', border: 'border-transparent' },
  { id: 'neon', name: 'Neon Glow', bg: 'bg-[#0a0a14]', border: 'border-sky-400 shadow-glow' },
  { id: 'transparent', name: 'Transparent', bg: 'bg-transparent border-dashed', border: 'border-white/20' },
  { id: 'rounded', name: 'Rounded Pill', bg: 'bg-[#18181b]', border: 'border-white/10' },
  { id: 'dark', name: 'Modern Dark', bg: 'bg-[#09090b]', border: 'border-zinc-800' },
  { id: 'light', name: 'High Contrast Light', bg: 'bg-white text-black', border: 'border-black/10' },
];

const FONTS = [
  { id: 'Inter, system-ui, sans-serif', name: 'Inter' },
  { id: 'Outfit, sans-serif', name: 'Outfit' },
  { id: 'Roboto, sans-serif', name: 'Roboto' },
  { id: 'monospace', name: 'Monospace' },
  { id: 'Impact, sans-serif', name: 'Impact' },
  { id: 'Georgia, serif', name: 'Serif' },
];

export function OBSOverlaySection() {
  const { status, config, loadStatus, toggleServer, updateConfig } = useObsStore();
  const { currentSong, currentTime, duration } = usePlayerStore();
  const { showToast } = useToastStore();
  const [showQrModal, setShowQrModal] = useState(false);
  const [activeTab, setActiveTab] = useState<'preview' | 'themes' | 'custom' | 'server'>('preview');

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  const copyUrl = (url: string) => {
    navigator.clipboard.writeText(url);
    showToast('OBS Overlay URL copied to clipboard!', 'success');
  };

  const openBrowser = (url: string) => {
    window.open(url, '_blank');
  };

  const coverUrl = currentSong?.coverPath
    ? getImageUrl(currentSong.coverPath)
    : currentSong?.remoteCoverUrl || '/default-cover.png';

  const progressPct = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className="glass rounded-2xl p-6 space-y-6">
      {/* ── Header & Server Controls ───────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-sky-500/20 border border-sky-500/30 flex items-center justify-center text-sky-400 shrink-0">
            <Tv size={22} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-extrabold text-white tracking-tight">OBS Now Playing Overlay</h3>
              <span
                className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold flex items-center gap-1 ${
                  status.running
                    ? 'bg-emerald-500/15 border border-emerald-500/30 text-emerald-400'
                    : 'bg-red-500/15 border border-red-500/30 text-red-400'
                }`}
              >
                <Radio size={10} className={status.running ? 'animate-pulse' : ''} />
                {status.running ? 'Active (Port ' + status.port + ')' : 'Disabled'}
              </span>
            </div>
            <p className="text-xs text-text/40 mt-0.5">
              Broadcast current song, cover art & lyrics in real-time to OBS Studio Browser Source.
            </p>
          </div>
        </div>

        {/* Server Toggle Switch */}
        <button
          onClick={toggleServer}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-sm ${
            status.running
              ? 'bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 border border-emerald-500/30'
              : 'bg-white/10 hover:bg-white/15 text-white/60 border border-white/10'
          }`}
        >
          <Radio size={14} />
          {status.running ? 'Disable Server' : 'Enable OBS Overlay'}
        </button>
      </div>

      {/* ── Quick URL & Action Bar ────────────────────────────────────────── */}
      {status.running && (
        <div className="p-4 rounded-xl bg-[#141416] border border-white/5 space-y-3">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <span className="text-xs font-bold text-text/40 uppercase tracking-wider shrink-0">OBS URL:</span>
              <code className="text-xs font-mono text-sky-400 bg-black/40 px-3 py-1.5 rounded-lg border border-white/5 truncate flex-1">
                {status.localUrl}
              </code>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => copyUrl(status.localUrl)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-sky-500/15 hover:bg-sky-500/25 border border-sky-500/30 text-sky-400 rounded-lg text-xs font-bold transition-all"
              >
                <Copy size={13} />
                Copy URL
              </button>
              <button
                onClick={() => openBrowser(status.localUrl)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 text-white/80 rounded-lg text-xs font-bold transition-all"
              >
                <ExternalLink size={13} />
                Open
              </button>
              <button
                onClick={() => setShowQrModal(true)}
                title="Mobile QR Code"
                className="p-1.5 bg-white/5 hover:bg-white/10 border border-white/10 text-white/60 hover:text-white rounded-lg transition-colors"
              >
                <QrCode size={16} />
              </button>
            </div>
          </div>

          <div className="flex items-center gap-4 text-[11px] text-text/40 pt-1 border-t border-white/5 flex-wrap">
            <span>Endpoints:</span>
            <button onClick={() => copyUrl(status.localUrl + '/compact')} className="hover:text-sky-400 font-mono">
              /compact (Minimal)
            </button>
            <button onClick={() => copyUrl(status.localUrl + '/lyrics')} className="hover:text-sky-400 font-mono">
              /lyrics (Synced Karaoke)
            </button>
            <button onClick={() => copyUrl(status.localUrl + '/json')} className="hover:text-sky-400 font-mono">
              /json (API)
            </button>
          </div>
        </div>
      )}

      {/* ── Sub Navigation Tabs ───────────────────────────────────────────── */}
      <div className="flex items-center gap-2 border-b border-white/5 pb-2">
        <button
          onClick={() => setActiveTab('preview')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
            activeTab === 'preview' ? 'bg-white/10 text-white' : 'text-text/40 hover:text-white/70'
          }`}
        >
          <Eye size={13} />
          Live Preview
        </button>
        <button
          onClick={() => setActiveTab('themes')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
            activeTab === 'themes' ? 'bg-white/10 text-white' : 'text-text/40 hover:text-white/70'
          }`}
        >
          <Palette size={13} />
          Themes ({THEMES.length})
        </button>
        <button
          onClick={() => setActiveTab('custom')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
            activeTab === 'custom' ? 'bg-white/10 text-white' : 'text-text/40 hover:text-white/70'
          }`}
        >
          <Sliders size={13} />
          Style & Elements
        </button>
        <button
          onClick={() => setActiveTab('server')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
            activeTab === 'server' ? 'bg-white/10 text-white' : 'text-text/40 hover:text-white/70'
          }`}
        >
          <Settings2 size={13} />
          Network & Port
        </button>
      </div>

      {/* ── TAB 1: Live Interactive Overlay Preview ────────────────────────── */}
      {activeTab === 'preview' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-text/50 uppercase tracking-wider">Live Preview Canvas</span>
            <span className="text-[11px] text-text/30">Reflects current song & chosen settings</span>
          </div>

          <div className="p-8 rounded-2xl bg-[#09090b] border border-white/5 flex items-center justify-center min-h-[200px] relative overflow-hidden">
            {/* Grid background representation */}
            <div
              className="absolute inset-0 opacity-15 pointer-events-none"
              style={{
                backgroundImage:
                  'radial-gradient(circle, rgba(255,255,255,0.2) 1px, transparent 1px)',
                backgroundSize: '16px 16px',
              }}
            />

            {/* Live Interactive Overlay Card */}
            <div
              style={{
                fontFamily: config.fontFamily,
                color: config.textColor,
                borderRadius: `${config.cornerRadius}px`,
                backgroundColor:
                  config.theme === 'transparent'
                    ? 'transparent'
                    : config.theme === 'light'
                    ? '#ffffff'
                    : `rgba(18,18,18, ${config.bgOpacity / 100})`,
                backdropFilter: `blur(${config.bgBlur}px)`,
              }}
              className={`relative flex items-center gap-4 p-4 min-w-[320px] max-w-[500px] border shadow-2xl transition-all duration-300 ${
                config.theme === 'neon'
                  ? 'border-sky-400 shadow-[0_0_20px_rgba(56,189,248,0.4)]'
                  : config.theme === 'rgb'
                  ? 'border-transparent ring-2 ring-sky-400'
                  : 'border-white/10'
              }`}
            >
              {config.showArtwork && (
                <div
                  style={{
                    width: `${config.artworkSize || 54}px`,
                    height: `${config.artworkSize || 54}px`,
                    boxShadow: config.artworkGlow ? `0 0 22px ${config.accentColor || '#1db954'}80` : 'none',
                  }}
                  className={`relative shrink-0 overflow-hidden bg-white/5 shadow-2xl ${
                    config.artworkShape === 'circle'
                      ? 'rounded-full'
                      : config.artworkShape === 'square'
                      ? 'rounded-md'
                      : 'rounded-xl'
                  }`}
                >
                  <img src={coverUrl} alt="" className="w-full h-full object-cover" />
                </div>
              )}

              <div className="flex-1 min-w-0 flex flex-col gap-0.5">
                <p className="text-sm font-extrabold text-white truncate leading-tight">
                  {currentSong?.title || 'Whiplash'}
                </p>
                <p className="text-xs opacity-60 truncate">
                  {currentSong?.artist || 'aespa'} {currentSong?.album ? `• ${currentSong.album}` : '• Whiplash'}
                </p>

                {config.showLyrics && (
                  <div className="text-xs font-extrabold truncate flex items-center gap-1 mt-0.5" style={{ color: config.accentColor || '#1db954' }}>
                    <span>🎵</span>
                    <span className="truncate">Just close your eyes...</span>
                  </div>
                )}

                {config.showProgressBar && (
                  <div className="w-full h-1.5 rounded-full bg-white/15 overflow-hidden mt-1.5">
                    <div
                      style={{
                        width: `${progressPct || 65}%`,
                        backgroundColor: config.accentColor || '#1db954',
                      }}
                      className="h-full rounded-full transition-all"
                    />
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── TAB 2: Themes Grid ─────────────────────────────────────────────── */}
      {activeTab === 'themes' && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {THEMES.map((t) => {
            const isSelected = config.theme === t.id;
            return (
              <button
                key={t.id}
                onClick={() => updateConfig({ theme: t.id as any })}
                className={`p-3 rounded-xl border text-left transition-all relative overflow-hidden flex flex-col justify-between h-24 ${
                  t.bg
                } ${t.border} ${
                  isSelected ? 'ring-2 ring-sky-400 scale-[1.02]' : 'hover:scale-[1.01]'
                }`}
              >
                <div>
                  <span className="text-xs font-bold text-white block">{t.name}</span>
                  <span className="text-[10px] text-text/40 block mt-0.5">Preset Theme</span>
                </div>
                {isSelected && (
                  <span className="absolute top-2 right-2 p-1 bg-sky-500 rounded-full text-zinc-950">
                    <Check size={10} />
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* ── TAB 3: Style & Elements Customization ──────────────────────────── */}
      {activeTab === 'custom' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Style Controls */}
          <div className="space-y-4">
            <h4 className="text-xs font-bold text-text/50 uppercase tracking-wider">Typography & Colors</h4>

            <div className="space-y-2">
              <label className="text-xs font-semibold text-text/70 block">Font Family</label>
              <select
                value={config.fontFamily}
                onChange={(e) => updateConfig({ fontFamily: e.target.value })}
                className="w-full px-3 py-2 bg-[#1a1a1e] border border-white/10 rounded-xl text-xs text-white focus:outline-none"
              >
                {FONTS.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-text/70 block mb-1">Accent Color</label>
                <input
                  type="color"
                  value={config.accentColor}
                  onChange={(e) => updateConfig({ accentColor: e.target.value })}
                  className="w-full h-9 rounded-lg border border-white/10 bg-transparent cursor-pointer p-0.5"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-text/70 block mb-1">Text Color</label>
                <input
                  type="color"
                  value={config.textColor}
                  onChange={(e) => updateConfig({ textColor: e.target.value })}
                  className="w-full h-9 rounded-lg border border-white/10 bg-transparent cursor-pointer p-0.5"
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between text-xs text-text/70 font-semibold">
                <span>Background Opacity</span>
                <span>{config.bgOpacity}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                value={config.bgOpacity}
                onChange={(e) => updateConfig({ bgOpacity: Number(e.target.value) })}
                className="w-full accent-sky-400"
              />
            </div>
          </div>

          {/* Element Display Toggles */}
          <div className="space-y-4">
            <h4 className="text-xs font-bold text-text/50 uppercase tracking-wider">Visible Elements</h4>

            <div className="space-y-2.5">
              <label className="flex items-center justify-between text-xs text-text/80 cursor-pointer">
                <span>Show Artwork</span>
                <input
                  type="checkbox"
                  checked={config.showArtwork}
                  onChange={(e) => updateConfig({ showArtwork: e.target.checked })}
                  className="accent-sky-400 rounded w-4 h-4"
                />
              </label>

              <label className="flex items-center justify-between text-xs text-text/80 cursor-pointer">
                <span>Show Progress Bar</span>
                <input
                  type="checkbox"
                  checked={config.showProgressBar}
                  onChange={(e) => updateConfig({ showProgressBar: e.target.checked })}
                  className="accent-sky-400 rounded w-4 h-4"
                />
              </label>

              <label className="flex items-center justify-between text-xs text-text/80 cursor-pointer">
                <span>Show Synced Lyrics</span>
                <input
                  type="checkbox"
                  checked={config.showLyrics}
                  onChange={(e) => updateConfig({ showLyrics: e.target.checked })}
                  className="accent-sky-400 rounded w-4 h-4"
                />
              </label>
            </div>
          </div>
        </div>
      )}

      {/* ── TAB 4: Network & Port Settings ─────────────────────────────────── */}
      {activeTab === 'server' && (
        <div className="space-y-4 max-w-md">
          <div className="space-y-2">
            <label className="text-xs font-semibold text-text/70 block">Server Port</label>
            <input
              type="number"
              value={config.port}
              onChange={(e) => updateConfig({ port: Number(e.target.value) || 4785 })}
              className="w-full px-3 py-2 bg-[#1a1a1e] border border-white/10 rounded-xl text-xs text-white focus:outline-none"
            />
          </div>

          <label className="flex items-start gap-3 p-3 rounded-xl bg-white/5 border border-white/5 cursor-pointer">
            <input
              type="checkbox"
              checked={config.lanAccess}
              onChange={(e) => updateConfig({ lanAccess: e.target.checked })}
              className="accent-sky-400 rounded w-4 h-4 mt-0.5"
            />
            <div>
              <span className="text-xs font-bold text-white block">Allow LAN Access</span>
              <span className="text-[11px] text-text/40 block mt-0.5 leading-snug">
                Binds to 0.0.0.0 allowing phones/tablets or other PCs on the same WiFi network to view the overlay.
              </span>
            </div>
          </label>
        </div>
      )}

      {/* ── QR CODE MODAL ─────────────────────────────────────────────────── */}
      {showQrModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="relative w-full max-w-sm glass-heavy border border-white/10 rounded-2xl p-6 shadow-2xl backdrop-blur-2xl text-text text-center space-y-4"
          >
            <button
              onClick={() => setShowQrModal(false)}
              className="absolute top-4 right-4 p-1 rounded-lg text-text/40 hover:text-white"
            >
              <X size={18} />
            </button>

            <div className="w-12 h-12 rounded-2xl bg-sky-500/20 text-sky-400 flex items-center justify-center mx-auto">
              <QrCode size={24} />
            </div>

            <h3 className="text-lg font-extrabold text-white">Mobile LAN Overlay QR</h3>
            <p className="text-xs text-text/50">
              Scan this QR code with your mobile phone or tablet to test the live overlay on your local network!
            </p>

            <div className="p-4 bg-white rounded-2xl inline-block shadow-lg">
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(
                  status.lanUrl || status.localUrl
                )}`}
                alt="QR Code"
                className="w-44 h-44 object-contain"
              />
            </div>

            <code className="block text-xs font-mono text-sky-400 bg-black/40 p-2 rounded-lg truncate">
              {status.lanUrl || status.localUrl}
            </code>
          </motion.div>
        </div>
      )}
    </div>
  );
}
