import type { LaneInstrument, TrackId, ZoneId } from '../types';

export interface TrackPreset {
  id: TrackId;
  title: string;
  description: string;
  bpm: number;
  key: string;
  chordLoop: string[];
  laneInstruments: Record<ZoneId, LaneInstrument>;
  tutorialHints: Record<LaneInstrument, string>;
}

export const MIDNIGHT_SOUL_TRACK: TrackPreset = {
  id: 'midnight-soul',
  title: 'Midnight Soul',
  description: 'Jazz-soul pocket with warm keys, grounded bass, and crisp player cues.',
  bpm: 96,
  key: 'A minor',
  chordLoop: ['Am', 'F', 'C', 'G'],
  laneInstruments: {
    left: 'drums',
    middle: 'bass',
    right: 'keys',
  },
  tutorialHints: {
    drums: 'Hit with quick wrist strikes',
    bass: 'Hold a note pose, then pulse to play',
    keys: 'Raise both hands and hold the chord',
  },
};

export const TRACK_PRESETS: Record<TrackId, TrackPreset> = {
  [MIDNIGHT_SOUL_TRACK.id]: MIDNIGHT_SOUL_TRACK,
};
