import { ipcMain, BrowserWindow } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

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
        if (SUPPORTED_EXTENSIONS.has(ext)) {
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
    const mm = await import('music-metadata');
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
      embeddedLyrics = common.lyrics.join('\n');
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
      let library: { songs: unknown[]; albums: unknown[]; artists: unknown[]; lastScan: number | null } = {
        songs: [], albums: [], artists: [], lastScan: null,
      };
      if (fs.existsSync(libraryPath)) {
        try {
          library = JSON.parse(fs.readFileSync(libraryPath, 'utf-8'));
        } catch {
          // Reset if corrupted
        }
      }

      const existingHashes = new Set(
        (library.songs as Array<{ hash: string }>).map((s) => s.hash),
      );

      const songs: Array<Record<string, unknown>> = [...(library.songs as Array<Record<string, unknown>>)];
      const albumMap = new Map<string, Record<string, unknown>>();
      const artistMap = new Map<string, Record<string, unknown>>();

      // Reconstruct existing maps
      for (const album of library.albums as Array<Record<string, unknown>>) {
        albumMap.set(album['id'] as string, album);
      }
      for (const artist of library.artists as Array<Record<string, unknown>>) {
        artistMap.set(artist['id'] as string, artist);
      }

      // Process new files
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

        // Skip duplicates
        if (existingHashes.has(meta.hash)) continue;
        existingHashes.add(meta.hash);

        const songId = meta.hash;

        // Create album ID
        const albumKey = `${meta.album.toLowerCase()}::${meta.albumArtist.toLowerCase()}`;
        const albumId = crypto.createHash('md5').update(albumKey).digest('hex').slice(0, 12);

        // Create artist ID
        const artistKey = `artist::${meta.artist.toLowerCase()}`;
        const artistId = crypto.createHash('md5').update(artistKey).digest('hex').slice(0, 12);

        // Create album artist ID
        const albumArtistKey = `artist::${meta.albumArtist.toLowerCase()}`;
        const albumArtistId = crypto.createHash('md5').update(albumArtistKey).digest('hex').slice(0, 12);

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
        } else {
          coverPath = findCoverFile(meta.path);
        }

        const song = {
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
          addedAt: Date.now(),
          playCount: 0,
        };

        songs.push(song);

        // Update album map
        if (!albumMap.has(albumId)) {
          albumMap.set(albumId, {
            id: albumId,
            name: meta.album,
            artist: meta.albumArtist,
            albumArtist: meta.albumArtist,
            year: meta.year,
            genre: meta.genre,
            coverPath,
            songIds: [songId],
            totalDuration: meta.duration,
            trackCount: 1,
            discCount: meta.disc,
          });
        } else {
          const existing = albumMap.get(albumId)!;
          const songIds = existing['songIds'] as string[];
          if (!songIds.includes(songId)) {
            songIds.push(songId);
            existing['totalDuration'] = (existing['totalDuration'] as number) + meta.duration;
            existing['trackCount'] = songIds.length;
            existing['discCount'] = Math.max(existing['discCount'] as number, meta.disc);
            if (!existing['coverPath'] && coverPath) existing['coverPath'] = coverPath;
          }
        }

        // Update artist map
        if (!artistMap.has(artistId)) {
          artistMap.set(artistId, {
            id: artistId,
            name: meta.artist,
            coverPath: coverPath,
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

        // Handle albumArtist if different from artist
        if (albumArtistId !== artistId && !artistMap.has(albumArtistId)) {
          artistMap.set(albumArtistId, {
            id: albumArtistId,
            name: meta.albumArtist,
            coverPath,
            albumIds: [albumId],
            songIds: [songId],
            totalSongs: 1,
            totalAlbums: 1,
          });
        }
      }

      // Save library
      library = {
        songs,
        albums: Array.from(albumMap.values()),
        artists: Array.from(artistMap.values()),
        lastScan: Date.now(),
      };

      fs.writeFileSync(libraryPath, JSON.stringify(library, null, 2), 'utf-8');

      mainWindow?.webContents.send('scanner:progress', {
        status: 'done',
        message: `Scan complete! ${songs.length} songs in library.`,
        totalFiles: files.length,
        processedFiles: files.length,
        currentFile: '',
      });

      return library;
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
      return JSON.parse(fs.readFileSync(libraryPath, 'utf-8'));
    } catch {
      return null;
    }
  });

  // Read lyrics
  ipcMain.handle('lyrics:read', async (_event, songId: string, lrcPath: string | null, hasEmbeddedLyrics: boolean) => {
    const dataPath = getDataPath();

    // Try embedded lyrics from cache first
    if (hasEmbeddedLyrics) {
      const cachedPath = path.join(dataPath, 'cache', 'lyrics', `${songId}.txt`);
      if (fs.existsSync(cachedPath)) {
        return { source: 'embedded', content: fs.readFileSync(cachedPath, 'utf-8') };
      }
    }

    // Try LRC file second (synced)
    if (lrcPath && fs.existsSync(lrcPath)) {
      return { source: 'lrc', content: fs.readFileSync(lrcPath, 'utf-8') };
    }

    return null;
  });
}
