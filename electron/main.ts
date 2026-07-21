import { app, BrowserWindow, ipcMain, dialog, protocol, net } from 'electron';
import { autoUpdater } from 'electron-updater';
import path from 'path';
import fs from 'fs';
import { fileURLToPath, pathToFileURL } from 'url';
import { registerScannerIpc } from './scanner';
import { registerDownloaderIpc } from './ipc/downloaderIpc';
import { registerPlaylistSyncIpc } from './ipc/playlistSyncIpc';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

let mainWindow: BrowserWindow | null = null;

// Register custom protocol privileges before app ready
protocol.registerSchemesAsPrivileged([
  {
    scheme: 'local-audio',
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      stream: true,
      bypassCSP: true,
      corsEnabled: true,
    },
  },
  {
    scheme: 'local-image',
    privileges: {
      standard: false,
      secure: true,
      supportFetchAPI: true,
      bypassCSP: true,
      corsEnabled: true,
    },
  },
]);

const DIST = path.join(__dirname, '../dist');
const ELECTRON_DIST = path.join(__dirname);
const VITE_DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL;

function getDataPath(): string {
  const dataPath = path.join(app.getPath('userData'), 'localspo');
  if (!fs.existsSync(dataPath)) {
    fs.mkdirSync(dataPath, { recursive: true });
  }
  return dataPath;
}

function ensureDataFiles(): void {
  const dataPath = getDataPath();
  const files = ['library.json', 'history.json', 'favorites.json', 'playlist.json', 'settings.json', 'cache.json'];

  for (const file of files) {
    const filePath = path.join(dataPath, file);
    if (!fs.existsSync(filePath)) {
      const defaultData = file === 'settings.json'
        ? JSON.stringify({ musicFolders: [], theme: 'calm-monochrome', accentColor: '#FFFFFF', gapless: true, crossfade: false, crossfadeDuration: 3, visualizer: 'spectrum', lyricsEnabled: true, seekByLyricsEnabled: true, equalizerPreset: 'flat', equalizerBands: [0,0,0,0,0,0,0,0,0,0] }, null, 2)
        : file === 'library.json'
        ? JSON.stringify({ songs: [], albums: [], artists: [], lastScan: null }, null, 2)
        : file === 'playlist.json'
        ? JSON.stringify({ playlists: [] }, null, 2)
        : file === 'favorites.json'
        ? JSON.stringify({ songIds: [], albumIds: [], artistIds: [] }, null, 2)
        : file === 'history.json'
        ? JSON.stringify({ entries: [] }, null, 2)
        : JSON.stringify({}, null, 2);
      fs.writeFileSync(filePath, defaultData, 'utf-8');
    }
  }

  const cacheDirs = ['cover', 'lyrics', 'waveform'];
  for (const dir of cacheDirs) {
    const dirPath = path.join(dataPath, 'cache', dir);
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }
  }
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    frame: false,
    titleBarStyle: 'hidden',
    transparent: false,
    backgroundColor: '#09090b',
    show: false,
    webPreferences: {
      preload: path.join(ELECTRON_DIST, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      webSecurity: true,
    },
    icon: path.join(DIST, 'logo.png'),
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
  });

  if (VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(VITE_DEV_SERVER_URL);
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(DIST, 'index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// Helper to serve local files with byte-range support for seeking
function serveLocalFile(filePath: string, request: Request): Response {
  const stat = fs.statSync(filePath);
  const fileSize = stat.size;
  const range = request.headers.get('range');

  let contentType = 'audio/mpeg';
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.flac') contentType = 'audio/flac';
  else if (ext === '.wav') contentType = 'audio/wav';
  else if (ext === '.ogg' || ext === '.oga') contentType = 'audio/ogg';
  else if (ext === '.m4a') contentType = 'audio/mp4';
  else if (ext === '.mp3') contentType = 'audio/mpeg';

  if (range) {
    const parts = range.replace(/bytes=/, "").split("-");
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
    const chunksize = (end - start) + 1;
    const fileStream = fs.createReadStream(filePath, { start, end });
    return new Response(fileStream as any, {
      status: 206,
      statusText: 'Partial Content',
      headers: {
        'Content-Range': `bytes ${start}-${end}/${fileSize}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': String(chunksize),
        'Content-Type': contentType,
      }
    });
  } else {
    const fileStream = fs.createReadStream(filePath);
    return new Response(fileStream as any, {
      status: 200,
      headers: {
        'Content-Length': String(fileSize),
        'Accept-Ranges': 'bytes',
        'Content-Type': contentType,
      }
    });
  }
}

// Register protocol for local audio files using native net.fetch for robust range support & stream cancellation
function registerLocalProtocol(): void {
  // Prevent uncaught stream cancellation popups from undici/webstreams
  process.on('uncaughtException', (err) => {
    if (err && err.message && err.message.includes('ReadableStream')) {
      console.warn('[MainProcess] Ignored ReadableStream cancellation:', err.message);
      return;
    }
    console.error('[MainProcess] Uncaught Exception:', err);
  });

  process.on('unhandledRejection', (reason) => {
    console.warn('[MainProcess] Unhandled Rejection:', reason);
  });

  protocol.handle('local-audio', (request) => {
    try {
      let filePath = '';
      if (request.url.startsWith('local-audio://local/')) {
        filePath = request.url.slice('local-audio://local/'.length);
      } else if (request.url.startsWith('local-audio://')) {
        filePath = request.url.slice('local-audio://'.length);
      } else {
        filePath = request.url.slice('local-audio:'.length);
      }
      filePath = decodeURIComponent(filePath);
      if (filePath.startsWith('/') && process.platform === 'win32') {
        filePath = filePath.slice(1);
      }
      const resolvedPath = path.resolve(filePath);
      return serveLocalFile(resolvedPath, request);
    } catch (err) {
      console.error('[local-audio] Error serving audio file:', err);
      return new Response('File error', { status: 500 });
    }
  });

  protocol.handle('local-image', (request) => {
    try {
      let filePath = '';
      if (request.url.startsWith('local-image://local/')) {
        filePath = request.url.slice('local-image://local/'.length);
      } else if (request.url.startsWith('local-image://')) {
        filePath = request.url.slice('local-image://'.length);
      } else {
        filePath = request.url.slice('local-image:'.length);
      }
      filePath = decodeURIComponent(filePath);
      if (filePath.startsWith('/') && process.platform === 'win32') {
        filePath = filePath.slice(1);
      }
      const resolvedPath = path.resolve(filePath);
      const fileUrl = pathToFileURL(resolvedPath).toString();
      return net.fetch(fileUrl, { bypassCustomProtocolHandlers: true });
    } catch (err) {
      console.error('[local-image] Error serving image file:', err);
      return new Response('Image error', { status: 500 });
    }
  });
}

// ─── Auto Updater Setup ─────────────────────────────────

function setupAutoUpdater(): void {
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  const sendUpdateStatus = (data: { status: string; version?: string; percent?: number; error?: string }) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('updater:status', data);
    }
  };

  autoUpdater.on('checking-for-update', () => {
    sendUpdateStatus({ status: 'checking' });
  });

  autoUpdater.on('update-available', (info) => {
    sendUpdateStatus({ status: 'available', version: info.version });
  });

  autoUpdater.on('update-not-available', (info) => {
    sendUpdateStatus({ status: 'not-available', version: info.version });
  });

  autoUpdater.on('error', (err) => {
    sendUpdateStatus({ status: 'error', error: err?.message || 'Update check failed' });
  });

  autoUpdater.on('download-progress', (progressObj) => {
    sendUpdateStatus({
      status: 'downloading',
      percent: Math.round(progressObj.percent),
    });
  });

  autoUpdater.on('update-downloaded', (info) => {
    sendUpdateStatus({ status: 'downloaded', version: info.version });
  });
}

// ─── IPC Handlers ───────────────────────────────────────

function registerIpcHandlers(): void {
  // Window controls
  ipcMain.on('window:minimize', () => mainWindow?.minimize());
  ipcMain.on('window:maximize', () => {
    if (mainWindow?.isMaximized()) {
      mainWindow.unmaximize();
    } else {
      mainWindow?.maximize();
    }
  });
  ipcMain.on('window:close', () => mainWindow?.close());
  ipcMain.handle('window:isMaximized', () => mainWindow?.isMaximized() ?? false);

  // Dialogs
  ipcMain.handle('dialog:openFolder', async () => {
    const result = await dialog.showOpenDialog(mainWindow!, {
      properties: ['openDirectory'],
      title: 'Select Music Folder',
    });
    return result.canceled ? null : result.filePaths[0];
  });

  ipcMain.handle('dialog:openImage', async () => {
    const result = await dialog.showOpenDialog(mainWindow!, {
      properties: ['openFile'],
      title: 'Select Playlist Cover Image',
      filters: [{ name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'webp', 'gif', 'avif'] }],
    });
    if (result.canceled || result.filePaths.length === 0) return null;
    const src = result.filePaths[0];
    const ext = path.extname(src);
    const destDir = path.join(getDataPath(), 'covers');
    if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });
    const destName = `cover_${Date.now()}_${Math.random().toString(36).slice(2, 7)}${ext}`;
    const destPath = path.join(destDir, destName);
    fs.copyFileSync(src, destPath);
    return destPath.replace(/\\/g, '/');
  });

  // Auto Updater IPC
  ipcMain.handle('updater:check', async () => {
    if (!app.isPackaged) {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('updater:status', { status: 'not-available', version: app.getVersion() });
      }
      return { status: 'dev-mode' };
    }
    try {
      return await autoUpdater.checkForUpdates();
    } catch (err: any) {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('updater:status', { status: 'error', error: err?.message || 'Check failed' });
      }
      return null;
    }
  });

  ipcMain.handle('updater:download', async () => {
    try {
      return await autoUpdater.downloadUpdate();
    } catch (err: any) {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('updater:status', { status: 'error', error: err?.message || 'Download failed' });
      }
      return null;
    }
  });

  ipcMain.on('updater:quitAndInstall', () => {
    autoUpdater.quitAndInstall();
  });

  // App version & paths
  ipcMain.handle('app:getVersion', () => app.getVersion());
  ipcMain.handle('app:getDataPath', () => getDataPath());
  ipcMain.handle('app:getUserDataPath', () => app.getPath('userData'));

  // Data persistence
  ipcMain.handle('data:read', async (_event, fileName: string) => {
    try {
      const safeFileName = path.basename(fileName);
      const filePath = path.join(getDataPath(), safeFileName);
      if (!fs.existsSync(filePath)) return null;
      const content = fs.readFileSync(filePath, 'utf-8');
      return JSON.parse(content);
    } catch (err) {
      console.error(`Error reading data file ${fileName}:`, err);
      return null;
    }
  });

  ipcMain.handle('data:write', async (_event, fileName: string, data: unknown) => {
    try {
      const dataPath = getDataPath();
      if (!fs.existsSync(dataPath)) {
        fs.mkdirSync(dataPath, { recursive: true });
      }
      const safeFileName = path.basename(fileName);
      const filePath = path.join(dataPath, safeFileName);
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
      return true;
    } catch (err) {
      console.error(`Error writing data file ${fileName}:`, err);
      return false;
    }
  });

  // File operations
  ipcMain.handle('fs:readFile', async (_event, filePath: string) => {
    if (!fs.existsSync(filePath)) return null;
    return fs.readFileSync(filePath);
  });

  ipcMain.handle('fs:exists', async (_event, filePath: string) => {
    return fs.existsSync(filePath);
  });

  ipcMain.handle('fs:readDir', async (_event, dirPath: string) => {
    if (!fs.existsSync(dirPath)) return [];
    return fs.readdirSync(dirPath, { withFileTypes: true }).map(entry => ({
      name: entry.name,
      isDirectory: entry.isDirectory(),
      path: path.join(dirPath, entry.name),
    }));
  });

  ipcMain.handle('fs:stat', async (_event, filePath: string) => {
    if (!fs.existsSync(filePath)) return null;
    const stat = fs.statSync(filePath);
    return { size: stat.size, mtime: stat.mtimeMs };
  });

  ipcMain.handle('fs:writeFile', async (_event, filePath: string, data: Buffer | string) => {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(filePath, data);
    return true;
  });

  // Path utilities
  ipcMain.handle('path:join', async (_event, ...segments: string[]) => {
    return path.join(...segments);
  });

  ipcMain.handle('path:basename', async (_event, filePath: string) => {
    return path.basename(filePath);
  });

  ipcMain.handle('path:dirname', async (_event, filePath: string) => {
    return path.dirname(filePath);
  });

  ipcMain.handle('path:extname', async (_event, filePath: string) => {
    return path.extname(filePath).toLowerCase();
  });
}

// ─── App Lifecycle ──────────────────────────────────────

app.whenReady().then(() => {
  registerLocalProtocol();
  ensureDataFiles();
  registerIpcHandlers();
  registerScannerIpc(getDataPath);
  const downloaderService = registerDownloaderIpc(getDataPath);
  registerPlaylistSyncIpc(getDataPath, downloaderService);
  setupAutoUpdater();
  createWindow();

  // Check for updates automatically in packaged build
  if (app.isPackaged) {
    autoUpdater.checkForUpdatesAndNotify().catch((err) => {
      console.warn('[AutoUpdater] Failed auto-check:', err);
    });
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
