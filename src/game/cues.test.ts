import { describe, expect, it } from 'vitest';
import { computeCueWindowActive, countdownSecond, shouldTriggerCountdownTick } from './cues';

describe('cue helpers', () => {
  it('activates cue windows near quantized beat boundaries', () => {
    expect(computeCueWindowActive(0, '8n')).toBe(true);
    expect(computeCueWindowActive(0.5, '8n')).toBe(true);
    expect(computeCueWindowActive(0.125, '8n')).toBe(false);
  });

  it('computes countdown second labels and edge transitions', () => {
    expect(countdownSecond(9_900)).toBe(10);
    expect(countdownSecond(9_050)).toBe(10);
    expect(countdownSecond(8_999)).toBe(9);
  });

  it('triggers timer warning tick only when crossing into a new second at 10s or less', () => {
    expect(shouldTriggerCountdownTick(null, 10_000)).toBe(true);
    expect(shouldTriggerCountdownTick(9_900, 9_200)).toBe(false);
    expect(shouldTriggerCountdownTick(9_900, 8_900)).toBe(true);
    expect(shouldTriggerCountdownTick(12_000, 11_000)).toBe(false);
  });
});
