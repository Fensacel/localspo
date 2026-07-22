import { cleanArtistName, cleanMusicMetadata, normalizeImageUrl } from './metadataCleaner';

export interface YTSearchResult {
  videoId: string;
  title: string;
  artist: string;
  durationSeconds: number;
}

function normalizeArtistStr(name: string): string {
  if (!name) return '';
  return name
    .toLowerCase()
    .replace(/\s*(?:feat\.|ft\.|x|&|,|and)\s*/g, ' ')
    .replace(/\s+topic$/g, '')
    .replace(/\s+official\s*(?:channel)?$/g, '')
    .replace(/vevo$/g, '')
    .replace(/[^\w\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeTitleStr(title: string): string {
  if (!title) return '';
  return title
    .toLowerCase()
    .replace(/\s*[\(\[]\s*(?:official\s+)?(?:music\s+)?(?:video|audio|lyric\s+video|lyrics\s+video|visualizer|mv|m\/v)\s*[\)\]]/gi, '')
    .replace(/\s*[\(\[]\s*(?:hd|4k|1080p)\s*[\)\]]/gi, '')
    .replace(/[^\w\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function computeDiceCoefficient(str1: string, str2: string): number {
  const s1 = str1.replace(/\s+/g, '');
  const s2 = str2.replace(/\s+/g, '');
  if (s1 === s2) return 1.0;
  if (s1.length < 2 || s2.length < 2) return 0.0;

  const bigrams1 = new Map<string, number>();
  for (let i = 0; i < s1.length - 1; i++) {
    const bigram = s1.substring(i, i + 2);
    bigrams1.set(bigram, (bigrams1.get(bigram) || 0) + 1);
  }

  let intersectionSize = 0;
  for (let i = 0; i < s2.length - 1; i++) {
    const bigram = s2.substring(i, i + 2);
    const count = bigrams1.get(bigram) || 0;
    if (count > 0) {
      bigrams1.set(bigram, count - 1);
      intersectionSize++;
    }
  }

  return (2.0 * intersectionSize) / (s1.length + s2.length - 2);
}

export class YTMusicApi {
  public static buildSearchQuery(artist: string, title: string, album?: string): string {
    const cleanArtist = (artist || '').split(',')[0].replace(/\s*(?:feat\.|ft\.|x|&|and)\s*.*$/i, '').trim();
    let cleanTitle = (title || '').trim();
    if (cleanTitle.length > 40) {
      cleanTitle = cleanTitle
        .replace(/\s*[\(\[]\s*From The Vault\s*[\)\]]/gi, '')
        .replace(/\s*[\(\[]\s*Taylor's Version\s*[\)\]]/gi, '')
        .trim();
    }
    if (!cleanArtist) return cleanTitle;
    if (!cleanTitle) return cleanArtist;
    return `${cleanTitle} ${cleanArtist}`;
  }

  public static async searchVideo(artist: string, title: string, album?: string, durationSeconds?: number): Promise<YTSearchResult | null> {
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
        const resObj = this.parseVideoIdFromYtJson(json, title, artist, album, durationSeconds, query);
        if (resObj?.videoId) {
          return {
            videoId: resObj.videoId,
            title: resObj.title || title,
            artist: resObj.artist || artist,
            durationSeconds: resObj.durationSeconds || 0,
          };
        }
      }
    } catch (e) {
      console.warn('YTMusic API search error, fallback to yt-dlp search:', e);
    }

    return null;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public static parseVideoIdFromYtJson(
    json: any,
    requestedTitle: string,
    requestedArtist: string,
    requestedAlbum?: string,
    requestedDurationSeconds?: number,
    queryUsed?: string,
  ): { videoId: string; title: string; artist: string; score: number; durationSeconds: number } | null {
    try {
      if (!json || typeof json !== 'object') return null;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const data = json as any;
      const contents = data?.contents?.tabbedSearchResultsRenderer?.tabs?.[0]?.tabRenderer?.content?.sectionListRenderer?.contents;
      if (!Array.isArray(contents)) return null;

      const normReqTitle = normalizeTitleStr(requestedTitle);
      const normReqArtist = normalizeArtistStr(requestedArtist);
      const normReqAlbum = normalizeTitleStr(requestedAlbum || '');

      const reqHasExtended = /\b(extended|10 minute|10 min|10-minute)\b/i.test(requestedTitle);
      const reqHasLive = /\b(live|concert)\b/i.test(requestedTitle);
      const reqHasRemix = /\b(remix)\b/i.test(requestedTitle);

      interface Candidate {
        videoId: string;
        title: string;
        artist: string;
        channel: string;
        album: string;
        durationSeconds: number;
        score: number;
        reasons: string[];
        rejectedReason?: string;
      }

      const candidates: Candidate[] = [];

      for (const section of contents) {
        const shelf = section?.musicShelfRenderer || section?.musicCardShelfRenderer;
        if (!shelf) continue;

        const items = shelf.contents || [shelf];
        for (const item of items) {
          const itemData = item.musicResponsiveListItemRenderer || item;
          if (!itemData) continue;

          // Extract text runs across all flexColumns
          const allRuns: string[] = [];
          const flexCols = itemData?.flexColumns || [];
          for (const col of flexCols) {
            const runs = col?.musicResponsiveListItemFlexColumnRenderer?.text?.runs;
            if (Array.isArray(runs)) {
              for (const r of runs) {
                if (r?.text) allRuns.push(r.text);
              }
            }
          }

          const titleRunsArr = flexCols[0]?.musicResponsiveListItemFlexColumnRenderer?.text?.runs;
          const titleRun = Array.isArray(titleRunsArr) ? titleRunsArr.map((r: any) => r.text || '').join('') : '';

          const artistRunsArr = flexCols[1]?.musicResponsiveListItemFlexColumnRenderer?.text?.runs;
          const artistRun = Array.isArray(artistRunsArr) ? artistRunsArr.map((r: any) => r.text || '').join('') : '';
          const albumRun = flexCols[2]?.musicResponsiveListItemFlexColumnRenderer?.text?.runs?.[0]?.text || '';

          const rawVideoId =
            itemData?.overlay?.musicItemThumbnailOverlayRenderer?.content?.musicPlayButtonRenderer?.playNavigationEndpoint?.watchEndpoint?.videoId ||
            itemData?.navigationEndpoint?.watchEndpoint?.videoId;

          if (!rawVideoId || !titleRun || typeof rawVideoId !== 'string') continue;
          const videoId = String(rawVideoId).replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 11);
          if (videoId.length !== 11) continue;

          // Extract candidate duration if present in runs
          let candDur = 0;
          for (const text of allRuns) {
            const timeMatch = text.trim().match(/^(\d+):(\d{2})(?::(\d{2}))?$/);
            if (timeMatch) {
              if (timeMatch[3] !== undefined) {
                candDur = parseInt(timeMatch[1], 10) * 3600 + parseInt(timeMatch[2], 10) * 60 + parseInt(timeMatch[3], 10);
              } else {
                candDur = parseInt(timeMatch[1], 10) * 60 + parseInt(timeMatch[2], 10);
              }
              break;
            }
          }

          const candTitle = titleRun as string;
          const candArtist = artistRun as string;
          const candAlbum = albumRun as string;
          const fullCandText = (allRuns.join(' ') + ' ' + candTitle + ' ' + candArtist + ' ' + candAlbum).toLowerCase();

          const normCandTitle = normalizeTitleStr(candTitle);
          const normCandArtist = normalizeArtistStr(candArtist);
          const normCandAlbum = normalizeTitleStr(candAlbum);

          let score = 0;
          const reasons: string[] = [];
          let rejectedReason: string | undefined = undefined;

          // 1. ARTIST IDENTITY VALIDATION GATE (STRICT FIRST CONSTRAINT)
          const isGenericArtist = /\b(unknown artist|various artists|ai music|cover artist|fan upload|random channel|cover band|tribute band)\b/i.test(normCandArtist);
          
          let artistScore = 0;
          let isArtistValid = false;
          let artistSim = 0;

          if (normReqArtist) {
            if (isGenericArtist) {
              score -= 5000;
              reasons.push('Generic/Unknown/Cover Artist Rejected (-5000)');
              rejectedReason = `Rejected Generic Artist "${candArtist}"`;
            } else if (normCandArtist === normReqArtist || normCandArtist.includes(normReqArtist) || normReqArtist.includes(normCandArtist) || fullCandText.includes(normReqArtist)) {
              artistScore = 1000;
              isArtistValid = true;
              reasons.push('Artist EXACT Match (+1000)');
            } else {
              artistSim = computeDiceCoefficient(normCandArtist, normReqArtist);
              if (artistSim > 0.97) {
                artistScore = 800;
                isArtistValid = true;
                reasons.push(`Artist Fuzzy Match >97% (${(artistSim * 100).toFixed(0)}%) (+800)`);
              } else if (artistSim >= 0.75) {
                artistScore = 400;
                isArtistValid = true;
                reasons.push(`Artist Partial Match (${(artistSim * 100).toFixed(0)}%) (+400)`);
              } else {
                score -= 5000;
                reasons.push('Artist Mismatch Penalty (-5000)');
                rejectedReason = `Artist Mismatch ("${candArtist}" vs "${requestedArtist}")`;
              }
            }
          }

          if (!isArtistValid && normReqArtist) {
            // Discard candidates with artist mismatch!
            candidates.push({
              videoId: videoId as string,
              title: candTitle,
              artist: candArtist,
              channel: candArtist,
              album: candAlbum,
              durationSeconds: candDur,
              score: score - 5000,
              reasons,
              rejectedReason: rejectedReason || `Artist Mismatch ("${candArtist}" vs "${requestedArtist}")`,
            });
            continue;
          }

          score += artistScore;

          // 2. NEGATIVE PENALTIES & HARD REJECTIONS
          // Hard AI & Reaction & Podcast & Karaoke Penalties (-1000)
          if (/\b(ai|ai cover|ai version|ai generated|ai voice|ai song)\b/i.test(fullCandText) && !/\bai\b/i.test(normReqTitle)) {
            score -= 1000;
            reasons.push('AI / AI Cover (-1000)');
            rejectedReason = 'AI Cover / AI Generated detected';
          }
          if (/\bkaraoke\b/i.test(fullCandText) && !/\bkaraoke\b/i.test(normReqTitle)) {
            score -= 1000;
            reasons.push('Karaoke (-1000)');
            rejectedReason = 'Karaoke version detected';
          }
          if (/\breaction\b/i.test(fullCandText) && !/\breaction\b/i.test(normReqTitle)) {
            score -= 1000;
            reasons.push('Reaction (-1000)');
            rejectedReason = 'Reaction video detected';
          }
          if (/\bpodcast\b/i.test(fullCandText) && !/\bpodcast\b/i.test(normReqTitle)) {
            score -= 1000;
            reasons.push('Podcast (-1000)');
            rejectedReason = 'Podcast detected';
          }

          // Instrumental & Fanmade Penalties (-700)
          if (/\b(instrumental|backing track|minus one|piano cover|guitar cover|violin cover|orchestral)\b/i.test(fullCandText) && !/\binstrumental\b/i.test(normReqTitle)) {
            score -= 700;
            reasons.push('Instrumental (-700)');
          }
          if (/\b(fanmade|fan-made|fan made)\b/i.test(fullCandText) && !/\bfanmade\b/i.test(normReqTitle)) {
            score -= 700;
            reasons.push('Fanmade (-700)');
          }

          // Cover, Remix, Sped Up, Slowed, Reverb, Nightcore, 8D, Bass Boosted Penalties (-500)
          if (/\bcover\b/i.test(fullCandText) && !/\bcover\b/i.test(normReqTitle)) {
            score -= 500;
            reasons.push('Cover (-500)');
          }
          if (/\bremix\b/i.test(fullCandText) && !reqHasRemix) {
            score -= 500;
            reasons.push('Remix (-500)');
          }
          if (/\b(sped up|speed up)\b/i.test(fullCandText) && !/\b(sped up|speed up)\b/i.test(normReqTitle)) {
            score -= 500;
            reasons.push('Sped Up (-500)');
          }
          if (/\b(slowed|reverb)\b/i.test(fullCandText) && !/\b(slowed|reverb)\b/i.test(normReqTitle)) {
            score -= 500;
            reasons.push('Slowed/Reverb (-500)');
          }
          if (/\bnightcore\b/i.test(fullCandText) && !/\bnightcore\b/i.test(normReqTitle)) {
            score -= 500;
            reasons.push('Nightcore (-500)');
          }
          if (/\b(8d|8d audio)\b/i.test(fullCandText) && !/\b8d\b/i.test(normReqTitle)) {
            score -= 500;
            reasons.push('8D Audio (-500)');
          }
          if (/\bbass boosted\b/i.test(fullCandText) && !/\bbass boosted\b/i.test(normReqTitle)) {
            score -= 500;
            reasons.push('Bass Boosted (-500)');
          }
          if (/\btribute\b/i.test(fullCandText) && !/\btribute\b/i.test(normReqTitle)) {
            score -= 500;
            reasons.push('Tribute (-500)');
          }
          if (/\b(male version|female version|chipmunk)\b/i.test(fullCandText) && !/\b(male version|female version|chipmunk)\b/i.test(normReqTitle)) {
            score -= 500;
            reasons.push('Vocal Altered Version (-500)');
          }

          // Lyrics, Extended, Loop Penalties (-300)
          if (/\b(lyrics|lyric video)\b/i.test(fullCandText) && !/\blyrics\b/i.test(normReqTitle)) {
            score -= 300;
            reasons.push('Lyrics Video (-300)');
          }
          if (/\bextended\b/i.test(fullCandText) && !reqHasExtended) {
            score -= 300;
            reasons.push('Extended (-300)');
          }
          if (/\bloop\b/i.test(fullCandText) && !/\bloop\b/i.test(normReqTitle)) {
            score -= 300;
            reasons.push('Loop (-300)');
          }

          // Live / Concert Penalties (-200)
          if (/\b(live|concert)\b/i.test(fullCandText) && !reqHasLive) {
            score -= 200;
            reasons.push('Live / Concert (-200)');
          }

          // 3. TITLE & METADATA MATCHING
          if (normCandTitle === normReqTitle || normCandTitle.includes(normReqTitle) || normReqTitle.includes(normCandTitle)) {
            score += 300;
            reasons.push('Title EXACT Match (+300)');
          } else {
            const titleSim = computeDiceCoefficient(normCandTitle, normReqTitle);
            if (titleSim >= 0.95) {
              score += 250;
              reasons.push(`Title Fuzzy Match >95% (${(titleSim * 100).toFixed(0)}%) (+250)`);
            } else if (titleSim >= 0.7) {
              score += 150;
              reasons.push(`Title Partial Match (${(titleSim * 100).toFixed(0)}%) (+150)`);
            } else {
              const reqWords = normReqTitle.split(/\s+/).filter((w) => w.length > 1);
              const candWords = normCandTitle.split(/\s+/).filter((w) => w.length > 1);
              const matchCount = reqWords.filter((w) => candWords.includes(w)).length;
              if (reqWords.length > 0 && matchCount / reqWords.length >= 0.6) {
                score += 80;
                reasons.push('Title Word Match (+80)');
              } else {
                score -= 5000;
                reasons.push('Title Mismatch Penalty (-5000)');
                rejectedReason = `Title Mismatch ("${candTitle}" vs "${requestedTitle}")`;
              }
            }
          }

          // Album Match (+100)
          if (normReqAlbum && normCandAlbum && (normCandAlbum === normReqAlbum || normCandAlbum.includes(normReqAlbum) || normReqAlbum.includes(normCandAlbum))) {
            score += 100;
            reasons.push('Album Match (+100)');
          }

          // Channel Priority (+300 Artist, +250 Topic, +150 Verified, +150 Official Audio)
          if (normCandArtist.includes('official') || normCandArtist.includes('vevo')) {
            score += 300;
            reasons.push('Official Artist Channel (+300)');
          } else if (normCandArtist.includes('topic') || normCandArtist.endsWith('- topic')) {
            score += 250;
            reasons.push('Official Topic Channel (+250)');
          } else {
            score += 150;
            reasons.push('Verified Artist / Channel (+150)');
          }

          if (fullCandText.includes('official audio') || fullCandText.includes('official video') || fullCandText.includes('official music video')) {
            score += 150;
            reasons.push('Official Audio (+150)');
          }

          // 3. DURATION VALIDATION (+100 <2s, +50 <5s, REJECT >10s)
          if (requestedDurationSeconds && requestedDurationSeconds > 0 && candDur > 0) {
            const diff = Math.abs(candDur - requestedDurationSeconds);
            if (diff <= 2) {
              score += 100;
              reasons.push(`Duration within 2s (${candDur}s vs ${requestedDurationSeconds}s) (+100)`);
            } else if (diff <= 5) {
              score += 50;
              reasons.push(`Duration within 5s (${candDur}s vs ${requestedDurationSeconds}s) (+50)`);
            } else if (diff > 10) {
              score -= 1000;
              reasons.push(`Duration Mismatch > 10s (${candDur}s vs ${requestedDurationSeconds}s, diff ${diff.toFixed(1)}s) (-1000)`);
              if (!rejectedReason) rejectedReason = `Duration difference ${diff.toFixed(1)}s > 10s`;
            }
          }

          candidates.push({
            videoId: videoId as string,
            title: candTitle,
            artist: candArtist,
            channel: candArtist,
            album: candAlbum,
            durationSeconds: candDur,
            score,
            reasons,
            rejectedReason,
          });
        }
      }

      candidates.sort((a, b) => b.score - a.score);

      // DEBUG PANEL PRINTING
      console.log('====================================================');
      console.log('[STREAMING SEARCH DEBUG PANEL - ARTIST VALIDATION]');
      console.log(`Requested Artist       : "${requestedArtist}"`);
      console.log(`Requested Track        : "${requestedArtist} - ${requestedTitle}" (Album: ${requestedAlbum || 'N/A'}, Duration: ${requestedDurationSeconds || 'N/A'}s)`);
      console.log(`Search Query Used      : "${queryUsed || requestedTitle}"`);
      console.log(`Total Candidates       : ${candidates.length}`);
      console.log('----------------------------------------------------');
      for (let idx = 0; idx < candidates.length; idx++) {
        const c = candidates[idx];
        const artSim = computeDiceCoefficient(normalizeArtistStr(c.artist), normReqArtist);
        console.log(`Candidate #${idx + 1} [Score: ${c.score}]`);
        console.log(`  ├─ Candidate Video ID : ${c.videoId}`);
        console.log(`  ├─ Candidate Title    : "${c.title}"`);
        console.log(`  ├─ Candidate Artist   : "${c.artist}"`);
        console.log(`  ├─ Artist Similarity  : ${(artSim * 100).toFixed(1)}%`);
        console.log(`  ├─ Duration           : ${c.durationSeconds}s`);
        console.log(`  ├─ Score Breakdown    : ${c.reasons.join(' | ')}`);
        if (c.rejectedReason || c.score < 400) {
          console.log(`  └─ Rejected Reason    : ${c.rejectedReason || 'Confidence Score < 400'}`);
        }
      }

      // Minimum Confidence Score Threshold: 400 Points (Requires Validated Artist + Matching Recording)
      const CONFIDENCE_THRESHOLD = 400;

      if (candidates.length > 0 && candidates[0].score >= CONFIDENCE_THRESHOLD) {
        const best = candidates[0];
        console.log('----------------------------------------------------');
        console.log(`Final Selected Artist  : "${best.artist}"`);
        console.log(`Final Selected Video ID: ${best.videoId}`);
        console.log(`[SELECTED RESULT] "${best.title}" by "${best.artist}" (Score: ${best.score})`);
        console.log('====================================================');
        return { videoId: best.videoId, title: best.title, artist: best.artist, score: best.score, durationSeconds: best.durationSeconds };
      } else {
        console.log('----------------------------------------------------');
        console.warn(`[STREAMING ENGINE] Highest candidate score was ${candidates[0]?.score ?? 0} (< ${CONFIDENCE_THRESHOLD}).`);
        console.warn('RESULT: "No official recording found."');
        console.log('====================================================');
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
          coverUrl = `https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg`;

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
            ytVideoId: videoId,
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
