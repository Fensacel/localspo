import { useState, useEffect } from 'react';
import { FolderOpen, Save, Settings, RefreshCw, ListMusic } from 'lucide-react';
import { useDownloaderStore } from '../stores/useDownloaderStore';
import type { DownloaderSettings } from '../types';

function SettingRow({ label, desc, children }: { label: string; desc?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 py-3 border-b border-white/5 last:border-0">
      <div className="flex-1">
        <p className="text-sm font-semibold text-text">{label}</p>
        {desc && <p className="text-xs text-text/40 mt-0.5">{desc}</p>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

function Toggle({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={`relative w-10 h-5.5 rounded-full transition-colors duration-200 ${
        checked ? 'bg-primary' : 'bg-white/15'
      }`}
      style={{ height: '22px' }}
    >
      <span
        className={`absolute top-0.5 left-0.5 w-[18px] h-[18px] rounded-full bg-white shadow-sm transition-transform duration-200 ${
          checked ? 'translate-x-[18px]' : ''
        }`}
      />
    </button>
  );
}

export function DownloaderSettingsTab() {
  const { settings, updateSettings, loadSettings } = useDownloaderStore();
  const [form, setForm] = useState<DownloaderSettings | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  useEffect(() => {
    if (settings) setForm({ ...settings });
  }, [settings]);

  if (!form) {
    return (
      <div className="flex items-center justify-center h-48">
        <RefreshCw size={18} className="text-primary animate-spin" />
      </div>
    );
  }

  const handleSelectFolder = async () => {
    const folder = await window.electronAPI.dialog.openFolder();
    if (folder) setForm((prev) => (prev ? { ...prev, downloadFolder: folder } : null));
  };

  const handleSave = async () => {
    if (!form) return;
    await updateSettings(form);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="space-y-8 max-w-2xl">
      {/* Audio Settings */}
      <section>
        <p className="text-xs font-bold text-text/40 uppercase tracking-wider mb-4 flex items-center gap-2">
          <Settings size={12} />
          Audio
        </p>
        <div className="glass rounded-2xl border border-white/5 px-4">
          <SettingRow label="Download Location">
            <div className="flex gap-2">
              <input
                type="text"
                value={form.downloadFolder}
                readOnly
                className="w-48 px-2 py-1.5 bg-white/5 border border-white/10 rounded-lg text-xs text-text/70 truncate focus:outline-none"
              />
              <button
                onClick={handleSelectFolder}
                className="flex items-center gap-1.5 px-2.5 py-1.5 bg-white/10 hover:bg-white/15 rounded-lg text-xs font-medium text-text transition-colors"
              >
                <FolderOpen size={13} />
                Browse
              </button>
            </div>
          </SettingRow>

          <SettingRow label="Audio Format" desc="File format for downloaded tracks">
            <select
              value={form.audioFormat}
              onChange={(e) => setForm({ ...form, audioFormat: e.target.value as DownloaderSettings['audioFormat'] })}
              className="px-2.5 py-1.5 bg-zinc-900 border border-white/10 rounded-lg text-xs text-text focus:outline-none focus:ring-1 focus:ring-primary/40"
            >
              <option value="mp3">MP3</option>
              <option value="flac">FLAC (Lossless)</option>
              <option value="m4a">M4A (AAC)</option>
              <option value="wav">WAV</option>
            </select>
          </SettingRow>

          <SettingRow label="Audio Bitrate" desc="Quality level (MP3 only)">
            <select
              value={form.audioBitrate}
              onChange={(e) => setForm({ ...form, audioBitrate: e.target.value as DownloaderSettings['audioBitrate'] })}
              className="px-2.5 py-1.5 bg-zinc-900 border border-white/10 rounded-lg text-xs text-text focus:outline-none focus:ring-1 focus:ring-primary/40"
            >
              <option value="320k">320 kbps (High)</option>
              <option value="256k">256 kbps</option>
              <option value="192k">192 kbps</option>
              <option value="128k">128 kbps</option>
            </select>
          </SettingRow>

          <SettingRow label="Concurrent Downloads" desc="Max simultaneous downloads (1-5)">
            <input
              type="number"
              min={1}
              max={5}
              value={form.concurrentDownloads}
              onChange={(e) => setForm({ ...form, concurrentDownloads: parseInt(e.target.value) || 1 })}
              className="w-20 px-2.5 py-1.5 bg-white/5 border border-white/10 rounded-lg text-xs text-text focus:outline-none focus:ring-1 focus:ring-primary/40"
            />
          </SettingRow>

          <SettingRow label="Max Retries" desc="Retry failed downloads (0-5)">
            <input
              type="number"
              min={0}
              max={5}
              value={form.retryCount}
              onChange={(e) => setForm({ ...form, retryCount: parseInt(e.target.value) || 0 })}
              className="w-20 px-2.5 py-1.5 bg-white/5 border border-white/10 rounded-lg text-xs text-text focus:outline-none focus:ring-1 focus:ring-primary/40"
            />
          </SettingRow>
        </div>
      </section>

      {/* Metadata & Library */}
      <section>
        <p className="text-xs font-bold text-text/40 uppercase tracking-wider mb-4 flex items-center gap-2">
          <ListMusic size={12} />
          Library
        </p>
        <div className="glass rounded-2xl border border-white/5 px-4">
          <SettingRow label="Fetch Lyrics" desc="Download synced lyrics from LRCLIB after each track">
            <Toggle checked={form.getLyrics} onChange={(v) => setForm({ ...form, getLyrics: v })} />
          </SettingRow>
          <SettingRow label="Create .LRC File" desc="Save a separate .lrc lyrics file alongside the audio">
            <Toggle checked={form.createLrcFile} onChange={(v) => setForm({ ...form, createLrcFile: v })} />
          </SettingRow>
          <SettingRow label="Auto Import" desc="Automatically add completed downloads to your local library">
            <Toggle checked={form.autoImport} onChange={(v) => setForm({ ...form, autoImport: v })} />
          </SettingRow>
          <SettingRow label="Auto Create Playlist" desc="When downloading a Spotify playlist, create a matching local playlist">
            <Toggle checked={form.autoCreatePlaylist ?? true} onChange={(v) => setForm({ ...form, autoCreatePlaylist: v })} />
          </SettingRow>
          <SettingRow label="Keep Removed Songs" desc="Keep local songs when they are removed from the Spotify playlist">
            <Toggle checked={form.keepRemovedSongs ?? true} onChange={(v) => setForm({ ...form, keepRemovedSongs: v })} />
          </SettingRow>
          <SettingRow label="Auto Sync on Startup" desc="Sync all followed playlists when LocalSpo starts">
            <Toggle checked={form.autoSyncOnStartup ?? true} onChange={(v) => setForm({ ...form, autoSyncOnStartup: v })} />
          </SettingRow>
        </div>
      </section>

      {/* Hybrid Streaming & Cache */}
      <section>
        <p className="text-xs font-bold text-text/40 uppercase tracking-wider mb-4 flex items-center gap-2">
          <Settings size={12} />
          Hybrid Streaming & Cache
        </p>
        <div className="glass rounded-2xl border border-white/5 px-4">
          <SettingRow label="Instant Streaming" desc="Stream audio from YouTube Music instantly without downloading first">
            <span className="text-xs text-emerald-400 font-semibold px-2 py-1 bg-emerald-500/10 rounded-lg">Active</span>
          </SettingRow>

          <SettingRow label="Stream URL Cache" desc="Cached direct stream links (valid for ~4 hours)">
            <button
              onClick={async () => {
                if (window.electronAPI?.streaming) {
                  const result = await window.electronAPI.streaming.pruneCache();
                  alert(`Cache pruned! Active entries remaining: ${result.cacheSize}`);
                }
              }}
              className="px-3 py-1.5 bg-white/10 hover:bg-white/15 rounded-lg text-xs font-medium text-text transition-colors"
            >
              Clear Expired Cache
            </button>
          </SettingRow>
        </div>
      </section>


      {/* Save Button */}
      <div className="flex justify-end">
        <button
          onClick={handleSave}
          className="flex items-center gap-2 px-6 py-2.5 bg-primary rounded-xl text-sm font-bold text-zinc-950 shadow-glow hover:bg-primary-hover transition-all"
        >
          {saved ? (
            <>✓ Saved!</>
          ) : (
            <>
              <Save size={15} />
              Save Settings
            </>
          )}
        </button>
      </div>
    </div>
  );
}
