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
    });

    expect(result.events.some((event) => event.instrument === 'drums')).toBe(true);
    expect(result.events.every((event) => event.source === 'player')).toBe(true);

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
        right: { wristVelocity: 0, torsoY: 260, shoulderWristAngle: 0.2, energy: 0.05 },
      },
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

  it('does not emit autonomous conductor support when no player gesture is present', () => {
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
    });

    expect(result.events).toHaveLength(0);
  });

  it('uses selected lane instruments instead of fixed zone roles', () => {
    const conductor = createConductor();
    const result = mapFeaturesToEvents({
      timestamp: 4200,
      state: createInitialMappingState(),
      conductor,
      laneInstruments: {
        left: 'pad',
        middle: 'rhythm',
        right: 'bass',
      },
      features: {
        left: { wristVelocity: 0.1, torsoY: 180, shoulderWristAngle: 0.4, energy: 0.08 },
        middle: { wristVelocity: 0.7, torsoY: 230, shoulderWristAngle: 0.1, energy: 0.12 },
        right: { wristVelocity: 0.2, torsoY: 240, shoulderWristAngle: -1.1, energy: 0.1 },
      },
    });

    expect(result.events.some((event) => event.zone === 'left' && event.instrument === 'pad')).toBe(true);
    expect(result.events.some((event) => event.zone === 'middle' && event.instrument === 'drums')).toBe(true);
    expect(result.events.some((event) => event.zone === 'right' && event.instrument === 'bass')).toBe(true);
  });
});
