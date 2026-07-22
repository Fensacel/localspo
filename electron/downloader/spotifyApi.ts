import { YTMusicApi } from './ytMusicApi';

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
  owner?: string;
  description?: string;
  coverUrl: string | null;
  tracks: SpotifyTrackMeta[];
}

export class SpotifyApiExtractor {
  private static cachedAccessToken: { token: string; expiresAt: number } | null = null;

  private static async getAnonymousAccessToken(): Promise<string | null> {
    if (this.cachedAccessToken && Date.now() < this.cachedAccessToken.expiresAt) {
      return this.cachedAccessToken.token;
    }

    // Primary Strategy: Fetch a known-valid track embed page and extract the access token from the session state
    try {
      const embedUrl = 'https://open.spotify.com/embed/track/7ouMYWpwJ422jRcDASZB7P';
      const res = await fetch(embedUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept-Language': 'en-US,en;q=0.9',
        }
      });
      if (res.ok) {
        const html = await res.text();
        const match = html.match(/<script[^>]*id="__NEXT_DATA__"[^>]*>(.*?)<\/script>/s);
        if (match) {
          const data = JSON.parse(match[1]);
          const token = data?.props?.pageProps?.state?.settings?.session?.accessToken;
          const expiresAt = data?.props?.pageProps?.state?.settings?.session?.accessTokenExpirationTimestampMs;
          if (token) {
            this.cachedAccessToken = {
              token,
              expiresAt: expiresAt ? expiresAt - 60000 : Date.now() + 3000000,
            };
            console.log('[Spotify] Successfully retrieved anonymous access token');
            return token;
          }
        }
      }
    } catch (e) {
      console.warn('[Spotify] Failed retrieving token from track embed page:', e);
    }

    console.error('[Spotify] All token strategies failed');
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
    // For playlists: enrich only tracks that have a clean Spotify ID (not local fallback IDs)
    await this.enrichTracksWithWebApi(collection.tracks);

    return collection;
  }

  private static async fetchSingleTrack(id: string): Promise<SpotifyTrackMeta> {
    const pageUrl = `https://open.spotify.com/track/${id}`;
    
    // 1. Try to fetch metadata using partner GraphQL API
    const token = await this.getAnonymousAccessToken();
    if (token) {
      try {
        const partnerUrl = 'https://api-partner.spotify.com/pathfinder/v1/query';
        const params = new URLSearchParams({
          operationName: 'getTrack',
          variables: JSON.stringify({
            uri: `spotify:track:${id}`
          }),
          extensions: JSON.stringify({
            persistedQuery: {
              version: 1,
              sha256Hash: '612585ae06ba435ad26369870deaae23b5c8800a256cd8a57e08eddc25a37294',
            }
          })
        });

        const res = await fetch(`${partnerUrl}?${params.toString()}`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'app-platform': 'WebPlayer',
          }
        });

        if (res.ok) {
          const resJson: any = await res.json();
          const track = resJson?.data?.trackUnion;
          if (track && track.__typename === 'Track') {
            const title = track.name || 'Unknown Track';
            const firstArtists = track.firstArtist?.items?.map((a: any) => a.profile?.name).filter(Boolean) || [];
            const otherArtists = track.otherArtists?.items?.map((a: any) => a.profile?.name).filter(Boolean) || [];
            const artists = [...firstArtists, ...otherArtists];
            if (artists.length === 0) artists.push('Unknown Artist');

            const albumOfTrack = track.albumOfTrack || {};
            const albumName = albumOfTrack.name || title;
            const coverSources = albumOfTrack.coverArt?.sources || [];
            const coverUrl = coverSources.length > 0 ? coverSources[0].url : null;
            const durationMs = track.duration?.totalMilliseconds || 0;
            const releaseDate = albumOfTrack.date?.isoString || undefined;

            return {
              id,
              spotifyUrl: pageUrl,
              title,
              artist: artists.join(', '),
              artistNames: artists,
              album: albumName,
              coverUrl,
              durationMs,
              releaseDate,
              trackNumber: track.trackNumber || 1,
              discNumber: track.discNumber || 1,
              type: 'track',
            };
          }
        }
      } catch (err) {
        console.warn('[Spotify] GraphQL fetchSingleTrack failed, falling back to embed parsing:', err);
      }
    }

    // 2. Fallback: Parse embed page JSON or initialState
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
        const trackData = embedJson?.props?.pageProps?.state?.data?.entity || embedJson?.props?.pageProps?.state?.entity;
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
      const entity = embedJson?.props?.pageProps?.state?.data?.entity || embedJson?.props?.pageProps?.state?.entity;
      if (entity) {
        const albumTitle = entity.title || entity.name || 'Unknown Album';
        const albumArtist = entity.artists?.map((a: any) => a.name).join(', ') || entity.artist || 'Unknown Artist';
        const coverUrl = entity.visualIdentity?.imageRight?.[0]?.url || entity.coverArt?.sources?.[0]?.url || null;
        const trackList = entity.trackList || [];

        const tracks: SpotifyTrackMeta[] = trackList.map((t: any, idx: number) => {
          const wrapper = t;
          const track = wrapper.track || wrapper;
          const artists = track.artists?.map((a: any) => a.name) || [track.subtitle || albumArtist];
          return {
            id: track.uri?.split(':')?.[2] || track.id || `${id}_${idx}`,
            spotifyUrl: track.uri?.startsWith('spotify:track:') ? `https://open.spotify.com/track/${track.uri.split(':')[2]}` : pageUrl,
            title: track.title || track.name || `Track ${idx + 1}`,
            artist: artists.join(', '),
            artistNames: artists,
            album: albumTitle,
            coverUrl,
            durationMs: track.duration || track.durationMs || 0,
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
    let playlistTitle = 'Spotify Playlist';
    let owner = '';
    let description = '';
    let playlistCoverUrl: string | null = null;
    const tracks: SpotifyTrackMeta[] = [];

    // Helper to format track object
    const addTrackIfValid = (title: string, artist: string, album: string, coverUrl: string | null, durationMs: number, trackId?: string) => {
      if (!title || title.trim().length === 0) return;
      const cleanTitle = title.trim();
      const cleanArtist = artist && artist.trim().length > 0 ? artist.trim() : 'Unknown Artist';
      const cleanAlbum = album && album.trim().length > 0 ? album.trim() : playlistTitle;

      tracks.push({
        id: trackId || `${id}_${tracks.length}`,
        spotifyUrl: trackId ? `https://open.spotify.com/track/${trackId}` : pageUrl,
        title: cleanTitle,
        artist: cleanArtist,
        artistNames: [cleanArtist],
        album: cleanAlbum,
        coverUrl: coverUrl || playlistCoverUrl,
        durationMs: durationMs || 180000,
        trackNumber: tracks.length + 1,
        type: 'track',
      });
    };

    // ── STRATEGY 1: Partner Pathfinder GraphQL API (best — gives album name + cover per track) ──
    const token = await this.getAnonymousAccessToken();
    if (token) {
      try {
        let offset = 0;
        const limit = 100;
        while (true) {
          const partnerUrl = 'https://api-partner.spotify.com/pathfinder/v1/query';
          const params = new URLSearchParams({
            operationName: 'fetchPlaylist',
            variables: JSON.stringify({
              uri: `spotify:playlist:${id}`,
              offset,
              limit,
              enableWatchFeedEntrypoint: false,
              includeEpisodeContentRatingsV2: false,
            }),
            extensions: JSON.stringify({
              persistedQuery: {
                version: 1,
                sha256Hash: 'a65e12194ed5fc443a1cdebed5fabe33ca5b07b987185d63c72483867ad13cb4',
              }
            })
          });

          const res = await fetch(`${partnerUrl}?${params.toString()}`, {
            headers: {
              'Authorization': `Bearer ${token}`,
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
              'app-platform': 'WebPlayer',
            }
          });

          if (!res.ok) break;

          const resJson: any = await res.json();
          const playlistV2 = resJson?.data?.playlistV2;
          if (playlistV2 && playlistV2.name) {
            playlistTitle = playlistV2.name;
            playlistCoverUrl = playlistV2.images?.items?.[0]?.sources?.[0]?.url || playlistCoverUrl;
            owner = playlistV2.ownerV2?.data?.displayName || owner;
            description = playlistV2.description || description;
          }

          const content = playlistV2?.content;
          const items = content?.items || [];
          if (items.length === 0) break;

          for (let i = 0; i < items.length; i++) {
            const item = items[i];
            const trackData = item?.itemV2?.data;
            if (!trackData || trackData.__typename !== 'Track') continue;

            const tId = trackData.uri?.startsWith('spotify:track:') ? trackData.uri.split(':')[2] : trackData.id;
            const artists = trackData.artists?.items?.map((a: any) => a.profile?.name).filter(Boolean) || ['Unknown Artist'];
            const albumOfTrack = trackData.albumOfTrack || {};
            const albumName = albumOfTrack.name || playlistTitle;
            // Prefer highest-res cover (sources are sorted smallest→largest, take last)
            const coverSources = albumOfTrack.coverArt?.sources || [];
            const trackCoverUrl = coverSources.length > 0 ? coverSources[coverSources.length - 1].url : playlistCoverUrl;
            const dur = trackData.trackDuration?.totalMilliseconds || 180000;

            addTrackIfValid(trackData.name, artists.join(', '), albumName, trackCoverUrl, dur, tId);
          }

          const total = content?.totalCount || 0;
          offset += items.length;
          if (offset >= total) break;
        }
      } catch (err) {
        console.warn('[Spotify] Pathfinder GraphQL playlist fetch failed:', err);
      }
    }

    // ── STRATEGY 2: Embed Page __NEXT_DATA__ JSON (fallback, lacks per-track album/cover) ──
    if (tracks.length === 0) {
      let embedHtml = '';
      try {
        embedHtml = await this.httpGet(`https://open.spotify.com/embed/playlist/${id}`);
      } catch (e) {
        console.warn('[Spotify] Embed HTML fetch error:', e);
      }

      if (embedHtml) {
        const embedScriptMatch = embedHtml.match(/<script id="__NEXT_DATA__"\s+type="application\/json">\s*(.+?)\s*<\/script>/s);
        if (embedScriptMatch && embedScriptMatch[1]) {
          try {
            const embedJson = JSON.parse(embedScriptMatch[1]);
            const entity = embedJson?.props?.pageProps?.state?.data?.entity ||
                           embedJson?.props?.pageProps?.state?.entity ||
                           embedJson?.props?.pageProps?.entity ||
                           embedJson?.props?.pageProps;

            if (entity) {
              playlistTitle = entity.title || entity.name || playlistTitle;
              playlistCoverUrl = entity.coverArt?.sources?.[0]?.url || entity.images?.[0]?.url || playlistCoverUrl;
              owner = entity.owner?.displayName || entity.owner?.name || entity.owner?.id || owner;
              description = entity.description || description;

              const trackList = entity.trackList || entity.tracks?.items || entity.tracks || entity.items || [];
              if (Array.isArray(trackList) && trackList.length > 0) {
                for (let idx = 0; idx < trackList.length; idx++) {
                  const wrapper = trackList[idx];
                  const track = wrapper.track || wrapper.item || wrapper;
                  if (!track) continue;

                  const tTitle = track.title || track.name || wrapper.title || wrapper.name;
                  if (!tTitle) continue;

                  const tId = track.id || (track.uri?.startsWith('spotify:track:') ? track.uri.split(':')[2] : null);
                  const subtitle = wrapper.subtitle || track.subtitle;
                  const artistsList = track.artists?.map((a: any) => a.name || a.profile?.name).filter(Boolean) || [];
                  const artistStr = artistsList.length > 0 ? artistsList.join(', ') : (subtitle || 'Unknown Artist');
                  const albumName = track.album?.name || playlistTitle;
                  const cover = track.album?.images?.[0]?.url ||
                                 track.album?.coverArt?.sources?.[0]?.url ||
                                 track.coverArt?.sources?.[0]?.url ||
                                 playlistCoverUrl;
                  const dur = track.duration || track.durationMs || track.duration_ms || 180000;

                  addTrackIfValid(tTitle, artistStr, albumName, cover, dur, tId);
                }
              }
            }
          } catch (err) {
            console.warn('[Spotify] Failed parsing embed __NEXT_DATA__:', err);
          }
        }
      }
    }

    // ── STRATEGY 3: Base64 initialState or Main Open Spotify Page ────────────────
    if (tracks.length === 0) {
      try {
        const mainPageHtml = await this.httpGet(`https://open.spotify.com/playlist/${id}`);
        
        // Extract title & cover from meta tags
        const titleMatch = mainPageHtml.match(/<meta\s+property="og:title"\s+content="([^"]+)"/i);
        if (titleMatch) playlistTitle = titleMatch[1];
        const coverMatch = mainPageHtml.match(/<meta\s+property="og:image"\s+content="([^"]+)"/i);
        if (coverMatch) playlistCoverUrl = coverMatch[1];

        // Base64 initialState
        const initialStateMatch = mainPageHtml.match(/<script\s+id="initialState"\s+type="text\/plain">\s*(.+?)\s*<\/script>/s);
        if (initialStateMatch && initialStateMatch[1]) {
          const decoded = Buffer.from(initialStateMatch[1], 'base64').toString('utf-8');
          const json = JSON.parse(decoded);
          const entities = json?.entities?.items || {};

          for (const key of Object.keys(entities)) {
            const item = entities[key];
            if (item && item.type === 'track' && item.name) {
              const artists = item.artists?.map((a: any) => a.name).filter(Boolean) || ['Unknown Artist'];
              addTrackIfValid(
                item.name,
                artists.join(', '),
                item.album?.name || playlistTitle,
                item.album?.images?.[0]?.url || playlistCoverUrl,
                item.duration_ms || 180000,
                item.id
              );
            }
          }
        }
      } catch (e) {
        console.warn('[Spotify] Main page HTML scraping failed:', e);
      }
    }

    if (tracks.length === 0) {
      throw new Error(`Could not fetch tracks for Spotify Playlist ${id}. Make sure the playlist is public.`);
    }

    return {
      type: 'playlist',
      id,
      title: playlistTitle,
      owner,
      description,
      coverUrl: playlistCoverUrl,
      tracks,
    };
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

  // ─── Spotify Search ──────────────────────────────────────────────────────────

  public static async searchSpotify(
    query: string,
    types: ('track' | 'album' | 'artist' | 'playlist')[] = ['track', 'album', 'artist', 'playlist'],
    limit = 20,
  ): Promise<{
    tracks: any[];
    albums: any[];
    artists: any[];
    playlists: any[];
  }> {
    try {
      const token = await this.getAnonymousAccessToken();
      if (token) {
        const typeStr = types.join(',');
        const encodedQuery = encodeURIComponent(query);
        const url = `https://api.spotify.com/v1/search?q=${encodedQuery}&type=${typeStr}&limit=${limit}`;

        const res = await this.httpGetJson(url, {
          Authorization: `Bearer ${token}`,
        });

        if (res && (res.tracks?.items?.length || res.albums?.items?.length || res.artists?.items?.length || res.playlists?.items?.length)) {
          const tracks = (res.tracks?.items || []).filter(Boolean).map((t: any) => ({
            id: t.id,
            title: t.name,
            artist: t.artists?.map((a: any) => a.name).join(', ') || 'Unknown Artist',
            artistNames: t.artists?.map((a: any) => a.name) || [],
            album: t.album?.name || '',
            coverUrl: t.album?.images?.[0]?.url || null,
            durationMs: t.duration_ms || 0,
            spotifyUrl: t.external_urls?.spotify || `https://open.spotify.com/track/${t.id}`,
          }));

          const albums = (res.albums?.items || []).filter(Boolean).map((a: any) => ({
            id: a.id,
            name: a.name,
            artist: a.artists?.map((ar: any) => ar.name).join(', ') || 'Unknown Artist',
            coverUrl: a.images?.[0]?.url || null,
            trackCount: a.total_tracks || 0,
            releaseDate: a.release_date || '',
            spotifyUrl: a.external_urls?.spotify || `https://open.spotify.com/album/${a.id}`,
          }));

          const artists = (res.artists?.items || []).filter(Boolean).map((ar: any) => ({
            id: ar.id,
            name: ar.name,
            coverUrl: ar.images?.[0]?.url || null,
            genres: ar.genres || [],
            spotifyUrl: ar.external_urls?.spotify || `https://open.spotify.com/artist/${ar.id}`,
          }));

          const playlists = (res.playlists?.items || []).filter(Boolean).map((p: any) => ({
            id: p.id,
            name: p.name,
            description: p.description || '',
            owner: p.owner?.display_name || p.owner?.id || '',
            coverUrl: p.images?.[0]?.url || null,
            trackCount: p.tracks?.total || 0,
            spotifyUrl: p.external_urls?.spotify || `https://open.spotify.com/playlist/${p.id}`,
          }));

          return { tracks, albums, artists, playlists };
        }
      }
    } catch (err) {
      console.warn('[Spotify] Search failed, falling back to YouTube Music search:', err);
    }

    // Fallback to YouTube Music Search
    console.log('[Search] Using YouTube Music search fallback for query:', query);
    const ytResult = await YTMusicApi.searchYTMusic(query, types);

    // If YTMusic search also returned empty for tracks, try single video search fallback
    if (ytResult.tracks.length === 0 && ytResult.albums.length === 0 && ytResult.playlists.length === 0) {
      const singleVideo = await YTMusicApi.searchVideo('', query);
      if (singleVideo) {
        ytResult.tracks.push({
          id: singleVideo.videoId,
          title: singleVideo.title,
          artist: singleVideo.artist,
          artistNames: [singleVideo.artist],
          album: 'YouTube Music',
          coverUrl: `https://i.ytimg.com/vi/${singleVideo.videoId}/hqdefault.jpg`,
          durationMs: singleVideo.durationSeconds * 1000,
          spotifyUrl: `https://www.youtube.com/watch?v=${singleVideo.videoId}`,
        });
      }
    }

    return ytResult;
  }
}

