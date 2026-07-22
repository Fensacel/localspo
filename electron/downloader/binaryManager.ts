import path from 'path';
import fs from 'fs';

let app: any = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  app = require('electron').app;
} catch {}

export interface BinaryPaths {
  ytdlp: string;
  ffmpeg: string;
}

export function getBinaryPaths(getDataPath: () => string): BinaryPaths {
  const isWin = process.platform === 'win32';
  const ytdlpName = isWin ? 'yt-dlp.exe' : 'yt-dlp';
  const ffmpegName = isWin ? 'ffmpeg.exe' : 'ffmpeg';

  const possibleYtdlpPaths = [
    ...(app?.getAppPath ? [path.join(app.getAppPath(), 'bin', ytdlpName)] : []),
    path.join(process.cwd(), 'bin', ytdlpName),
    path.join(getDataPath(), 'bin', ytdlpName),
    ytdlpName,
  ];

  const possibleFfmpegPaths = [
    ...(process.resourcesPath ? [path.join(process.resourcesPath, 'bin', ffmpegName)] : []),
    ...(app?.getAppPath ? [path.join(app.getAppPath(), 'bin', ffmpegName)] : []),
    path.join(process.cwd(), 'bin', ffmpegName),
    path.join(getDataPath(), 'bin', ffmpegName),
    ffmpegName,
  ];

  let resolvedYtdlp = ytdlpName;
  for (const p of possibleYtdlpPaths) {
    if (fs.existsSync(p)) {
      resolvedYtdlp = p;
      break;
    }
  }

  let resolvedFfmpeg = ffmpegName;
  for (const p of possibleFfmpegPaths) {
    if (fs.existsSync(p)) {
      resolvedFfmpeg = p;
      break;
    }
  }

  return {
    ytdlp: resolvedYtdlp,
    ffmpeg: resolvedFfmpeg,
  };
}
