/**
 * Format seconds to MM:SS or HH:MM:SS
 */
export function formatTime(seconds: number): string {
  if (!seconds || !isFinite(seconds)) return '0:00';

  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hrs > 0) {
    return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Format duration for display (e.g., "3 min 24 sec")
 */
export function formatDurationLong(seconds: number): string {
  if (!seconds || !isFinite(seconds)) return '0 sec';

  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  const parts: string[] = [];
  if (hrs > 0) parts.push(`${hrs} hr`);
  if (mins > 0) parts.push(`${mins} min`);
  if (secs > 0 && hrs === 0) parts.push(`${secs} sec`);

  return parts.join(' ') || '0 sec';
}

/**
 * Format file size to human readable
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';

  const units = ['B', 'KB', 'MB', 'GB'];
  const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / Math.pow(1024, exponent);

  return `${value.toFixed(exponent > 0 ? 1 : 0)} ${units[exponent]}`;
}

/**
 * Format bitrate (e.g., 1737 -> "1,737 kbps")
 */
export function formatBitrate(kbps: number): string {
  if (!kbps) return 'N/A';
  return `${kbps.toLocaleString()} kbps`;
}

/**
 * Format sample rate (e.g., 44100 -> "44.1 kHz")
 */
export function formatSampleRate(hz: number): string {
  if (!hz) return 'N/A';
  return `${(hz / 1000).toFixed(hz % 1000 === 0 ? 0 : 1)} kHz`;
}

/**
 * Format bit depth (e.g., 24 -> "24-bit")
 */
export function formatBitDepth(bits: number): string {
  if (!bits) return 'N/A';
  return `${bits}-bit`;
}

/**
 * Check if codec is lossless
 */
export function isLossless(codec: string): boolean {
  const losslessCodecs = ['flac', 'alac', 'wav', 'aiff', 'ape', 'wv', 'pcm'];
  return losslessCodecs.includes(codec.toLowerCase());
}

/**
 * Generate a simple hash from string
 */
export function hashString(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
}

/**
 * Create a deterministic ID from album + artist
 */
export function createAlbumId(album: string, artist: string): string {
  return hashString(`${album.toLowerCase()}::${artist.toLowerCase()}`);
}

/**
 * Create a deterministic ID from artist name
 */
export function createArtistId(name: string): string {
  return hashString(`artist::${name.toLowerCase()}`);
}

/**
 * Debounce a function
 */
export function debounce<T extends (...args: unknown[]) => unknown>(
  fn: T,
  ms: number,
): (...args: Parameters<T>) => void {
  let timeoutId: ReturnType<typeof setTimeout>;
  return (...args: Parameters<T>) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), ms);
  };
}

/**
 * Clamp a number between min and max
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/**
 * Extract dominant color from an image using canvas
 */
export function extractDominantColor(imageSrc: string): Promise<[number, number, number]> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve([59, 130, 246]); // Default blue
        return;
      }

      canvas.width = 10;
      canvas.height = 10;
      ctx.drawImage(img, 0, 0, 10, 10);

      const data = ctx.getImageData(0, 0, 10, 10).data;
      let r = 0,
        g = 0,
        b = 0,
        count = 0;

      for (let i = 0; i < data.length; i += 4) {
        // Skip very dark and very light pixels
        const brightness = (data[i] + data[i + 1] + data[i + 2]) / 3;
        if (brightness > 30 && brightness < 230) {
          r += data[i];
          g += data[i + 1];
          b += data[i + 2];
          count++;
        }
      }

      if (count > 0) {
        resolve([Math.round(r / count), Math.round(g / count), Math.round(b / count)]);
      } else {
        resolve([59, 130, 246]);
      }
    };
    img.onerror = () => resolve([59, 130, 246]);
    img.src = imageSrc;
  });
}

/**
 * Get standard-compliant URL for local audio files
 */
export function getAudioUrl(filePath: string): string {
  if (!filePath) return '';
  return `local-audio://local/${encodeURIComponent(filePath)}`;
}

/**
 * Get standard-compliant URL for local image files (covers)
 */
export function getImageUrl(filePath: string): string {
  if (!filePath) return '';
  return `local-image://local/${encodeURIComponent(filePath)}`;
}
