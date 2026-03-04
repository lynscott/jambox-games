export type LyricsPlayerSlot = 1 | 2;

export interface LyricsCue {
  id: string;
  startMs: number;
  endMs: number;
  text: string;
}

export interface LyricsTrack {
  id: string;
  title: string;
  artist: string;
  instrumentalSrc: string;
  source?: 'local' | 'youtube';
  youtubeVideoId?: string;
  thumbnailUrl?: string;
  durationMs?: number;
  youtubeUrl?: string;
  cues: LyricsCue[];
}

export interface LyricsCueResult {
  cueIndex: number;
  cue: LyricsCue;
  transcript: string;
  overlapScore: number;
  timingScore: number;
  totalScore: number;
  grade: 'perfect' | 'good' | 'miss';
  offsetMs: number;
}

export interface LyricsPlayerSummary {
  playerSlot: LyricsPlayerSlot;
  score: number;
  perfectHits: number;
  goodHits: number;
  misses: number;
  totalCues: number;
  cueResults: LyricsCueResult[];
}

export interface LyricsRoundSummary {
  round: number;
  playerOne: LyricsCueResult;
  playerTwo: LyricsCueResult;
}

export interface LyricsResultSummary {
  trackId: string;
  trackTitle: string;
  rounds: LyricsRoundSummary[];
  players: Record<LyricsPlayerSlot, LyricsPlayerSummary>;
}

const TOKEN_PATTERN = /[^a-z0-9\s']/gi;

export function normalizeLyricTokens(value: string): string[] {
  return value
    .toLowerCase()
    .replace(TOKEN_PATTERN, ' ')
    .split(/\s+/)
    .map((token) => token.trim())
    .filter(Boolean);
}

function computeLcsLength(expected: string[], spoken: string[]): number {
  const rows = expected.length + 1;
  const cols = spoken.length + 1;
  const dp: number[][] = Array.from({ length: rows }, () => Array(cols).fill(0));

  for (let i = 1; i < rows; i += 1) {
    for (let j = 1; j < cols; j += 1) {
      if (expected[i - 1] === spoken[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  return dp[rows - 1][cols - 1];
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

export function computeOverlapScore(expectedText: string, spokenText: string): number {
  const expected = normalizeLyricTokens(expectedText);
  const spoken = normalizeLyricTokens(spokenText);

  if (expected.length === 0 || spoken.length === 0) {
    return 0;
  }

  const lcs = computeLcsLength(expected, spoken);
  const recall = lcs / expected.length;
  const precision = lcs / spoken.length;

  return clamp(recall * 0.75 + precision * 0.25, 0, 1);
}

export function computeTimingScore(offsetMs: number, perfectWindowMs = 450, okayWindowMs = 1800): number {
  const absoluteOffset = Math.abs(offsetMs);

  if (absoluteOffset <= perfectWindowMs) {
    return 1;
  }

  if (absoluteOffset >= okayWindowMs) {
    return 0;
  }

  const remaining = okayWindowMs - absoluteOffset;
  const span = Math.max(1, okayWindowMs - perfectWindowMs);
  return clamp(remaining / span, 0, 1);
}

export function gradeLyricsScore(score: number): 'perfect' | 'good' | 'miss' {
  if (score >= 85) {
    return 'perfect';
  }
  if (score >= 60) {
    return 'good';
  }
  return 'miss';
}

export function evaluateLyricsCue(cue: LyricsCue, cueIndex: number, transcript: string, detectedAtMs: number): LyricsCueResult {
  const cueMidpointMs = (cue.startMs + cue.endMs) / 2;
  const offsetMs = Math.round(detectedAtMs - cueMidpointMs);
  const overlapScore = computeOverlapScore(cue.text, transcript);
  const timingScore = computeTimingScore(offsetMs);
  const totalScore = Math.round((overlapScore * 0.85 + timingScore * 0.15) * 100);

  return {
    cue,
    cueIndex,
    transcript,
    overlapScore,
    timingScore,
    totalScore,
    grade: gradeLyricsScore(totalScore),
    offsetMs,
  };
}

function createMissResult(cue: LyricsCue, cueIndex: number): LyricsCueResult {
  return {
    cue,
    cueIndex,
    transcript: '',
    overlapScore: 0,
    timingScore: 0,
    totalScore: 0,
    grade: 'miss',
    offsetMs: 0,
  };
}

function summarizePlayer(
  track: LyricsTrack,
  playerSlot: LyricsPlayerSlot,
  bestCueResults: Array<LyricsCueResult | null>,
): LyricsPlayerSummary {
  const cueResults = track.cues.map((cue, index) => bestCueResults[index] || createMissResult(cue, index));
  const perfectHits = cueResults.filter((result) => result.grade === 'perfect').length;
  const goodHits = cueResults.filter((result) => result.grade === 'good').length;
  const misses = cueResults.length - perfectHits - goodHits;

  return {
    playerSlot,
    score: cueResults.reduce((sum, result) => sum + result.totalScore, 0),
    perfectHits,
    goodHits,
    misses,
    totalCues: cueResults.length,
    cueResults,
  };
}

export function summarizeLyricsHeadToHead(
  track: LyricsTrack,
  byPlayer: Record<LyricsPlayerSlot, Array<LyricsCueResult | null>>,
): LyricsResultSummary {
  const playerOne = summarizePlayer(track, 1, byPlayer[1]);
  const playerTwo = summarizePlayer(track, 2, byPlayer[2]);

  return {
    trackId: track.id,
    trackTitle: track.title,
    players: {
      1: playerOne,
      2: playerTwo,
    },
    rounds: track.cues.map((cue, index) => ({
      round: index + 1,
      playerOne: playerOne.cueResults[index] || createMissResult(cue, index),
      playerTwo: playerTwo.cueResults[index] || createMissResult(cue, index),
    })),
  };
}
