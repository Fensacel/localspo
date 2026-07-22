export interface LyricsResult {
  syncedLyrics: string | null;
  plainLyrics: string | null;
  source: 'lrclib' | 'musixmatch' | 'none';
}

export class LyricsApi {
  private static musixmatchToken: string | null = null;

  private static cleanArtist(artist: string): string {
    if (!artist) return '';
    let a = artist
      .replace(/\s*-\s*Topic$/i, '')
      .replace(/\s+VEVO$/i, '')
      .replace(/VEVO$/i, '')
      .replace(/\s+Official\s+Channel$/i, '')
      .replace(/\s+Official$/i, '')
      .trim();

    // Extract main English name e.g. "TWICE (트와이스)" -> "TWICE"
    if (a.includes('(') && a.includes(')')) {
      const mainName = a.replace(/\(.*?\)/g, '').trim();
      if (mainName.length > 0) return mainName;
    }
    return a;
  }

  private static cleanTitle(title: string, artistName?: string): string {
    if (!title) return '';
    let t = title.trim();

    if (artistName && t.toLowerCase().startsWith(artistName.toLowerCase() + ' - ')) {
      t = t.slice(artistName.length + 3).trim();
    }

    t = t
      .replace(/^["'“”„](.*)["'“”„]$/, '$1')
      .replace(/["'“”„]/g, '')
      .replace(/\[(MV|M\/V|Official Video|Official Audio|Lyric Video|Audio|Lyrics|Performance Video)\]/gi, '')
      .replace(/\((Official Video|Official Audio|Lyric Video|Audio|M\/V|MV|Lyrics|Performance Video)\)/gi, '')
      .replace(/\(feat\..*?\)/gi, '')
      .replace(/\[feat\..*?\]/gi, '')
      .replace(/feat\..*$/gi, '')
      .replace(/ft\..*$/gi, '')
      .replace(/\s+/g, ' ')
      .trim();

    return t;
  }

  private static isArtistMatch(candidateArtist: string | undefined, targetArtist: string): boolean {
    if (!candidateArtist || !targetArtist) return false;
    const ca = candidateArtist.toLowerCase().trim();
    const ta = targetArtist.toLowerCase().trim();
    return ca.includes(ta) || ta.includes(ca);
  }

  private static getHeaders() {
    return {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      'Accept': 'application/json, text/plain, */*',
      'Accept-Language': 'en-US,en;q=0.9',
    };
  }

  /**
   * ── Provider: Lyrics.ovh (Ultra fast global plain lyrics DB) ──
   */
  private static async fetchLyricsOvh(artist: string, title: string): Promise<LyricsResult | null> {
    try {
      const url = `https://api.lyrics.ovh/v1/${encodeURIComponent(artist)}/${encodeURIComponent(title)}`;
      const res = await fetch(url, {
        headers: this.getHeaders(),
        signal: AbortSignal.timeout(2500),
      });
      if (res.ok) {
        const data: any = await res.json();
        if (data && data.lyrics && data.lyrics.trim().length > 10) {
          console.log(`[LyricsApi] Lyrics.ovh hit for: ${artist} - ${title}`);
          return {
            syncedLyrics: null,
            plainLyrics: data.lyrics.trim(),
            source: 'none',
          };
        }
      }
    } catch {}
    return null;
  }

  /**
   * ── Provider: NetEase Cloud Music ──
   */
  private static async fetchNetease(artist: string, title: string): Promise<LyricsResult | null> {
    try {
      const query = `${artist} ${title}`.trim();
      const searchRes = await fetch(
        `https://music.163.com/api/search/get?s=${encodeURIComponent(query)}&type=1&limit=5`,
        {
          headers: this.getHeaders(),
          signal: AbortSignal.timeout(2000),
        }
      );
      if (searchRes.ok) {
        const searchData: any = await searchRes.json();
        const songs = searchData?.result?.songs;
        if (Array.isArray(songs) && songs.length > 0) {
          const normArtist = artist.toLowerCase().trim();
          const normTitle = title.toLowerCase().trim();

          for (const s of songs) {
            const songName = (s.name || '').toLowerCase().trim();
            const artistNames = (s.artists || []).map((a: any) => (a.name || '').toLowerCase().trim());
            const fullArtistStr = artistNames.join(' ');

            const artistMatches =
              artistNames.some((an: string) => an.includes(normArtist) || normArtist.includes(an)) ||
              fullArtistStr.includes(normArtist) ||
              normArtist.includes(fullArtistStr);

            const titleMatches = songName.includes(normTitle) || normTitle.includes(songName);

            if (!artistMatches || !titleMatches) {
              continue;
            }

            const songId = s.id;
            const lrcRes = await fetch(
              `https://music.163.com/api/song/lyric?os=pc&id=${songId}&lv=-1&kv=-1&tv=-1`,
              {
                headers: this.getHeaders(),
                signal: AbortSignal.timeout(2000),
              }
            );
            if (lrcRes.ok) {
              const lrcData: any = await lrcRes.json();
              const lyricStr = lrcData?.lrc?.lyric;
              if (lyricStr && lyricStr.trim().length > 15 && !lyricStr.includes('纯音乐,请欣赏')) {
                console.log(`[LyricsApi] NetEase VERIFIED lyrics hit for: ${artist} - ${title}`);
                return {
                  syncedLyrics: lyricStr,
                  plainLyrics: null,
                  source: 'lrclib',
                };
              }
            }
          }
        }
      }
    } catch (e) {
      console.warn('[LyricsApi] NetEase fetch error:', e);
    }
    return null;
  }

  /**
   * ── Provider: Musixmatch Desktop API ──
   */
  private static async getMusixmatchToken(): Promise<string | null> {
    if (this.musixmatchToken) return this.musixmatchToken;
    try {
      const res = await fetch(
        'https://apic-desktop.musixmatch.com/ws/1.1/token.get?format=json&app_id=web-desktop-app-v1.0',
        {
          headers: this.getHeaders(),
          signal: AbortSignal.timeout(2000),
        }
      );
      if (res.ok) {
        const data: any = await res.json();
        const token = data?.message?.body?.user_token;
        if (token) {
          this.musixmatchToken = token;
          return token;
        }
      }
    } catch {}
    return null;
  }

  private static async fetchMusixmatch(artist: string, title: string): Promise<LyricsResult | null> {
    try {
      const token = await this.getMusixmatchToken();
      if (!token) return null;

      const url = `https://apic-desktop.musixmatch.com/ws/1.1/macro.subtitles.get?format=json&q_artist=${encodeURIComponent(
        artist
      )}&q_track=${encodeURIComponent(title)}&usertoken=${token}&app_id=web-desktop-app-v1.0`;

      const res = await fetch(url, {
        headers: this.getHeaders(),
        signal: AbortSignal.timeout(2500),
      });

      if (res.ok) {
        const data: any = await res.json();
        const macroCalls = data?.message?.body?.macro_calls;

        const subtitleBody =
          macroCalls?.['track.subtitles.get']?.message?.body?.subtitle_list?.[0]?.subtitle?.subtitle_body;
        if (subtitleBody && subtitleBody.trim().length > 0) {
          console.log(`[LyricsApi] Musixmatch SYNCED lyrics hit for: ${artist} - ${title}`);
          return {
            syncedLyrics: subtitleBody,
            plainLyrics: null,
            source: 'musixmatch',
          };
        }

        const lyricsBody = macroCalls?.['track.lyrics.get']?.message?.body?.lyrics?.lyrics_body;
        if (lyricsBody && lyricsBody.trim().length > 0) {
          console.log(`[LyricsApi] Musixmatch PLAIN lyrics hit for: ${artist} - ${title}`);
          return {
            syncedLyrics: null,
            plainLyrics: lyricsBody,
            source: 'musixmatch',
          };
        }
      }
    } catch {}
    return null;
  }

  /**
   * ── Multi-Provider Lyrics Search (Ultra Fast Concurrent Query) ──
   */
  public static async fetchLyrics(
    artist: string,
    title: string,
    album?: string,
    durationSeconds?: number
  ): Promise<LyricsResult> {
    const primaryArtist = this.cleanArtist(artist);
    const rawArtist = artist.replace(/\s*-\s*Topic$/i, '').trim();
    const cleanTitle = this.cleanTitle(title, primaryArtist);

    if (!primaryArtist || !cleanTitle) {
      return { syncedLyrics: null, plainLyrics: null, source: 'none' };
    }

    console.log(`[LyricsApi] Starting fast multi-provider fetch for: "${primaryArtist}" - "${cleanTitle}"`);

    // 1. Concurrent Fetch across all major providers in parallel
    const [lrclibRes, musixmatchRes, neteaseRes] = await Promise.allSettled([
      this.fetchLrclibFast(primaryArtist, cleanTitle, durationSeconds),
      this.fetchMusixmatch(primaryArtist, cleanTitle),
      this.fetchNetease(primaryArtist, cleanTitle),
    ]);

    // Priority 1: Synced lyrics from LRCLIB
    if (lrclibRes.status === 'fulfilled' && lrclibRes.value?.syncedLyrics) {
      console.log(`[LyricsApi] Selected LRCLIB Synced for: ${primaryArtist} - ${cleanTitle}`);
      return lrclibRes.value;
    }

    // Priority 2: Synced lyrics from Musixmatch
    if (musixmatchRes.status === 'fulfilled' && musixmatchRes.value?.syncedLyrics) {
      console.log(`[LyricsApi] Selected Musixmatch Synced for: ${primaryArtist} - ${cleanTitle}`);
      return musixmatchRes.value;
    }

    // Priority 3: Synced lyrics from NetEase
    if (neteaseRes.status === 'fulfilled' && neteaseRes.value?.syncedLyrics) {
      console.log(`[LyricsApi] Selected NetEase Synced for: ${primaryArtist} - ${cleanTitle}`);
      return neteaseRes.value;
    }

    // Priority 4: Plain lyrics from LRCLIB
    if (lrclibRes.status === 'fulfilled' && lrclibRes.value?.plainLyrics) {
      console.log(`[LyricsApi] Selected LRCLIB Plain for: ${primaryArtist} - ${cleanTitle}`);
      return lrclibRes.value;
    }

    // Priority 5: Plain lyrics from Musixmatch
    if (musixmatchRes.status === 'fulfilled' && musixmatchRes.value?.plainLyrics) {
      console.log(`[LyricsApi] Selected Musixmatch Plain for: ${primaryArtist} - ${cleanTitle}`);
      return musixmatchRes.value;
    }

    // Priority 6: Lyrics.ovh Fallback
    const ovhResult = await this.fetchLyricsOvh(primaryArtist, cleanTitle);
    if (ovhResult) return ovhResult;

    // Fallback: If rawArtist differs from primaryArtist, try LRCLIB with rawArtist
    if (rawArtist && rawArtist !== primaryArtist) {
      const rawRes = await this.fetchLrclibFast(rawArtist, cleanTitle, durationSeconds);
      if (rawRes && (rawRes.syncedLyrics || rawRes.plainLyrics)) {
        return rawRes;
      }
    }

    return {
      syncedLyrics: null,
      plainLyrics: null,
      source: 'none',
    };
  }

  private static async fetchLrclibFast(
    artist: string,
    title: string,
    durationSeconds?: number
  ): Promise<LyricsResult | null> {
    // 1. Direct GET without duration (most reliable)
    try {
      const getUrl = `https://lrclib.net/api/get?artist_name=${encodeURIComponent(
        artist
      )}&track_name=${encodeURIComponent(title)}`;
      const res = await fetch(getUrl, {
        headers: this.getHeaders(),
        signal: AbortSignal.timeout(3000),
      });
      if (res.ok) {
        const data: any = await res.json();
        if (data && (data.syncedLyrics || data.plainLyrics)) {
          return {
            syncedLyrics: data.syncedLyrics || null,
            plainLyrics: data.plainLyrics || null,
            source: 'lrclib',
          };
        }
      }
    } catch {}

    // 2. Direct GET with duration
    if (durationSeconds && durationSeconds > 0) {
      try {
        const getUrl = `https://lrclib.net/api/get?artist_name=${encodeURIComponent(
          artist
        )}&track_name=${encodeURIComponent(title)}&duration=${Math.round(durationSeconds)}`;
        const res = await fetch(getUrl, {
          headers: this.getHeaders(),
          signal: AbortSignal.timeout(3000),
        });
        if (res.ok) {
          const data: any = await res.json();
          if (data && (data.syncedLyrics || data.plainLyrics)) {
            return {
              syncedLyrics: data.syncedLyrics || null,
              plainLyrics: data.plainLyrics || null,
              source: 'lrclib',
            };
          }
        }
      } catch {}
    }

    // 3. Search query
    try {
      const searchUrl = `https://lrclib.net/api/search?q=${encodeURIComponent(`${artist} ${title}`)}`;
      const res = await fetch(searchUrl, {
        headers: this.getHeaders(),
        signal: AbortSignal.timeout(3500),
      });
      if (res.ok) {
        const results = (await res.json()) as any[];
        if (Array.isArray(results) && results.length > 0) {
          const candidate = results.find(
            (r) => (r.syncedLyrics || r.plainLyrics) && this.isArtistMatch(r.artistName, artist)
          );
          if (candidate) {
            return {
              syncedLyrics: candidate.syncedLyrics || null,
              plainLyrics: candidate.plainLyrics || null,
              source: 'lrclib',
            };
          }
        }
      }
    } catch {}

    return null;
  }
}
