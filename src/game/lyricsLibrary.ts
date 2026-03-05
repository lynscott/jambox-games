import type { LyricsCue, LyricsTrack } from './lyrics';

const YOUTUBE_API_BASE = 'https://www.googleapis.com/youtube/v3';
const LYRICS_API_BASE = 'https://api.lyrics.ovh/v1';
const LRCLIB_API_BASE = 'https://lrclib.net/api';
const ITUNES_SEARCH_API_BASE = 'https://itunes.apple.com/search';
const DEFAULT_TOP_QUERY = 'official instrumental audio';
const DEFAULT_MAX_ROUNDS = 8;

export interface YoutubeInstrumentalOption {
  id: string;
  videoId: string;
  title: string;
  artist: string;
  channelTitle: string;
  thumbnailUrl: string;
  durationMs: number;
  youtubeUrl: string;
}

export interface CuratedLyricsSeed {
  id: string;
  title: string;
  artist: string;
  youtubeQuery: string;
}

export const CURATED_LYRICS_SEEDS: CuratedLyricsSeed[] = [
  {
    id: 'billie-jean',
    title: 'Billie Jean',
    artist: 'Michael Jackson',
    youtubeQuery: 'Michael Jackson Billie Jean instrumental',
  },
  {
    id: 'i-want-it-that-way',
    title: 'I Want It That Way',
    artist: 'Backstreet Boys',
    youtubeQuery: 'Backstreet Boys I Want It That Way instrumental',
  },
  {
    id: 'no-scrubs',
    title: 'No Scrubs',
    artist: 'TLC',
    youtubeQuery: 'TLC No Scrubs instrumental',
  },
  {
    id: 'hey-ya',
    title: 'Hey Ya!',
    artist: 'Outkast',
    youtubeQuery: 'Outkast Hey Ya instrumental',
  },
  {
    id: 'yeah',
    title: 'Yeah!',
    artist: 'Usher',
    youtubeQuery: 'Usher Yeah instrumental',
  },
  {
    id: 'mr-brightside',
    title: 'Mr. Brightside',
    artist: 'The Killers',
    youtubeQuery: 'The Killers Mr Brightside instrumental',
  },
];

interface YoutubeSearchResponse {
  items: Array<{
    id: { videoId?: string };
    snippet?: {
      title?: string;
      channelTitle?: string;
      thumbnails?: {
        high?: { url?: string };
        medium?: { url?: string };
        default?: { url?: string };
      };
    };
  }>;
}

interface YoutubeVideosResponse {
  items: Array<{
    id: string;
    contentDetails?: { duration?: string };
  }>;
}

interface LrclibTrackResponse {
  plainLyrics?: string;
  syncedLyrics?: string;
}

function getYoutubeApiKey() {
  return import.meta.env.VITE_YOUTUBE_API_KEY || import.meta.env.VITE_YOUTUBE_KEY || '';
}

export function hasYoutubeApiKey() {
  return Boolean(getYoutubeApiKey());
}

function parseIsoDurationToMs(value: string): number {
  const match = value.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) {
    return 0;
  }

  const hours = Number(match[1] || 0);
  const minutes = Number(match[2] || 0);
  const seconds = Number(match[3] || 0);
  return ((hours * 60 + minutes) * 60 + seconds) * 1000;
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

function normalizeInstrumentalTitle(value: string) {
  return value
    .replace(/\[[^\]]+\]/g, ' ')
    .replace(
      /\(([^)]*instrumental[^)]*|lyrics?|audio|official[^)]*|reprod[^)]*|prod\.?[^)]*|remake[^)]*|cover[^)]*|slowed[^)]*|sped up[^)]*)\)/gi,
      ' ',
    )
    .replace(/official\s+(video|audio)/gi, ' ')
    .replace(/instrumental/gi, ' ')
    .replace(/reprod\.?/gi, ' ')
    .replace(/prod\.?\s+by\s+[^-]+/gi, ' ')
    .replace(/prod\.?/gi, ' ')
    .replace(/cover/gi, ' ')
    .replace(/remake/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function deriveArtistAndTitle(optionTitle: string, channelTitle: string) {
  const normalized = normalizeInstrumentalTitle(optionTitle);
  const dashMatch = normalized.split(' - ').map((part) => part.trim()).filter(Boolean);

  if (dashMatch.length >= 2) {
    return {
      artist: dashMatch[0],
      title: dashMatch.slice(1).join(' - '),
    };
  }

  return {
    artist: channelTitle.replace(/VEVO|Topic/gi, '').trim() || 'Unknown Artist',
    title: normalized,
  };
}

async function youtubeGet<T>(path: string, params: Record<string, string>) {
  const apiKey = getYoutubeApiKey();
  if (!apiKey) {
    throw new Error('Missing VITE_YOUTUBE_API_KEY');
  }

  const url = new URL(`${YOUTUBE_API_BASE}${path}`);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  url.searchParams.set('key', apiKey);

  const response = await fetch(url.toString());
  if (!response.ok) {
    throw new Error(`YouTube request failed (${response.status})`);
  }

  return response.json() as Promise<T>;
}

async function fetchVideoDurations(videoIds: string[]) {
  if (videoIds.length === 0) {
    return new Map<string, number>();
  }

  const response = await youtubeGet<YoutubeVideosResponse>('/videos', {
    part: 'contentDetails',
    id: videoIds.join(','),
    maxResults: String(videoIds.length),
  });

  return new Map(
    response.items.map((item) => [item.id, parseIsoDurationToMs(item.contentDetails?.duration || 'PT0S')]),
  );
}

async function fetchLyrics(artist: string, title: string) {
  const response = await fetch(
    `${LYRICS_API_BASE}/${encodeURIComponent(artist)}/${encodeURIComponent(title)}`,
  );

  if (!response.ok) {
    throw new Error(`Lyrics request failed (${response.status})`);
  }

  const payload = (await response.json()) as { lyrics?: string; error?: string };
  if (!payload.lyrics) {
    throw new Error(payload.error || 'Lyrics unavailable');
  }

  return payload.lyrics;
}

async function fetchLrclibLyrics(artist: string, title: string, durationMs?: number) {
  const url = new URL(`${LRCLIB_API_BASE}/search`);
  url.searchParams.set('artist_name', artist);
  url.searchParams.set('track_name', title);
  if (durationMs && Number.isFinite(durationMs)) {
    url.searchParams.set('duration', String(Math.round(durationMs / 1000)));
  }

  const response = await fetch(url.toString());
  if (!response.ok) {
    throw new Error(`LRCLIB request failed (${response.status})`);
  }

  const payload = (await response.json().catch(() => null)) as LrclibTrackResponse[] | null;
  const match = payload?.find((item) => item.syncedLyrics || item.plainLyrics) || null;
  if (!match) {
    throw new Error('LRCLIB returned no lyrics');
  }

  return {
    plainLyrics: String(match.plainLyrics || '').trim(),
    syncedLyrics: String(match.syncedLyrics || '').trim(),
  };
}

async function fetchCanonicalTrackMetadata(option: YoutubeInstrumentalOption) {
  const url = new URL(ITUNES_SEARCH_API_BASE);
  url.searchParams.set('media', 'music');
  url.searchParams.set('entity', 'song');
  url.searchParams.set('limit', '5');
  url.searchParams.set('term', `${option.artist} ${option.title}`);

  const response = await fetch(url.toString());
  if (!response.ok) {
    return null;
  }

  const payload = (await response.json().catch(() => null)) as
    | {
        results?: Array<{
          artistName?: string;
          trackName?: string;
        }>;
      }
    | null;

  const match = payload?.results?.find((result) => result.artistName && result.trackName);
  if (!match?.artistName || !match.trackName) {
    return null;
  }

  return {
    artist: match.artistName.trim(),
    title: match.trackName.trim(),
  };
}

async function fetchLyricsWithFallbacks(option: YoutubeInstrumentalOption) {
  const primary = deriveArtistAndTitle(`${option.artist} - ${option.title}`, option.channelTitle);
  const titleVariants = [
    option.title,
    option.title.replace(/\s+\.\.\.$/, '').trim(),
    option.title.replace(/[.!]+$/g, '').trim(),
    normalizeInstrumentalTitle(option.title),
  ].filter(Boolean);
  const canonicalTrack = await fetchCanonicalTrackMetadata(option);

  const candidates = [
    { artist: primary.artist, title: primary.title },
    canonicalTrack,
    { artist: option.artist, title: titleVariants[0] || option.title },
    { artist: option.channelTitle.replace(/VEVO|Topic/gi, '').trim(), title: titleVariants[0] || option.title },
    ...titleVariants.map((title) => ({ artist: option.artist, title })),
  ].filter(
    (
      candidate,
    ): candidate is {
      artist: string;
      title: string;
    } => Boolean(candidate?.artist && candidate?.title),
  );

  for (const candidate of candidates) {
    try {
      const lrclib = await fetchLrclibLyrics(candidate.artist, candidate.title, option.durationMs);
      if (lrclib.syncedLyrics || lrclib.plainLyrics) {
        return lrclib;
      }
    } catch {
      // Try the next lookup variant.
    }

    try {
      return {
        plainLyrics: await fetchLyrics(candidate.artist, candidate.title),
        syncedLyrics: '',
      };
    } catch {
      // Try the next lookup variant.
    }
  }

  throw new Error('Lyrics API did not return lyrics for this song.');
}

async function findBestYoutubeInstrumental(query: string) {
  const results = await searchYoutubeInstrumentals(query);
  const match = results[0];
  if (!match) {
    throw new Error('No instrumental result found on YouTube.');
  }
  return match;
}

function buildGeneratedCues(lyrics: string, durationMs: number): LyricsCue[] {
  const lines = lyrics
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .slice(0, DEFAULT_MAX_ROUNDS);

  if (lines.length === 0) {
    throw new Error('Lyrics API returned no usable lyric lines');
  }

  const introMs = Math.min(8_000, Math.max(2_000, Math.round(durationMs * 0.12)));
  const playableDurationMs = Math.max(8_000, durationMs - introMs);
  const perLineMs = Math.max(3_500, Math.floor(playableDurationMs / lines.length));

  return lines.map((text, index) => {
    const startMs = introMs + index * perLineMs;
    const endMs = startMs + perLineMs - 250;
    return {
      id: `line-${index + 1}`,
      startMs,
      endMs,
      text,
    };
  });
}

function buildSyncedCues(syncedLyrics: string): LyricsCue[] {
  const parsed = syncedLyrics
    .split(/\r?\n/)
    .map((line, index) => {
      const match = line.trim().match(/^\[(\d{2,}):(\d{2})(?:\.(\d{1,3}))?\](.*)$/);
      if (!match) {
        return null;
      }

      const minutes = Number(match[1] || 0);
      const seconds = Number(match[2] || 0);
      const millis = Number((match[3] || '0').padEnd(3, '0'));
      const text = match[4].trim();
      if (!text) {
        return null;
      }

      return {
        id: `line-${index + 1}`,
        startMs: minutes * 60_000 + seconds * 1000 + millis,
        text,
      };
    })
    .filter((item): item is { id: string; startMs: number; text: string } => Boolean(item))
    .slice(0, DEFAULT_MAX_ROUNDS);

  return parsed.map((cue, index) => ({
    id: cue.id,
    startMs: cue.startMs,
    endMs: parsed[index + 1] ? Math.max(cue.startMs + 900, parsed[index + 1].startMs - 120) : cue.startMs + 3500,
    text: cue.text,
  }));
}

export async function searchYoutubeInstrumentals(query: string) {
  const response = await youtubeGet<YoutubeSearchResponse>('/search', {
    part: 'snippet',
    type: 'video',
    videoEmbeddable: 'true',
    videoCategoryId: '10',
    maxResults: '12',
    order: 'viewCount',
    q: query.trim() ? `${query.trim()} instrumental` : DEFAULT_TOP_QUERY,
  });

  const videoIds = response.items
    .map((item) => item.id.videoId || '')
    .filter(Boolean);
  const durations = await fetchVideoDurations(videoIds);

  return response.items
    .map((item) => {
      const videoId = item.id.videoId;
      const title = item.snippet?.title?.trim();
      const channelTitle = item.snippet?.channelTitle?.trim() || 'Unknown Channel';

      if (!videoId || !title) {
        return null;
      }

      const derived = deriveArtistAndTitle(title, channelTitle);
      const thumbnailUrl =
        item.snippet?.thumbnails?.high?.url ||
        item.snippet?.thumbnails?.medium?.url ||
        item.snippet?.thumbnails?.default?.url ||
        '';

      return {
        id: videoId,
        videoId,
        title: derived.title,
        artist: derived.artist,
        channelTitle,
        thumbnailUrl,
        durationMs: durations.get(videoId) || 180_000,
        youtubeUrl: `https://www.youtube.com/watch?v=${videoId}`,
      } satisfies YoutubeInstrumentalOption;
    })
    .filter((item): item is YoutubeInstrumentalOption => Boolean(item));
}

export async function buildLyricsTrackFromYoutube(option: YoutubeInstrumentalOption): Promise<LyricsTrack> {
  const lyrics = await fetchLyricsWithFallbacks(option);
  const syncedCues = lyrics.syncedLyrics ? buildSyncedCues(lyrics.syncedLyrics) : [];
  const cues = syncedCues.length > 0 ? syncedCues : buildGeneratedCues(lyrics.plainLyrics, option.durationMs);

  return {
    id: slugify(`${option.artist}-${option.title}-${option.videoId}`),
    title: option.title,
    artist: option.artist,
    instrumentalSrc: option.youtubeUrl,
    source: 'youtube',
    youtubeVideoId: option.videoId,
    thumbnailUrl: option.thumbnailUrl,
    durationMs: option.durationMs,
    youtubeUrl: option.youtubeUrl,
    cues,
  };
}

export async function buildLyricsTrackFromSeed(seed: CuratedLyricsSeed): Promise<LyricsTrack> {
  const option = await findBestYoutubeInstrumental(seed.youtubeQuery);

  return buildLyricsTrackFromYoutube({
    ...option,
    title: seed.title,
    artist: seed.artist,
  });
}
