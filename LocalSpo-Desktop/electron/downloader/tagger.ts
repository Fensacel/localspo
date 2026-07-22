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

import { cleanMusicMetadata } from './metadataCleaner';

export class AudioTagger {
  public static async embedTags(
    filePath: string,
    ffmpegPath: string,
    tags: TagData
  ): Promise<boolean> {
    if (!fs.existsSync(filePath)) return false;

    // Clean tags before embedding
    const cleaned = cleanMusicMetadata({
      title: tags.title || '',
      artist: tags.artist || '',
      album: tags.album || '',
    });
    tags = {
      ...tags,
      title: cleaned.title,
      artist: cleaned.artist,
      album: cleaned.album,
    };

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

    // Metadata flags (Standard keys + ID3v2 4-letter frame mappings for TagScanner/MP3Tag/iTunes)
    if (tags.title) {
      ffmpegArgs.push('-metadata', `title=${tags.title}`, '-metadata', `TIT2=${tags.title}`);
    }
    if (tags.artist) {
      ffmpegArgs.push('-metadata', `artist=${tags.artist}`, '-metadata', `TPE1=${tags.artist}`);
    }
    if (tags.album) {
      ffmpegArgs.push('-metadata', `album=${tags.album}`, '-metadata', `TALB=${tags.album}`);
    }
    if (tags.year) {
      ffmpegArgs.push('-metadata', `date=${tags.year}`, '-metadata', `TYER=${tags.year}`, '-metadata', `YEAR=${tags.year}`);
    }
    if (tags.trackNumber) {
      ffmpegArgs.push('-metadata', `track=${tags.trackNumber}`, '-metadata', `TRCK=${tags.trackNumber}`);
    }
    if (tags.discNumber) {
      ffmpegArgs.push('-metadata', `disc=${tags.discNumber}`, '-metadata', `TPOS=${tags.discNumber}`);
    }
    if (tags.lyrics) {
      ffmpegArgs.push('-metadata', `lyrics=${tags.lyrics}`, '-metadata', `USLT=${tags.lyrics}`);
    }

    // Extended metadata flags
    if (tags.composer) {
      ffmpegArgs.push('-metadata', `composer=${tags.composer}`, '-metadata', `TCOM=${tags.composer}`);
    }
    if (tags.conductor) {
      ffmpegArgs.push('-metadata', `conductor=${tags.conductor}`, '-metadata', `TPE3=${tags.conductor}`);
    }
    if (tags.copyright) {
      ffmpegArgs.push('-metadata', `copyright=${tags.copyright}`, '-metadata', `TCOP=${tags.copyright}`);
    }
    if (tags.publisher) {
      ffmpegArgs.push(
        '-metadata', `publisher=${tags.publisher}`,
        '-metadata', `TPUB=${tags.publisher}`,
        '-metadata', `organization=${tags.publisher}`,
        '-metadata', `ORGANIZATION=${tags.publisher}`
      );
    }
    if (tags.isrc) {
      ffmpegArgs.push('-metadata', `isrc=${tags.isrc}`, '-metadata', `TSRC=${tags.isrc}`);
    }
    if (tags.encodedBy) {
      ffmpegArgs.push('-metadata', `encoded_by=${tags.encodedBy}`, '-metadata', `TSSE=${tags.encodedBy}`);
    }
    if (tags.grouping) {
      ffmpegArgs.push('-metadata', `grouping=${tags.grouping}`, '-metadata', `TIT1=${tags.grouping}`);
    }
    if (tags.subtitle) {
      ffmpegArgs.push('-metadata', `subtitle=${tags.subtitle}`, '-metadata', `TIT3=${tags.subtitle}`);
    }
    if (tags.comment) {
      ffmpegArgs.push('-metadata', `comment=${tags.comment}`, '-metadata', `COMM=${tags.comment}`);
    }
    if (tags.bpm) {
      ffmpegArgs.push('-metadata', `bpm=${tags.bpm}`, '-metadata', `TBPM=${tags.bpm}`);
    }
    if (tags.key) {
      ffmpegArgs.push('-metadata', `key=${tags.key}`, '-metadata', `TKEY=${tags.key}`);
    }
    if (tags.originalArtist) {
      ffmpegArgs.push('-metadata', `original_artist=${tags.originalArtist}`, '-metadata', `TOPE=${tags.originalArtist}`);
    }
    if (tags.remixer) {
      ffmpegArgs.push('-metadata', `remixer=${tags.remixer}`, '-metadata', `TPE4=${tags.remixer}`);
    }

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
