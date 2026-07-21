export interface LyricsResult {
  syncedLyrics: string | null;
  plainLyrics: string | null;
  source: 'lrclib' | 'none';
}

export class LyricsApi {
  private static containsNonLatin(text: string): boolean {
    // Detect CJK (Chinese, Japanese, Korean) and Cyrillic characters
    return /[\u3040-\u30ff\u4e00-\u9faf\uac00-\ud7af\u0400-\u04ff]/.test(text);
  }

  public static async fetchLyrics(
    artist: string,
    title: string,
    album?: string,
    durationSeconds?: number
  ): Promise<LyricsResult> {
    const cleanArtist = artist.replace(/ feat\..*$/i, '').replace(/ ft\..*$/i, '').trim();
    const cleanTitle = title.replace(/\(feat\..*\)/i, '').replace(/\[feat\..*\]/i, '').trim();

    try {
      // 1. Try search endpoint first to get all candidate versions (allows filtering romaji/translations)
      const searchUrl = `https://lrclib.net/api/search?q=${encodeURIComponent(`${cleanArtist} ${cleanTitle}`)}`;
      const searchRes = await fetch(searchUrl, {
        headers: {
          'User-Agent': 'LocalSpo-MusicPlayer/1.0.5',
        },
      });

      if (searchRes.ok) {
        const results = (await searchRes.json()) as any[];
        if (Array.isArray(results) && results.length > 0) {
          const hasNonLatinLyrics = results.some((item) =>
            this.containsNonLatin(item.plainLyrics || item.syncedLyrics || '')
          );

          let candidates = results.filter((item) => item.plainLyrics || item.syncedLyrics);
          
          // If any search result contains original non-Latin lyrics, filter out pure Romaji/Latin-only results
          if (hasNonLatinLyrics) {
            candidates = candidates.filter((item) =>
              this.containsNonLatin(item.plainLyrics || item.syncedLyrics || '')
            );
          }

          const queryCleanTitle = cleanTitle.toLowerCase();
          const queryCleanArtist = cleanArtist.toLowerCase();

          let bestCandidate = null;
          let bestScore = -1;

          for (const item of candidates) {
            let score = 0;
            const itemTitle = (item.trackName || '').toLowerCase();
            const itemArtist = (item.artistName || '').toLowerCase();
            const itemAlbum = (item.albumName || '').toLowerCase();

            // Title matching
            if (itemTitle === queryCleanTitle) {
              score += 100;
            } else if (itemTitle.includes(queryCleanTitle) || queryCleanTitle.includes(itemTitle)) {
              score += 50;
            }

            // Artist matching
            if (itemArtist === queryCleanArtist) {
              score += 50;
            } else if (itemArtist.includes(queryCleanArtist) || queryCleanArtist.includes(itemArtist)) {
              score += 20;
            }

            // Album matching
            if (album && itemAlbum === album.toLowerCase()) {
              score += 30;
            }

            // Duration matching
            if (durationSeconds && item.duration) {
              const diff = Math.abs(item.duration - durationSeconds);
              if (diff <= 2) score += 20;
              else if (diff <= 5) score += 10;
              else if (diff > 15) score -= 20;
            }

            if (score > bestScore) {
              bestScore = score;
              bestCandidate = item;
            }
          }

          if (bestCandidate) {
            return {
              syncedLyrics: bestCandidate.syncedLyrics || null,
              plainLyrics: bestCandidate.plainLyrics || null,
              source: 'lrclib',
            };
          }
        }
      }

      // 2. Fallback: Exact get endpoint from LRCLIB
      let url = `https://lrclib.net/api/get?artist_name=${encodeURIComponent(cleanArtist)}&track_name=${encodeURIComponent(cleanTitle)}`;
      if (album) url += `&album_name=${encodeURIComponent(album)}`;
      if (durationSeconds && durationSeconds > 0) url += `&duration=${Math.round(durationSeconds)}`;

      const res = await fetch(url, {
        headers: {
          'User-Agent': 'LocalSpo-MusicPlayer/1.0.5',
        },
      });

      if (res.ok) {
        const data: any = await res.json();
        if (data.syncedLyrics || data.plainLyrics) {
          return {
            syncedLyrics: data.syncedLyrics || null,
            plainLyrics: data.plainLyrics || null,
            source: 'lrclib',
          };
        }
      }
    } catch (err) {
      console.warn('LRCLIB fetch lyrics error:', err);
    }

    return {
      syncedLyrics: null,
      plainLyrics: null,
      source: 'none',
    };
  }
}
