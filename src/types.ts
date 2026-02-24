export type ZoneId = 'left' | 'middle' | 'right';

export type Quantization = '4n' | '8n' | '16n';

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
