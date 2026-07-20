# 🎵 BlueTune (LocalSpo)

> **A Next-Gen, Premium Desktop Local Music Player** built with Electron, React, TypeScript, and Tailwind CSS. Designed for audiophiles and music lovers who appreciate sleek aesthetics and powerful features.

[![Latest Release](https://img.shields.io/github/v/release/Fensacel/localspo?style=for-the-badge&color=10B981&label=Download%20Installer)](https://github.com/Fensacel/localspo/releases/latest)
[![Platform - Windows](https://img.shields.io/badge/Platform-Windows-0078D6?style=for-the-badge&logo=windows)](https://github.com/Fensacel/localspo/releases/latest)
[![License - MIT](https://img.shields.io/badge/License-MIT-blue?style=for-the-badge)](LICENSE)

---

## 📥 Download Application

You can download the latest installer `.exe` for Windows directly from the GitHub Releases page:

### 👉 [**Click Here to Download Latest Version (GitHub Releases)**](https://github.com/Fensacel/localspo/releases/latest)

1. Go to the [**Releases Page**](https://github.com/Fensacel/localspo/releases/latest).
2. Download `LocalSpo Setup X.X.X.exe` under **Assets**.
3. Run the installer to install BlueTune on your Windows PC.
4. Enjoy your music with automatic lyrics, romanization, and built-in auto-updater!

---

## ✨ Features

- **🎧 High-Fidelity Local Audio Playback**: Full support for FLAC, WAV, MP3, AAC, M4A, and OGG formats with byte-range streaming and seeking.
- **🌐 Automatic Romanization Engine**:
  - Automatically detects non-Latin scripts (Japanese, Korean, Chinese, Cyrillic, Greek, Hindi, Arabic, Thai) and generates clean Romaji / Latin transliterations.
  - Multi-mode display: **Original**, **Romanized**, or **Both** (Dual-line mode).
- **🎤 Synced & Embedded Lyrics System**:
  - Full LRC time-synced lyrics with word-level highlight and interactive line seeking.
  - Automatic fallback to embedded track lyrics or online metadata.
- **🎛️ DSP Equalizer & Audio Options**: 10-band graphic equalizer with preset modes, Gapless Playback, and custom Crossfade.
- **📊 Listening History & Analytics**:
  - Track listening history with individual item removal via right-click context menu.
  - Recap stats for Most Played tracks (Today, This Week, This Month).
- **🎨 Glassmorphism & Modern UI**: Animated album artwork, dynamic color palettes, full-screen Now Playing mode, and smooth Framer Motion animations.
- **🔄 Auto-Updater**: Built-in `electron-updater` integration with background download and 1-click restart-to-update support.

---

## 💻 Developer Setup & Source Build

If you want to contribute or build the application from source:

### Prerequisites
- [Node.js](https://nodejs.org/) (v18 or higher)
- [npm](https://www.npmjs.com/)

```bash
# 1. Clone the repository
git clone https://github.com/Fensacel/localspo.git

# 2. Navigate to project folder
cd localspo

# 3. Install dependencies
npm install

# 4. Run development app
npm run dev

# 5. Build production Windows installer
npm run build
```

---

## 🛠️ Built With

- **Framework**: [Electron](https://www.electronjs.org/) + [React 19](https://react.dev/) + [TypeScript](https://www.typescriptlang.org/)
- **Build Tool**: [Vite](https://vitejs.dev/) + [Vite Plugin Electron](https://github.com/electron-vite/vite-plugin-electron)
- **Styling & Motion**: [Tailwind CSS](https://tailwindcss.com/) + [Framer Motion](https://www.framer.com/motion/)
- **Audio Processing**: Web Audio API + [WaveSurfer.js](https://wavesurfer.js.org/) + [music-metadata](https://github.com/Borewit/music-metadata)
- **Japanese Engine**: [Wanakana](https://wanakana.com/)
- **State Management**: [Zustand](https://github.com/pmndrs/zustand)
- **Updater**: [electron-updater](https://www.electron.build/auto-update)

---

## 📜 License

Distributed under the MIT License. See `LICENSE` for details.