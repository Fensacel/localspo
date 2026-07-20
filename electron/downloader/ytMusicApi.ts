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
          },
        },
      };

      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        const json: any = await res.json();
        const videoId = this.parseVideoIdFromYtJson(json);
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

  private static parseVideoIdFromYtJson(json: any): string | null {
    try {
      const contents = json?.contents?.tabbedSearchResultsRenderer?.tabs?.[0]?.tabRenderer?.content?.sectionListRenderer?.contents;
      if (!Array.isArray(contents)) return null;

      for (const section of contents) {
        const shelf = section?.musicShelfRenderer || section?.musicCardShelfRenderer;
        if (!shelf) continue;

        const items = shelf.contents || [shelf];
        for (const item of items) {
          const itemData = item.musicResponsiveListItemRenderer || item;
          const overlay = itemData?.overlay?.musicItemThumbnailOverlayRenderer?.content?.musicPlayButtonRenderer;
          const playEndpoint = overlay?.playNavigationEndpoint?.watchEndpoint?.videoId;
          if (playEndpoint) return playEndpoint;

          const onTap = itemData?.navigationEndpoint?.watchEndpoint?.videoId;
          if (onTap) return onTap;
        }
      }
    } catch (err) {
      console.warn('Failed parsing YTMusic JSON:', err);
    }
    return null;
  }
}
