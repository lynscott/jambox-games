import { describe, expect, it } from 'vitest';
import {
  applyEvent,
  computeConsistency,
  computeFinalScore,
  computeOffsetMs,
  createInitialScoringState,
  gradeTimingMs,
} from './scoring';

describe('gradeTimingMs', () => {
  it('grades perfect within 35ms', () => {
    expect(gradeTimingMs(0)).toBe('perfect');
    expect(gradeTimingMs(35)).toBe('perfect');
    expect(gradeTimingMs(-35)).toBe('perfect');
  });

  it('grades good within 80ms', () => {
    expect(gradeTimingMs(36)).toBe('good');
    expect(gradeTimingMs(80)).toBe('good');
    expect(gradeTimingMs(-60)).toBe('good');
  });

  it('grades late within 150ms', () => {
    expect(gradeTimingMs(81)).toBe('late');
    expect(gradeTimingMs(150)).toBe('late');
  });

  it('grades miss beyond 150ms', () => {
    expect(gradeTimingMs(151)).toBe('miss');
    expect(gradeTimingMs(500)).toBe('miss');
  });
});

describe('applyEvent', () => {
  it('scores a perfect hit with base 100 points', () => {
    const state = createInitialScoringState(0);
    const result = applyEvent(state, { timestamp: 1000, zone: 'left', offsetMs: 10 });
    expect(result.grade).toBe('perfect');
    expect(result.points).toBe(100);
    expect(result.combo).toBe(1);
  });

  it('increments combo on consecutive perfect/good', () => {
    const state = createInitialScoringState(0);
    applyEvent(state, { timestamp: 1000, zone: 'left', offsetMs: 10 });
    applyEvent(state, { timestamp: 1200, zone: 'left', offsetMs: 50 });
    const result = applyEvent(state, { timestamp: 1400, zone: 'left', offsetMs: 5 });
    expect(result.combo).toBe(3);
  });

  it('resets combo on miss', () => {
    const state = createInitialScoringState(0);
    applyEvent(state, { timestamp: 1000, zone: 'left', offsetMs: 10 });
    applyEvent(state, { timestamp: 1200, zone: 'left', offsetMs: 10 });
    const result = applyEvent(state, { timestamp: 1400, zone: 'left', offsetMs: 200 });
    expect(result.grade).toBe('miss');
    expect(result.combo).toBe(0);
  });

  it('holds combo on late (no increment, no reset)', () => {
    const state = createInitialScoringState(0);
    applyEvent(state, { timestamp: 1000, zone: 'left', offsetMs: 10 });
    const result = applyEvent(state, { timestamp: 1200, zone: 'left', offsetMs: 100 });
    expect(result.grade).toBe('late');
    expect(result.combo).toBe(1); // held, not incremented
  });

  it('applies multiplier at combo tier boundaries', () => {
    const state = createInitialScoringState(0);
    // Build combo to 5 for 1.5x multiplier
    for (let i = 0; i < 5; i++) {
      applyEvent(state, { timestamp: 1000 + i * 200, zone: 'left', offsetMs: 10 });
    }
    // 6th hit at combo=5 → tier 1 → 1.5x
    const result = applyEvent(state, { timestamp: 2200, zone: 'left', offsetMs: 10 });
    expect(result.multiplier).toBe(1.5);
    expect(result.points).toBe(150); // 100 * 1.5
  });

  it('caps multiplier at 3x', () => {
    const state = createInitialScoringState(0);
    // Build combo to 20+ for max multiplier
    for (let i = 0; i < 22; i++) {
      applyEvent(state, { timestamp: 1000 + i * 200, zone: 'left', offsetMs: 10 });
    }
    const result = applyEvent(state, { timestamp: 6000, zone: 'left', offsetMs: 10 });
    expect(result.multiplier).toBe(3);
  });

  it('rejects jitter events within 100ms', () => {
    const state = createInitialScoringState(0);
    applyEvent(state, { timestamp: 1000, zone: 'left', offsetMs: 10 });
    const result = applyEvent(state, { timestamp: 1050, zone: 'left', offsetMs: 10 });
    expect(result.jitterRejected).toBe(true);
    expect(result.points).toBe(0);
    expect(state.jitterCount).toBe(1);
  });

  it('allows events on different zones within 100ms', () => {
    const state = createInitialScoringState(0);
    applyEvent(state, { timestamp: 1000, zone: 'left', offsetMs: 10 });
    const result = applyEvent(state, { timestamp: 1050, zone: 'middle', offsetMs: 10 });
    expect(result.jitterRejected).toBe(false);
    expect(result.grade).toBe('perfect');
  });
});

describe('computeConsistency', () => {
  it('returns 0 for fewer than 2 hits', () => {
    const state = createInitialScoringState(0);
    state.hitTimestamps = [1000];
    expect(computeConsistency(state, 60_000)).toBe(0);
  });

  it('returns high score for regular, balanced, spread-out hits', () => {
    const state = createInitialScoringState(0);
    const interval = 1000; // perfectly regular
    for (let i = 0; i < 30; i++) {
      state.hitTimestamps.push(i * interval);
      const zone = (['left', 'middle', 'right'] as const)[i % 3];
      state.laneHits[zone] += 1;
    }
    const score = computeConsistency(state, 30_000);
    expect(score).toBeGreaterThan(300);
  });

  it('returns lower score for irregular hits', () => {
    const state = createInitialScoringState(0);
    // Very irregular intervals
    state.hitTimestamps = [0, 100, 5000, 5100, 20000, 25000];
    state.laneHits = { left: 3, middle: 2, right: 1 };
    const score = computeConsistency(state, 30_000);
    expect(score).toBeLessThan(300);
  });

  it('applies jitter penalty', () => {
    const stateClean = createInitialScoringState(0);
    const stateDirty = createInitialScoringState(0);

    for (let i = 0; i < 20; i++) {
      stateClean.hitTimestamps.push(i * 500);
      stateDirty.hitTimestamps.push(i * 500);
      const zone = (['left', 'middle', 'right'] as const)[i % 3];
      stateClean.laneHits[zone] += 1;
      stateDirty.laneHits[zone] += 1;
    }
    stateDirty.jitterCount = 10;

    const cleanScore = computeConsistency(stateClean, 10_000);
    const dirtyScore = computeConsistency(stateDirty, 10_000);
    expect(dirtyScore).toBeLessThan(cleanScore);
  });
});

describe('computeFinalScore', () => {
  it('sums timing + consistency + combo bonus', () => {
    const state = createInitialScoringState(0);
    state.timingPoints = 1000;
    state.maxCombo = 15;
    state.combo = 10;
    // Add some hits for consistency
    for (let i = 0; i < 10; i++) {
      state.hitTimestamps.push(i * 500);
      const zone = (['left', 'middle', 'right'] as const)[i % 3];
      state.laneHits[zone] += 1;
    }

    const result = computeFinalScore(state, 5_000);
    expect(result.timing).toBe(1000);
    expect(result.comboBonus).toBe(150); // 15 * 10
    expect(result.consistency).toBeGreaterThan(0);
    expect(result.total).toBe(result.timing + result.consistency + result.comboBonus);
    expect(result.maxCombo).toBe(15);
  });
});

describe('computeOffsetMs', () => {
  it('returns 0 when exactly on grid', () => {
    expect(computeOffsetMs(1000, 500, 0)).toBe(0);
  });

  it('returns positive offset when after grid line', () => {
    expect(computeOffsetMs(1020, 500, 0)).toBe(20);
  });

  it('returns negative offset when before grid line', () => {
    expect(computeOffsetMs(980, 500, 0)).toBe(-20);
  });

  it('accounts for session start offset', () => {
    expect(computeOffsetMs(2500, 500, 500)).toBe(0);
  });
});
