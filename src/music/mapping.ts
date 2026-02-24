import type { Conductor } from './conductor';
import type { ZoneFeatureSnapshot, ZoneId } from '../types';

export type MusicEvent =
  | {
      instrument: 'drums';
      kind: 'kick' | 'snare' | 'hat';
      zone: ZoneId;
      velocity: number;
    }
  | {
      instrument: 'bass';
      zone: ZoneId;
      note: string;
      velocity: number;
    }
  | {
      instrument: 'pad';
      zone: ZoneId;
      notes: string[];
      velocity: number;
      filterCutoff: number;
    };

export interface MappingState {
  lastDrumHitAt: Record<ZoneId, number>;
  lastBassAt: number;
  lastPadAt: number;
  lastSupportAt: number;
}

interface MappingParams {
  timestamp: number;
  state: MappingState;
  conductor: Conductor;
  features: Record<ZoneId, ZoneFeatureSnapshot>;
  previousGlobalEnergy: number;
}

interface MappingResult {
  events: MusicEvent[];
  nextState: MappingState;
  globalEnergy: number;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function createInitialMappingState(): MappingState {
  return {
    lastDrumHitAt: {
      left: -Infinity,
      middle: -Infinity,
      right: -Infinity,
    },
    lastBassAt: -Infinity,
    lastPadAt: -Infinity,
    lastSupportAt: -Infinity,
  };
}

function mapAngleToBassNote(angle: number, conductor: Conductor): string {
  const chord = conductor.getChordVoicing(3);
  const normalized = clamp((angle + Math.PI) / (Math.PI * 2), 0, 0.9999);
  const index = Math.floor(normalized * chord.length);
  return conductor.constrainNoteToChord(chord[index]);
}

function mapTorsoToFilter(torsoY: number): number {
  const normalized = clamp((320 - torsoY) / 240, 0, 1);
  return 400 + normalized * 2200;
}

export function mapFeaturesToEvents({
  timestamp,
  state,
  conductor,
  features,
  previousGlobalEnergy,
}: MappingParams): MappingResult {
  const nextState: MappingState = {
    lastDrumHitAt: { ...state.lastDrumHitAt },
    lastBassAt: state.lastBassAt,
    lastPadAt: state.lastPadAt,
    lastSupportAt: state.lastSupportAt,
  };
  const events: MusicEvent[] = [];

  const zones: ZoneId[] = ['left', 'middle', 'right'];
  const globalEnergy = zones.reduce((sum, zone) => sum + features[zone].energy, 0) / zones.length;

  zones.forEach((zone) => {
    const feature = features[zone];
    if (feature.wristVelocity > 0.45 && timestamp - nextState.lastDrumHitAt[zone] > 180) {
      const kind = zone === 'left' ? 'kick' : zone === 'middle' ? 'snare' : 'hat';
      events.push({
        instrument: 'drums',
        kind,
        zone,
        velocity: clamp(feature.wristVelocity, 0.25, 1),
      });
      nextState.lastDrumHitAt[zone] = timestamp;
    }
  });

  if (timestamp - nextState.lastBassAt > 220 && features.middle.energy > 0.04) {
    events.push({
      instrument: 'bass',
      zone: 'middle',
      note: mapAngleToBassNote(features.middle.shoulderWristAngle, conductor),
      velocity: clamp(0.35 + features.middle.energy, 0.3, 0.85),
    });
    nextState.lastBassAt = timestamp;
  }

  const chordNotes = conductor.getChordVoicing(4);
  if (timestamp - nextState.lastPadAt > 500 && features.right.energy > 0.03) {
    events.push({
      instrument: 'pad',
      zone: 'right',
      notes: chordNotes,
      velocity: clamp(0.2 + features.right.energy, 0.2, 0.6),
      filterCutoff: mapTorsoToFilter(features.right.torsoY),
    });
    nextState.lastPadAt = timestamp;
  }

  if (conductor.shouldAddFill(globalEnergy, previousGlobalEnergy)) {
    events.push({
      instrument: 'drums',
      kind: 'hat',
      zone: 'right',
      velocity: 0.5,
    });
  }

  const idleZones = zones.filter((zone) => conductor.shouldSupportIdle(features[zone].energy));
  if (idleZones.length > 0 && timestamp - nextState.lastSupportAt > 700) {
    events.push({
      instrument: 'pad',
      zone: idleZones[0],
      notes: chordNotes,
      velocity: 0.18,
      filterCutoff: 900,
    });
    nextState.lastSupportAt = timestamp;
  }

  return {
    events,
    nextState,
    globalEnergy,
  };
}
