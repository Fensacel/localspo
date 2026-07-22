/**
 * Store and manage per-song lyric timing offset (in seconds or ms).
 */
export class LyricOffsetStore {
  private static STORAGE_KEY = 'localspo_lyric_offsets';

  private static getOffsets(): Record<string, number> {
    try {
      const raw = localStorage.getItem(this.STORAGE_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  }

  /**
   * Get timing offset in seconds for a specific song ID (default: 0)
   */
  static getOffset(songId: string): number {
    if (!songId) return 0;
    const offsets = this.getOffsets();
    return offsets[songId] || 0;
  }

  /**
   * Set timing offset in seconds for a specific song ID
   */
  static setOffset(songId: string, offsetSeconds: number): void {
    if (!songId) return;
    try {
      const offsets = this.getOffsets();
      offsets[songId] = Math.round(offsetSeconds * 100) / 100;
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(offsets));
    } catch {}
  }
}
