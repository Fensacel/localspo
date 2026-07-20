export interface YTSearchResult {
  videoId: string;
  title: string;
  artist: string;
  durationSeconds: number;
}

export class YTMusicApi {
  public static buildSearchQuery(artist: string, title: string, album?: string): string {
    const cleanArtist = artist.replace(/ feat\..*$/i, '').replace(/ ft\..*$/i, '').trim();
    const cleanTitle = title.trim();
    if (album && album.toLowerCase() !== title.toLowerCase()) {
      return `${cleanArtist} - ${cleanTitle} ${album}`;
    }
    return `${cleanArtist} - ${cleanTitle}`;
  }

  public static async searchVideo(artist: string, title: string, album?: string): Promise<YTSearchResult | null> {
    const query = this.buildSearchQuery(artist, title, album);
    
    try {
      const url = `https://music.youtube.com/youtubei/v1/search?alt=json`;
      const body = {
        query,
        params: 'EgWKAQIIAWoKEAoQAxAEEAkQBQ%3D%3D',
        context: {
          client: {
            clientName: 'WEB_REMIX',
            clientVersion: '1.20240101.01.00',
            hl: 'en',
            gl: 'US',
          },
        },
      };

      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept-Language': 'en-US,en;q=0.9',
        },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        const json: unknown = await res.json();
        const videoId = this.parseVideoIdFromYtJson(json, title, artist);
        if (videoId) {
          return {
            videoId,
            title,
            artist,
            durationSeconds: 0,
          };
        }
      }
    } catch (e) {
      console.warn('YTMusic API search error, fallback to yt-dlp search:', e);
    }

    return null;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private static parseVideoIdFromYtJson(json: any, requestedTitle: string, requestedArtist: string): string | null {
    try {
      if (!json || typeof json !== 'object') return null;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const data = json as any;
      const contents = data?.contents?.tabbedSearchResultsRenderer?.tabs?.[0]?.tabRenderer?.content?.sectionListRenderer?.contents;
      if (!Array.isArray(contents)) return null;

      const normReqTitle = requestedTitle.toLowerCase().trim();
      const normReqArtist = requestedArtist.toLowerCase().split(',')[0].replace(/ feat\..*$/i, '').replace(/ ft\..*$/i, '').trim();

      const forbiddenKeywords = [
        'spanish', 'espanol', 'español', 'traducida', 'traduccion',
        'cover', 'bachata', 'reggae', 'instrumental', 'karaoke',
        'slowed', 'reverb', 'tribute', 'parody', 'remix'
      ];

      // Don't forbid keywords if requested title explicitly contains them
      const allowedForbidden = forbiddenKeywords.filter((k) => normReqTitle.includes(k));
      const activeForbidden = forbiddenKeywords.filter((k) => !allowedForbidden.includes(k));

      interface Candidate {
        videoId: string;
        title: string;
        artist: string;
        score: number;
      }

      const candidates: Candidate[] = [];

      for (const section of contents) {
        const shelf = section?.musicShelfRenderer || section?.musicCardShelfRenderer;
        if (!shelf) continue;

        const items = shelf.contents || [shelf];
        for (const item of items) {
          const itemData = item.musicResponsiveListItemRenderer || item;

          const titleRun = itemData?.flexColumns?.[0]?.musicResponsiveListItemFlexColumnRenderer?.text?.runs?.[0]?.text || '';
          const artistRun = itemData?.flexColumns?.[1]?.musicResponsiveListItemFlexColumnRenderer?.text?.runs?.[0]?.text || '';

          const videoId =
            itemData?.overlay?.musicItemThumbnailOverlayRenderer?.content?.musicPlayButtonRenderer?.playNavigationEndpoint?.watchEndpoint?.videoId ||
            itemData?.navigationEndpoint?.watchEndpoint?.videoId;

          if (!videoId || !titleRun || typeof videoId !== 'string') continue;

          const normCandTitle = (titleRun as string).toLowerCase().trim();
          const normCandArtist = (artistRun as string).toLowerCase().trim();

          // Reject if candidate contains forbidden keyword (e.g. "spanish version", "cover", "bachata")
          const isForbidden = activeForbidden.some((k) => normCandTitle.includes(k));
          if (isForbidden) continue;

          let score = 0;

          // Check title match
          if (normCandTitle === normReqTitle) {
            score += 100;
          } else if (normCandTitle.includes(normReqTitle) || normReqTitle.includes(normCandTitle)) {
            score += 60;
          } else {
            const reqWords = normReqTitle.split(/\s+/).filter((w) => w.length > 2);
            const candWords = normCandTitle.split(/\s+/).filter((w) => w.length > 2);
            const matchCount = reqWords.filter((w) => candWords.includes(w)).length;
            if (reqWords.length > 0 && matchCount / reqWords.length >= 0.5) {
              score += 30;
            } else {
              // Title doesn't match expected title (e.g. translated titles like "Lo Arriesgo Todo")
              continue;
            }
          }

          // Artist match bonus
          if (normCandArtist && (normCandArtist.includes(normReqArtist) || normReqArtist.includes(normCandArtist))) {
            score += 40;
          }

          candidates.push({ videoId: videoId as string, title: titleRun as string, artist: artistRun as string, score });
        }
      }

      candidates.sort((a, b) => b.score - a.score);

      if (candidates.length > 0 && candidates[0].score >= 30) {
        return candidates[0].videoId;
      }
    } catch (err) {
      console.warn('Failed parsing YTMusic JSON:', err);
    }
    return null;
  }
}
