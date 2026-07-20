import type { LyricLine, LyricsData, LyricWord } from '@/types';

/**
 * Helper to parse Enhanced LRC word-level timestamps if present on a line.
 */
function parseEnhancedWords(lineContent: string): { words: LyricWord[]; cleanText: string } | null {
  const wordTimeRegex = /(?:<|\(|\[)(\d{1,3}):(\d{2})(?:[.,](\d+))?(?:>|\)|\])/g;
  const matches = [...lineContent.matchAll(wordTimeRegex)];

  if (matches.length === 0) {
    return null;
  }

  const wordStamps: { time: number; index: number; length: number }[] = [];

  for (const match of matches) {
    const minutes = parseInt(match[1], 10);
    const seconds = parseInt(match[2], 10);
    const fracStr = match[3] || '0';
    const fraction = parseFloat('0.' + fracStr);
    const time = minutes * 60 + seconds + fraction;
    wordStamps.push({
      time,
      index: match.index!,
      length: match[0].length,
    });
  }

  if (wordStamps.length === 0) return null;

  const words: LyricWord[] = [];
  let cleanText = '';

  for (let i = 0; i < wordStamps.length; i++) {
    const currentStamp = wordStamps[i];
    const nextStamp = i < wordStamps.length - 1 ? wordStamps[i + 1] : null;

    const textStart = currentStamp.index + currentStamp.length;
    const textEnd = nextStamp ? nextStamp.index : lineContent.length;
    const rawWordText = lineContent.substring(textStart, textEnd);
    const wordText = rawWordText.trim();

    cleanText += rawWordText;

    if (wordText.length > 0) {
      const startTime = currentStamp.time;
      const endTime = nextStamp ? nextStamp.time : startTime + 1.0;
      words.push({
        text: wordText,
        startTime,
        endTime,
      });
    }
  }

  cleanText = cleanText.trim();

  if (words.length === 0) return null;

  return { words, cleanText };
}

/**
 * Calculate natural word durations for a line.
 * Blends uniform beat cadence (80%) with character length weight (20%)
 * so every word gets its natural turn to highlight in sync with the song tempo.
 */
function calculateNaturalWordDurations(wordsOnly: string[], lineDuration: number): number[] {
  const count = wordsOnly.length;
  if (count === 0) return [];
  if (count === 1) return [lineDuration];

  const totalChars = wordsOnly.reduce((acc, w) => acc + w.length, 0);
  const avgChars = totalChars / count;

  const weights = wordsOnly.map((w) => {
    const charRatio = avgChars > 0 ? w.length / avgChars : 1.0;
    // 80% base uniform beat weight + 20% character length scaling
    return Math.max(0.5, 0.8 + 0.2 * charRatio);
  });

  const totalWeight = weights.reduce((acc, w) => acc + w, 0);

  return weights.map((w) => (w / totalWeight) * lineDuration);
}

/**
 * Generate fallback virtual timestamps for regular LRC lines
 * using smart natural timing.
 */
export function generateFallbackWordsForLines(lines: LyricLine[]): void {
  for (let i = 0; i < lines.length; i++) {
    const currentLine = lines[i];

    // If enhanced LRC already provided timestamps for this line, use original timestamps
    if (currentLine.isEnhanced && currentLine.words && currentLine.words.length > 0) {
      continue;
    }

    const nextLine = i < lines.length - 1 ? lines[i + 1] : null;

    // 1. Calculate line duration
    const startTime = currentLine.time;
    const nextStartTime = nextLine ? nextLine.time : (currentLine.endTime || (startTime + 4.0));
    const rawDuration = nextStartTime - startTime;

    // 2. Split line into words
    const tokens = currentLine.text.split(/(\s+)/);
    const wordsOnly = tokens.filter((t) => t.trim().length > 0);

    if (wordsOnly.length === 0) {
      currentLine.words = [];
      continue;
    }

    // Determine active vocal duration:
    // Vocal delivery spans ~88% of raw line gap (reserving a ~12% tail buffer for breathing/pause)
    // capping only on large instrumental breaks (>6s).
    const maxVocalDuration = Math.max(2.5, wordsOnly.length * 0.8);
    const rawVocalDuration = rawDuration > 6.0 ? maxVocalDuration : Math.min(rawDuration * 0.88, rawDuration - 0.35);
    const lineDuration = Math.max(0.4, rawVocalDuration);

    // 3 & 4. Calculate natural word durations
    const wordDurations = calculateNaturalWordDurations(wordsOnly, lineDuration);

    // 5. Generate virtual timestamps
    const words: LyricWord[] = [];
    let currentTimePointer = startTime;

    for (let w = 0; w < wordsOnly.length; w++) {
      const wordText = wordsOnly[w];
      const wordDuration = wordDurations[w];

      const wordStartTime = currentTimePointer;
      const wordEndTime = currentTimePointer + wordDuration;

      words.push({
        text: wordText,
        startTime: wordStartTime,
        endTime: wordEndTime,
      });

      currentTimePointer = wordEndTime;
    }

    currentLine.words = words;
  }
}

/**
 * Parse LRC format lyrics into structured LyricLine array.
 * Supports standard LRC timestamps [mm:ss.xx] and [mm:ss.xxx] as well as Enhanced LRC.
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

      const enhanced = parseEnhancedWords(text);
      if (enhanced) {
        lyrics.push({
          time,
          text: enhanced.cleanText,
          words: enhanced.words,
          isEnhanced: true,
        });
      } else {
        lyrics.push({ time, text });
      }
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

  // Generate weighted fallback virtual timestamps if not Enhanced LRC
  generateFallbackWordsForLines(lyrics);

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
