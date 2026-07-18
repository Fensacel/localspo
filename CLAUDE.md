# CLAUDE.md

## Project

BlueTune

BlueTune adalah aplikasi desktop Local Music Player premium.

Seluruh aplikasi berjalan secara offline.

Tidak menggunakan backend.

Tidak menggunakan database.

Semua data disimpan dalam file JSON.

---

## Stack

Electron

React 19

TypeScript

Vite

TailwindCSS

Framer Motion

Zustand

NodeJS

WaveSurfer.js

Web Audio API

Lucide Icons

music-metadata

chokidar

---

## Goal

Buat aplikasi yang terasa seperti:

Apple Music

Spotify Desktop

Poweramp

MusicBee

---

## Rules

- Strict TypeScript
- ESLint
- Prettier
- SOLID
- Clean Architecture
- Reusable Components
- No duplicated code
- Functional React Components
- Hooks only
- No class component
- Use Zustand
- Use React Router
- Every feature must be modular

---

## Data

Tidak boleh memakai

MySQL

SQLite

MongoDB

Server

Semua data berupa

library.json

history.json

favorites.json

playlist.json

settings.json

---

## Features

- Music Scanner
- Lyrics
- Waveform
- Visualizer
- Playlist
- Search
- Queue
- Recently Played
- Favorites
- Dynamic Theme
- Equalizer
- Mini Player
- Folder Watch

---

## Audio

Never re-encode audio.

Always play original file.

Support

FLAC

MP3

AAC

ALAC

M4A

OGG

WAV

---

## UI

Gunakan UI_GUIDE.md sebagai acuan utama.

Semua komponen harus reusable.

Seluruh animasi menggunakan Framer Motion.

Target 60 FPS.

---

## Workflow

Ikuti TASKS.md.

Jangan melompat phase.

Kerjakan satu phase sampai selesai.

Review kode.

Optimasi.

Lanjut phase berikutnya.

Jangan berhenti sampai project selesai.