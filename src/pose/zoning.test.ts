import { describe, expect, it } from 'vitest';
import { assignZones, createInitialZoningState } from './zoning';

const WIDTH = 900;

describe('zoning', () => {
  it('picks highest-confidence candidate in each zone', () => {
    const state = createInitialZoningState();

    const next = assignZones({
      now: 0,
      width: WIDTH,
      state,
      poses: [
        { score: 0.4, centerX: 120 },
        { score: 0.8, centerX: 150 },
        { score: 0.7, centerX: 460 },
        { score: 0.9, centerX: 800 },
      ],
    });

    expect(next.occupants.left?.score).toBe(0.8);
    expect(next.occupants.middle?.score).toBe(0.7);
    expect(next.occupants.right?.score).toBe(0.9);
  });

  it('uses hysteresis before switching occupants', () => {
    let state = createInitialZoningState();

    state = assignZones({
      now: 0,
      width: WIDTH,
      state,
      poses: [{ score: 0.6, centerX: 100 }],
    });

    state = assignZones({
      now: 16,
      width: WIDTH,
      state,
      poses: [{ score: 0.95, centerX: 240 }],
      holdFrames: 2,
      switchMargin: 0.2,
    });

    expect(state.occupants.left?.centerX).toBe(100);

    state = assignZones({
      now: 32,
      width: WIDTH,
      state,
      poses: [{ score: 0.95, centerX: 240 }],
      holdFrames: 2,
      switchMargin: 0.2,
    });

    expect(state.occupants.left?.centerX).toBe(240);
  });

  it('reacquires after missing timeout', () => {
    let state = createInitialZoningState();

    state = assignZones({
      now: 0,
      width: WIDTH,
      state,
      poses: [{ score: 0.6, centerX: 100 }],
    });

    state = assignZones({
      now: 500,
      width: WIDTH,
      state,
      poses: [],
      missingTimeoutMs: 2000,
    });

    expect(state.occupants.left).not.toBeNull();

    state = assignZones({
      now: 2501,
      width: WIDTH,
      state,
      poses: [{ score: 0.8, centerX: 220 }],
      missingTimeoutMs: 2000,
    });

    expect(state.occupants.left?.centerX).toBe(220);
  });
});
