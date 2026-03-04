import { describe, expect, it, vi } from 'vitest';
import { createInstruments, MIDNIGHT_SOUL_PATCHES } from './instruments';

const synthCalls = vi.hoisted(() => [] as Array<[unknown, unknown, unknown, unknown]>);
const filterRampCalls = vi.hoisted(() => [] as Array<[unknown, unknown, unknown]>);

class FakeSynth {
  toDestination() {
    return this;
  }

  connect() {
    return this;
  }

  triggerAttackRelease(note: unknown, duration: unknown, time: unknown, velocity: unknown) {
    synthCalls.push([note, duration, time, velocity]);
  }

  dispose() {}
}

class FakeFilter {
  frequency = {
    rampTo: (value: unknown, seconds: unknown, time: unknown) => {
      filterRampCalls.push([value, seconds, time]);
    },
  };

  toDestination() {
    return this;
  }

  dispose() {}
}

class FakePolySynth {
  connect() {
    return this;
  }

  triggerAttackRelease(note: unknown, duration: unknown, time: unknown, velocity: unknown) {
    synthCalls.push([note, duration, time, velocity]);
  }

  dispose() {}
}

vi.mock('tone', () => ({
  MembraneSynth: FakeSynth,
  NoiseSynth: FakeSynth,
  Synth: FakeSynth,
  MonoSynth: FakeSynth,
  Filter: FakeFilter,
  PolySynth: FakePolySynth,
}));

describe('Midnight Soul instrument patches', () => {
  it('defines a warmer soul-leaning palette for drums, bass, and keys', () => {
    expect(MIDNIGHT_SOUL_PATCHES.snare.noise.type).toBe('pink');
    expect(MIDNIGHT_SOUL_PATCHES.hat.oscillator.type).toBe('triangle');
    expect(MIDNIGHT_SOUL_PATCHES.bass.oscillator.type).toBe('triangle');
    expect(MIDNIGHT_SOUL_PATCHES.keys.filterFrequency).toBeGreaterThanOrEqual(1200);
    expect(MIDNIGHT_SOUL_PATCHES.keys.envelope.release).toBeGreaterThan(1);
  });

  it('exposes a wrong-note trigger in the public instrument contract', async () => {
    synthCalls.length = 0;
    filterRampCalls.length = 0;

    const instruments = await createInstruments();

    expect(typeof instruments.triggerWrong).toBe('function');

    instruments.triggerWrong(1.5, 0.35);
    expect(synthCalls).toContainEqual(['A1', '16n', 1.5, 0.35]);

    instruments.triggerPad(['A4', 'C5', 'E5'], 2, 0.4, 1600);
    expect(filterRampCalls).toContainEqual([1600, 0.05, 2]);
  });
});
