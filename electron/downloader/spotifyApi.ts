export interface SpotifyTrackMeta {
  id: string;
  spotifyUrl: string;
  title: string;
  artist: string;
  artistNames: string[];
  album: string;
  coverUrl: string | null;
  durationMs: number;
  releaseDate?: string;
  trackNumber?: number;
  discNumber?: number;
  type: 'track' | 'episode';
}

export interface SpotifyCollectionMeta {
  type: 'album' | 'playlist' | 'track' | 'episode';
  id: string;
  title: string;
  artist?: string;
  coverUrl: string | null;
  tracks: SpotifyTrackMeta[];
}

export class SpotifyApiExtractor {
  public static parseUrl(urlStr: string): { type: 'track' | 'album' | 'playlist' | 'episode'; id: string } | null {
    if (!urlStr) return null;
    const cleanUrl = urlStr.trim();
    
    // spotify:track:id format
    const spotifyUriMatch = cleanUrl.match(/^spotify:(track|album|playlist|episode):([a-zA-Z0-9]+)/i);
    if (spotifyUriMatch) {
      return {
        type: spotifyUriMatch[1].toLowerCase() as any,
        id: spotifyUriMatch[2],
      };
    }

    // https://open.spotify.com/track/id format
    const httpMatch = cleanUrl.match(/open\.spotify\.com\/(track|album|playlist|episode)\/([a-zA-Z0-9]+)/i);
    if (httpMatch) {
      return {
        type: httpMatch[1].toLowerCase() as any,
        id: httpMatch[2],
      };
    }

    return null;
  }

  public static async fetchMetadata(urlStr: string): Promise<SpotifyCollectionMeta> {
    const parsed = this.parseUrl(urlStr);
    if (!parsed) {
      throw new Error('Invalid Spotify URL or URI');
    }

    const { type, id } = parsed;

    if (type === 'track') {
      const track = await this.fetchSingleTrack(id);
      return {
        type: 'track',
        id,
        title: track.title,
        artist: track.artist,
        coverUrl: track.coverUrl,
        tracks: [track],
      };
    }

    if (type === 'episode') {
      const track = await this.fetchEpisode(id);
      return {
        type: 'episode',
        id,
        title: track.title,
        artist: track.artist,
        coverUrl: track.coverUrl,
        tracks: [track],
      };
    }

    if (type === 'album') {
      return await this.fetchAlbum(id);
    }

    if (type === 'playlist') {
      return await this.fetchPlaylist(id);
    }

    throw new Error(`Unsupported entity type: ${type}`);
  }

  private static async fetchSingleTrack(id: string): Promise<SpotifyTrackMeta> {
    const pageUrl = `https://open.spotify.com/track/${id}`;
    const html = await this.httpGet(pageUrl);

    // Try parsing initialState script tag
    const initialStateMatch = html.match(/<script\s+id="initialState"\s+type="text\/plain">\s*(.+?)\s*<\/script>/s);
    if (initialStateMatch && initialStateMatch[1]) {
      try {
        const decoded = Buffer.from(initialStateMatch[1], 'base64').toString('utf-8');
        const json = JSON.parse(decoded);
        const entity = json?.entities?.items?.[`spotify:track:${id}`] || json?.entities?.items?.[id];
        if (entity) {
          return this.formatTrackEntity(entity, id);
        }
      } catch (e) {
        console.warn('Failed to parse initialState:', e);
      }
    }

    // Try embed page JSON
    try {
      const embedHtml = await this.httpGet(`https://open.spotify.com/embed/track/${id}`);
      const embedScriptMatch = embedHtml.match(/<script id="__NEXT_DATA__"\s+type="application\/json">\s*(.+?)\s*<\/script>/s);
      if (embedScriptMatch && embedScriptMatch[1]) {
        const embedJson = JSON.parse(embedScriptMatch[1]);
        const trackData = embedJson?.props?.pageProps?.state?.data?.entity;
        if (trackData) {
          const title = trackData.title || trackData.name || 'Unknown Title';
          const artists = trackData.artists?.map((a: any) => a.name) || [trackData.artist || 'Unknown Artist'];
          let coverUrl =
            trackData.visualIdentity?.imageRight?.[0]?.url ||
            trackData.coverArt?.sources?.[0]?.url ||
            trackData.album?.coverArt?.sources?.[0]?.url ||
            trackData.album?.images?.[0]?.url ||
            trackData.images?.[0]?.url ||
            null;

          if (!coverUrl) {
            try {
              const oembed = await this.httpGetJson(`https://open.spotify.com/oembed?url=https://open.spotify.com/track/${id}`);
              if (oembed && oembed.thumbnail_url) {
                coverUrl = oembed.thumbnail_url;
              }
            } catch {}
          }

          const durationMs = trackData.duration || trackData.durationMs || 0;

          return {
            id,
            spotifyUrl: `https://open.spotify.com/track/${id}`,
            title,
            artist: artists.join(', '),
            artistNames: artists,
            album: trackData.album?.name || title,
            coverUrl,
            durationMs,
            releaseDate: trackData.releaseDate?.isoString || trackData.album?.releaseDate,
            trackNumber: trackData.trackNumber || 1,
            discNumber: trackData.discNumber || 1,
            type: 'track',
          };
        }
      }
    } catch (e) {
      console.warn('Failed to parse embed page:', e);
    }

    // Fallback: oEmbed API
    const oembedJson = await this.httpGetJson(`https://open.spotify.com/oembed?url=https://open.spotify.com/track/${id}`);
    if (oembedJson && oembedJson.title) {
      return {
        id,
        spotifyUrl: `https://open.spotify.com/track/${id}`,
        title: oembedJson.title,
        artist: oembedJson.author_name || 'Unknown Artist',
        artistNames: [oembedJson.author_name || 'Unknown Artist'],
        album: oembedJson.title,
        coverUrl: oembedJson.thumbnail_url || null,
        durationMs: 0,
        type: 'track',
      };
    }

    throw new Error(`Could not fetch metadata for Spotify Track ${id}`);
  }

  private static async fetchEpisode(id: string): Promise<SpotifyTrackMeta> {
    const oembedJson = await this.httpGetJson(`https://open.spotify.com/oembed?url=https://open.spotify.com/episode/${id}`);
    if (oembedJson && oembedJson.title) {
      return {
        id,
        spotifyUrl: `https://open.spotify.com/episode/${id}`,
        title: oembedJson.title,
        artist: oembedJson.author_name || 'Podcast Host',
        artistNames: [oembedJson.author_name || 'Podcast Host'],
        album: 'Podcast',
        coverUrl: oembedJson.thumbnail_url || null,
        durationMs: 0,
        type: 'episode',
      };
    }
    throw new Error(`Could not fetch metadata for Spotify Episode ${id}`);
  }

  private static async fetchAlbum(id: string): Promise<SpotifyCollectionMeta> {
    const pageUrl = `https://open.spotify.com/album/${id}`;
    const html = await this.httpGet(pageUrl);

    // Try initialState base64
    const initialStateMatch = html.match(/<script\s+id="initialState"\s+type="text\/plain">\s*(.+?)\s*<\/script>/s);
    if (initialStateMatch && initialStateMatch[1]) {
      try {
        const decoded = Buffer.from(initialStateMatch[1], 'base64').toString('utf-8');
        const json = JSON.parse(decoded);
        const albumEntity = json?.entities?.items?.[`spotify:album:${id}`] || json?.entities?.items?.[id];
        if (albumEntity) {
          const albumTitle = albumEntity.name || 'Unknown Album';
          const albumArtist = albumEntity.artists?.map((a: any) => a.name).join(', ') || 'Unknown Artist';
          const coverUrl = albumEntity.images?.[0]?.url || albumEntity.coverArt?.sources?.[0]?.url || null;

          const rawTracks = albumEntity.tracks?.items || albumEntity.tracks || [];
          const tracks: SpotifyTrackMeta[] = rawTracks.map((t: any, idx: number) => {
            const artists = t.artists?.map((a: any) => a.name) || [albumArtist];
            return {
              id: t.id || `${id}_${idx}`,
              spotifyUrl: t.id ? `https://open.spotify.com/track/${t.id}` : pageUrl,
              title: t.name || t.title || `Track ${idx + 1}`,
              artist: artists.join(', '),
              artistNames: artists,
              album: albumTitle,
              coverUrl,
              durationMs: t.duration_ms || t.durationMs || 0,
              trackNumber: t.track_number || idx + 1,
              discNumber: t.disc_number || 1,
              type: 'track',
            };
          });

          return {
            type: 'album',
            id,
            title: albumTitle,
            artist: albumArtist,
            coverUrl,
            tracks,
          };
        }
      } catch (e) {
        console.warn('Failed parsing album initialState:', e);
      }
    }

    // Try embed page
    const embedHtml = await this.httpGet(`https://open.spotify.com/embed/album/${id}`);
    const embedScriptMatch = embedHtml.match(/<script id="__NEXT_DATA__"\s+type="application\/json">\s*(.+?)\s*<\/script>/s);
    if (embedScriptMatch && embedScriptMatch[1]) {
      const embedJson = JSON.parse(embedScriptMatch[1]);
      const entity = embedJson?.props?.pageProps?.state?.data?.entity;
      if (entity) {
        const albumTitle = entity.title || entity.name || 'Unknown Album';
        const albumArtist = entity.artists?.map((a: any) => a.name).join(', ') || entity.artist || 'Unknown Artist';
        const coverUrl = entity.visualIdentity?.imageRight?.[0]?.url || entity.coverArt?.sources?.[0]?.url || null;
        const trackList = entity.trackList || [];

        const tracks: SpotifyTrackMeta[] = trackList.map((t: any, idx: number) => {
          const artists = t.artists?.map((a: any) => a.name) || [t.subtitle || albumArtist];
          return {
            id: t.uri?.split(':')?.[2] || `${id}_${idx}`,
            spotifyUrl: t.uri?.startsWith('spotify:track:') ? `https://open.spotify.com/track/${t.uri.split(':')[2]}` : pageUrl,
            title: t.title || t.name || `Track ${idx + 1}`,
            artist: artists.join(', '),
            artistNames: artists,
            album: albumTitle,
            coverUrl,
            durationMs: t.duration || 0,
            trackNumber: idx + 1,
            type: 'track',
          };
        });

        return {
          type: 'album',
          id,
          title: albumTitle,
          artist: albumArtist,
          coverUrl,
          tracks,
        };
      }
    }

    throw new Error(`Could not fetch metadata for Spotify Album ${id}`);
  }

  private static async fetchPlaylist(id: string): Promise<SpotifyCollectionMeta> {
    const pageUrl = `https://open.spotify.com/playlist/${id}`;
    const html = await this.httpGet(pageUrl);

    // Try initialState base64
    const initialStateMatch = html.match(/<script\s+id="initialState"\s+type="text\/plain">\s*(.+?)\s*<\/script>/s);
    if (initialStateMatch && initialStateMatch[1]) {
      try {
        const decoded = Buffer.from(initialStateMatch[1], 'base64').toString('utf-8');
        const json = JSON.parse(decoded);
        const playlistEntity = json?.entities?.items?.[`spotify:playlist:${id}`] || json?.entities?.items?.[id];
        if (playlistEntity) {
          const playlistTitle = playlistEntity.name || 'Unknown Playlist';
          const coverUrl = playlistEntity.images?.[0]?.url || null;

          const rawTracks = playlistEntity.tracks?.items || playlistEntity.contents?.items || [];
          const tracks: SpotifyTrackMeta[] = [];
          
          for (let i = 0; i < rawTracks.length; i++) {
            const item = rawTracks[i];
            const track = item.track || item;
            if (!track || !track.name) continue;

            const artists = track.artists?.map((a: any) => a.name) || ['Unknown Artist'];
            tracks.push({
              id: track.id || `${id}_${i}`,
              spotifyUrl: track.id ? `https://open.spotify.com/track/${track.id}` : pageUrl,
              title: track.name,
              artist: artists.join(', '),
              artistNames: artists,
              album: track.album?.name || playlistTitle,
              coverUrl: track.album?.images?.[0]?.url || coverUrl,
              durationMs: track.duration_ms || track.durationMs || 0,
              trackNumber: i + 1,
              type: 'track',
            });
          }

          return {
            type: 'playlist',
            id,
            title: playlistTitle,
            coverUrl,
            tracks,
          };
        }
      } catch (e) {
        console.warn('Failed parsing playlist initialState:', e);
      }
    }

    // Try embed page
    const embedHtml = await this.httpGet(`https://open.spotify.com/embed/playlist/${id}`);
    const embedScriptMatch = embedHtml.match(/<script id="__NEXT_DATA__"\s+type="application\/json">\s*(.+?)\s*<\/script>/s);
    if (embedScriptMatch && embedScriptMatch[1]) {
      const embedJson = JSON.parse(embedScriptMatch[1]);
      const entity = embedJson?.props?.pageProps?.state?.data?.entity;
      if (entity) {
        const playlistTitle = entity.title || entity.name || 'Unknown Playlist';
        const playlistCoverUrl = entity.coverArt?.sources?.[0]?.url || null;
        const trackList = entity.trackList || [];

        const tracks: SpotifyTrackMeta[] = [];
        for (let idx = 0; idx < trackList.length; idx++) {
          const t = trackList[idx];
          const trackId = t.uri?.startsWith('spotify:track:') ? t.uri.split(':')[2] : (t.id || null);
          const artists = t.subtitle ? [t.subtitle] : ['Unknown Artist'];

          let trackCoverUrl =
            t.album?.images?.[0]?.url ||
            t.album?.coverArt?.sources?.[0]?.url ||
            t.coverArt?.sources?.[0]?.url ||
            t.visualIdentity?.imageRight?.[0]?.url ||
            null;

          if (!trackCoverUrl && trackId) {
            try {
              const oembed = await this.httpGetJson(`https://open.spotify.com/oembed?url=https://open.spotify.com/track/${trackId}`);
              if (oembed && oembed.thumbnail_url) {
                trackCoverUrl = oembed.thumbnail_url;
              }
            } catch {}
          }

          tracks.push({
            id: trackId || `${id}_${idx}`,
            spotifyUrl: trackId ? `https://open.spotify.com/track/${trackId}` : pageUrl,
            title: t.title || t.name || `Track ${idx + 1}`,
            artist: artists.join(', '),
            artistNames: artists,
            album: t.album?.name || playlistTitle,
            coverUrl: trackCoverUrl || playlistCoverUrl,
            durationMs: t.duration || 0,
            trackNumber: idx + 1,
            type: 'track',
          });
        }

        return {
          type: 'playlist',
          id,
          title: playlistTitle,
          coverUrl: playlistCoverUrl,
          tracks,
        };
      }
    }

    throw new Error(`Could not fetch metadata for Spotify Playlist ${id}`);
  }

  private static formatTrackEntity(entity: any, id: string): SpotifyTrackMeta {
    const title = entity.name || 'Unknown Title';
    const artists = entity.artists?.map((a: any) => a.name) || ['Unknown Artist'];
    const coverUrl = entity.album?.images?.[0]?.url || entity.album?.coverArt?.sources?.[0]?.url || null;
    const durationMs = entity.duration_ms || entity.durationMs || 0;

    return {
      id,
      spotifyUrl: `https://open.spotify.com/track/${id}`,
      title,
      artist: artists.join(', '),
      artistNames: artists,
      album: entity.album?.name || title,
      coverUrl,
      durationMs,
      releaseDate: entity.album?.release_date || entity.album?.releaseDate,
      trackNumber: entity.track_number || entity.trackNumber || 1,
      discNumber: entity.disc_number || entity.discNumber || 1,
      type: 'track',
    };
  }

  private static async httpGet(url: string): Promise<string> {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      },
    });
    if (!res.ok) {
      throw new Error(`HTTP Error ${res.status}: ${res.statusText}`);
    }
    return await res.text();
  }

  private static async httpGetJson(url: string): Promise<any> {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko)',
        'Accept': 'application/json',
      },
    });
    if (!res.ok) return null;
    return await res.json();
  }
}
