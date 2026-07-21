import { cleanArtistName, cleanMusicMetadata, normalizeImageUrl } from './metadataCleaner';

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

  public static async searchYTMusic(
    query: string,
    types: ('track' | 'album' | 'artist' | 'playlist')[] = ['track', 'album', 'artist', 'playlist'],
  ): Promise<{
    tracks: any[];
    albums: any[];
    artists: any[];
    playlists: any[];
  }> {
    const tracks: any[] = [];
    const albums: any[] = [];
    const artists: any[] = [];
    const playlists: any[] = [];

    const fetchYT = async (searchParams?: string) => {
      try {
        const url = `https://music.youtube.com/youtubei/v1/search?alt=json`;
        const body: any = {
          query,
          context: {
            client: {
              clientName: 'WEB_REMIX',
              clientVersion: '1.20240101.01.00',
              hl: 'en',
              gl: 'US',
            },
          },
        };
        if (searchParams) {
          body.params = searchParams;
        }

        const res = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'User-Agent':
              'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept-Language': 'en-US,en;q=0.9',
          },
          body: JSON.stringify(body),
        });

        if (res.ok) {
          return await res.json();
        }
      } catch (err) {
        console.warn('YTMusic fetch error:', err);
      }
      return null;
    };

    const isOnlyTracks = types.length === 1 && types[0] === 'track';
    const isOnlyAlbums = types.length === 1 && types[0] === 'album';
    const isOnlyArtists = types.length === 1 && types[0] === 'artist';
    const isOnlyPlaylists = types.length === 1 && types[0] === 'playlist';

    let jsonTarget: any = null;
    let categoryParam: string | undefined;

    if (isOnlyTracks) {
      categoryParam = 'EgWKAQIIAWoKEAoQAxAEEAkQBQ%3D%3D'; // Songs filter -> 20+ tracks
    } else if (isOnlyAlbums) {
      categoryParam = 'EgWKAQIBAWoKEAoQAxAEEAkQBQ%3D%3D'; // Albums filter -> 20+ albums
    } else if (isOnlyArtists) {
      categoryParam = 'EgWKAQIgAWoKEAoQAxAEEAkQBQ%3D%3D'; // Artists filter -> 20+ artists
    } else if (isOnlyPlaylists) {
      categoryParam = 'EgWKAQIECWoKEAoQAxAEEAkQBQ%3D%3D'; // Playlists filter -> 20+ playlists
    }

    if (categoryParam) {
      jsonTarget = await fetchYT(categoryParam);
      this.parseItemsFromYtJson(jsonTarget, tracks, albums, artists, playlists);
    } else {
      const [gen, songsGen] = await Promise.all([
        fetchYT(),
        fetchYT('EgWKAQIIAWoKEAoQAxAEEAkQBQ%3D%3D'),
      ]);
      this.parseItemsFromYtJson(songsGen || gen, tracks, albums, artists, playlists);
      if (gen && gen !== songsGen) {
        this.parseItemsFromYtJson(gen, tracks, albums, artists, playlists);
      }
    }

    const uniqueTracks = Array.from(new Map(tracks.map((t) => [t.id, t])).values());
    const uniqueAlbums = Array.from(new Map(albums.map((a) => [a.id, a])).values());
    const uniqueArtists = Array.from(new Map(artists.map((ar) => [ar.id, ar])).values());
    const uniquePlaylists = Array.from(new Map(playlists.map((p) => [p.id, p])).values());

    return {
      tracks: uniqueTracks,
      albums: uniqueAlbums,
      artists: uniqueArtists,
      playlists: uniquePlaylists,
    };
  }

  private static parseItemsFromYtJson(
    json: any,
    tracks: any[],
    albums: any[],
    artists: any[],
    playlists: any[],
  ): void {
    if (!json || typeof json !== 'object') return;

    const contents =
      json?.contents?.tabbedSearchResultsRenderer?.tabs?.[0]?.tabRenderer?.content
        ?.sectionListRenderer?.contents ||
      json?.contents?.sectionListRenderer?.contents;

    if (!Array.isArray(contents)) return;

    for (const section of contents) {
      const shelf = section?.musicShelfRenderer || section?.musicCardShelfRenderer;
      if (!shelf) continue;

      const shelfTitle = (shelf.title?.runs?.[0]?.text || '').toLowerCase();
      const items = shelf.contents || [shelf];

      for (const item of items) {
        const data = item.musicResponsiveListItemRenderer || item;
        if (!data) continue;

        const titleRun =
          data.flexColumns?.[0]?.musicResponsiveListItemFlexColumnRenderer?.text?.runs?.[0]?.text || '';
        const secondColRuns =
          data.flexColumns?.[1]?.musicResponsiveListItemFlexColumnRenderer?.text?.runs || [];
        const subtitle = secondColRuns.map((r: any) => r.text).join('');

        const thumbs =
          data.thumbnail?.musicThumbnailRenderer?.thumbnail?.thumbnails ||
          data.thumbnail?.thumbnails ||
          [];
        let coverUrl = thumbs.length > 0 ? thumbs[thumbs.length - 1].url : null;

        const videoId =
          data.overlay?.musicItemThumbnailOverlayRenderer?.content?.musicPlayButtonRenderer
            ?.playNavigationEndpoint?.watchEndpoint?.videoId ||
          data.navigationEndpoint?.watchEndpoint?.videoId;

        if (videoId && !coverUrl) {
          coverUrl = `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`;
        }
        coverUrl = normalizeImageUrl(coverUrl);

        const browseId = data.navigationEndpoint?.browseEndpoint?.browseId;

        if (videoId && titleRun) {
          // Extract text runs from column 1 (ignoring category tags & bullets)
          const runsText = secondColRuns
            .map((r: any) => (r.text || '').trim())
            .filter((t: string) => t && t !== '•' && t !== ',');

          const filteredParts = runsText.filter(
            (p: string) => !['song', 'video', 'music video'].includes(p.toLowerCase())
          );

          const rawArtist = filteredParts[0] || 'YouTube';
          let rawAlbum = '';
          if (filteredParts.length > 1) {
            const candidateAlbum = filteredParts[1];
            if (!/^\d+:\d+$/.test(candidateAlbum) && !/views$/i.test(candidateAlbum) && !/^\d{4}$/.test(candidateAlbum)) {
              rawAlbum = candidateAlbum;
            }
          }

          const cleaned = cleanMusicMetadata({
            title: titleRun,
            artist: rawArtist,
            album: rawAlbum,
          });

          tracks.push({
            id: videoId,
            title: cleaned.title,
            artist: cleaned.artist,
            artistNames: [cleaned.artist],
            album: cleaned.album,
            coverUrl,
            durationMs: 0,
            spotifyUrl: `https://www.youtube.com/watch?v=${videoId}`,
          });
        } else if (browseId && (shelfTitle.includes('album') || browseId.startsWith('MPRE'))) {
          const rawArtist = secondColRuns[2]?.text || secondColRuns[0]?.text || 'YouTube Artist';
          const cleanedArtist = cleanArtistName(rawArtist);
          const cleanedAlbum = cleanMusicMetadata({ title: titleRun, artist: cleanedArtist }).title;

          albums.push({
            id: browseId,
            name: cleanedAlbum,
            artist: cleanedArtist,
            coverUrl,
            trackCount: 0,
            releaseDate: '',
            spotifyUrl: `https://music.youtube.com/browse/${browseId}`,
          });
        } else if (browseId && (shelfTitle.includes('artist') || browseId.startsWith('UC'))) {
          const cleanedArtist = cleanArtistName(titleRun);
          artists.push({
            id: browseId,
            name: cleanedArtist,
            coverUrl,
            genres: [],
            spotifyUrl: `https://music.youtube.com/channel/${browseId}`,
          });
        } else if (
          browseId &&
          (shelfTitle.includes('playlist') || browseId.startsWith('VL') || browseId.startsWith('PL'))
        ) {
          playlists.push({
            id: browseId.replace(/^VL/, ''),
            name: titleRun,
            description: subtitle,
            owner: secondColRuns[2]?.text || 'YouTube',
            coverUrl,
            trackCount: 0,
            spotifyUrl: `https://www.youtube.com/playlist?list=${browseId.replace(/^VL/, '')}`,
          });
        }
      }
    }
  }
}
