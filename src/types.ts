export type ZoneId = 'left' | 'middle' | 'right';

export type Quantization = '4n' | '8n' | '16n';

export type GamePhase = 'setup' | 'permissions' | 'calibration' | 'tutorial' | 'jam' | 'results';

export type TimingGrade = 'perfect' | 'good' | 'late' | 'miss';

export type LaneInstrument = 'rhythm' | 'bass' | 'pad';

export interface LaneTimingFeedback {
  grade: TimingGrade;
  timestamp: number;
}

export interface LaneState {
  instrument: LaneInstrument;
  activity: number;
  lastGrade: TimingGrade | null;
  hitCount: number;
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
  wristVelocity: number;
  torsoY: number;
  shoulderWristAngle: number;
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
  currentChord: string;
  personCount: number;
  zoneEnergy: Record<ZoneId, number>;
  movementToAudioMs: number;
}
