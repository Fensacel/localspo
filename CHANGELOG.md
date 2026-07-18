# CHANGELOG.md

## [0.1.0] - 2026-07-18
### Added
- **Project Structure:** Created the basic Electron + React + TypeScript + Vite + TailwindCSS boilerplate.
- **Electron Configurations:** Frameless window, custom window control bindings, and path/file utilities IPC bridge.
- **Custom Protocols:** Registered `local-audio://` and `local-image://` protocols to allow Web Security bypass for offline media playback and local album cover loading.
- **State Management:** Set up Zustand stores for `Library` (songs, albums, artists, scan progress), `Player` (playback controls, volume, repeat/shuffle, queue), and `Settings` (folders, crossfade/gapless toggle, visualizer preference).
- **Core Components:**
  - `Titlebar`: Frameless window control bar.
  - `Sidebar`: Glassmorphic navigation menu.
  - `MiniPlayer`: Bottom playback control bar with progress/volume seeking.
  - `AudioEngine`: Headless HTML5 Audio and Web Audio API node handling, keyboard shortcuts, Media Session API listener.
- **Library Pages:** Home, Songs, Albums, Artists, Search, Playlists, Favorites, History, Settings, and Detail pages.
- **Lyrics & Parser:** Created LRC/unsynced parser and custom scrolling `LyricsPanel` with Apple Music styling and neon blue glowing active line.
- **Scanner Service:** Implemented recursion, `music-metadata` parser, cover-art/lyrics caching, and `library.json` compilation in the main process.

### Added (Latest session updates)
- **Persisted Stores:** Added `useFavoritesStore` (`favorites.json`), `useHistoryStore` (`history.json`), and `usePlaylistStore` (`playlist.json`) to persist library actions and listen counts using Electron data IPC handlers.
- **Full Screen Dashboard:** Developed `NowPlayingOverlay` overlay with rotating artwork, tabbed Apple-Music scrolling lyrics, tabbed queue lists, and details specs panel.
- **Visualizer Engine:** Built 60 FPS HTML5 Canvas visualizers including Spectrum columns, time domain Waveforms, circular radial indicators, and reactive floating particle systems.
- **Playlist Management:** Added `PlaylistsPage` grid with pin, favorite, and deletion overlays, alongside `PlaylistDetailPage` track listings.
- **Context Playlist Trigger:** Developed `AddToPlaylistMenu` popup overlay to easily insert any song into custom lists.
- **Linter & Formatter Setup:** Integrated ESLint v9 Flat configuration (`eslint.config.js`) and `.prettierrc` rules, achieving complete code formatting and compilation purity (Zero errors, warnings, or unused variables).
- **Queue Panel UI:** Created a unified drag-and-drop `QueuePanel` component (sidebar and overlay) displaying previous, current and next tracks, supporting HTML5 reordering, double-click playback, item removal, and auto-scrolling.

### Fixed
- **Audio Playback Block:** Registered `local-audio` and `local-image` as privileged standard secure schemes and resolved Chromium file loader URL encoding of spaces/special characters by utilizing `pathToFileURL` in the main protocol handlers.
- **Unstable Quick Picks:** Stabilized random homepage picks by caching song list selections daily in `localStorage`, regenerating only on calendar day change, library change, or manual refresh button click.
- **Lyrics Precedence:** Changed lyrics resolver to prioritize embedded audio file lyrics over external `.lrc` files in the folder directory.
- **Seeking & Volume Jitter:** Repaired slider jitter, loops, and desync bugs in the playback progress/volume sliders by implementing continuous mouse-move scrubbing event tracking on window handlers.
- **Audio Engine & Autoplay Glitch:** Refactored `AudioEngine.tsx` to unify playback control triggers, check physical path existence, resolve promise rejections, bypass Strict Mode race cycles, prevent AudioContext `InvalidStateError` reconnect exceptions, and output detailed console audit logs for all HTML5 media events.
