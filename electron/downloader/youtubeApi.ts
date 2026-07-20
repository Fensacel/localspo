import { SpotifyCollectionMeta, SpotifyTrackMeta } from './spotifyApi';

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

  public static async fetchMetadata(urlStr: string): Promise<SpotifyCollectionMeta> {
    const parsed = this.parseUrl(urlStr);
    if (!parsed) {
      throw new Error('Invalid YouTube URL');
    }

    const { id } = parsed;
    const videoUrl = `https://www.youtube.com/watch?v=${id}`;

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
          title = parts.slice(1).join(' - ').replace(/\[.*?\]|\(.*?\)/g, '').trim() || rawTitle;
        }

        const track: SpotifyTrackMeta = {
          id: `yt_${id}`,
          spotifyUrl: videoUrl,
          title: title || rawTitle,
          artist: artist || author,
          artistNames: [artist || author],
          album: 'YouTube',
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

    // Fallback if oEmbed fails
    const track: SpotifyTrackMeta = {
      id: `yt_${id}`,
      spotifyUrl: videoUrl,
      title: `YouTube Video (${id})`,
      artist: 'YouTube',
      artistNames: ['YouTube'],
      album: 'YouTube',
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
