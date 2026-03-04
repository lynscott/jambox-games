import { describe, expect, it } from 'vitest';
import { createConductor } from './conductor';
import { createInitialMappingState, mapFeaturesToEvents } from './mapping';
import type { ZoneFeatureSnapshot } from '../types';

function feature(overrides: Partial<ZoneFeatureSnapshot>): ZoneFeatureSnapshot {
  return {
    occupied: true,
    wristVelocity: 0,
    wristDeltaY: 0,
    torsoY: 230,
    shoulderWristAngle: 0,
    handsRaised: false,
    handsOpen: false,
    energy: 0,
    ...overrides,
  };
}

describe('feature mapping', () => {
  it('maps clear drum strikes to debounced drum hits', () => {
    const conductor = createConductor();
    let state = createInitialMappingState();

    let result = mapFeaturesToEvents({
      timestamp: 1000,
      state,
      conductor,
      features: {
        left: feature({ wristVelocity: 0.66, wristDeltaY: 24, energy: 0.18 }),
        middle: feature({ energy: 0.1 }),
        right: feature({ energy: 0.05 }),
      },
    });

    expect(result.events.some((event) => event.instrument === 'drums')).toBe(true);
    expect(result.events.every((event) => event.source === 'player')).toBe(true);
    expect(result.statuses.left).toBe('hit');

    state = result.nextState;
    result = mapFeaturesToEvents({
      timestamp: 1050,
      state,
      conductor,
      features: {
        left: feature({ wristVelocity: 0.84, wristDeltaY: 26, energy: 0.22 }),
        middle: feature({ energy: 0.1 }),
        right: feature({ energy: 0.05 }),
      },
    });

    expect(result.events.filter((event) => event.instrument === 'drums')).toHaveLength(0);
    expect(result.statuses.left).toBe('hit');
  });

  it('requires bass pose stability and pulse before emitting a bass note', () => {
    const conductor = createConductor();
    let state = createInitialMappingState();

    let result = mapFeaturesToEvents({
      timestamp: 2000,
      state,
      conductor,
      features: {
        left: feature({ energy: 0.05 }),
        middle: feature({ shoulderWristAngle: -1.0, wristVelocity: 0.12, wristDeltaY: 4, energy: 0.2 }),
        right: feature({ energy: 0.03 }),
      },
    });

    expect(result.events).toHaveLength(0);
    expect(result.statuses.middle).toBe('get_ready');

    state = result.nextState;
    result = mapFeaturesToEvents({
      timestamp: 2200,
      state,
      conductor,
      features: {
        left: feature({ energy: 0.05 }),
        middle: feature({ shoulderWristAngle: -1.0, wristVelocity: 0.16, wristDeltaY: 6, energy: 0.22 }),
        right: feature({ energy: 0.03 }),
      },
    });

    expect(result.events).toHaveLength(0);
    expect(result.statuses.middle).toBe('hold');

    state = result.nextState;
    result = mapFeaturesToEvents({
      timestamp: 2280,
      state,
      conductor,
      features: {
        left: feature({ energy: 0.05 }),
        middle: feature({ shoulderWristAngle: -1.0, wristVelocity: 0.58, wristDeltaY: 20, energy: 0.24 }),
        right: feature({ energy: 0.03 }),
      },
    });

    const bass = result.events.find((event) => event.instrument === 'bass');
    expect(bass).toBeDefined();
    expect(result.statuses.middle).toBe('hit');
    if (bass?.instrument === 'bass') {
      expect(['A2', 'C3', 'E3']).toContain(bass.note);
    }
  });

  it('requires a sustained open-hands posture before emitting a keys pad event', () => {
    const conductor = createConductor();
    let state = createInitialMappingState();

    let result = mapFeaturesToEvents({
      timestamp: 3000,
      state,
      conductor,
      features: {
        left: feature({ energy: 0.03 }),
        middle: feature({ energy: 0.04 }),
        right: feature({ handsRaised: true, handsOpen: true, torsoY: 190, energy: 0.18 }),
      },
    });

    expect(result.events).toHaveLength(0);
    expect(result.statuses.right).toBe('hold');

    state = result.nextState;
    result = mapFeaturesToEvents({
      timestamp: 3220,
      state,
      conductor,
      features: {
        left: feature({ energy: 0.03 }),
        middle: feature({ energy: 0.04 }),
        right: feature({ handsRaised: true, handsOpen: true, torsoY: 180, energy: 0.22 }),
      },
    });

    const pad = result.events.find((event) => event.instrument === 'pad');
    expect(pad).toBeDefined();
    expect(result.statuses.right).toBe('sustain');
    if (pad?.instrument === 'pad') {
      expect(pad.filterCutoff).toBeGreaterThanOrEqual(400);
      expect(pad.filterCutoff).toBeLessThanOrEqual(2600);
    }

    state = result.nextState;
    result = mapFeaturesToEvents({
      timestamp: 3360,
      state,
      conductor,
      features: {
        left: feature({ energy: 0.03 }),
        middle: feature({ energy: 0.04 }),
        right: feature({ handsRaised: true, handsOpen: true, torsoY: 176, energy: 0.24 }),
      },
    });

    expect(result.events.filter((event) => event.instrument === 'pad')).toHaveLength(0);
    expect(result.statuses.right).toBe('sustain');
  });

  it('does not emit player notes from idle movement or energy alone', () => {
    const conductor = createConductor();
    const result = mapFeaturesToEvents({
      timestamp: 3000,
      state: createInitialMappingState(),
      conductor,
      features: {
        left: feature({ energy: 0.28, wristVelocity: 0.18, wristDeltaY: 5 }),
        middle: feature({ energy: 0.24, shoulderWristAngle: 0.4, wristVelocity: 0.12, wristDeltaY: 2 }),
        right: feature({ energy: 0.3, handsRaised: true, handsOpen: false }),
      },
    });

    expect(result.events).toHaveLength(0);
  });

  it('does not emit events for empty lanes even if stale values are present', () => {
    const conductor = createConductor();
    const result = mapFeaturesToEvents({
      timestamp: 3600,
      state: createInitialMappingState(),
      conductor,
      features: {
        left: feature({ occupied: false, wristVelocity: 0.8, wristDeltaY: 24, energy: 0.25 }),
        middle: feature({ occupied: false, shoulderWristAngle: -0.9, wristVelocity: 0.5, wristDeltaY: 18, energy: 0.22 }),
        right: feature({ occupied: false, handsRaised: true, handsOpen: true, energy: 0.2 }),
      },
    });

    expect(result.events).toHaveLength(0);
    expect(result.statuses.left).toBe('no_player');
    expect(result.statuses.middle).toBe('no_player');
    expect(result.statuses.right).toBe('no_player');
  });

  it('uses selected lane instruments instead of fixed zone roles', () => {
    const conductor = createConductor();
    let state = createInitialMappingState();
    const laneInstruments = {
      left: 'keys' as const,
      middle: 'drums' as const,
      right: 'bass' as const,
    };

    let result = mapFeaturesToEvents({
      timestamp: 4200,
      state,
      conductor,
      laneInstruments,
      features: {
        left: feature({ handsRaised: true, handsOpen: true, torsoY: 185, energy: 0.16 }),
        middle: feature({ wristVelocity: 0.72, wristDeltaY: 24, energy: 0.18 }),
        right: feature({ shoulderWristAngle: -1.1, wristVelocity: 0.12, wristDeltaY: 2, energy: 0.12 }),
      },
    });

    expect(result.events.some((event) => event.zone === 'middle' && event.instrument === 'drums')).toBe(true);
    expect(result.events.some((event) => event.zone === 'left' && event.instrument === 'pad')).toBe(false);
    expect(result.events.some((event) => event.zone === 'right' && event.instrument === 'bass')).toBe(false);

    state = result.nextState;
    result = mapFeaturesToEvents({
      timestamp: 4425,
      state,
      conductor,
      laneInstruments,
      features: {
        left: feature({ handsRaised: true, handsOpen: true, torsoY: 180, energy: 0.18 }),
        middle: feature({ energy: 0.05 }),
        right: feature({ shoulderWristAngle: -1.1, wristVelocity: 0.18, wristDeltaY: 4, energy: 0.14 }),
      },
    });

    expect(result.events.some((event) => event.zone === 'left' && event.instrument === 'pad')).toBe(true);

    state = result.nextState;
    result = mapFeaturesToEvents({
      timestamp: 4505,
      state,
      conductor,
      laneInstruments,
      features: {
        left: feature({ handsRaised: true, handsOpen: true, torsoY: 178, energy: 0.18 }),
        middle: feature({ energy: 0.05 }),
        right: feature({ shoulderWristAngle: -1.1, wristVelocity: 0.6, wristDeltaY: 22, energy: 0.18 }),
      },
    });

    expect(result.events.some((event) => event.zone === 'right' && event.instrument === 'bass')).toBe(true);
  });
});
