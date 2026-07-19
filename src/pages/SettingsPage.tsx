import { useSettingsStore } from '@/stores';
import { motion } from 'framer-motion';
import {
  Settings as SettingsIcon,
  FolderOpen,
  Palette,
  Volume2,
  Trash2,
  Plus,
  RefreshCw,
} from 'lucide-react';

export function SettingsPage() {
  const {
    musicFolders,
    gapless,
    crossfade,
    crossfadeDuration,
    lyricsEnabled,
    seekByLyricsEnabled,
    updateSettings,
    addMusicFolder,
    removeMusicFolder,
  } = useSettingsStore();

  const handleAddFolder = async () => {
    const folder = await window.electronAPI.dialog.openFolder();
    if (folder) {
      await addMusicFolder(folder);
      window.dispatchEvent(new CustomEvent('scan-folder', { detail: folder }));
    }
  };

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold mb-6 flex items-center gap-2">
        <SettingsIcon size={24} className="text-primary" />
        Settings
      </h1>

      <div className="space-y-6">
        {/* Music Folders */}
        <SettingsSection title="Music Folders" icon={FolderOpen}>
          <div className="space-y-2 mb-3">
            {musicFolders.length === 0 && (
              <p className="text-sm text-text/30 py-3">No folders added</p>
            )}
            {musicFolders.map((folder) => (
              <div
                key={folder}
                className="flex items-center justify-between px-4 py-3 glass rounded-xl"
              >
                <span className="text-sm text-text/70 truncate flex-1 mr-3">{folder}</span>
                <button
                  onClick={() => removeMusicFolder(folder)}
                  className="text-text/30 hover:text-danger transition-colors shrink-0"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleAddFolder}
              className="flex items-center gap-2 px-4 py-2.5 glass rounded-button text-sm font-medium text-text/70 hover:text-text transition-colors"
            >
              <Plus size={14} />
              Add Folder
            </motion.button>
            {musicFolders.length > 0 && (
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => {
                  window.dispatchEvent(new CustomEvent('rescan-library'));
                }}
                className="flex items-center gap-2 px-4 py-2.5 glass rounded-button text-sm font-medium text-text/70 hover:text-text transition-colors"
              >
                <RefreshCw size={14} />
                Rescan Library
              </motion.button>
            )}
          </div>
        </SettingsSection>

        {/* Audio */}
        <SettingsSection title="Audio" icon={Volume2}>
          <ToggleSetting
            label="Gapless Playback"
            description="Seamless transition between tracks"
            enabled={gapless}
            onChange={(v) => updateSettings({ gapless: v })}
          />
          <ToggleSetting
            label="Crossfade"
            description="Fade between tracks"
            enabled={crossfade}
            onChange={(v) => updateSettings({ crossfade: v })}
          />
          {crossfade && (
            <div className="flex items-center justify-between py-3">
              <div>
                <p className="text-sm font-medium">Crossfade Duration</p>
                <p className="text-xs text-text/30">{crossfadeDuration} seconds</p>
              </div>
              <input
                type="range"
                min={1}
                max={10}
                step={1}
                value={crossfadeDuration}
                onChange={(e) => updateSettings({ crossfadeDuration: Number(e.target.value) })}
                className="w-32"
              />
            </div>
          )}
        </SettingsSection>

        {/* Display */}
        <SettingsSection title="Display" icon={Palette}>
          <ToggleSetting
            label="Lyrics"
            description="Show lyrics when available"
            enabled={lyricsEnabled}
            onChange={(v) => updateSettings({ lyricsEnabled: v })}
          />
          <ToggleSetting
            label="Seek by Lyrics"
            description="Allow clicking on synced lyric lines to jump to that time"
            enabled={seekByLyricsEnabled}
            onChange={(v) => updateSettings({ seekByLyricsEnabled: v })}
          />

        </SettingsSection>

        {/* About */}
        <div className="glass rounded-2xl p-6 text-center">
          <div className="flex items-center justify-center gap-2 mb-2">
            <img src="logo.png" className="w-5 h-5 object-contain" alt="" />
            <span className="text-sm font-bold tracking-wider">LocalSpo</span>
          </div>
          <p className="text-xs text-text/30">Version 1.0.1</p>
        </div>
      </div>
    </div>
  );
}

interface SettingsSectionProps {
  title: string;
  icon: React.ElementType;
  children: React.ReactNode;
}

function SettingsSection({ title, icon: Icon, children }: SettingsSectionProps) {
  return (
    <div className="glass rounded-2xl p-5">
      <h3 className="text-sm font-semibold mb-4 flex items-center gap-2 text-text/70">
        <Icon size={16} className="text-primary" />
        {title}
      </h3>
      <div className="divide-y divide-white/5">{children}</div>
    </div>
  );
}

interface ToggleSettingProps {
  label: string;
  description: string;
  enabled: boolean;
  onChange: (enabled: boolean) => void;
}

function ToggleSetting({ label, description, enabled, onChange }: ToggleSettingProps) {
  return (
    <div className="flex items-center justify-between py-3">
      <div>
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs text-text/30">{description}</p>
      </div>
      <button
        onClick={() => onChange(!enabled)}
        className={`relative w-11 h-6 rounded-full transition-colors duration-200 ${
          enabled ? 'bg-primary' : 'bg-white/10'
        }`}
      >
        <motion.div
          animate={{ x: enabled ? 20 : 2 }}
          transition={{ type: 'spring', stiffness: 500, damping: 30 }}
          className="absolute top-1 w-4 h-4 rounded-full bg-white shadow-sm"
        />
      </button>
    </div>
  );
}
