export type ScriptType =
  | 'korean'
  | 'japanese'
  | 'chinese'
  | 'cyrillic'
  | 'greek'
  | 'arabic'
  | 'hindi'
  | 'thai'
  | 'latin';

export class LanguageDetector {
  /**
   * Automatically detect script type based on character unicode ranges.
   */
  static detectScript(text: string): ScriptType {
    if (!text || text.trim().length === 0) return 'latin';

    let koreanCount = 0;
    let japaneseCount = 0;
    let chineseCount = 0;
    let cyrillicCount = 0;
    let greekCount = 0;
    let arabicCount = 0;
    let hindiCount = 0;
    let thaiCount = 0;

    for (let i = 0; i < text.length; i++) {
      const code = text.charCodeAt(i);

      // Korean (Hangul Syllables, Jamo)
      if ((code >= 0xac00 && code <= 0xd7af) || (code >= 0x1100 && code <= 0x11ff) || (code >= 0x3130 && code <= 0x318f)) {
        koreanCount++;
      }
      // Japanese Hiragana & Katakana
      else if ((code >= 0x3040 && code <= 0x309f) || (code >= 0x30a0 && code <= 0x30ff)) {
        japaneseCount++;
      }
      // Chinese / CJK Ideographs
      else if (code >= 0x4e00 && code <= 0x9faf) {
        chineseCount++;
      }
      // Cyrillic (Russian, Ukrainian, etc.)
      else if (code >= 0x0400 && code <= 0x04ff) {
        cyrillicCount++;
      }
      // Greek
      else if (code >= 0x0370 && code <= 0x03ff) {
        greekCount++;
      }
      // Arabic
      else if (code >= 0x0600 && code <= 0x06ff) {
        arabicCount++;
      }
      // Devanagari (Hindi)
      else if (code >= 0x0900 && code <= 0x097f) {
        hindiCount++;
      }
      // Thai
      else if (code >= 0x0e00 && code <= 0x0e7f) {
        thaiCount++;
      }
    }

    if (koreanCount > 0) return 'korean';
    if (japaneseCount > 0) return 'japanese';
    if (chineseCount > 0) return 'chinese';
    if (cyrillicCount > 0) return 'cyrillic';
    if (greekCount > 0) return 'greek';
    if (arabicCount > 0) return 'arabic';
    if (hindiCount > 0) return 'hindi';
    if (thaiCount > 0) return 'thai';

    return 'latin';
  }
}
