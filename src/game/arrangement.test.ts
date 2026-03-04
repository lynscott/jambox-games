import { describe, expect, it } from 'vitest';
import { computeLoopArrangement } from './arrangement';

describe('computeLoopArrangement', () => {
  it('starts in harmony section with all zones active', () => {
    const state = computeLoopArrangement({
      nowSeconds: 100,
      jamStartSeconds: 100,
      bpm: 120,
    });

    expect(state.section).toBe('harmony');
    expect(state.cycleIndex).toBe(0);
    expect(state.barInCycle).toBe(0);
    expect(state.activeZones).toEqual({ left: true, middle: true, right: true });
    expect(state.callout).toBe('Harmony');
  });

  it('enters solo section on bars 5-6 and focuses left zone in cycle 0', () => {
    const state = computeLoopArrangement({
      nowSeconds: 108, // 16 beats at 120 BPM
      jamStartSeconds: 100,
      bpm: 120,
    });

    expect(state.section).toBe('solo');
    expect(state.barInCycle).toBe(4);
    expect(state.focusZone).toBe('left');
    expect(state.activeZones).toEqual({ left: true, middle: false, right: false });
    expect(state.callout).toBe('Solo: Left');
  });

  it('rotates solo focus zone each cycle', () => {
    const state = computeLoopArrangement({
      nowSeconds: 124, // cycle 1, bar 5 at 120 BPM
      jamStartSeconds: 100,
      bpm: 120,
    });

    expect(state.cycleIndex).toBe(1);
    expect(state.section).toBe('solo');
    expect(state.focusZone).toBe('middle');
    expect(state.activeZones).toEqual({ left: false, middle: true, right: false });
    expect(state.callout).toBe('Solo: Middle');
  });

  it('uses blend section on final two bars with all zones active', () => {
    const state = computeLoopArrangement({
      nowSeconds: 112, // 24 beats at 120 BPM => bar 7
      jamStartSeconds: 100,
      bpm: 120,
    });

    expect(state.section).toBe('blend');
    expect(state.barInCycle).toBe(6);
    expect(state.activeZones).toEqual({ left: true, middle: true, right: true });
    expect(state.callout).toBe('Blend');
  });

  it('reports cycle progress from 0 to <1', () => {
    const state = computeLoopArrangement({
      nowSeconds: 110, // beat 20 in cycle => 62.5%
      jamStartSeconds: 100,
      bpm: 120,
    });

    expect(state.cycleProgress).toBeCloseTo(0.625, 3);
  });
});
