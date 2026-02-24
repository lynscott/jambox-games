import { describe, expect, it } from 'vitest';
import { createConductor } from './conductor';
import { createInitialMappingState, mapFeaturesToEvents } from './mapping';

describe('feature mapping', () => {
  it('maps high wrist velocity to debounced drum hits', () => {
    const conductor = createConductor();
    let state = createInitialMappingState();

    let result = mapFeaturesToEvents({
      timestamp: 1000,
      state,
      conductor,
      features: {
        left: { wristVelocity: 0.6, torsoY: 240, shoulderWristAngle: 0.2, energy: 0.6 },
        middle: { wristVelocity: 0, torsoY: 230, shoulderWristAngle: -0.2, energy: 0.1 },
        right: { wristVelocity: 0, torsoY: 230, shoulderWristAngle: 0.1, energy: 0.05 },
      },
      previousGlobalEnergy: 0.2,
    });

    expect(result.events.some((event) => event.instrument === 'drums')).toBe(true);

    state = result.nextState;
    result = mapFeaturesToEvents({
      timestamp: 1050,
      state,
      conductor,
      features: {
        left: { wristVelocity: 0.8, torsoY: 240, shoulderWristAngle: 0.2, energy: 0.6 },
        middle: { wristVelocity: 0, torsoY: 230, shoulderWristAngle: -0.2, energy: 0.1 },
        right: { wristVelocity: 0, torsoY: 230, shoulderWristAngle: 0.1, energy: 0.05 },
      },
      previousGlobalEnergy: result.globalEnergy,
    });

    expect(result.events.filter((event) => event.instrument === 'drums')).toHaveLength(0);
  });

  it('maps angle and torso to bass/pad events in chord', () => {
    const conductor = createConductor();
    const result = mapFeaturesToEvents({
      timestamp: 2000,
      state: createInitialMappingState(),
      conductor,
      features: {
        left: { wristVelocity: 0, torsoY: 220, shoulderWristAngle: 1.2, energy: 0.1 },
        middle: { wristVelocity: 0, torsoY: 180, shoulderWristAngle: -1.0, energy: 0.1 },
        right: { wristVelocity: 0, torsoY: 260, shoulderWristAngle: 0.2, energy: 0.02 },
      },
      previousGlobalEnergy: 0.1,
    });

    const bass = result.events.find((event) => event.instrument === 'bass');
    const pad = result.events.find((event) => event.instrument === 'pad');

    expect(bass).toBeDefined();
    expect(pad).toBeDefined();
    if (bass?.instrument === 'bass') {
      expect(['A2', 'C3', 'E3']).toContain(bass.note);
    }
    if (pad?.instrument === 'pad') {
      expect(pad.filterCutoff).toBeGreaterThanOrEqual(400);
      expect(pad.filterCutoff).toBeLessThanOrEqual(2600);
    }
  });

  it('adds idle support pattern for low-energy zones', () => {
    const conductor = createConductor();
    const result = mapFeaturesToEvents({
      timestamp: 3000,
      state: createInitialMappingState(),
      conductor,
      features: {
        left: { wristVelocity: 0, torsoY: 230, shoulderWristAngle: 0, energy: 0.01 },
        middle: { wristVelocity: 0, torsoY: 230, shoulderWristAngle: 0, energy: 0.01 },
        right: { wristVelocity: 0, torsoY: 230, shoulderWristAngle: 0, energy: 0.01 },
      },
      previousGlobalEnergy: 0,
    });

    expect(result.events.some((event) => event.instrument === 'pad')).toBe(true);
  });
});
