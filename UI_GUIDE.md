# BlueTune UI Guide

---

# Design Philosophy

BlueTune bukan sekadar music player.

BlueTune harus terasa seperti aplikasi desktop premium.

Keyword

- Elegant
- Minimal
- Modern
- Smooth
- Premium
- Fast
- Blue Neon

Inspirasi

- Apple Music
- Spotify Desktop
- Arc Browser
- Nothing OS
- Windows 11
- Samsung One UI

---

# Theme

Dark Mode Only

Background

#030712

Surface

#0F172A

Card

rgba(17,24,39,.65)

Primary

#3B82F6

Primary Hover

#2563EB

Accent

#60A5FA

Text

#F8FAFC

Secondary Text

#94A3B8

Border

rgba(255,255,255,.08)

Danger

#EF4444

Success

#22C55E

Warning

#FACC15

---

# Dynamic Theme

Background mengikuti warna dominan cover album.

Opacity

15%

Blur

80px

Gradient

Linear

Transisi

700ms

Contoh

Album merah

↓

Background merah transparan

Album biru

↓

Background biru transparan

Album hijau

↓

Background hijau transparan

---

# Window

Frameless Window

Rounded Corner

16px

Custom Titlebar

Transparent

Mica Effect

Shadow

Blur

---

# Layout

```
──────────────────────────────────────────────

Sidebar

───────────────

Main Content

─────────────────────

Now Playing

──────────────────────────────────────────────

Mini Player

──────────────────────────────────────────────
```

---

# Sidebar

Lebar

260px

Glass

Blur

Navigation

🏠 Home

🎵 Songs

💿 Albums

🎤 Artists

❤️ Favorites

📂 Playlists

🕒 History

⚙ Settings

Hover

Blue Glow

Active

Blue Background

Animated Indicator

---

# Home

Hero Banner

Continue Listening

Quick Picks

Recently Played

Recently Added

Top Albums

Top Artists

Random Mix

Favorite Playlist

---

# Album Card

Radius

24px

Hover

Scale

1.03

Shadow

Blue Glow

Animated Border

Glass Background

---

# Song List

Hover

Blue Glass

Active

Animated Left Border

Double Click

Play

Right Click

Context Menu

---

# Search

Glass Search

Realtime

Suggestion

Highlight

Instant

---

# Now Playing

Album Cover

520x520

Rounded

32px

Floating Shadow

Animated Rotation

Background Blur

Waveform

Visualizer

Queue

Lyrics

Audio Info

Codec

Bitrate

Bit Depth

Sample Rate

Channel

Duration

---

# Lyrics

Apple Music Style

Center

Current Line

38px

Bold

Blue Glow

Previous

24px

Gray

Next

24px

Gray

Smooth Auto Scroll

Fade Animation

Word Highlight (optional)

---

# Mini Player

Glass

Blur

90px Height

Play

Pause

Next

Previous

Shuffle

Repeat

Volume

Progress

Queue

Device

Lyrics Toggle

---

# Visualizer

Blue Gradient

Waveform

Spectrum

Particle

Reactive Circle

Audio Reactive Background

Glow Effect

60 FPS

---

# Equalizer

10 Band

Preset

Flat

Rock

Pop

Jazz

Classical

Bass Boost

Treble Boost

Custom

Realtime Preview

---

# Playlist

Cover

Description

Song Count

Duration

Drag Drop

Favorite

Pin

Sort

---

# Settings

Theme

Accent Color

Music Folder

Visualizer

Lyrics

Gapless

Crossfade

Audio Buffer

Equalizer

---

# Notification

Glass Toast

Bottom Right

Rounded

Blur

Slide Animation

---

# Animation

Library

Framer Motion

Transition

250ms

Page

Fade

Slide

Lyrics

Auto Scroll

Album Cover

Rotate Slowly

Button

Ripple

Hover

Scale

1.05

---

# Typography

Font

Inter

Title

700

Subtitle

600

Body

500

Lyrics

700

---

# Icon

Lucide

Stroke

1.8

Rounded

---

# Responsive

Desktop

2560

1920

1600

1440

1366

Laptop

Tablet

---

# Audio Information

Saat lagu diputar tampilkan

FLAC

24 Bit

44.1 kHz

1737 kbps

Lossless

Stereo

Codec

Ukuran File

---

# Empty State

Glass Illustration

Friendly Message

Action Button

---

# UX

Tidak boleh ada loading lama.

Semua transisi maksimal

300ms.

Semua animasi harus 60 FPS.

Semua scroll harus smooth.

---

# Overall Feeling

Blue Neon

Premium

Elegant

Modern

Fast

Desktop Application

Tidak boleh terlihat seperti website.

Harus terasa seperti aplikasi native Windows.