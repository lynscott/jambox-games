import { describe, expect, it } from 'vitest';
import {
  createInitialGestureIntentState,
  updateGestureIntent,
} from './gesture-intent';

describe('gesture intent state machine', () => {
  it('triggers drums only on a clear strike and respects cooldown', () => {
    let state = createInitialGestureIntentState();

    let result = updateGestureIntent('drums', state, {
      timestamp: 1000,
      wristVelocity: 0.3,
      wristDeltaY: 6,
    });
    expect(result.trigger).toBe(false);
    expect(result.nextState.phase).toBe('idle');

    result = updateGestureIntent('drums', result.nextState, {
      timestamp: 1100,
      wristVelocity: 0.72,
      wristDeltaY: 24,
    });
    expect(result.trigger).toBe(true);
    expect(result.nextState.phase).toBe('cooldown');

    state = result.nextState;
    result = updateGestureIntent('drums', state, {
      timestamp: 1180,
      wristVelocity: 0.86,
      wristDeltaY: 28,
    });
    expect(result.trigger).toBe(false);
    expect(result.nextState.phase).toBe('cooldown');

    result = updateGestureIntent('drums', result.nextState, {
      timestamp: 1325,
      wristVelocity: 0.9,
      wristDeltaY: 26,
    });
    expect(result.trigger).toBe(true);
  });

  it('arms bass from a stable note pose and triggers only on pulse', () => {
    let result = updateGestureIntent('bass', createInitialGestureIntentState(), {
      timestamp: 2000,
      noteSlot: 1,
      noteSlotStableMs: 90,
      pulseVelocity: 0.1,
    });
    expect(result.nextState.phase).toBe('idle');
    expect(result.armedSlot).toBeNull();
    expect(result.trigger).toBe(false);

    result = updateGestureIntent('bass', result.nextState, {
      timestamp: 2160,
      noteSlot: 1,
      noteSlotStableMs: 220,
      pulseVelocity: 0.12,
    });
    expect(result.nextState.phase).toBe('armed');
    expect(result.armedSlot).toBe(1);
    expect(result.trigger).toBe(false);

    result = updateGestureIntent('bass', result.nextState, {
      timestamp: 2230,
      noteSlot: 1,
      noteSlotStableMs: 290,
      pulseVelocity: 0.54,
    });
    expect(result.trigger).toBe(true);
    expect(result.armedSlot).toBe(1);
    expect(result.nextState.phase).toBe('cooldown');
  });

  it('starts and releases keys sustain from a held open-hands posture', () => {
    let result = updateGestureIntent('keys', createInitialGestureIntentState(), {
      timestamp: 3000,
      handsRaised: true,
      handsOpen: true,
      holdMs: 90,
      torsoY: 210,
    });
    expect(result.trigger).toBe(false);
    expect(result.release).toBe(false);
    expect(result.nextState.phase).toBe('idle');

    result = updateGestureIntent('keys', result.nextState, {
      timestamp: 3220,
      handsRaised: true,
      handsOpen: true,
      holdMs: 260,
      torsoY: 205,
    });
    expect(result.trigger).toBe(true);
    expect(result.nextState.phase).toBe('active');
    expect(result.release).toBe(false);

    result = updateGestureIntent('keys', result.nextState, {
      timestamp: 3360,
      handsRaised: true,
      handsOpen: true,
      holdMs: 400,
      torsoY: 198,
    });
    expect(result.trigger).toBe(false);
    expect(result.nextState.phase).toBe('active');
    expect(result.release).toBe(false);

    result = updateGestureIntent('keys', result.nextState, {
      timestamp: 3490,
      handsRaised: false,
      handsOpen: false,
      holdMs: 0,
      torsoY: 240,
    });
    expect(result.trigger).toBe(false);
    expect(result.release).toBe(true);
    expect(result.nextState.phase).toBe('idle');
  });

  it('ignores idle noise for bass and keys', () => {
    const bass = updateGestureIntent('bass', createInitialGestureIntentState(), {
      timestamp: 4100,
      noteSlot: null,
      noteSlotStableMs: 0,
      pulseVelocity: 0.14,
    });
    const keys = updateGestureIntent('keys', createInitialGestureIntentState(), {
      timestamp: 4100,
      handsRaised: true,
      handsOpen: false,
      holdMs: 80,
      torsoY: 230,
    });

    expect(bass.trigger).toBe(false);
    expect(bass.nextState.phase).toBe('idle');
    expect(keys.trigger).toBe(false);
    expect(keys.release).toBe(false);
    expect(keys.nextState.phase).toBe('idle');
  });
});
