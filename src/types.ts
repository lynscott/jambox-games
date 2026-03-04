export type ZoneId = 'left' | 'middle' | 'right';

export type Quantization = '4n' | '8n' | '16n';

export type GamePhase =
  | 'lobby'
  | 'home'
  | 'setup'
  | 'vs_setup'
  | 'vs_battle'
  | 'vs_results'
  | 'on_beat_setup'
  | 'on_beat_play'
  | 'on_beat_results'
  | 'lyrics_setup'
  | 'lyrics_play'
  | 'lyrics_results'
  | 'permissions'
  | 'calibration'
  | 'tutorial'
  | 'jam'
  | 'results'
  | 'vs_placeholder';

export type GameSelection = 'jam_hero' | 'vs' | 'on_beat' | 'know_your_lyrics';

export type TimingGrade = 'perfect' | 'good' | 'late' | 'miss';

export type TrackId = 'midnight-soul';

export type LaneInstrument = 'drums' | 'bass' | 'keys';

export type GestureIntentPhase = 'idle' | 'armed' | 'active' | 'cooldown';
export type LaneStatus = 'no_player' | 'get_ready' | 'hold' | 'hit' | 'sustain';

export interface LaneTimingFeedback {
  grade: TimingGrade;
  timestamp: number;
}

export interface LaneState {
  instrument: LaneInstrument;
  occupied: boolean;
  status: LaneStatus;
  activity: number;
  lastGrade: TimingGrade | null;
  hitCount: number;
  gesturePhase: GestureIntentPhase;
}

export interface ScoreSnapshot {
  total: number;
  timing: number;
  consistency: number;
  comboBonus: number;
  combo: number;
  maxCombo: number;
  multiplier: number;
}

export interface ZoneFeatureSnapshot {
  occupied: boolean;
  wristVelocity: number;
  wristDeltaY: number;
  torsoY: number;
  shoulderWristAngle: number;
  handsRaised: boolean;
  handsOpen: boolean;
  energy: number;
}

export interface ZoneOccupantSnapshot {
  score: number;
  centerX: number;
  centerY: number;
}

export interface AppDiagnostics {
  fps: number;
  inferenceMs: number;
  trackTitle: string;
  currentChord: string;
  personCount: number;
  gesturePhase: Record<ZoneId, GestureIntentPhase>;
  zoneEnergy: Record<ZoneId, number>;
  movementToAudioMs: number;
}
