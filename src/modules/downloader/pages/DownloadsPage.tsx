import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search,
  ListMusic,
  History,
  ListCheck,
  Settings,
  Heart,
  Download,
  RefreshCw,
} from 'lucide-react';
import { SpotifySearchTab } from '../components/SpotifySearchTab';
import { QueueTab } from '../components/QueueTab';
import { HistoryTab } from '../components/HistoryTab';
import { SpotifyPlaylistsTab } from '../components/SpotifyPlaylistsTab';
import { LikedSongsTab } from '../components/LikedSongsTab';
import { DownloaderSettingsTab } from '../components/DownloaderSettingsTab';
import { useDownloaderStore } from '../stores/useDownloaderStore';
import { useSpotifyStore } from '../stores/useSpotifyStore';

type Tab = 'search' | 'queue' | 'history' | 'playlists' | 'liked' | 'settings';

const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: 'search', label: 'Search', icon: Search },
  { id: 'queue', label: 'Queue', icon: ListCheck },
  { id: 'history', label: 'History', icon: History },
  { id: 'playlists', label: 'Playlists', icon: ListMusic },
  { id: 'liked', label: 'Liked Songs', icon: Heart },
  { id: 'settings', label: 'Settings', icon: Settings },
];

export function DownloadsPage() {
  const [activeTab, setActiveTab] = useState<Tab>('search');
  const { queue, loadQueue, loadSettings, settings } = useDownloaderStore();
  const { loadLinkedPlaylists, linkedPlaylists, syncPlaylist } = useSpotifyStore();

  const activeCount = queue.filter((i) => i.status === 'downloading' || i.status === 'tagging').length;
  const queuedCount = queue.filter((i) => i.status === 'queued').length;
  const totalActive = activeCount + queuedCount;

  useEffect(() => {
    loadQueue();
    loadSettings();
    loadLinkedPlaylists();
  }, [loadQueue, loadSettings, loadLinkedPlaylists]);

  // Step 13: Startup auto-sync
  useEffect(() => {
    if (!settings?.autoSyncOnStartup || linkedPlaylists.length === 0) return;

    const autoSyncPlaylists = linkedPlaylists.filter((p) => p.autoSync);
    for (const playlist of autoSyncPlaylists) {
      // Check if synced recently (within 5 minutes) — skip if so
      const fiveMinAgo = Date.now() - 5 * 60 * 1000;
      if (playlist.lastSync && playlist.lastSync > fiveMinAgo) continue;

      console.log(`[AutoSync] Startup sync for: ${playlist.name}`);
      syncPlaylist(playlist.spotifyId, [], settings?.keepRemovedSongs ?? true);
    }
  }, [settings?.autoSyncOnStartup, linkedPlaylists.length]); // eslint-disable-line

  // Step 13: Interval auto-sync event listener
  useEffect(() => {
    const handleAutoSyncTrigger = (e: Event) => {
      const { spotifyId } = (e as CustomEvent).detail;
      const playlist = linkedPlaylists.find((p) => p.spotifyId === spotifyId);
      if (!playlist || !playlist.autoSync) return;
      syncPlaylist(playlist.spotifyId, [], settings?.keepRemovedSongs ?? true);
    };
    window.addEventListener('spotify:autoSyncTrigger', handleAutoSyncTrigger);
    return () => window.removeEventListener('spotify:autoSyncTrigger', handleAutoSyncTrigger);
  }, [linkedPlaylists, settings?.keepRemovedSongs, syncPlaylist]);

  return (
    <div className="flex flex-col h-full space-y-6 pb-10">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-primary/15 border border-primary/20 flex items-center justify-center">
          <Download size={20} className="text-primary" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-text">Spotify Sync</h1>
          <p className="text-xs text-text/40">Search, download, and sync your Spotify library</p>
        </div>
        {totalActive > 0 && (
          <div className="ml-auto flex items-center gap-2 px-3 py-1.5 bg-primary/10 border border-primary/20 rounded-full">
            <RefreshCw size={12} className="text-primary animate-spin" />
            <span className="text-xs font-semibold text-primary">{totalActive} active</span>
          </div>
        )}
      </div>

      {/* Tab Bar */}
      <div className="flex items-center gap-1 p-1 glass rounded-xl border border-white/5 w-fit">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          const showBadge = tab.id === 'queue' && totalActive > 0;

          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`relative flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold transition-all duration-200 ${
                isActive
                  ? 'bg-primary text-zinc-950 shadow-glow'
                  : 'text-text/50 hover:text-text/80 hover:bg-white/5'
              }`}
            >
              <Icon size={14} />
              <span className="hidden sm:inline">{tab.label}</span>
              {showBadge && (
                <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-rose-500 text-white text-[9px] font-bold flex items-center justify-center">
                  {totalActive > 9 ? '9+' : totalActive}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.15 }}
          className="flex-1 min-h-0"
        >
          {activeTab === 'search' && <SpotifySearchTab />}
          {activeTab === 'queue' && <QueueTab />}
          {activeTab === 'history' && <HistoryTab />}
          {activeTab === 'playlists' && <SpotifyPlaylistsTab />}
          {activeTab === 'liked' && <LikedSongsTab />}
          {activeTab === 'settings' && <DownloaderSettingsTab />}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
