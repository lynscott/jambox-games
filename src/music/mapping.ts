import type { Conductor } from './conductor';
import type { LaneInstrument, ZoneFeatureSnapshot, ZoneId } from '../types';

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

export interface MappingState {
  lastRhythmHitAt: Record<ZoneId, number>;
  lastBassAt: Record<ZoneId, number>;
  lastPadAt: Record<ZoneId, number>;
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
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function createInitialMappingState(): MappingState {
  return {
    lastRhythmHitAt: {
      left: -Infinity,
      middle: -Infinity,
      right: -Infinity,
    },
    lastBassAt: {
      left: -Infinity,
      middle: -Infinity,
      right: -Infinity,
    },
    lastPadAt: {
      left: -Infinity,
      middle: -Infinity,
      right: -Infinity,
    },
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
  laneInstruments = {
    left: 'rhythm',
    middle: 'bass',
    right: 'pad',
  },
}: MappingParams): MappingResult {
  const nextState: MappingState = {
    lastRhythmHitAt: { ...state.lastRhythmHitAt },
    lastBassAt: { ...state.lastBassAt },
    lastPadAt: { ...state.lastPadAt },
  };
  const events: MusicEvent[] = [];

  const zones: ZoneId[] = ['left', 'middle', 'right'];
  const globalEnergy = zones.reduce((sum, zone) => sum + features[zone].energy, 0) / zones.length;

  zones.forEach((zone) => {
    const feature = features[zone];
    const role = laneInstruments[zone];

    if (role === 'rhythm') {
      if (feature.wristVelocity > 0.45 && timestamp - nextState.lastRhythmHitAt[zone] > 180) {
        const kind = zone === 'left' ? 'kick' : zone === 'middle' ? 'snare' : 'hat';
        events.push({
          source: 'player',
          instrument: 'drums',
          kind,
          zone,
          velocity: clamp(feature.wristVelocity, 0.25, 1),
        });
        nextState.lastRhythmHitAt[zone] = timestamp;
      }
      return;
    }

    if (role === 'bass') {
      if (timestamp - nextState.lastBassAt[zone] > 220 && feature.energy > 0.04) {
        events.push({
          source: 'player',
          instrument: 'bass',
          zone,
          note: mapAngleToBassNote(feature.shoulderWristAngle, conductor),
          velocity: clamp(0.35 + feature.energy, 0.3, 0.85),
        });
        nextState.lastBassAt[zone] = timestamp;
      }
      return;
    }

    if (timestamp - nextState.lastPadAt[zone] > 500 && feature.energy > 0.03) {
      events.push({
        source: 'player',
        instrument: 'pad',
        zone,
        notes: conductor.getChordVoicing(4),
        velocity: clamp(0.2 + feature.energy, 0.2, 0.6),
        filterCutoff: mapTorsoToFilter(feature.torsoY),
      });
      nextState.lastPadAt[zone] = timestamp;
    }
  });

  return {
    events,
    nextState,
    globalEnergy,
  };
}
