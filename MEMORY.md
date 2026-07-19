# MEMORY.md

## Project Status
- **Project Name:** bluetune
- **Target Platform:** Windows Desktop (Electron)
- **Current Phase:** Phase 7 (Playlists & Favorites integration) & Phase 10 (Build Verification)

## Core Stack Decision
- **Frontend:** React 19, TypeScript, Vite, TailwindCSS (v3), Zustand, Framer Motion, React Router, Lucide Icons, WaveSurfer.js, Web Audio API.
- **Backend / OS Access:** Electron, Node.js, `music-metadata` (for metadata parsing), `chokidar` (for directory watching).
- **Data Persistence:** Offline-first via JSON files (`library.json`, `settings.json`, `favorites.json`, `playlist.json`, `history.json`). No SQL or server-side databases.

## Architecture
- Clean Architecture utilizing:
  - **Renderer Process:** React frontend, Zustand stores, custom hooks.
  - **IPC Layer:** Electron preload script (`electron/preload.ts`) exposing safe, context-isolated APIs.
  - **Main Process:** Electron lifecycle, folder picking dialogs, local file protocol handles (`local-audio://`, `local-image://`), and metadata scanning.
  - **Scanner Service:** Reusable worker in the main process utilizing `music-metadata` to scan audio files recursively, hash them, extract cover art, write caching directories, and write database files (`library.json`).

## Key Decisions & Progress
- **Dynamic Backgrounds:** Extract dominant color from album cover using canvas in renderer to dynamically adjust theme accents (opacity <15% for background glows).
- **Embedded Lyrics / LRC Support:** Embedded lyrics are cached to `.txt` files under `userData/bluetune/cache/lyrics/` when scanned, and synced LRC files are read directly from path.
- **Offline Files Protocols:** Registered custom protocols `local-audio` and `local-image` as privileged standard secure schemes with Chromium (`registerSchemesAsPrivileged` with `stream: true`) to bypass Web Security local resource loading blocks and enable audio seeking/streaming. Also normalized Windows backslashes for `net.fetch` compatibility.
- **Vite Electron Plugin Config:** Adjusted `vite-plugin-electron` configurations in `package.json` to match versions compatible with the NPM registry.
- **State Management & Persistence:** Created `useFavoritesStore` (favorites.json), `useHistoryStore` (history.json), and `usePlaylistStore` (playlist.json) to handle library actions and listen counts.
- **Visualizer Overlay:** Implemented `NowPlayingOverlay` drawing canvas animations (Spectrum, Waveform, Circular, Particles) reactive to Web Audio API analyser frequencies.
- **Playlists & Context UI:** Created custom `AddToPlaylistMenu` dropdown and fully functional `PlaylistsPage` grid alongside a `PlaylistDetailPage` layout.

## Verification & Cleanliness
- **Stable Quick Picks:** Integrated localStorage-based stable daily and library-size randomized selections with a manual refresh button.
- **Lyrics Precedence:** Adjusted metadata parser scanner and IPC handler to always cache and prioritize embedded lyrics over local `.lrc` files.
- **Unified Queue Panel:** Designed a responsive `QueuePanel` for the sidebar and `NowPlayingOverlay`, supporting HTML5 drag-and-drop reordering, double-click playback, track removal, and auto-scrolling to active tracks.
- **Audio Seeking & Volume Sync:** Fixed playback jitter, desync, and infinite loop seek bugs by implementing mouse-drag event tracking on both progress and volume sliders.
- **Audio Engine Refactor:** Unified state synchronization inside `AudioEngine.tsx` to handle `currentSong` and `isPlaying` changes simultaneously, preventing race conditions and double-plays. Added filesystem exists checks and verbose console listeners to all media events.
- **TypeScript Purity:** Checked the complete codebase with `npx tsc --noEmit` and confirmed ZERO type errors.
- **Build Success:** Ran `npx vite build` and successfully compiled all renderer bundles and main/preload electron scripts for production with ZERO errors.
