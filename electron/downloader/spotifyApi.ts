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

  // Extended ID3 Metadata
  isrc?: string;
  publisher?: string;
  copyright?: string;
  composer?: string;
  bpm?: number;
  key?: string;
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
  private static cachedAccessToken: { token: string; expiresAt: number } | null = null;

  private static async getAnonymousAccessToken(): Promise<string | null> {
    if (this.cachedAccessToken && Date.now() < this.cachedAccessToken.expiresAt) {
      return this.cachedAccessToken.token;
    }
    try {
      const res = await this.httpGetJson('https://open.spotify.com/get_access_token?reason=transport&productType=web_player');
      if (res && res.accessToken) {
        this.cachedAccessToken = {
          token: res.accessToken,
          expiresAt: Date.now() + (res.accessTokenExpirationTimestampMs ? res.accessTokenExpirationTimestampMs - Date.now() - 60000 : 3000000),
        };
        return res.accessToken;
      }
    } catch (e) {
      console.warn('Failed fetching Spotify web player token:', e);
    }
    return null;
  }

  private static async enrichTracksWithWebApi(tracks: SpotifyTrackMeta[]): Promise<void> {
    const token = await this.getAnonymousAccessToken();
    if (!token) return;

    const trackMap = new Map<string, SpotifyTrackMeta>();
    const validIds: string[] = [];

    for (const track of tracks) {
      if (track.id && !track.id.includes('_') && !track.id.includes(':')) {
        trackMap.set(track.id, track);
        validIds.push(track.id);
      }
    }

    if (validIds.length === 0) return;

    for (let i = 0; i < validIds.length; i += 50) {
      const chunk = validIds.slice(i, i + 50);
      try {
        const res = await this.httpGetJson(`https://api.spotify.com/v1/tracks?ids=${chunk.join(',')}`, {
          Authorization: `Bearer ${token}`,
        });
        if (res && Array.isArray(res.tracks)) {
          const albumIdsToFetch = new Set<string>();

          for (const apiTrack of res.tracks) {
            if (!apiTrack || !apiTrack.id) continue;
            const item = trackMap.get(apiTrack.id);
            if (item) {
              if (apiTrack.name) item.title = apiTrack.name;
              if (apiTrack.artists && apiTrack.artists.length > 0) {
                item.artistNames = apiTrack.artists.map((a: any) => a.name);
                item.artist = item.artistNames.join(', ');
              }
              if (apiTrack.album?.name) item.album = apiTrack.album.name;
              if (apiTrack.album?.images?.[0]?.url) item.coverUrl = apiTrack.album.images[0].url;
              if (apiTrack.album?.release_date) item.releaseDate = apiTrack.album.release_date;
              if (apiTrack.track_number) item.trackNumber = apiTrack.track_number;
              if (apiTrack.disc_number) item.discNumber = apiTrack.disc_number;

              // Extended ID3 Fields
              if (apiTrack.external_ids?.isrc) item.isrc = apiTrack.external_ids.isrc;

              if (apiTrack.album?.id) {
                albumIdsToFetch.add(apiTrack.album.id);
              }
            }
          }

          // Fetch full album details to get publisher/label & copyrights
          if (albumIdsToFetch.size > 0) {
            const albumIdsArr = Array.from(albumIdsToFetch);
            for (let j = 0; j < albumIdsArr.length; j += 20) {
              const albumChunk = albumIdsArr.slice(j, j + 20);
              const albumsRes = await this.httpGetJson(`https://api.spotify.com/v1/albums?ids=${albumChunk.join(',')}`, {
                Authorization: `Bearer ${token}`,
              });
              if (albumsRes && Array.isArray(albumsRes.albums)) {
                const albumInfoMap = new Map<string, { label: string; copyright: string }>();
                for (const alb of albumsRes.albums) {
                  if (!alb || !alb.id) continue;
                  const label = alb.label || '';
                  const copyright = alb.copyrights?.map((c: any) => c.text).join('; ') || '';
                  albumInfoMap.set(alb.id, { label, copyright });
                }

                for (const apiTrack of res.tracks) {
                  if (!apiTrack || !apiTrack.id || !apiTrack.album?.id) continue;
                  const item = trackMap.get(apiTrack.id);
                  const albInfo = albumInfoMap.get(apiTrack.album.id);
                  if (item && albInfo) {
                    if (albInfo.label) item.publisher = albInfo.label;
                    if (albInfo.copyright) item.copyright = albInfo.copyright;
                  }
                }
              }
            }
          }

          // Fetch audio-features to get BPM (tempo) and Musical Key
          try {
            const featuresRes = await this.httpGetJson(`https://api.spotify.com/v1/audio-features?ids=${chunk.join(',')}`, {
              Authorization: `Bearer ${token}`,
            });
            if (featuresRes && Array.isArray(featuresRes.audio_features)) {
              const PITCHES = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'];
              for (const feat of featuresRes.audio_features) {
                if (!feat || !feat.id) continue;
                const item = trackMap.get(feat.id);
                if (item) {
                  if (typeof feat.tempo === 'number' && feat.tempo > 0) {
                    item.bpm = Math.round(feat.tempo);
                  }
                  if (typeof feat.key === 'number' && feat.key >= 0 && feat.key <= 11) {
                    const pitchName = PITCHES[feat.key];
                    const modeName = feat.mode === 1 ? 'Major' : 'Minor';
                    item.key = `${pitchName} ${modeName}`;
                  }
                }
              }
            }
          } catch (e) {
            console.warn('Failed fetching audio features:', e);
          }
        }
      } catch (err) {
        console.warn('Failed enriching tracks with Spotify Web API:', err);
      }
    }
  }

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
    let collection: SpotifyCollectionMeta;

    if (type === 'track') {
      const track = await this.fetchSingleTrack(id);
      collection = {
        type: 'track',
        id,
        title: track.title,
        artist: track.artist,
        coverUrl: track.coverUrl,
        tracks: [track],
      };
    } else if (type === 'episode') {
      const track = await this.fetchEpisode(id);
      collection = {
        type: 'episode',
        id,
        title: track.title,
        artist: track.artist,
        coverUrl: track.coverUrl,
        tracks: [track],
      };
    } else if (type === 'album') {
      collection = await this.fetchAlbum(id);
    } else if (type === 'playlist') {
      collection = await this.fetchPlaylist(id);
    } else {
      throw new Error(`Unsupported entity type: ${type}`);
    }

    // Enrich all tracks with extended metadata from Spotify Web API
    await this.enrichTracksWithWebApi(collection.tracks);

    return collection;
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

  private static async httpGetJson(url: string, extraHeaders?: Record<string, string>): Promise<any> {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko)',
        'Accept': 'application/json',
        ...(extraHeaders || {}),
      },
    });
    if (!res.ok) return null;
    return await res.json();
  }
}
