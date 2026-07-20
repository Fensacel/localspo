export interface LyricsResult {
  syncedLyrics: string | null;
  plainLyrics: string | null;
  source: 'lrclib' | 'none';
}

export class LyricsApi {
  public static async fetchLyrics(
    artist: string,
    title: string,
    album?: string,
    durationSeconds?: number
  ): Promise<LyricsResult> {
    const cleanArtist = artist.replace(/ feat\..*$/i, '').replace(/ ft\..*$/i, '').trim();
    const cleanTitle = title.replace(/\(feat\..*\)/i, '').replace(/\[feat\..*\]/i, '').trim();

    try {
      // 1. Try exact get endpoint from LRCLIB
      let url = `https://lrclib.net/api/get?artist_name=${encodeURIComponent(cleanArtist)}&track_name=${encodeURIComponent(cleanTitle)}`;
      if (album) url += `&album_name=${encodeURIComponent(album)}`;
      if (durationSeconds && durationSeconds > 0) url += `&duration=${Math.round(durationSeconds)}`;

      const res = await fetch(url, {
        headers: {
          'User-Agent': 'LocalSpo-MusicPlayer/1.0.4',
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

      // 2. Try search endpoint if exact match returns 404
      const searchUrl = `https://lrclib.net/api/search?q=${encodeURIComponent(`${cleanArtist} ${cleanTitle}`)}`;
      const searchRes = await fetch(searchUrl, {
        headers: {
          'User-Agent': 'LocalSpo-MusicPlayer/1.0.4',
        },
      });

      if (searchRes.ok) {
        const results = (await searchRes.json()) as any[];
        if (Array.isArray(results) && results.length > 0) {
          const best = results[0];
          if (best.syncedLyrics || best.plainLyrics) {
            return {
              syncedLyrics: best.syncedLyrics || null,
              plainLyrics: best.plainLyrics || null,
              source: 'lrclib',
            };
          }
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
