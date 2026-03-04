import { describe, expect, it } from 'vitest';
import {
  computeOverlapScore,
  computeTimingScore,
  evaluateLyricsCue,
  summarizeLyricsHeadToHead,
  type LyricsTrack,
} from './lyrics';

describe('lyrics scoring', () => {
  it('computes overlap based on shared token order', () => {
    expect(computeOverlapScore('pig dog crow chicken', 'pig dog crow chicken')).toBe(1);
    expect(computeOverlapScore('pig dog crow chicken', 'dog pig chicken')).toBeLessThan(0.7);
    expect(computeOverlapScore('pig dog crow chicken', '')).toBe(0);
  });

  it('penalizes timing outside the perfect window', () => {
    expect(computeTimingScore(0)).toBe(1);
    expect(computeTimingScore(300)).toBe(1);
    expect(computeTimingScore(900)).toBeGreaterThan(0);
    expect(computeTimingScore(2_500)).toBe(0);
  });

  it('builds per-player round summaries with misses for untouched cues', () => {
    const track: LyricsTrack = {
      id: 'test',
      title: 'Test',
      artist: 'Test',
      instrumentalSrc: '/x.mp3',
      cues: [
        { id: 'a', startMs: 0, endMs: 2_000, text: 'hello world' },
        { id: 'b', startMs: 2_000, endMs: 4_000, text: 'goodbye world' },
      ],
    };

    const p1Round1 = evaluateLyricsCue(track.cues[0], 0, 'hello world', 900);
    const p2Round1 = evaluateLyricsCue(track.cues[0], 0, 'hello there', 1000);

    const summary = summarizeLyricsHeadToHead(track, {
      1: [p1Round1, null],
      2: [p2Round1, null],
    });

    expect(summary.rounds.length).toBe(2);
    expect(summary.players[1].cueResults[1].grade).toBe('miss');
    expect(summary.players[2].cueResults[1].grade).toBe('miss');
    expect(summary.players[1].score).toBeGreaterThan(summary.players[2].score);
  });
});
