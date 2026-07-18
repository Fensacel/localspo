import { HashRouter, Routes, Route } from 'react-router-dom';
import { MainLayout } from '@/layouts/MainLayout';
import { HomePage } from '@/pages/HomePage';
import { SongsPage } from '@/pages/SongsPage';
import { AlbumsPage } from '@/pages/AlbumsPage';
import { ArtistsPage } from '@/pages/ArtistsPage';
import { AlbumDetailPage } from '@/pages/AlbumDetailPage';
import { ArtistDetailPage } from '@/pages/ArtistDetailPage';
import { FavoritesPage } from '@/pages/FavoritesPage';
import { PlaylistsPage } from '@/pages/PlaylistsPage';
import { PlaylistDetailPage } from '@/pages/PlaylistDetailPage';
import { HistoryPage } from '@/pages/HistoryPage';
import { SearchPage } from '@/pages/SearchPage';
import { SettingsPage } from '@/pages/SettingsPage';
import { useSettingsStore, useFavoritesStore, useHistoryStore, usePlaylistStore } from '@/stores';
import { useEffect } from 'react';
import { AudioEngine } from '@/features/player/AudioEngine';
import { useScanner } from '@/hooks/useScanner';

export function App() {
  const loadSettings = useSettingsStore((s) => s.loadSettings);
  const loadFavorites = useFavoritesStore((s) => s.loadFavorites);
  const loadHistory = useHistoryStore((s) => s.loadHistory);
  const loadPlaylists = usePlaylistStore((s) => s.loadPlaylists);

  useEffect(() => {
    loadSettings();
    loadFavorites();
    loadHistory();
    loadPlaylists();
  }, [loadSettings, loadFavorites, loadHistory, loadPlaylists]);

  // Initialize scanner and load library
  useScanner();

  return (
    <HashRouter>
      <AudioEngine />
      <Routes>
        <Route element={<MainLayout />}>
          <Route path="/" element={<HomePage />} />
          <Route path="/songs" element={<SongsPage />} />
          <Route path="/albums" element={<AlbumsPage />} />
          <Route path="/albums/:id" element={<AlbumDetailPage />} />
          <Route path="/artists" element={<ArtistsPage />} />
          <Route path="/artists/:id" element={<ArtistDetailPage />} />
          <Route path="/favorites" element={<FavoritesPage />} />
          <Route path="/playlists" element={<PlaylistsPage />} />
          <Route path="/playlists/:id" element={<PlaylistDetailPage />} />
          <Route path="/history" element={<HistoryPage />} />
          <Route path="/search" element={<SearchPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Route>
      </Routes>
    </HashRouter>
  );
}
