import type { LyricsTrack } from './lyrics';

export const LYRICS_TRACKS: LyricsTrack[] = [
  // AUTO-INSERT TRACKS START
  {
    id: 'demo-moo-ma-ga-gai',
    title: 'Moo Ma Ga Gai Demo',
    artist: 'Jam Box Games',
    instrumentalSrc: '/audio/say-the-word-on-beat-original.mp3',
    source: 'local',
    durationMs: 19200,
    cues: [
      { id: 'line-1', startMs: 0, endMs: 2400, text: 'Moo ma ga gai' },
      { id: 'line-2', startMs: 2400, endMs: 4800, text: 'Pig dog crow chicken' },
      { id: 'line-3', startMs: 4800, endMs: 7200, text: 'Moo ma ga gai' },
      { id: 'line-4', startMs: 7200, endMs: 9600, text: 'Pig dog crow chicken' },
      { id: 'line-5', startMs: 9600, endMs: 12000, text: 'Moo ma ga gai' },
      { id: 'line-6', startMs: 12000, endMs: 14400, text: 'Pig dog crow chicken' },
      { id: 'line-7', startMs: 14400, endMs: 16800, text: 'Moo ma ga gai' },
      { id: 'line-8', startMs: 16800, endMs: 19200, text: 'Pig dog crow chicken' },
    ],
  },
  // AUTO-INSERT TRACKS END
];

export function getLyricsTrackById(trackId: string): LyricsTrack {
  const match = LYRICS_TRACKS.find((track) => track.id === trackId);
  if (!match) {
    throw new Error(`Unknown lyrics track: ${trackId}`);
  }
  return match;
}
