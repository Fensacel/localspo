import { SpotifyCollectionMeta, SpotifyTrackMeta } from './spotifyApi';
import { cleanMusicMetadata } from './metadataCleaner';

export class YouTubeApiExtractor {
  public static parseUrl(urlStr: string): { type: 'video'; id: string } | null {
    if (!urlStr) return null;
    const cleanUrl = urlStr.trim();
    const match = cleanUrl.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?.*v=|v\/|embed\/|shorts\/))([a-zA-Z0-9_-]{11})/i);
    if (match && match[1]) {
      return { type: 'video', id: match[1] };
    }
    return null;
  }

  private static async fetchYTMusicDetails(videoId: string): Promise<{
    title?: string;
    artist?: string;
    album?: string;
    releaseDate?: string;
    coverUrl?: string;
  } | null> {
    try {
      const url = `https://music.youtube.com/youtubei/v1/next?alt=json`;
      const body = {
        videoId,
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
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept-Language': 'en-US,en;q=0.9',
        },
        body: JSON.stringify(body),
      });

      if (!res.ok) return null;

      const json: any = await res.json();
      const itemData =
        json?.contents?.singleColumnMusicWatchNextResultsRenderer?.tabbedRenderer?.watchNextTabRenderer?.content
          ?.musicQueueRenderer?.content?.playlistPanelRenderer?.contents?.[0]?.playlistPanelVideoRenderer;

      if (!itemData) return null;

      const rawTitle = itemData.title?.runs?.[0]?.text;
      const secondColRuns = itemData.longBylineText?.runs || [];

      const rawArtist = secondColRuns[0]?.text;
      const rawAlbum = secondColRuns[2]?.text;
      const rawYear = secondColRuns[4]?.text || secondColRuns[2]?.text;

      const thumbs = itemData.thumbnail?.thumbnails || [];
      const coverUrl = thumbs.length > 0 ? thumbs[thumbs.length - 1].url : undefined;

      return {
        title: rawTitle,
        artist: rawArtist,
        album: rawAlbum,
        releaseDate: /^\d{4}$/.test(rawYear) ? rawYear : undefined,
        coverUrl,
      };
    } catch (e) {
      console.warn('[YouTubeAPI] YTMusic details lookup failed:', e);
      return null;
    }
  }

  public static async fetchMetadata(urlStr: string): Promise<SpotifyCollectionMeta> {
    const parsed = this.parseUrl(urlStr);
    if (!parsed) {
      throw new Error('Invalid YouTube URL');
    }

    const { id } = parsed;
    const videoUrl = `https://www.youtube.com/watch?v=${id}`;

    // 1. Try YouTube Music next API for rich official metadata
    const ytMusicMeta = await this.fetchYTMusicDetails(id);
    if (ytMusicMeta && (ytMusicMeta.title || ytMusicMeta.artist)) {
      const cleaned = cleanMusicMetadata({
        title: ytMusicMeta.title || 'YouTube Track',
        artist: ytMusicMeta.artist || 'YouTube',
        album: ytMusicMeta.album,
      });

      const track: SpotifyTrackMeta = {
        id: `yt_${id}`,
        spotifyUrl: videoUrl,
        title: cleaned.title,
        artist: cleaned.artist,
        artistNames: [cleaned.artist],
        album: cleaned.album,
        coverUrl: ytMusicMeta.coverUrl || `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
        durationMs: 0,
        releaseDate: ytMusicMeta.releaseDate,
        type: 'track',
      };

      return {
        type: 'track',
        id: `yt_${id}`,
        title: track.title,
        artist: track.artist,
        coverUrl: track.coverUrl,
        tracks: [track],
      };
    }

    // 2. Fallback to oEmbed metadata if YTMusic API unavailable
    try {
      const oembedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(videoUrl)}&format=json`;
      const res = await fetch(oembedUrl);

      if (res.ok) {
        const data = (await res.json()) as Record<string, string>;
        const rawTitle = data.title || 'YouTube Track';
        const author = data.author_name || 'YouTube';
        const coverUrl = data.thumbnail_url || `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;

        let title = rawTitle;
        let artist = author;

        if (rawTitle.includes(' - ')) {
          const parts = rawTitle.split(' - ');
          artist = parts[0].trim();
          title = parts.slice(1).join(' - ').trim() || rawTitle;
        }

        const cleaned = cleanMusicMetadata({
          title,
          artist,
          album: '',
        });

        const track: SpotifyTrackMeta = {
          id: `yt_${id}`,
          spotifyUrl: videoUrl,
          title: cleaned.title,
          artist: cleaned.artist,
          artistNames: [cleaned.artist],
          album: cleaned.album,
          coverUrl,
          durationMs: 0,
          type: 'track',
        };

        return {
          type: 'track',
          id: `yt_${id}`,
          title: track.title,
          artist: track.artist,
          coverUrl: track.coverUrl,
          tracks: [track],
        };
      }
    } catch (err) {
      console.warn('Failed to fetch YouTube oEmbed metadata, using fallback:', err);
    }

    // 3. Last resort fallback
    const cleaned = cleanMusicMetadata({
      title: `YouTube Video (${id})`,
      artist: 'YouTube',
    });

    const track: SpotifyTrackMeta = {
      id: `yt_${id}`,
      spotifyUrl: videoUrl,
      title: cleaned.title,
      artist: cleaned.artist,
      artistNames: [cleaned.artist],
      album: cleaned.album,
      coverUrl: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
      durationMs: 0,
      type: 'track',
    };

    return {
      type: 'track',
      id: `yt_${id}`,
      title: track.title,
      artist: track.artist,
      coverUrl: track.coverUrl,
      tracks: [track],
    };
  }
}
