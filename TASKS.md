# TASKS

## Phase 1: Core Setup
- [x] Setup Electron (frameless window, context bridge, custom IPC protocols)
- [x] Setup React (React 19 + StrictMode)
- [x] Setup TypeScript (strict checking, tsconfig.json configurations)
- [x] Setup TailwindCSS (v3 design tokens, custom glassmorphism)
- [x] Setup Zustand (stores for library, player, settings, favorites, history, playlists)
- [x] Setup Routing (HashRouter for Electron offline loading)
- [x] Setup ESLint (v9 flat config, typescript-eslint integration)
- [x] Setup Prettier (code styling verification script)

---

## Phase 2: Music Scanner
- [x] Folder Picker (dialog directory select IPC)
- [x] Recursive Scan (recursive file walker)
- [x] Metadata Reader (music-metadata tag extraction)
- [x] Cover Reader (embedded cover extraction + folder fallback)
- [x] Lyrics Reader (embedded tag extraction + LRC reader)
- [x] Hash Generator (file size + mtime MD5 hashing for duplication checks)
- [x] Cache Generator (caching directory structure for images and lyrics)

---

## Phase 3: Library
- [x] Albums (responsive grid, hover play, duration mapping)
- [x] Artists (circular layout, circular covers, artist detail routing)
- [x] Songs (comprehensive list, format indicator, play trigger, favorites heart)
- [x] Recently Added (dynamic sorting by timestamp)
- [x] Favorites (Zustand loved songIds mapping, favorites list)
- [x] Recently Played (Zustand listening history list)

---

## Phase 4: Player
- [x] Play (HTML5 Audio play invoke)
- [x] Pause (HTML5 Audio pause invoke)
- [x] Previous (Index wrapping player action)
- [x] Next (Index wrapping player action)
- [x] Queue (Store arrays, double click playlist/album set queue index)
- [x] Shuffle (Fisher-Yates random queue shuffle toggle)
- [x] Repeat (off, one, all playback wrapping options)
- [x] Volume (master gain controls + volume bar)
- [x] Seek (currentTime property bindings + custom event listener seek trigger)
- [x] Speed (playbackRate speed modifier)
- [/] Gapless (preloaded secondary buffer setup)
- [/] Crossfade (transition toggles in settings)

---

## Phase 5: Lyrics
- [x] Embedded Lyrics (caching text files, reading fallback)
- [x] LRC Parser (timestamp regex parsing into LyricLine arrays)
- [x] Auto Scroll (offsetTop calculation centering on container height)
- [ ] Karaoke Highlight

---

## Phase 6: Visualizer
- [x] Waveform (Canvas time domain draw line)
- [x] Spectrum (Canvas frequency bar gradient spectrum)
- [x] Frequency (Circular outer glowing reactive ring visualizer)
- [x] Particle (Reactive floating particle system speed)

---

## Phase 7: Playlist
- [x] Create (Playlist creation modal, auto metadata timestamps)
- [x] Delete (Confirmation triggers, filtering lists)
- [x] Edit (Renaming and descriptions updating)
- [x] Favorite (Love playlist marking toggle)
- [ ] Smart Playlist

---

## Phase 8: Settings
- [x] Theme (Neon dark glassmorphism system)
- [x] Accent Color (dominant color extraction on current song artwork)
- [x] Music Folder (addition, deletion, rescan triggering)
- [x] Audio (crossfade and gapless option toggles)
- [ ] Equalizer

---

## Phase 9: Optimization
- [ ] Lazy Loading
- [ ] Virtual List
- [x] Image Cache (MD5 cached covers)
- [x] Lyrics Cache (caching to cache/lyrics/ folder)
- [x] Metadata Cache (library.json persistence structure)

---

## Phase 10: Packaging
- [/] Windows Build (electron-builder configurations in package.json)
- [ ] Auto Update
- [/] Installer (NSIS target set in build options)

---

## Bug Fixing & Enhancements (Session July 2026)
- [x] Audio Playback: Resolved Chromium URL encoding issues with spaces and special characters using `pathToFileURL` in the `local-audio` and `local-image` handlers.
- [x] Stable Quick Picks: Implemented daily/library-stable random picks using localStorage caching with a manual refresh button.
- [x] Lyrics Precedence: Prioritized embedded lyrics (synced/unsynced) over external `.lrc` files in the same directory, with proper caching.
- [x] Queue UI Panel: Added unified QueuePanel on both sidebar and NowPlayingOverlay containing Album cover, Title, Artist, Duration, previous, current and next tracks, supporting HTML5 drag-and-drop reordering, double-click play, track removal, and auto-scrolling to active track.
- [x] Playback Sync & Jitter: Fixed desync, jumping and loop bugs in seeking and volume slider by implementing mousemove and mouseup drag handlers.
- [x] Audio Engine Debugging: Refactored AudioEngine.tsx to implement filesystem path exists checks, unified playback state synchronization (preventing race conditions and re-connect crashes), and verbose console log event monitors.