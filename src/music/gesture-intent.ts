import type { GestureIntentPhase, LaneInstrument } from '../types';

const DRUM_STRIKE_VELOCITY = 0.6;
const DRUM_STRIKE_DROP = 18;
const DRUM_COOLDOWN_MS = 180;
const BASS_POSE_STABLE_MS = 160;
const BASS_PULSE_VELOCITY = 0.4;
const BASS_COOLDOWN_MS = 220;
const KEYS_HOLD_MS = 180;

export interface GestureIntentInput {
  timestamp: number;
  wristVelocity?: number;
  wristDeltaY?: number;
  noteSlot?: number | null;
  noteSlotStableMs?: number;
  pulseVelocity?: number;
  handsRaised?: boolean;
  handsOpen?: boolean;
  holdMs?: number;
  torsoY?: number;
}

export interface GestureIntentState {
  phase: GestureIntentPhase;
  armedSlot: number | null;
  cooldownUntil: number;
  sustainActive: boolean;
}

export interface GestureIntentResult {
  nextState: GestureIntentState;
  trigger: boolean;
  release: boolean;
  armedSlot: number | null;
}

export function createInitialGestureIntentState(): GestureIntentState {
  return {
    phase: 'idle',
    armedSlot: null,
    cooldownUntil: -Infinity,
    sustainActive: false,
  };
}

function inCooldown(state: GestureIntentState, timestamp: number): boolean {
  return timestamp < state.cooldownUntil;
}

export function updateGestureIntent(
  instrument: LaneInstrument,
  state: GestureIntentState,
  input: GestureIntentInput,
): GestureIntentResult {
  if (instrument === 'drums') {
    if (inCooldown(state, input.timestamp)) {
      return {
        nextState: { ...state, phase: 'cooldown' },
        trigger: false,
        release: false,
        armedSlot: state.armedSlot,
      };
    }

    const strikeReady =
      (input.wristVelocity ?? 0) >= DRUM_STRIKE_VELOCITY && (input.wristDeltaY ?? 0) >= DRUM_STRIKE_DROP;
    if (!strikeReady) {
      return {
        nextState: { ...state, phase: 'idle', armedSlot: null },
        trigger: false,
        release: false,
        armedSlot: null,
      };
    }

    return {
      nextState: {
        phase: 'cooldown',
        armedSlot: null,
        cooldownUntil: input.timestamp + DRUM_COOLDOWN_MS,
        sustainActive: false,
      },
      trigger: true,
      release: false,
      armedSlot: null,
    };
  }

  if (instrument === 'bass') {
    if (inCooldown(state, input.timestamp)) {
      return {
        nextState: { ...state, phase: 'cooldown' },
        trigger: false,
        release: false,
        armedSlot: state.armedSlot,
      };
    }

    const stableSlot =
      input.noteSlot !== null &&
      input.noteSlot !== undefined &&
      (input.noteSlotStableMs ?? 0) >= BASS_POSE_STABLE_MS;
    const armedSlot = stableSlot ? input.noteSlot ?? null : state.armedSlot;
    const pulsing = (input.pulseVelocity ?? 0) >= BASS_PULSE_VELOCITY;

    if (armedSlot !== null && pulsing) {
      return {
        nextState: {
          phase: 'cooldown',
          armedSlot,
          cooldownUntil: input.timestamp + BASS_COOLDOWN_MS,
          sustainActive: false,
        },
        trigger: true,
        release: false,
        armedSlot,
      };
    }

    if (stableSlot) {
      return {
        nextState: {
          phase: 'armed',
          armedSlot,
          cooldownUntil: state.cooldownUntil,
          sustainActive: false,
        },
        trigger: false,
        release: false,
        armedSlot,
      };
    }

    return {
      nextState: {
        phase: 'idle',
        armedSlot: null,
        cooldownUntil: state.cooldownUntil,
        sustainActive: false,
      },
      trigger: false,
      release: false,
      armedSlot: null,
    };
  }

  const sustainReady = Boolean(input.handsRaised && input.handsOpen && (input.holdMs ?? 0) >= KEYS_HOLD_MS);
  if (state.sustainActive && !sustainReady) {
    return {
      nextState: {
        phase: 'idle',
        armedSlot: null,
        cooldownUntil: state.cooldownUntil,
        sustainActive: false,
      },
      trigger: false,
      release: true,
      armedSlot: null,
    };
  }

  if (!state.sustainActive && sustainReady) {
    return {
      nextState: {
        phase: 'active',
        armedSlot: null,
        cooldownUntil: state.cooldownUntil,
        sustainActive: true,
      },
      trigger: true,
      release: false,
      armedSlot: null,
    };
  }

  if (state.sustainActive && sustainReady) {
    return {
      nextState: {
        phase: 'active',
        armedSlot: null,
        cooldownUntil: state.cooldownUntil,
        sustainActive: true,
      },
      trigger: false,
      release: false,
      armedSlot: null,
    };
  }

  return {
    nextState: {
      phase: 'idle',
      armedSlot: null,
      cooldownUntil: state.cooldownUntil,
      sustainActive: false,
    },
    trigger: false,
    release: false,
    armedSlot: null,
  };
}
