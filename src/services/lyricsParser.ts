import type { LyricLine, LyricsData } from '@/types';

/**
 * Parse LRC format lyrics into structured LyricLine array.
 * Supports standard LRC timestamps [mm:ss.xx] and [mm:ss.xxx]
 */
export function parseLrc(lrcContent: string): LyricsData {
  const lines = lrcContent.split('\n');
  const lyrics: LyricLine[] = [];
  const timeRegex = /\[(\d{1,3}):(\d{2})(?:[.,](\d+))?\]/g;

  for (const line of lines) {
    const matches = [...line.matchAll(timeRegex)];
    if (matches.length === 0) continue;

    // Get the text part after all timestamps
    let text = line.replace(timeRegex, '').trim();
    if (/^[\s♪♫♬♩♭♮♯]*$/u.test(text)) {
      text = '';
    }

    for (const match of matches) {
      const minutes = parseInt(match[1], 10);
      const seconds = parseInt(match[2], 10);
      const fracStr = match[3] || '0';
      const fraction = parseFloat('0.' + fracStr);

      const time = minutes * 60 + seconds + fraction;
      lyrics.push({ time, text });
    }
  }

  // Sort by time
  lyrics.sort((a, b) => a.time - b.time);

  // Calculate end times
  for (let i = 0; i < lyrics.length - 1; i++) {
    lyrics[i].endTime = lyrics[i + 1].time;
  }
  if (lyrics.length > 0) {
    lyrics[lyrics.length - 1].endTime = lyrics[lyrics.length - 1].time + 10;
  }

  return {
    synced: true,
    lines: lyrics,
    rawText: lyrics.map((l) => l.text).join('\n'),
  };
}

/**
 * Parse unsynced/plain text lyrics
 */
export function parsePlainLyrics(text: string): LyricsData {
  const lines = text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !/^[\s♪♫♬♩♭♮♯]*$/u.test(line));

  return {
    synced: false,
    lines: lines.map((text, index) => ({
      time: index,
      text,
    })),
    rawText: text,
  };
}

/**
 * Detect if lyrics content is LRC format
 */
export function isLrcFormat(content: string): boolean {
  return /\[\d{1,3}:\d{2}(?:[.,]\d+)?\]/.test(content);
}

/**
 * Parse lyrics content, auto-detecting format
 */
export function parseLyrics(content: string): LyricsData {
  if (isLrcFormat(content)) {
    return parseLrc(content);
  }
  return parsePlainLyrics(content);
}

/**
 * Find the current lyric index based on playback time
 */
export function findCurrentLyricIndex(lyrics: LyricLine[], currentTime: number): number {
  if (lyrics.length === 0) return -1;

  for (let i = lyrics.length - 1; i >= 0; i--) {
    if (currentTime >= lyrics[i].time) {
      return i;
    }
  }

  return -1;
}
