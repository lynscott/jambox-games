import type { Conductor } from './conductor';
import {
  createInitialGestureIntentState,
  updateGestureIntent,
  type GestureIntentState,
} from './gesture-intent';
import type {
  GestureIntentPhase,
  LaneInstrument,
  LaneStatus,
  ZoneFeatureSnapshot,
  ZoneId,
} from '../types';

export type MusicEvent =
  | {
      source: 'player';
      instrument: 'drums';
      kind: 'kick' | 'snare' | 'hat';
      zone: ZoneId;
      velocity: number;
    }
  | {
      source: 'player';
      instrument: 'bass';
      zone: ZoneId;
      note: string;
      velocity: number;
    }
  | {
      source: 'player';
      instrument: 'pad';
      zone: ZoneId;
      notes: string[];
      velocity: number;
      filterCutoff: number;
    };

interface BassPoseTracker {
  slot: number | null;
  since: number | null;
}

export interface MappingState {
  gesture: Record<ZoneId, GestureIntentState>;
  bassPose: Record<ZoneId, BassPoseTracker>;
  keysHoldStartedAt: Record<ZoneId, number | null>;
}

interface MappingParams {
  timestamp: number;
  state: MappingState;
  conductor: Conductor;
  features: Record<ZoneId, ZoneFeatureSnapshot>;
  laneInstruments?: Record<ZoneId, LaneInstrument>;
}

interface MappingResult {
  events: MusicEvent[];
  nextState: MappingState;
  globalEnergy: number;
  statuses: Record<ZoneId, LaneStatus>;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function createInitialBassPose(): BassPoseTracker {
  return {
    slot: null,
    since: null,
  };
}

export function createInitialMappingState(): MappingState {
  return {
    gesture: {
      left: createInitialGestureIntentState(),
      middle: createInitialGestureIntentState(),
      right: createInitialGestureIntentState(),
    },
    bassPose: {
      left: createInitialBassPose(),
      middle: createInitialBassPose(),
      right: createInitialBassPose(),
    },
    keysHoldStartedAt: {
      left: null,
      middle: null,
      right: null,
    },
  };
}

function mapAngleToBassSlot(angle: number, conductor: Conductor): { slot: number; note: string } {
  const chord = conductor.getChordVoicing(3);
  const normalized = clamp((angle + Math.PI) / (Math.PI * 2), 0, 0.9999);
  const slot = Math.floor(normalized * chord.length);
  return {
    slot,
    note: conductor.constrainNoteToChord(chord[slot]),
  };
}

function mapTorsoToFilter(torsoY: number): number {
  const normalized = clamp((320 - torsoY) / 240, 0, 1);
  return 400 + normalized * 2200;
}

function nextBassPoseTracker(
  tracker: BassPoseTracker,
  slot: number,
  timestamp: number,
): { nextTracker: BassPoseTracker; stableMs: number } {
  if (tracker.slot === slot && tracker.since !== null) {
    return {
      nextTracker: tracker,
      stableMs: timestamp - tracker.since,
    };
  }

  return {
    nextTracker: {
      slot,
      since: timestamp,
    },
    stableMs: 0,
  };
}

function kindForZone(zone: ZoneId): 'kick' | 'snare' | 'hat' {
  if (zone === 'left') {
    return 'kick';
  }
  if (zone === 'middle') {
    return 'snare';
  }
  return 'hat';
}

function resetZoneState(nextState: MappingState, zone: ZoneId): void {
  nextState.gesture[zone] = createInitialGestureIntentState();
  nextState.bassPose[zone] = createInitialBassPose();
  nextState.keysHoldStartedAt[zone] = null;
}

function statusFromGesture(
  instrument: LaneInstrument,
  gesturePhase: GestureIntentPhase,
  feature: ZoneFeatureSnapshot,
): LaneStatus {
  if (!feature.occupied) {
    return 'no_player';
  }

  if (instrument === 'keys') {
    if (gesturePhase === 'active') {
      return 'sustain';
    }
    if (feature.handsRaised && feature.handsOpen) {
      return 'hold';
    }
    return 'get_ready';
  }

  if (gesturePhase === 'armed') {
    return 'hold';
  }
  if (gesturePhase === 'cooldown') {
    return 'hit';
  }

  return 'get_ready';
}

export function mapFeaturesToEvents({
  timestamp,
  state,
  conductor,
  features,
  laneInstruments = {
    left: 'drums',
    middle: 'bass',
    right: 'keys',
  },
}: MappingParams): MappingResult {
  const nextState: MappingState = {
    gesture: {
      left: { ...state.gesture.left },
      middle: { ...state.gesture.middle },
      right: { ...state.gesture.right },
    },
    bassPose: {
      left: { ...state.bassPose.left },
      middle: { ...state.bassPose.middle },
      right: { ...state.bassPose.right },
    },
    keysHoldStartedAt: { ...state.keysHoldStartedAt },
  };
  const statuses: Record<ZoneId, LaneStatus> = {
    left: 'no_player',
    middle: 'no_player',
    right: 'no_player',
  };
  const events: MusicEvent[] = [];

  const zones: ZoneId[] = ['left', 'middle', 'right'];
  const globalEnergy = zones.reduce((sum, zone) => sum + features[zone].energy, 0) / zones.length;

  zones.forEach((zone) => {
    const feature = features[zone];
    const role = laneInstruments[zone];

    if (!feature.occupied) {
      resetZoneState(nextState, zone);
      statuses[zone] = 'no_player';
      return;
    }

    if (role === 'drums') {
      const intent = updateGestureIntent(role, nextState.gesture[zone], {
        timestamp,
        wristVelocity: feature.wristVelocity,
        wristDeltaY: feature.wristDeltaY,
      });
      nextState.gesture[zone] = intent.nextState;
      statuses[zone] = intent.trigger
        ? 'hit'
        : statusFromGesture(role, intent.nextState.phase, feature);

      if (!intent.trigger) {
        return;
      }

      events.push({
        source: 'player',
        instrument: 'drums',
        kind: kindForZone(zone),
        zone,
        velocity: clamp(feature.wristVelocity, 0.25, 1),
      });
      return;
    }

    if (role === 'bass') {
      const bassPose = mapAngleToBassSlot(feature.shoulderWristAngle, conductor);
      const trackedPose = nextBassPoseTracker(nextState.bassPose[zone], bassPose.slot, timestamp);
      nextState.bassPose[zone] = trackedPose.nextTracker;

      const pulseVelocity = Math.max(feature.wristVelocity, Math.abs(feature.wristDeltaY) / 30);
      const intent = updateGestureIntent(role, nextState.gesture[zone], {
        timestamp,
        noteSlot: bassPose.slot,
        noteSlotStableMs: trackedPose.stableMs,
        pulseVelocity,
      });
      nextState.gesture[zone] = intent.nextState;
      statuses[zone] = intent.trigger
        ? 'hit'
        : statusFromGesture(role, intent.nextState.phase, feature);

      if (!intent.trigger) {
        return;
      }

      events.push({
        source: 'player',
        instrument: 'bass',
        zone,
        note: bassPose.note,
        velocity: clamp(0.35 + Math.max(feature.energy, pulseVelocity * 0.35), 0.3, 0.85),
      });
      return;
    }

    const holdingPosture = feature.handsRaised && feature.handsOpen;
    if (!holdingPosture) {
      nextState.keysHoldStartedAt[zone] = null;
    } else if (nextState.keysHoldStartedAt[zone] === null) {
      nextState.keysHoldStartedAt[zone] = timestamp;
    }

    const holdStartedAt = nextState.keysHoldStartedAt[zone];
    const holdMs = holdingPosture && holdStartedAt !== null ? timestamp - holdStartedAt : 0;
    const intent = updateGestureIntent(role, nextState.gesture[zone], {
      timestamp,
      handsRaised: feature.handsRaised,
      handsOpen: feature.handsOpen,
      holdMs,
      torsoY: feature.torsoY,
    });
    nextState.gesture[zone] = intent.nextState;
    statuses[zone] = intent.trigger
      ? 'sustain'
      : statusFromGesture(role, intent.nextState.phase, feature);

    if (!intent.trigger) {
      return;
    }

    events.push({
      source: 'player',
      instrument: 'pad',
      zone,
      notes: conductor.getChordVoicing(4),
      velocity: clamp(0.2 + feature.energy, 0.2, 0.6),
      filterCutoff: mapTorsoToFilter(feature.torsoY),
    });
  });

  return {
    events,
    nextState,
    globalEnergy,
    statuses,
  };
}
