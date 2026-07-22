import http from 'http';
import net from 'net';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import os from 'os';

export interface OBSOverlayConfig {
  enabled: boolean;
  port: number;
  lanAccess: boolean;
  theme: 'classic' | 'spotify' | 'minimal' | 'glass' | 'rgb' | 'neon' | 'transparent' | 'rounded' | 'dark' | 'light';
  fontFamily: string;
  fontSize: 'small' | 'medium' | 'large' | 'xlarge';
  textColor: string;
  accentColor: string;
  bgColor: string;
  bgOpacity: number;
  bgBlur: number;
  cornerRadius: number;
  artworkSize: number;
  artworkShape: 'square' | 'rounded' | 'circle';
  artworkSpin: boolean;
  artworkGlow: boolean;
  showArtwork: boolean;
  showProgressBar: boolean;
  showTime: boolean;
  showLyrics: boolean;
  showNextSong: boolean;
  marqueeText: boolean;
  animation: 'fade' | 'slide' | 'scale' | 'none';
}

export const DEFAULT_OBS_CONFIG: OBSOverlayConfig = {
  enabled: true,
  port: 4785,
  lanAccess: false,
  theme: 'spotify',
  fontFamily: 'Inter, system-ui, sans-serif',
  fontSize: 'medium',
  textColor: '#ffffff',
  accentColor: '#1db954',
  bgColor: '#121212',
  bgOpacity: 85,
  bgBlur: 16,
  cornerRadius: 16,
  artworkSize: 64,
  artworkShape: 'rounded',
  artworkSpin: false,
  artworkGlow: true,
  showArtwork: true,
  showProgressBar: true,
  showTime: true,
  showLyrics: true,
  showNextSong: true,
  marqueeText: true,
  animation: 'slide',
};

export interface OBSStatePayload {
  title: string;
  artist: string;
  album: string;
  artworkUrl: string;
  currentTime: number;
  duration: number;
  progress: number;
  isPlaying: boolean;
  repeatMode: string;
  shuffleMode: string;
  isStreaming: boolean;
  sourceType: string;
  quality: string;
  isFavorite: boolean;
  lyrics: string;
  currentLyric: string;
  nextLyric: string;
  nextSong: { title: string; artist: string; coverUrl?: string } | null;
  config: OBSOverlayConfig;
}

export class OBSServer {
  private server: http.Server | null = null;
  private wsClients: Set<net.Socket> = new Set();
  private getDataPath: () => string;
  private config: OBSOverlayConfig = { ...DEFAULT_OBS_CONFIG };
  private currentState: OBSStatePayload = {
    title: 'No Song Playing',
    artist: 'LocalSpo',
    album: '',
    artworkUrl: '/artwork',
    currentTime: 0,
    duration: 0,
    progress: 0,
    isPlaying: false,
    repeatMode: 'off',
    shuffleMode: 'off',
    isStreaming: false,
    sourceType: 'offline',
    quality: 'High',
    isFavorite: false,
    lyrics: '',
    currentLyric: '',
    nextLyric: '',
    nextSong: null,
    config: { ...DEFAULT_OBS_CONFIG },
  };
  private activeLocalCoverPath: string | null = null;
  private activeRemoteCoverUrl: string | null = null;

  constructor(getDataPath: () => string) {
    this.getDataPath = getDataPath;
    this.loadConfig();
  }

  // ─── Config Storage ────────────────────────────────────────────────────────

  private loadConfig(): void {
    try {
      const configPath = path.join(this.getDataPath(), 'obsConfig.json');
      if (fs.existsSync(configPath)) {
        const raw = fs.readFileSync(configPath, 'utf8');
        const parsed = JSON.parse(raw);
        this.config = { ...DEFAULT_OBS_CONFIG, ...parsed };
      }
    } catch (e) {
      console.warn('[OBSServer] Error loading obsConfig.json:', e);
    }
  }

  private saveConfig(): void {
    try {
      const dir = this.getDataPath();
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      const configPath = path.join(dir, 'obsConfig.json');
      fs.writeFileSync(configPath, JSON.stringify(this.config, null, 2), 'utf8');
    } catch (e) {
      console.error('[OBSServer] Error saving obsConfig.json:', e);
    }
  }

  public getConfig(): OBSOverlayConfig {
    return { ...this.config };
  }

  public updateConfig(newConfig: Partial<OBSOverlayConfig>): OBSOverlayConfig {
    const needRestart =
      (newConfig.port !== undefined && newConfig.port !== this.config.port) ||
      (newConfig.lanAccess !== undefined && newConfig.lanAccess !== this.config.lanAccess) ||
      (newConfig.enabled !== undefined && newConfig.enabled !== this.config.enabled);

    this.config = { ...this.config, ...newConfig };
    this.currentState.config = { ...this.config };
    this.saveConfig();

    if (needRestart) {
      this.restart();
    } else {
      this.broadcastState();
    }

    return this.getConfig();
  }

  // ─── LAN IP Helper ─────────────────────────────────────────────────────────

  public getLanIp(): string | null {
    const interfaces = os.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
      for (const netInterface of interfaces[name] || []) {
        if (netInterface.family === 'IPv4' && !netInterface.internal) {
          return netInterface.address;
        }
      }
    }
    return null;
  }

  public getStatus() {
    const lanIp = this.getLanIp();
    const running = this.server !== null && this.server.listening;
    return {
      running,
      port: this.config.port,
      lanAccess: this.config.lanAccess,
      localUrl: `http://127.0.0.1:${this.config.port}`,
      lanUrl: lanIp ? `http://${lanIp}:${this.config.port}` : null,
      config: this.getConfig(),
    };
  }

  // ─── Server Lifecycle ──────────────────────────────────────────────────────

  public start(): boolean {
    if (this.server) {
      return true; // Already running
    }

    const host = this.config.lanAccess ? '0.0.0.0' : '127.0.0.1';
    const port = this.config.port;

    try {
      this.server = http.createServer((req, res) => this.handleHttpRequest(req, res));

      // Handle WebSocket upgrade
      this.server.on('upgrade', (req, socket: net.Socket, head) => {
        this.handleWsUpgrade(req, socket, head);
      });

      this.server.on('error', (err: any) => {
        console.error('[OBSServer] Server HTTP error:', err);
        if (err.code === 'EADDRINUSE') {
          console.warn(`[OBSServer] Port ${port} in use. Attempting fallback port ${port + 1}...`);
          this.config.port = port + 1;
          this.server = null;
          this.start();
        }
      });

      this.server.listen(port, host, () => {
        console.log(`[OBSServer] Now Playing Overlay server active at http://${host}:${port}`);
      });

      return true;
    } catch (e) {
      console.error('[OBSServer] Failed starting HTTP server:', e);
      this.server = null;
      return false;
    }
  }

  public stop(): boolean {
    if (!this.server) return true;

    // Close all active WebSocket sockets
    for (const socket of this.wsClients) {
      try {
        socket.destroy();
      } catch {}
    }
    this.wsClients.clear();

    try {
      this.server.close();
      this.server = null;
      console.log('[OBSServer] Overlay HTTP server stopped.');
      return true;
    } catch (e) {
      console.error('[OBSServer] Error stopping server:', e);
      this.server = null;
      return false;
    }
  }

  public restart(): boolean {
    this.stop();
    if (this.config.enabled) {
      return this.start();
    }
    return true;
  }

  // ─── State Broadcasting ─────────────────────────────────────────────────────

  public updateState(payload: Partial<OBSStatePayload>, localCoverPath?: string | null, remoteCoverUrl?: string | null): void {
    if (localCoverPath !== undefined) this.activeLocalCoverPath = localCoverPath;
    if (remoteCoverUrl !== undefined) this.activeRemoteCoverUrl = remoteCoverUrl;

    const coverKey = encodeURIComponent(localCoverPath || remoteCoverUrl || payload.title || 'none');
    const artworkUrl = `http://127.0.0.1:${this.config.port}/artwork?v=${coverKey}`;

    this.currentState = {
      ...this.currentState,
      ...payload,
      artworkUrl,
      config: { ...this.config },
    };

    this.broadcastState();
  }

  private broadcastState(): void {
    if (this.wsClients.size === 0) return;

    const json = JSON.stringify(this.currentState);
    const frame = this.buildWsFrame(json);

    for (const socket of Array.from(this.wsClients)) {
      if (socket.writable) {
        socket.write(frame);
      } else {
        this.wsClients.delete(socket);
      }
    }
  }

  // ─── RFC 6455 WebSocket Implementation ──────────────────────────────────────

  private handleWsUpgrade(req: http.IncomingMessage, socket: net.Socket, _head: Buffer): void {
    const key = req.headers['sec-websocket-key'];
    if (!key) {
      socket.destroy();
      return;
    }

    const acceptKey = crypto
      .createHash('sha1')
      .update(key + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11')
      .digest('base64');

    const headers = [
      'HTTP/1.1 101 Switching Protocols',
      'Upgrade: websocket',
      'Connection: Upgrade',
      `Sec-WebSocket-Accept: ${acceptKey}`,
      '\r\n',
    ].join('\r\n');

    socket.write(headers);
    this.wsClients.add(socket);

    // Send initial snapshot immediately upon connection
    const frame = this.buildWsFrame(JSON.stringify(this.currentState));
    socket.write(frame);

    socket.on('close', () => {
      this.wsClients.delete(socket);
    });

    socket.on('error', () => {
      this.wsClients.delete(socket);
      try { socket.destroy(); } catch {}
    });
  }

  private buildWsFrame(text: string): Buffer {
    const payload = Buffer.from(text, 'utf8');
    const length = payload.length;

    let header: Buffer;
    if (length <= 125) {
      header = Buffer.alloc(2);
      header[0] = 0x81; // FIN + Text frame
      header[1] = length;
    } else if (length <= 65535) {
      header = Buffer.alloc(4);
      header[0] = 0x81;
      header[1] = 126;
      header.writeUInt16BE(length, 2);
    } else {
      header = Buffer.alloc(10);
      header[0] = 0x81;
      header[1] = 127;
      header.writeBigUInt64BE(BigInt(length), 2);
    }

    return Buffer.concat([header, payload]);
  }

  // ─── HTTP Requests Routing ──────────────────────────────────────────────────

  private handleHttpRequest(req: http.IncomingMessage, res: http.ServerResponse): void {
    const reqUrl = req.url || '/';
    const parsedUrl = new URL(reqUrl, `http://127.0.0.1:${this.config.port}`);
    const pathname = parsedUrl.pathname;

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', '*');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    if (pathname === '/json') {
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify(this.currentState, null, 2));
      return;
    }

    if (pathname === '/artwork') {
      this.serveArtwork(res);
      return;
    }

    if (pathname === '/compact') {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(this.renderOverlayHtml('compact'));
      return;
    }

    if (pathname === '/lyrics') {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(this.renderOverlayHtml('lyrics'));
      return;
    }

    // Default '/' -> Full Overlay UI
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(this.renderOverlayHtml('full'));
  }

  // ─── Artwork Serving ────────────────────────────────────────────────────────

  private serveArtwork(res: http.ServerResponse): void {
    if (this.activeLocalCoverPath && fs.existsSync(this.activeLocalCoverPath)) {
      try {
        const ext = path.extname(this.activeLocalCoverPath).toLowerCase();
        let mime = 'image/jpeg';
        if (ext === '.png') mime = 'image/png';
        else if (ext === '.webp') mime = 'image/webp';
        else if (ext === '.gif') mime = 'image/gif';

        res.writeHead(200, { 'Content-Type': mime, 'Cache-Control': 'no-cache' });
        fs.createReadStream(this.activeLocalCoverPath).pipe(res);
        return;
      } catch (e) {
        console.warn('[OBSServer] Error serving local cover:', e);
      }
    }

    if (this.activeRemoteCoverUrl) {
      res.writeHead(302, { Location: this.activeRemoteCoverUrl });
      res.end();
      return;
    }

    // SVG Placeholder
    const placeholderSvg = `
      <svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 24 24" fill="none" stroke="#1db954" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="background:#18181b;">
        <circle cx="12" cy="12" r="10" stroke="#27272a" fill="#09090b"/>
        <circle cx="12" cy="12" r="3" fill="#1db954"/>
        <path d="M9 18V5l12-2v13"/>
        <circle cx="6" cy="18" r="3" fill="#1db954"/>
        <circle cx="18" cy="16" r="3" fill="#1db954"/>
      </svg>
    `;
    res.writeHead(200, { 'Content-Type': 'image/svg+xml' });
    res.end(placeholderSvg);
  }

  // ─── Overlay HTML Renderer ──────────────────────────────────────────────────

  private renderOverlayHtml(mode: 'full' | 'compact' | 'lyrics'): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>LocalSpo OBS Overlay</title>
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background: transparent;
      overflow: hidden;
      font-family: var(--font-family, system-ui, sans-serif);
      color: var(--text-color, #ffffff);
      user-select: none;
    }

    /* Overlay Card Themes */
    .card {
      position: relative;
      display: flex;
      align-items: center;
      gap: 16px;
      padding: 16px 20px;
      width: fit-content;
      min-width: 320px;
      max-width: 580px;
      border-radius: var(--corner-radius, 16px);
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    }

    /* Themes */
    .theme-spotify {
      background: rgba(18, 18, 18, calc(var(--bg-opacity, 85) / 100));
      backdrop-filter: blur(calc(var(--bg-blur, 16) * 1px));
      border: 1px solid rgba(255, 255, 255, 0.08);
      box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
    }
    .theme-classic {
      background: rgba(30, 30, 34, calc(var(--bg-opacity, 85) / 100));
      backdrop-filter: blur(calc(var(--bg-blur, 16) * 1px));
      border: 1px solid rgba(255, 255, 255, 0.1);
      box-shadow: 0 8px 24px rgba(0,0,0,0.4);
    }
    .theme-minimal {
      background: rgba(0, 0, 0, 0.4);
      padding: 10px 14px;
      border-radius: 12px;
      border: 1px solid rgba(255, 255, 255, 0.05);
    }
    .theme-glass {
      background: rgba(255, 255, 255, 0.07);
      backdrop-filter: blur(24px) saturate(180%);
      border: 1px solid rgba(255, 255, 255, 0.18);
      box-shadow: 0 12px 40px rgba(0, 0, 0, 0.35);
    }
    .theme-rgb {
      background: #0d0d11;
      border-radius: var(--corner-radius, 16px);
      padding: 16px;
      position: relative;
      z-index: 1;
    }
    .theme-rgb::before {
      content: '';
      position: absolute;
      inset: -2px;
      border-radius: calc(var(--corner-radius, 16px) + 2px);
      background: linear-gradient(45deg, #ff0000, #ff7300, #fffb00, #00ff2b, #00f0ff, #0022ff, #7a00ff, #ff00c8, #ff0000);
      background-size: 400%;
      z-index: -1;
      animation: rgbGlow 12s linear infinite;
    }
    @keyframes rgbGlow {
      0% { background-position: 0 0; }
      50% { background-position: 400% 0; }
      100% { background-position: 0 0; }
    }
    .theme-neon {
      background: rgba(10, 10, 20, 0.85);
      border: 1.5px solid var(--accent-color, #00f0ff);
      box-shadow: 0 0 15px var(--accent-color, #00f0ff), inset 0 0 10px rgba(0, 240, 255, 0.2);
    }
    .theme-transparent {
      background: transparent;
      box-shadow: none;
      border: none;
    }
    .theme-dark {
      background: #09090b;
      border: 1px solid #27272a;
    }
    .theme-light {
      background: rgba(255, 255, 255, 0.9);
      color: #09090b;
      border: 1px solid rgba(0, 0, 0, 0.1);
      box-shadow: 0 10px 25px rgba(0, 0, 0, 0.15);
    }

    /* Artwork */
    .artwork-wrap {
      position: relative;
      width: calc(var(--artwork-size, 64) * 1px);
      height: calc(var(--artwork-size, 64) * 1px);
      flex-shrink: 0;
      overflow: hidden;
    }
    .shape-square { border-radius: 6px; }
    .shape-rounded { border-radius: calc(var(--corner-radius, 16px) * 0.6); }
    .shape-circle { border-radius: 50%; }
    .spin { animation: rotateCover 12s linear infinite; }
    .glow { filter: drop-shadow(0 4px 14px var(--accent-color, #1db954)); }

    @keyframes rotateCover {
      from { transform: rotate(0deg); }
      to { transform: rotate(360deg); }
    }

    .artwork-img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      display: block;
    }

    /* Song Details */
    .info {
      flex: 1;
      min-width: 0;
      display: flex;
      flex-col;
      gap: 4px;
    }

    .title-wrap {
      overflow: hidden;
      white-space: nowrap;
      position: relative;
    }

    .title {
      font-size: 15px;
      font-weight: 800;
      color: var(--text-color, #ffffff);
      letter-spacing: -0.02em;
    }

    .artist {
      font-size: 12px;
      font-weight: 600;
      color: rgba(255, 255, 255, 0.65);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .theme-light .artist { color: rgba(0,0,0,0.6); }

    /* Progress Bar */
    .progress-bar-wrap {
      width: 100%;
      height: 4px;
      background: rgba(255, 255, 255, 0.15);
      border-radius: 99px;
      overflow: hidden;
      margin-top: 6px;
    }
    .theme-light .progress-bar-wrap { background: rgba(0, 0, 0, 0.1); }

    .progress-fill {
      height: 100%;
      background: var(--accent-color, #1db954);
      border-radius: 99px;
      transition: width 0.3s linear;
    }

    /* Lyrics Display */
    .lyrics-container {
      margin-top: 6px;
      font-size: 12px;
      font-weight: 700;
      color: var(--accent-color, #1db954);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      transition: all 0.2s ease;
    }
    .lyrics-next {
      font-size: 10px;
      opacity: 0.5;
      font-weight: 500;
      color: var(--text-color, #ffffff);
    }
  </style>
</head>
<body>
  <div id="app"></div>

  <script>
    (function() {
      const mode = "${mode}";
      let state = ${JSON.stringify(this.currentState)};

      const app = document.getElementById('app');

      function updateStyles(cfg) {
        const root = document.documentElement;
        root.style.setProperty('--font-family', cfg.fontFamily || 'Inter, sans-serif');
        root.style.setProperty('--text-color', cfg.textColor || '#ffffff');
        root.style.setProperty('--accent-color', cfg.accentColor || '#1db954');
        root.style.setProperty('--bg-opacity', cfg.bgOpacity !== undefined ? cfg.bgOpacity : 85);
        root.style.setProperty('--bg-blur', cfg.bgBlur !== undefined ? cfg.bgBlur : 16);
        root.style.setProperty('--corner-radius', (cfg.cornerRadius || 16) + 'px');
        root.style.setProperty('--artwork-size', cfg.artworkSize || 64);
      }

      function render() {
        const cfg = state.config || {};
        updateStyles(cfg);

        const themeClass = 'theme-' + (cfg.theme || 'spotify');
        const shapeClass = 'shape-' + (cfg.artworkShape || 'rounded');
        const glowClass = cfg.artworkGlow ? 'glow' : '';

        const titleText = state.title || 'No Song Playing';
        const artistText = state.artist + (state.album ? ' • ' + state.album : '');
        const progressPct = Math.min(100, Math.max(0, (state.progress || 0) * 100));

        if (mode === 'lyrics') {
          app.innerHTML = \`
            <div class="card \${themeClass}" style="max-width: 650px;">
              <div class="info">
                <div style="font-size:11px; font-weight:800; text-transform:uppercase; letter-spacing:0.05em; color:var(--accent-color);">
                  🎵 Synced Lyrics
                </div>
                <div style="font-size:16px; font-weight:800; color:var(--text-color); margin-top:2px;">
                  \${state.currentLyric || state.title || '...'}
                </div>
                \${state.nextLyric ? '<div class="lyrics-next" style="font-size:12px; margin-top:4px;">Next: ' + state.nextLyric + '</div>' : ''}
              </div>
            </div>
          \`;
          return;
        }

        if (mode === 'compact') {
          app.innerHTML = \`
            <div class="card \${themeClass}" style="padding: 8px 14px; min-width: 240px;">
              \${cfg.showArtwork ? \`
                <div class="artwork-wrap \${shapeClass} \${glowClass}" style="width:36px; height:36px;">
                  <img class="artwork-img" src="\${state.artworkUrl}" alt="" />
                </div>
              \` : ''}
              <div class="info" style="gap:2px;">
                <div class="title" style="font-size:13px;">\${titleText}</div>
                <div class="artist" style="font-size:11px;">\${state.artist}</div>
              </div>
            </div>
          \`;
          return;
        }

        // Clean, spacious overlay card layout for OBS
        app.innerHTML = \`
          <div class="card \${themeClass}" style="display:flex; align-items:center; gap:16px; padding:14px 20px; min-width:320px; max-width:540px;">
            \${cfg.showArtwork ? \`
              <div class="artwork-wrap \${shapeClass}" style="width:\${cfg.artworkSize || 56}px; height:\${cfg.artworkSize || 56}px; box-shadow: 0 0 24px rgba(29, 185, 84, 0.45); border-radius: 12px; flex-shrink:0;">
                <img class="artwork-img" src="\${state.artworkUrl}" alt="" style="border-radius: 12px; width:100%; height:100%; object-fit:cover;" />
              </div>
            \` : ''}
            <div class="info" style="display:flex; flex-direction:column; flex:1; min-width:0; gap:3px;">
              <div class="title" style="font-size:15px; font-weight:800; color:var(--text-color); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; letter-spacing:-0.01em;">
                \${state.title || 'No Song Playing'}
              </div>
              <div class="artist" style="font-size:12px; font-weight:600; opacity:0.65; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
                \${state.artist}\${state.album ? ' • ' + state.album : ''}
              </div>

              \${cfg.showLyrics && state.currentLyric ? \`
                <div class="lyrics-container" style="font-size:12px; font-weight:700; color:var(--accent-color, #1db954); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; margin-top:1px;">
                  🎵 \${state.currentLyric}
                </div>
              \` : ''}

              \${cfg.showProgressBar ? \`
                <div class="progress-bar-wrap" style="width:100%; height:5px; background:rgba(255,255,255,0.15); border-radius:99px; overflow:hidden; margin-top:5px;">
                  <div class="progress-fill" style="width: \${progressPct}%; height:100%; background:var(--accent-color, #1db954); border-radius:99px;"></div>
                </div>
              \` : ''}
            </div>
          </div>
        \`;
      }

      render();

      // WebSocket Connection
      function connectWs() {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = protocol + '//' + window.location.host + '/ws';
        const ws = new WebSocket(wsUrl);

        ws.onmessage = (event) => {
          try {
            state = JSON.parse(event.data);
            render();
          } catch(e) {}
        };

        ws.onclose = () => {
          setTimeout(connectWs, 1000);
        };
      }

      connectWs();
    })();
  </script>
</body>
</html>`;
  }
}
