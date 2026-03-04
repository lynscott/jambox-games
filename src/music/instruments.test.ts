import { describe, expect, it } from 'vitest';
import { MIDNIGHT_SOUL_PATCHES } from './instruments';

describe('Midnight Soul instrument patches', () => {
  it('defines a warmer soul-leaning palette for drums, bass, and keys', () => {
    expect(MIDNIGHT_SOUL_PATCHES.snare.noise.type).toBe('pink');
    expect(MIDNIGHT_SOUL_PATCHES.hat.oscillator.type).toBe('triangle');
    expect(MIDNIGHT_SOUL_PATCHES.bass.oscillator.type).toBe('triangle');
    expect(MIDNIGHT_SOUL_PATCHES.keys.filterFrequency).toBeGreaterThanOrEqual(1200);
    expect(MIDNIGHT_SOUL_PATCHES.keys.envelope.release).toBeGreaterThan(1);
  });
});
