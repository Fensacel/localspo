import type { LyricsData, LyricLine } from '@/types';
import { LanguageDetector } from './LanguageDetector';
import { KoreanProvider } from './providers/KoreanProvider';
import { JapaneseProvider } from './providers/JapaneseProvider';
import { ChineseProvider } from './providers/ChineseProvider';
import { GenericProvider } from './providers/GenericProvider';

export class RomanizationService {
  private static cache = new Map<string, LyricsData>();

  /**
   * Process and attach romanization to lyrics data asynchronously.
   */
  static async processLyrics(lyrics: LyricsData | null, cacheKey: string, forceRefresh = false): Promise<LyricsData | null> {
    if (!lyrics || !lyrics.lines || lyrics.lines.length === 0) return lyrics;

    // Check cache unless forceRefresh is true
    if (!forceRefresh && this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey)!;
    }

    // Process asynchronously without blocking UI / main thread
    const processedLines: LyricLine[] = lyrics.lines.map((line) => {
      const script = LanguageDetector.detectScript(line.text);

      if (script === 'latin') {
        return { ...line, romanization: undefined };
      }

      let romanizedText = line.text;

      switch (script) {
        case 'korean':
          romanizedText = KoreanProvider.romanize(line.text);
          break;
        case 'japanese':
          romanizedText = JapaneseProvider.romanize(line.text);
          break;
        case 'chinese':
          romanizedText = ChineseProvider.romanize(line.text);
          break;
        case 'cyrillic':
        case 'greek':
        case 'arabic':
        case 'hindi':
        case 'thai':
          romanizedText = GenericProvider.romanize(line.text);
          break;
      }

      // Sync word-level timestamps for Karaoke mode if words exist
      let romanizedWords = line.words;
      if (line.words && line.words.length > 0 && romanizedText !== line.text) {
        const romTokens = romanizedText.split(/\s+/).filter(t => t.length > 0);
        if (romTokens.length === line.words.length) {
          romanizedWords = line.words.map((w, idx) => ({
            ...w,
            text: romTokens[idx] || w.text,
          }));
        }
      }

      return {
        ...line,
        romanization: romanizedText !== line.text ? romanizedText : undefined,
        romanizationWords: romanizedWords,
      };
    });

    const overallScript = LanguageDetector.detectScript(
      lyrics.lines.map(l => l.text).slice(0, 5).join(' ')
    );

    const result: LyricsData = {
      ...lyrics,
      lines: processedLines,
      detectedScript: overallScript,
    };

    // Store in cache
    this.cache.set(cacheKey, result);
    return result;
  }

  /**
   * Clear cache for a specific key or all entries
   */
  static clearCache(key?: string) {
    if (key) {
      this.cache.delete(key);
    } else {
      this.cache.clear();
    }
  }
}
