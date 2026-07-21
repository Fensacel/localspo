export function cleanArtistName(rawArtist: string): string {
  if (!rawArtist) return 'Unknown Artist';
  return rawArtist
    .replace(/\s*-\s*Topic$/i, '')
    .replace(/\s+VEVO$/i, '')
    .replace(/VEVO$/i, '')
    .replace(/\s+Official\s+Channel$/i, '')
    .replace(/\s+Official$/i, '')
    .replace(/\s+Channel$/i, '')
    .trim();
}

export function cleanTrackTitle(rawTitle: string, artistName?: string): string {
  if (!rawTitle) return 'Unknown Title';
  let title = rawTitle.trim();

  // Remove surrounding quotes like "What is Love?" M/V
  title = title.replace(/^["'](.*)["']$/, '$1').trim();

  // If title starts with "Artist - Title", remove "Artist - "
  if (artistName && title.toLowerCase().startsWith(artistName.toLowerCase() + ' - ')) {
    title = title.slice(artistName.length + 3).trim();
  }

  // Remove common YouTube video suffixes
  title = title
    .replace(/\s*[\(\[]\s*(?:Official\s+)?(?:Music\s+)?(?:Video|Audio|Lyric\s+Video|Lyrics\s+Video|M\/V|MV)\s*[\)\]]/gi, '')
    .replace(/\s*[\(\[]\s*(?:HD|4K|1080p|Visualizer|Audio)\s*[\)\]]/gi, '')
    .replace(/\s*M\/V$/i, '')
    .replace(/\s*MV$/i, '')
    .replace(/^["'](.*)["']$/, '$1')
    .trim();

  return title || rawTitle;
}

export function cleanAlbumName(rawAlbum?: string): string {
  if (!rawAlbum) return '';
  const trimmed = rawAlbum.trim();
  if (
    /^YouTube/i.test(trimmed) ||
    trimmed === 'YouTube Music' ||
    trimmed === 'Unknown Album'
  ) {
    return '';
  }
  return trimmed;
}

export function normalizeImageUrl(url?: string | null): string | null {
  if (!url) return null;
  let clean = url.trim();
  if (clean.startsWith('//')) {
    clean = 'https:' + clean;
  }
  if (clean.includes('googleusercontent.com') || clean.includes('ggpht.com')) {
    clean = clean.replace(/=w\d+-h\d+[^$]*/, '=w500-h500-l90-rj').replace(/=s\d+[^$]*/, '=s500');
  }
  return clean;
}

export function cleanMusicMetadata(input: {
  title: string;
  artist: string;
  album?: string;
  albumArtist?: string;
}): {
  title: string;
  artist: string;
  album: string;
  albumArtist: string;
} {
  const artist = cleanArtistName(input.artist);
  const title = cleanTrackTitle(input.title, artist);
  const album = cleanAlbumName(input.album);
  const albumArtist = input.albumArtist ? cleanArtistName(input.albumArtist) : artist;

  return { title, artist, album, albumArtist };
}

export async function fetchHighResCoverUrl(
  artist: string,
  title: string,
  currentCoverUrl?: string | null
): Promise<string | null> {
  const normCurrent = normalizeImageUrl(currentCoverUrl);

  // 1. If currentCoverUrl is a YouTube Music / Google image, upgrade resolution parameter to w1200-h1200
  if (normCurrent && (normCurrent.includes('googleusercontent.com') || normCurrent.includes('ggpht.com'))) {
    return normCurrent
      .replace(/=w\d+-h\d+[^$]*/, '=w1200-h1200-l90-rj')
      .replace(/=s\d+[^$]*/, '=s1200');
  }

  // 2. Query iTunes Search API for official 1:1 square album cover artwork (1000x1000px)
  try {
    const cleanArtist = cleanArtistName(artist);
    const cleanTitle = cleanTrackTitle(title, cleanArtist);
    const query = `${cleanArtist} ${cleanTitle}`.trim();

    const res = await fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(query)}&entity=song&limit=1`);
    if (res.ok) {
      const data: any = await res.json();
      if (data.results && data.results.length > 0) {
        const artwork = data.results[0].artworkUrl100;
        if (artwork) {
          return artwork.replace('100x100bb', '1000x1000bb');
        }
      }
    }
  } catch (e) {
    console.warn('[Cover] iTunes search fallback failed:', e);
  }

  // 3. If currentCoverUrl is a YouTube video thumbnail (i.ytimg.com), use maxresdefault
  if (normCurrent && normCurrent.includes('i.ytimg.com')) {
    return normCurrent.replace(/\/(?:hq|sd|default|mqdefault|hq720)\.jpg/i, '/maxresdefault.jpg');
  }

  return normCurrent || null;
}

export async function enrichTrackMetadata(
  artist: string,
  title: string,
  currentAlbum?: string | null,
  currentCoverUrl?: string | null
): Promise<{
  artist: string;
  title: string;
  album: string;
  coverUrl: string | null;
}> {
  const cleanedArtist = cleanArtistName(artist);
  const cleanedTitle = cleanTrackTitle(title, cleanedArtist);
  let cleanedAlbum = cleanAlbumName(currentAlbum);
  let normCover = normalizeImageUrl(currentCoverUrl);

  if (normCover && (normCover.includes('googleusercontent.com') || normCover.includes('ggpht.com'))) {
    normCover = normCover
      .replace(/=w\d+-h\d+[^$]*/, '=w1200-h1200-l90-rj')
      .replace(/=s\d+[^$]*/, '=s1200');
  }

  if (!cleanedAlbum || !normCover || normCover.includes('i.ytimg.com')) {
    try {
      const query = `${cleanedArtist} ${cleanedTitle}`.trim();
      const res = await fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(query)}&entity=song&limit=1`);
      if (res.ok) {
        const data: any = await res.json();
        if (data.results && data.results.length > 0) {
          const match = data.results[0];
          if (!cleanedAlbum && match.collectionName) {
            cleanedAlbum = cleanAlbumName(match.collectionName);
          }
          if (match.artworkUrl100) {
            normCover = match.artworkUrl100.replace('100x100bb', '1000x1000bb');
          }
        }
      }
    } catch (e) {
      console.warn('[MetadataEnricher] iTunes lookup error:', e);
    }
  }

  return {
    artist: cleanedArtist,
    title: cleanedTitle,
    album: cleanedAlbum,
    coverUrl: normCover || currentCoverUrl || null,
  };
}
