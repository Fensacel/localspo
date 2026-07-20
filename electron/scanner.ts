import { ipcMain, BrowserWindow } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { getBinaryPaths } from './downloader/binaryManager';
import { AudioTagger } from './downloader/tagger';

const SUPPORTED_EXTENSIONS = new Set([
  '.flac', '.mp3', '.aac', '.alac', '.wav', '.aiff', '.ogg', '.m4a',
]);

interface ScanResult {
  filePath: string;
  hash: string;
  size: number;
  ext: string;
}

interface RawMetadata {
  title: string;
  artist: string;
  album: string;
  albumArtist: string;
  genre: string;
  disc: number;
  track: number;
  year: number;
  duration: number;
  bitrate: number;
  bitDepth: number;
  sampleRate: number;
  codec: string;
  channels: number;
  path: string;
  fileSize: number;
  hash: string;
  coverData: { data: Buffer; format: string } | null;
  embeddedLyrics: string | null;
  lrcPath: string | null;

  // Extended ID3 Metadata
  composer?: string;
  conductor?: string;
  copyright?: string;
  publisher?: string;
  isrc?: string;
  encodedBy?: string;
  grouping?: string;
  subtitle?: string;
  comment?: string;
  bpm?: number;
  key?: string;
  originalArtist?: string;
  remixer?: string;
}

function getFileHash(filePath: string): string {
  const buffer = fs.readFileSync(filePath);
  return crypto.createHash('md5').update(buffer).digest('hex');
}

function findLrcFile(audioPath: string): string | null {
  const dir = path.dirname(audioPath);
  const baseName = path.basename(audioPath, path.extname(audioPath));
  const lrcPath = path.join(dir, `${baseName}.lrc`);
  return fs.existsSync(lrcPath) ? lrcPath : null;
}

function findCoverFile(audioPath: string): string | null {
  const dir = path.dirname(audioPath);
  const coverNames = ['cover.jpg', 'cover.jpeg', 'cover.png', 'folder.jpg', 'folder.jpeg', 'folder.png', 'front.jpg', 'front.jpeg', 'front.png', 'album.jpg', 'album.jpeg', 'album.png'];

  for (const name of coverNames) {
    const coverPath = path.join(dir, name);
    if (fs.existsSync(coverPath)) return coverPath;
  }
  return null;
}

function formatEmbeddedLyrics(lyrics: any[]): string | null {
  const parts: string[] = [];

  for (const lyric of lyrics) {
    if (typeof lyric === 'string') {
      parts.push(lyric);
    } else if (lyric && typeof lyric === 'object') {
      if (Array.isArray(lyric.syncText) && lyric.syncText.length > 0) {
        // Synchronized lyrics
        const lrcLines = lyric.syncText.map((line: any) => {
          const timestamp = line.timestamp || 0;
          const mm = String(Math.floor(timestamp / 60000)).padStart(2, '0');
          const ss = String(Math.floor((timestamp % 60000) / 1000)).padStart(2, '0');
          const xx = String(Math.floor((timestamp % 1000) / 10)).padStart(2, '0');
          return `[${mm}:${ss}.${xx}]${line.text || ''}`;
        });
        parts.push(lrcLines.join('\n'));
      } else if (typeof lyric.text === 'string' && lyric.text.trim()) {
        // Plain text lyrics
        parts.push(lyric.text);
      }
    }
  }

  const result = parts.join('\n').trim();
  return result.length > 0 ? result : null;
}


async function scanDirectory(dirPath: string): Promise<string[]> {
  const results: string[] = [];

  async function walk(dir: string): Promise<void> {
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        await walk(fullPath);
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name).toLowerCase();
        const lowerName = entry.name.toLowerCase();
        if (
          SUPPORTED_EXTENSIONS.has(ext) &&
          !lowerName.includes('_temp_') &&
          !lowerName.includes('_tagged_') &&
          !lowerName.startsWith('.') &&
          !lowerName.endsWith('.tmp')
        ) {
          results.push(fullPath);
        }
      }
    }
  }

  await walk(dirPath);
  return results;
}

async function readMetadata(filePath: string, cachePath: string): Promise<RawMetadata | null> {
  try {
    // Dynamic import to handle ESM module
    const mm = (await import('music-metadata')) as any;
    const metadata = await mm.parseFile(filePath);
    const stat = fs.statSync(filePath);

    const common = metadata.common;
    const format = metadata.format;

    // Extract cover data
    let coverData: { data: Buffer; format: string } | null = null;
    if (common.picture && common.picture.length > 0) {
      const pic = common.picture[0];
      coverData = { data: Buffer.from(pic.data), format: pic.format };
    }

    // Extract embedded lyrics
    let embeddedLyrics: string | null = null;
    if (common.lyrics && common.lyrics.length > 0) {
      embeddedLyrics = formatEmbeddedLyrics(common.lyrics);
    }


    // Find LRC file
    const lrcPath = findLrcFile(filePath);

    // Determine codec
    let codec = format.codec || path.extname(filePath).replace('.', '').toUpperCase();
    if (codec === 'MPEG 1 Layer 3') codec = 'MP3';
    if (codec.includes('FLAC')) codec = 'FLAC';
    if (codec.includes('AAC')) codec = 'AAC';
    if (codec.includes('ALAC')) codec = 'ALAC';
    if (codec.includes('Vorbis')) codec = 'OGG';
    if (codec.includes('PCM')) codec = 'WAV';

    // Generate hash
    const hash = crypto.createHash('md5')
      .update(`${filePath}:${stat.size}:${stat.mtimeMs}`)
      .digest('hex');

    // Save cover to cache if embedded
    let savedCoverPath: string | null = null;
    if (coverData) {
      const ext = coverData.format.includes('png') ? 'png' : 'jpg';
      const coverFileName = `${hash}.${ext}`;
      const coverDir = path.join(cachePath, 'cache', 'cover');
      if (!fs.existsSync(coverDir)) fs.mkdirSync(coverDir, { recursive: true });
      savedCoverPath = path.join(coverDir, coverFileName);
      if (!fs.existsSync(savedCoverPath)) {
        fs.writeFileSync(savedCoverPath, coverData.data);
      }
    } else {
      // Try folder cover
      savedCoverPath = findCoverFile(filePath);
    }

    // Helper to safely get string from metadata array or string
    const getString = (val: any): string => {
      if (!val) return '';
      if (Array.isArray(val)) return val[0] ? String(val[0]) : '';
      return String(val);
    };

    const commentVal = common.comment?.[0] || (typeof common.comments === 'string' ? common.comments : (common.comments as any)?.[0]?.text) || '';

    return {
      title: common.title || path.basename(filePath, path.extname(filePath)),
      artist: common.artist || common.albumartist || 'Unknown Artist',
      album: common.album || 'Unknown Album',
      albumArtist: common.albumartist || common.artist || 'Unknown Artist',
      genre: common.genre?.[0] || '',
      disc: common.disk?.no || 1,
      track: common.track?.no || 0,
      year: common.year || 0,
      duration: format.duration || 0,
      bitrate: Math.round((format.bitrate || 0) / 1000),
      bitDepth: format.bitsPerSample || 0,
      sampleRate: format.sampleRate || 0,
      codec,
      channels: format.numberOfChannels || 2,
      path: filePath,
      fileSize: stat.size,
      hash,
      coverData,
      embeddedLyrics,
      lrcPath,

      // Extended ID3 Metadata
      composer: getString(common.composer),
      conductor: getString(common.conductor),
      copyright: common.copyright || '',
      publisher: getString(common.label || common.publisher),
      isrc: getString(common.isrc),
      encodedBy: common.encodedby || '',
      grouping: common.grouping || '',
      subtitle: getString(common.subtitle),
      comment: String(commentVal),
      bpm: common.bpm ? Number(common.bpm) : undefined,
      key: common.key || '',
      originalArtist: common.originalartist || '',
      remixer: getString(common.remixer),
    };
  } catch (err) {
    console.error(`Error reading metadata for ${filePath}:`, err);
    return null;
  }
}

export function registerScannerIpc(getDataPath: () => string): void {
  ipcMain.handle('scanner:scan', async (_event, folderPath: string) => {
    const mainWindow = BrowserWindow.getAllWindows()[0];
    const dataPath = getDataPath();

    try {
      // Send scanning status
      mainWindow?.webContents.send('scanner:progress', {
        status: 'scanning',
        message: `Scanning ${folderPath}...`,
        totalFiles: 0,
        processedFiles: 0,
        currentFile: '',
      });

      // Scan for audio files
      const files = await scanDirectory(folderPath);

      mainWindow?.webContents.send('scanner:progress', {
        status: 'processing',
        message: `Found ${files.length} audio files`,
        totalFiles: files.length,
        processedFiles: 0,
        currentFile: '',
      });

      // Read existing library
      const libraryPath = path.join(dataPath, 'library.json');
      let library: { songs: Record<string, unknown>[]; albums: unknown[]; artists: unknown[]; lastScan: number | null } = {
        songs: [], albums: [], artists: [], lastScan: null,
      };
      if (fs.existsSync(libraryPath)) {
        try {
          library = JSON.parse(fs.readFileSync(libraryPath, 'utf-8'));
        } catch {
          // Reset if corrupted
        }
      }

      // Map valid existing songs by path
      const songMapByPath = new Map<string, Record<string, unknown>>();
      if (Array.isArray(library.songs)) {
        for (const s of library.songs) {
          const p = s['path'] as string;
          if (p && fs.existsSync(p)) {
            const lower = p.toLowerCase();
            if (!lower.includes('_temp_') && !lower.includes('_tagged_') && !lower.endsWith('.tmp')) {
              songMapByPath.set(p, s);
            }
          }
        }
      }

      // Process scanned files
      let processed = 0;
      for (const filePath of files) {
        processed++;

        mainWindow?.webContents.send('scanner:progress', {
          status: 'processing',
          message: `Processing ${processed}/${files.length}`,
          totalFiles: files.length,
          processedFiles: processed,
          currentFile: path.basename(filePath),
        });

        const meta = await readMetadata(filePath, dataPath);
        if (!meta) continue;

        const songId = meta.hash;

        // Save embedded lyrics to cache
        if (meta.embeddedLyrics) {
          const lyricsDir = path.join(dataPath, 'cache', 'lyrics');
          if (!fs.existsSync(lyricsDir)) fs.mkdirSync(lyricsDir, { recursive: true });
          const lyricsCachePath = path.join(lyricsDir, `${songId}.txt`);
          fs.writeFileSync(lyricsCachePath, meta.embeddedLyrics, 'utf-8');
        }

        // Determine cover path
        let coverPath: string | null = null;
        if (meta.coverData) {
          const ext = meta.coverData.format.includes('png') ? 'png' : 'jpg';
          coverPath = path.join(dataPath, 'cache', 'cover', `${meta.hash}.${ext}`);
          const coverDir = path.dirname(coverPath);
          if (!fs.existsSync(coverDir)) fs.mkdirSync(coverDir, { recursive: true });
          try {
            fs.writeFileSync(coverPath, meta.coverData.data);
          } catch {}
        } else {
          coverPath = findCoverFile(meta.path);
        }

        const existingSong = songMapByPath.get(filePath);

        const songObj = {
          id: songId,
          title: meta.title,
          artist: meta.artist,
          album: meta.album,
          albumArtist: meta.albumArtist,
          genre: meta.genre,
          disc: meta.disc,
          track: meta.track,
          year: meta.year,
          duration: meta.duration,
          bitrate: meta.bitrate,
          bitDepth: meta.bitDepth,
          sampleRate: meta.sampleRate,
          codec: meta.codec,
          channels: meta.channels,
          path: meta.path,
          fileSize: meta.fileSize,
          hash: meta.hash,
          coverPath,
          hasEmbeddedCover: meta.coverData !== null,
          hasEmbeddedLyrics: meta.embeddedLyrics !== null,
          lrcPath: meta.lrcPath,
          addedAt: (existingSong?.addedAt as number) || Date.now(),
          playCount: (existingSong?.playCount as number) || 0,
        };

        songMapByPath.set(filePath, songObj);
      }

      const rawSongs = Array.from(songMapByPath.values());
      const uniqueSongMap = new Map<string, Record<string, unknown>>();

      for (const song of rawSongs) {
        const title = ((song['title'] as string) || '').toLowerCase().trim();
        const artist = ((song['artist'] as string) || '').toLowerCase().trim();
        const key = `${artist}::${title}`;

        if (!uniqueSongMap.has(key)) {
          uniqueSongMap.set(key, song);
        } else {
          const existing = uniqueSongMap.get(key)!;
          const hasCoverExisting = !!existing['coverPath'];
          const hasCoverNew = !!song['coverPath'];

          if (!hasCoverExisting && hasCoverNew) {
            uniqueSongMap.set(key, song);
          } else if (hasCoverExisting === hasCoverNew) {
            const bitrateExisting = (existing['bitrate'] as number) || 0;
            const bitrateNew = (song['bitrate'] as number) || 0;
            if (bitrateNew >= bitrateExisting) {
              uniqueSongMap.set(key, song);
            }
          }
        }
      }

      const allSongs = Array.from(uniqueSongMap.values());
      const albumMap = new Map<string, Record<string, unknown>>();
      const artistMap = new Map<string, Record<string, unknown>>();

      // Rebuild album and artist maps from all clean songs
      for (const song of allSongs) {
        const songId = song['id'] as string;
        const albumTitle = (song['album'] as string) || 'Unknown Album';
        const albumArtist = (song['albumArtist'] as string) || (song['artist'] as string) || 'Unknown Artist';
        const songArtist = (song['artist'] as string) || 'Unknown Artist';
        const coverPath = (song['coverPath'] as string | null) || null;
        const duration = (song['duration'] as number) || 0;
        const disc = (song['disc'] as number) || 1;

        // Album ID
        const albumKey = `${albumTitle.toLowerCase()}::${albumArtist.toLowerCase()}`;
        const albumId = crypto.createHash('md5').update(albumKey).digest('hex').slice(0, 12);

        // Artist ID
        const artistKey = `artist::${songArtist.toLowerCase()}`;
        const artistId = crypto.createHash('md5').update(artistKey).digest('hex').slice(0, 12);

        // Album Artist ID
        const albumArtistKey = `artist::${albumArtist.toLowerCase()}`;
        const albumArtistId = crypto.createHash('md5').update(albumArtistKey).digest('hex').slice(0, 12);

        // Update album map
        if (!albumMap.has(albumId)) {
          albumMap.set(albumId, {
            id: albumId,
            name: albumTitle,
            artist: albumArtist,
            albumArtist: albumArtist,
            year: song['year'],
            genre: song['genre'],
            coverPath,
            songIds: [songId],
            totalDuration: duration,
            trackCount: 1,
            discCount: disc,
          });
        } else {
          const existing = albumMap.get(albumId)!;
          const songIds = existing['songIds'] as string[];
          if (!songIds.includes(songId)) {
            songIds.push(songId);
            existing['totalDuration'] = (existing['totalDuration'] as number) + duration;
            existing['trackCount'] = songIds.length;
            existing['discCount'] = Math.max(existing['discCount'] as number, disc);
            if (!existing['coverPath'] && coverPath) existing['coverPath'] = coverPath;
          }
        }

        // Update artist map
        if (!artistMap.has(artistId)) {
          artistMap.set(artistId, {
            id: artistId,
            name: songArtist,
            coverPath,
            albumIds: [albumId],
            songIds: [songId],
            totalSongs: 1,
            totalAlbums: 1,
          });
        } else {
          const existing = artistMap.get(artistId)!;
          const songIds = existing['songIds'] as string[];
          const albumIds = existing['albumIds'] as string[];
          if (!songIds.includes(songId)) {
            songIds.push(songId);
            existing['totalSongs'] = songIds.length;
          }
          if (!albumIds.includes(albumId)) {
            albumIds.push(albumId);
            existing['totalAlbums'] = albumIds.length;
          }
        }

        if (albumArtistId !== artistId && !artistMap.has(albumArtistId)) {
          artistMap.set(albumArtistId, {
            id: albumArtistId,
            name: albumArtist,
            coverPath,
            albumIds: [albumId],
            songIds: [songId],
            totalSongs: 1,
            totalAlbums: 1,
          });
        }
      }

      // Save library
      const newLibrary = {
        songs: allSongs,
        albums: Array.from(albumMap.values()),
        artists: Array.from(artistMap.values()),
        lastScan: Date.now(),
      };

      fs.writeFileSync(libraryPath, JSON.stringify(newLibrary, null, 2), 'utf-8');

      mainWindow?.webContents.send('scanner:progress', {
        status: 'done',
        message: `Scan complete! ${allSongs.length} songs in library.`,
        totalFiles: files.length,
        processedFiles: files.length,
        currentFile: '',
      });

      return newLibrary;
    } catch (err) {
      mainWindow?.webContents.send('scanner:progress', {
        status: 'error',
        message: `Scan failed: ${(err as Error).message}`,
        totalFiles: 0,
        processedFiles: 0,
        currentFile: '',
      });
      throw err;
    }
  });

  // Get library data
  ipcMain.handle('scanner:getLibrary', async () => {
    const libraryPath = path.join(getDataPath(), 'library.json');
    if (!fs.existsSync(libraryPath)) return null;
    try {
      const data = JSON.parse(fs.readFileSync(libraryPath, 'utf-8'));
      if (data && Array.isArray(data.songs)) {
        const validSongs = data.songs.filter((song: any) => {
          if (!song.path || !fs.existsSync(song.path)) return false;
          const lower = song.path.toLowerCase();
          if (lower.includes('_temp_') || lower.includes('_tagged_') || lower.endsWith('.tmp')) return false;
          return true;
        });

        // Deduplicate valid songs by artist + title
        const deduplicatedMap = new Map<string, any>();
        for (const song of validSongs) {
          const title = (song.title || '').toLowerCase().trim();
          const artist = (song.artist || '').toLowerCase().trim();
          const key = `${artist}::${title}`;

          if (!deduplicatedMap.has(key)) {
            deduplicatedMap.set(key, song);
          } else {
            const existing = deduplicatedMap.get(key);
            const hasCoverExisting = !!existing.coverPath;
            const hasCoverNew = !!song.coverPath;

            if (!hasCoverExisting && hasCoverNew) {
              deduplicatedMap.set(key, song);
            } else if (hasCoverExisting === hasCoverNew) {
              const bitrateExisting = existing.bitrate || 0;
              const bitrateNew = song.bitrate || 0;
              if (bitrateNew >= bitrateExisting) {
                deduplicatedMap.set(key, song);
              }
            }
          }
        }

        const cleanSongs = Array.from(deduplicatedMap.values());

        if (cleanSongs.length !== data.songs.length) {
          data.songs = cleanSongs;
          try {
            fs.writeFileSync(libraryPath, JSON.stringify(data, null, 2), 'utf-8');
          } catch (e) {
            console.warn('Failed cleaning library.json:', e);
          }
        }
      }
      return data;
    } catch {
      return null;
    }
  });

  // Read lyrics
  ipcMain.handle('lyrics:read', async (
    _event,
    songId: string,
    audioPath: string,
    lrcPath: string | null,
    hasEmbeddedLyrics: boolean
  ) => {
    const dataPath = getDataPath();

    // Try embedded lyrics from cache first
    if (hasEmbeddedLyrics) {
      const cachedPath = path.join(dataPath, 'cache', 'lyrics', `${songId}.txt`);
      if (fs.existsSync(cachedPath)) {
        const cachedContent = fs.readFileSync(cachedPath, 'utf-8');
        if (cachedContent && cachedContent !== '[object Object]') {
          return { source: 'embedded', content: cachedContent };
        }
      }

      // If cache doesn't exist or is corrupt, parse it on the fly and update cache
      try {
        const mm = (await import('music-metadata')) as any;
        const metadata = await mm.parseFile(audioPath);
        if (metadata.common.lyrics && metadata.common.lyrics.length > 0) {
          const formatted = formatEmbeddedLyrics(metadata.common.lyrics);
          if (formatted) {
            const lyricsDir = path.join(dataPath, 'cache', 'lyrics');
            if (!fs.existsSync(lyricsDir)) fs.mkdirSync(lyricsDir, { recursive: true });
            fs.writeFileSync(cachedPath, formatted, 'utf-8');
            return { source: 'embedded', content: formatted };
          }
        }
      } catch (err) {
        console.error('Error parsing embedded lyrics on the fly:', err);
      }
    }

    // Try LRC file second (synced)
    if (lrcPath && fs.existsSync(lrcPath)) {
      return { source: 'lrc', content: fs.readFileSync(lrcPath, 'utf-8') };
    }

    return null;
  });

  // Update song tags & metadata
  ipcMain.handle('scanner:updateTags', async (_event, payload: {
    songId: string;
    filePath: string;
    title: string;
    artist: string;
    album: string;
    albumArtist?: string;
    year?: number;
    genre?: string;
    coverPath?: string | null;
    lyrics?: string | null;

    // Extended ID3 Metadata
    composer?: string;
    conductor?: string;
    copyright?: string;
    publisher?: string;
    isrc?: string;
    encodedBy?: string;
    grouping?: string;
    subtitle?: string;
    comment?: string;
    bpm?: number;
    key?: string;
    originalArtist?: string;
    remixer?: string;
  }) => {
    const dataPath = getDataPath();
    const binaries = getBinaryPaths(() => dataPath);

    if (!payload.filePath || !fs.existsSync(payload.filePath)) {
      throw new Error('Audio file not found');
    }

    try {
      // 1. Embed tags using AudioTagger
      await AudioTagger.embedTags(payload.filePath, binaries.ffmpeg, {
        title: payload.title,
        artist: payload.artist,
        album: payload.album,
        year: payload.year ? String(payload.year) : undefined,
        coverPath: payload.coverPath || null,
        lyrics: payload.lyrics || null,

        composer: payload.composer,
        conductor: payload.conductor,
        copyright: payload.copyright,
        publisher: payload.publisher,
        isrc: payload.isrc,
        encodedBy: payload.encodedBy,
        grouping: payload.grouping,
        subtitle: payload.subtitle,
        comment: payload.comment,
        bpm: payload.bpm,
        key: payload.key,
        originalArtist: payload.originalArtist,
        remixer: payload.remixer,
      });

      // 2. Read updated metadata
      const meta = await readMetadata(payload.filePath, dataPath);

      // 3. Update library.json
      const libraryPath = path.join(dataPath, 'library.json');
      if (fs.existsSync(libraryPath)) {
        const library = JSON.parse(fs.readFileSync(libraryPath, 'utf-8'));
        if (library && Array.isArray(library.songs)) {
          let updatedCoverPath = payload.coverPath || null;

          if (meta && meta.coverData) {
            const ext = meta.coverData.format.includes('png') ? 'png' : 'jpg';
            const cacheCoverPath = path.join(dataPath, 'cache', 'cover', `${meta.hash}.${ext}`);
            const coverDir = path.dirname(cacheCoverPath);
            if (!fs.existsSync(coverDir)) fs.mkdirSync(coverDir, { recursive: true });
            try {
              fs.writeFileSync(cacheCoverPath, meta.coverData.data);
              updatedCoverPath = cacheCoverPath;
            } catch {}
          }

          const songIndex = library.songs.findIndex(
            (s: any) => s.id === payload.songId || s.path === payload.filePath,
          );

          const updatedSong = {
            ...(songIndex >= 0 ? library.songs[songIndex] : {}),
            id: meta ? meta.hash : payload.songId,
            title: payload.title,
            artist: payload.artist,
            album: payload.album,
            albumArtist: payload.albumArtist || payload.artist,
            genre: payload.genre || '',
            year: payload.year || 0,
            path: payload.filePath,
            coverPath: updatedCoverPath,
            hasEmbeddedCover: !!updatedCoverPath,
            hasEmbeddedLyrics: !!payload.lyrics,

            // Extended ID3 Metadata
            composer: payload.composer || meta?.composer || '',
            conductor: payload.conductor || meta?.conductor || '',
            copyright: payload.copyright || meta?.copyright || '',
            publisher: payload.publisher || meta?.publisher || '',
            isrc: payload.isrc || meta?.isrc || '',
            encodedBy: payload.encodedBy || meta?.encodedBy || '',
            grouping: payload.grouping || meta?.grouping || '',
            subtitle: payload.subtitle || meta?.subtitle || '',
            comment: payload.comment || meta?.comment || '',
            bpm: payload.bpm || meta?.bpm,
            key: payload.key || meta?.key || '',
            originalArtist: payload.originalArtist || meta?.originalArtist || '',
            remixer: payload.remixer || meta?.remixer || '',
          };

          if (songIndex >= 0) {
            library.songs[songIndex] = updatedSong;
          } else {
            library.songs.push(updatedSong);
          }

          // Rebuild albums and artists maps
          const albumMap = new Map<string, Record<string, unknown>>();
          const artistMap = new Map<string, Record<string, unknown>>();

          for (const song of library.songs as Array<Record<string, unknown>>) {
            const songId = song['id'] as string;
            const albumTitle = (song['album'] as string) || 'Unknown Album';
            const albumArtist = (song['albumArtist'] as string) || (song['artist'] as string) || 'Unknown Artist';
            const songArtist = (song['artist'] as string) || 'Unknown Artist';
            const coverPath = (song['coverPath'] as string | null) || null;
            const duration = (song['duration'] as number) || 0;
            const disc = (song['disc'] as number) || 1;

            // Album ID
            const albumKey = `${albumTitle.toLowerCase()}::${albumArtist.toLowerCase()}`;
            const albumId = crypto.createHash('md5').update(albumKey).digest('hex').slice(0, 12);

            // Artist ID
            const artistKey = `artist::${songArtist.toLowerCase()}`;
            const artistId = crypto.createHash('md5').update(artistKey).digest('hex').slice(0, 12);

            // Album Artist ID
            const albumArtistKey = `artist::${albumArtist.toLowerCase()}`;
            const albumArtistId = crypto.createHash('md5').update(albumArtistKey).digest('hex').slice(0, 12);

            // Update album map
            if (!albumMap.has(albumId)) {
              albumMap.set(albumId, {
                id: albumId,
                name: albumTitle,
                artist: albumArtist,
                albumArtist: albumArtist,
                year: song['year'],
                genre: song['genre'],
                coverPath,
                songIds: [songId],
                totalDuration: duration,
                trackCount: 1,
                discCount: disc,
              });
            } else {
              const existing = albumMap.get(albumId)!;
              const songIds = existing['songIds'] as string[];
              if (!songIds.includes(songId)) {
                songIds.push(songId);
                existing['totalDuration'] = (existing['totalDuration'] as number) + duration;
                existing['trackCount'] = songIds.length;
                existing['discCount'] = Math.max(existing['discCount'] as number, disc);
                if (!existing['coverPath'] && coverPath) existing['coverPath'] = coverPath;
              }
            }

            // Update artist map
            if (!artistMap.has(artistId)) {
              artistMap.set(artistId, {
                id: artistId,
                name: songArtist,
                coverPath,
                albumIds: [albumId],
                songIds: [songId],
                totalSongs: 1,
                totalAlbums: 1,
              });
            } else {
              const existing = artistMap.get(artistId)!;
              const songIds = existing['songIds'] as string[];
              const albumIds = existing['albumIds'] as string[];
              if (!songIds.includes(songId)) {
                songIds.push(songId);
                existing['totalSongs'] = songIds.length;
              }
              if (!albumIds.includes(albumId)) {
                albumIds.push(albumId);
                existing['totalAlbums'] = albumIds.length;
              }
            }

            if (albumArtistId !== artistId && !artistMap.has(albumArtistId)) {
              artistMap.set(albumArtistId, {
                id: albumArtistId,
                name: albumArtist,
                coverPath,
                albumIds: [albumId],
                songIds: [songId],
                totalSongs: 1,
                totalAlbums: 1,
              });
            }
          }

          const newLibrary = {
            songs: library.songs,
            albums: Array.from(albumMap.values()),
            artists: Array.from(artistMap.values()),
            lastScan: Date.now(),
          };

          fs.writeFileSync(libraryPath, JSON.stringify(newLibrary, null, 2), 'utf-8');

          // Save lyrics cache if present
          if (payload.lyrics) {
            const lyricsDir = path.join(dataPath, 'cache', 'lyrics');
            if (!fs.existsSync(lyricsDir)) fs.mkdirSync(lyricsDir, { recursive: true });
            const lyricId = meta ? meta.hash : payload.songId;
            fs.writeFileSync(path.join(lyricsDir, `${lyricId}.txt`), payload.lyrics, 'utf-8');
            fs.writeFileSync(path.join(lyricsDir, `${payload.songId}.txt`), payload.lyrics, 'utf-8');
          }

          return { success: true, updatedSong, library: newLibrary };
        }
      }
      return { success: true };
    } catch (err: any) {
      console.error('Error updating song tags:', err);
      throw err;
    }
  });
}

