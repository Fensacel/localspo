# Architecture

bluetune menggunakan Clean Architecture.

```
Electron Main Process
            │
            ▼
Electron IPC
            │
            ▼
React Renderer
            │
            ▼
Feature Layer
            │
            ▼
Service Layer
            │
            ▼
Storage Layer
```

---

## Folder

```
src/

app/

components/

features/

hooks/

layouts/

pages/

services/

stores/

types/

utils/

assets/

electron/

cache/

config/

public/
```

---

## Storage

```
bluetune/

library.json

history.json

playlist.json

favorites.json

settings.json

cache/

cover/

lyrics/
```

---

## Scanner

Folder Music

↓

Recursive Scan

↓

Metadata

↓

library.json

↓

React

---

## Player

Audio Engine

↓

Queue

↓

Waveform

↓

Visualizer

↓

Lyrics

---

## Lyrics

Embedded

↓

LRC

↓

None

---

## Theme

Blue Theme

↓

Album Color Extract

↓

Dynamic Background

---

## State

React

↓

Zustand

↓

Components

---

## Services

ScannerService

PlayerService

LyricsService

PlaylistService

SettingsService

ThemeService

LibraryService

CacheService

---

## Performance

Virtual List

Lazy Image

Memoization

Background Scan

Cache

Debounce

GPU Animation

60 FPS

---

## Security

Sandbox

Context Isolation

IPC Validation

No Node Access di Renderer

Safe File Access