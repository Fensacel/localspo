import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

export interface TagData {
  title: string;
  artist: string;
  album: string;
  year?: string;
  trackNumber?: number;
  discNumber?: number;
  coverPath?: string | null;
  lyrics?: string | null;
}

export class AudioTagger {
  public static async embedTags(
    filePath: string,
    ffmpegPath: string,
    tags: TagData
  ): Promise<boolean> {
    if (!fs.existsSync(filePath)) return false;

    const dir = path.dirname(filePath);
    const ext = path.extname(filePath);
    const baseName = path.basename(filePath, ext);
    const tempOutputFile = path.join(dir, `${baseName}_tagged_${Date.now()}${ext}`);

    const ffmpegArgs: string[] = ['-y', '-i', filePath];

    let hasCover = false;
    if (tags.coverPath && fs.existsSync(tags.coverPath)) {
      ffmpegArgs.push('-i', tags.coverPath);
      hasCover = true;
    }

    if (hasCover) {
      ffmpegArgs.push(
        '-map', '0:a:0',
        '-map', '1:0',
        '-c:a', 'copy',
        '-c:v', 'mjpeg',
        '-disposition:v:0', 'attached_pic',
        '-metadata:s:v', 'title="Album cover"',
        '-metadata:s:v', 'comment="Cover (front)"'
      );
    } else {
      ffmpegArgs.push('-map', '0:a:0', '-c:a', 'copy');
    }

    if (ext.toLowerCase() === '.mp3') {
      ffmpegArgs.push('-id3v2_version', '3');
    }

    // Metadata flags
    if (tags.title) ffmpegArgs.push('-metadata', `title=${tags.title}`);
    if (tags.artist) ffmpegArgs.push('-metadata', `artist=${tags.artist}`);
    if (tags.album) ffmpegArgs.push('-metadata', `album=${tags.album}`);
    if (tags.year) ffmpegArgs.push('-metadata', `date=${tags.year}`);
    if (tags.trackNumber) ffmpegArgs.push('-metadata', `track=${tags.trackNumber}`);
    if (tags.discNumber) ffmpegArgs.push('-metadata', `disc=${tags.discNumber}`);
    if (tags.lyrics) ffmpegArgs.push('-metadata', `lyrics=${tags.lyrics}`);

    ffmpegArgs.push(tempOutputFile);

    return new Promise((resolve) => {
      try {
        const proc = spawn(ffmpegPath, ffmpegArgs, { windowsHide: true });

        proc.on('close', (code) => {
          if (code === 0 && fs.existsSync(tempOutputFile)) {
            try {
              fs.copyFileSync(tempOutputFile, filePath);
              try {
                fs.unlinkSync(tempOutputFile);
              } catch {}
              resolve(true);
            } catch (err) {
              console.error('Error replacing tagged file:', err);
              if (fs.existsSync(tempOutputFile)) {
                try {
                  fs.unlinkSync(tempOutputFile);
                } catch {}
              }
              resolve(false);
            }
          } else {
            console.warn('ffmpeg tagging failed with exit code:', code);
            if (fs.existsSync(tempOutputFile)) {
              try {
                fs.unlinkSync(tempOutputFile);
              } catch {}
            }
            resolve(false);
          }
        });

        proc.on('error', (err) => {
          console.error('ffmpeg process error during tagging:', err);
          if (fs.existsSync(tempOutputFile)) {
            try {
              fs.unlinkSync(tempOutputFile);
            } catch {}
          }
          resolve(false);
        });
      } catch (e) {
        console.error('AudioTagger error:', e);
        resolve(false);
      }
    });
  }
}
