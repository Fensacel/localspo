/**
 * Korean Hangul Revised Romanization (RR) Engine
 * Decomposes Hangul syllables (0xAC00 - 0xD7AF) into Initial, Medial, and Final sounds.
 */
export class KoreanProvider {
  private static INITIALS = [
    'g', 'kk', 'n', 'd', 'tt', 'r', 'm', 'b', 'pp',
    's', 'ss', '', 'j', 'jj', 'ch', 'k', 't', 'p', 'h'
  ];

  private static MEDIALS = [
    'a', 'ae', 'ya', 'yae', 'eo', 'e', 'yeo', 'ye', 'o',
    'wa', 'wae', 'oe', 'yo', 'u', 'wo', 'we', 'wi', 'yu',
    'eu', 'ui', 'i'
  ];

  private static FINALS = [
    '', 'g', 'kk', 'gs', 'n', 'nj', 'nh', 'd', 'l',
    'lg', 'lm', 'lb', 'ls', 'lt', 'lp', 'lh', 'm', 'b',
    'bs', 's', 'ss', 'ng', 'j', 'ch', 'k', 't', 'p', 'h'
  ];

  static romanize(text: string): string {
    if (!text) return text;
    let result = '';

    for (let i = 0; i < text.length; i++) {
      const code = text.charCodeAt(i);

      if (code >= 0xac00 && code <= 0xd7af) {
        const syllableIndex = code - 0xac00;
        const initialIdx = Math.floor(syllableIndex / 588);
        const medialIdx = Math.floor((syllableIndex % 588) / 28);
        const finalIdx = syllableIndex % 28;

        let initial = this.INITIALS[initialIdx];
        const medial = this.MEDIALS[medialIdx];
        const final = this.FINALS[finalIdx];

        if (i === 0 || text[i - 1] === ' ' || text[i - 1] === '\n') {
          if (initial.length > 0) {
            initial = initial.charAt(0).toUpperCase() + initial.slice(1);
          } else if (medial.length > 0) {
            result += medial.charAt(0).toUpperCase() + medial.slice(1) + final;
            continue;
          }
        }

        result += initial + medial + final;
      } else {
        result += text.charAt(i);
      }
    }

    return result;
  }
}
