import { describe, expect, it } from 'vitest';
import { createInitialState } from '../state/store';
import { MIDNIGHT_SOUL_TRACK } from './tracks';

describe('Midnight Soul track preset', () => {
  it('defines the first playable Jam Hero preset', () => {
    expect(MIDNIGHT_SOUL_TRACK.id).toBe('midnight-soul');
    expect(MIDNIGHT_SOUL_TRACK.title).toBe('Midnight Soul');
    expect(MIDNIGHT_SOUL_TRACK.bpm).toBeGreaterThanOrEqual(92);
    expect(MIDNIGHT_SOUL_TRACK.bpm).toBeLessThanOrEqual(98);
    expect(MIDNIGHT_SOUL_TRACK.key).toBe('A minor');
    expect(MIDNIGHT_SOUL_TRACK.laneInstruments).toEqual({
      left: 'drums',
      middle: 'bass',
      right: 'keys',
    });
    expect(MIDNIGHT_SOUL_TRACK.chordLoop.length).toBeGreaterThan(0);
    expect(MIDNIGHT_SOUL_TRACK.tutorialHints.drums).toMatch(/wrist strikes/i);
    expect(MIDNIGHT_SOUL_TRACK.tutorialHints.bass).toMatch(/pulse/i);
    expect(MIDNIGHT_SOUL_TRACK.tutorialHints.keys).toMatch(/hold/i);
  });

  it('sets Midnight Soul as the default Jam Hero setup', () => {
    const state = createInitialState();

    expect(state.currentTrackId).toBe('midnight-soul');
    expect(state.lanes.left.instrument).toBe('drums');
    expect(state.lanes.middle.instrument).toBe('bass');
    expect(state.lanes.right.instrument).toBe('keys');
  });
});
