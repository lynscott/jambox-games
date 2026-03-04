import { create } from 'zustand';
import type {
  AppDiagnostics,
  GamePhase,
  LaneInstrument,
  LaneState,
  Quantization,
  ScoreSnapshot,
  ZoneFeatureSnapshot,
  ZoneId,
  ZoneOccupantSnapshot,
} from '../types';

export interface AppState {
  isSessionRunning: boolean;
  isCalibrating: boolean;
  calibrationRequestToken: number;
  bpm: number;
  quantization: Quantization;
  showSkeleton: boolean;
  conductorEnabled: boolean;
  diagnostics: AppDiagnostics;
  zoneFeatures: Record<ZoneId, ZoneFeatureSnapshot>;
  zoneOccupants: Record<ZoneId, ZoneOccupantSnapshot | null>;
  calibrationLocks: Record<ZoneId, number | null>;
  gamePhase: GamePhase;
  jamDurationSec: 60 | 90;
  jamTimeRemainingMs: number;
  tutorialBeatsCompleted: number;
  tutorialBeatsTarget: number;
  tutorialLaneConfirmed: Record<ZoneId, boolean>;
  highScore: number;
  score: ScoreSnapshot;
  lanes: Record<ZoneId, LaneState>;
  hitFlashes: Record<ZoneId, number>;
  setSessionRunning: (isRunning: boolean) => void;
  setCalibrating: (isCalibrating: boolean) => void;
  requestCalibration: () => void;
  setBpm: (bpm: number) => void;
  setQuantization: (quantization: Quantization) => void;
  setShowSkeleton: (show: boolean) => void;
  setConductorEnabled: (enabled: boolean) => void;
  setDiagnostics: (diagnostics: Partial<AppDiagnostics>) => void;
  setZoneFeature: (zone: ZoneId, feature: Partial<ZoneFeatureSnapshot>) => void;
  setZoneOccupants: (occupants: Record<ZoneId, ZoneOccupantSnapshot | null>) => void;
  setCalibrationLocks: (locks: Record<ZoneId, number | null>) => void;
  setGamePhase: (phase: GamePhase) => void;
  setJamDuration: (duration: 60 | 90) => void;
  setLaneInstrument: (zone: ZoneId, instrument: LaneInstrument) => void;
  updateJamTimer: (remainingMs: number) => void;
  setTutorialProgress: (completed: number, target?: number) => void;
  setTutorialLaneConfirmed: (zone: ZoneId, confirmed: boolean) => void;
  resetTutorialProgress: () => void;
  commitHighScore: (score: number) => void;
  updateScore: (score: Partial<ScoreSnapshot>) => void;
  updateLane: (zone: ZoneId, lane: Partial<LaneState>) => void;
  setHitFlash: (zone: ZoneId, timestamp: number) => void;
  resetGameSession: () => void;
}

const DEFAULT_ZONE_FEATURE: ZoneFeatureSnapshot = {
  wristVelocity: 0,
  torsoY: 0,
  shoulderWristAngle: 0,
  energy: 0,
};

const DEFAULT_SCORE: ScoreSnapshot = {
  total: 0,
  timing: 0,
  consistency: 0,
  comboBonus: 0,
  combo: 0,
  maxCombo: 0,
  multiplier: 1,
};

const DEFAULT_LANE: LaneState = {
  instrument: 'rhythm',
  activity: 0,
  lastGrade: null,
  hitCount: 0,
};

const DEFAULT_LANES: Record<ZoneId, LaneState> = {
  left: { ...DEFAULT_LANE, instrument: 'rhythm' },
  middle: { ...DEFAULT_LANE, instrument: 'bass' },
  right: { ...DEFAULT_LANE, instrument: 'pad' },
};

export const createInitialState = () => ({
  isSessionRunning: false,
  isCalibrating: false,
  calibrationRequestToken: 0,
  bpm: 110,
  quantization: '8n' as const,
  showSkeleton: true,
  conductorEnabled: true,
  diagnostics: {
    fps: 0,
    inferenceMs: 0,
    currentChord: 'Am',
    personCount: 0,
    zoneEnergy: {
      left: 0,
      middle: 0,
      right: 0,
    },
    movementToAudioMs: 0,
  },
  zoneFeatures: {
    left: DEFAULT_ZONE_FEATURE,
    middle: DEFAULT_ZONE_FEATURE,
    right: DEFAULT_ZONE_FEATURE,
  },
  zoneOccupants: {
    left: null,
    middle: null,
    right: null,
  },
  calibrationLocks: {
    left: null,
    middle: null,
    right: null,
  },
  gamePhase: 'setup' as const,
  jamDurationSec: 60 as const,
  jamTimeRemainingMs: 60_000,
  tutorialBeatsCompleted: 0,
  tutorialBeatsTarget: 8,
  tutorialLaneConfirmed: {
    left: false,
    middle: false,
    right: false,
  },
  highScore: 0,
  score: { ...DEFAULT_SCORE },
  lanes: {
    left: { ...DEFAULT_LANES.left },
    middle: { ...DEFAULT_LANES.middle },
    right: { ...DEFAULT_LANES.right },
  } as Record<ZoneId, LaneState>,
  hitFlashes: { left: 0, middle: 0, right: 0 },
});

export const useAppStore = create<AppState>((set) => ({
  ...createInitialState(),
  setSessionRunning: (isSessionRunning) => set({ isSessionRunning }),
  setCalibrating: (isCalibrating) => set({ isCalibrating }),
  requestCalibration: () =>
    set((state) => ({
      calibrationRequestToken: state.calibrationRequestToken + 1,
      isCalibrating: true,
    })),
  setBpm: (bpm) => set({ bpm: Math.max(80, Math.min(140, Math.round(bpm))) }),
  setQuantization: (quantization) => set({ quantization }),
  setShowSkeleton: (showSkeleton) => set({ showSkeleton }),
  setConductorEnabled: (conductorEnabled) => set({ conductorEnabled }),
  setDiagnostics: (diagnostics) =>
    set((state) => ({ diagnostics: { ...state.diagnostics, ...diagnostics } })),
  setZoneFeature: (zone, feature) =>
    set((state) => ({
      zoneFeatures: {
        ...state.zoneFeatures,
        [zone]: {
          ...state.zoneFeatures[zone],
          ...feature,
        },
      },
    })),
  setZoneOccupants: (zoneOccupants) => set({ zoneOccupants }),
  setCalibrationLocks: (calibrationLocks) => set({ calibrationLocks }),
  setGamePhase: (gamePhase) => set({ gamePhase }),
  setJamDuration: (jamDurationSec) =>
    set({ jamDurationSec, jamTimeRemainingMs: jamDurationSec * 1000 }),
  setLaneInstrument: (zone, instrument) =>
    set((state) => ({
      lanes: {
        ...state.lanes,
        [zone]: { ...state.lanes[zone], instrument },
      },
    })),
  updateJamTimer: (jamTimeRemainingMs) => set({ jamTimeRemainingMs }),
  setTutorialProgress: (tutorialBeatsCompleted, tutorialBeatsTarget) =>
    set((state) => ({
      tutorialBeatsCompleted,
      tutorialBeatsTarget: tutorialBeatsTarget ?? state.tutorialBeatsTarget,
    })),
  setTutorialLaneConfirmed: (zone, confirmed) =>
    set((state) => ({
      tutorialLaneConfirmed: {
        ...state.tutorialLaneConfirmed,
        [zone]: confirmed,
      },
    })),
  resetTutorialProgress: () =>
    set({
      tutorialBeatsCompleted: 0,
      tutorialBeatsTarget: 8,
      tutorialLaneConfirmed: {
        left: false,
        middle: false,
        right: false,
      },
    }),
  commitHighScore: (score) =>
    set((state) => ({ highScore: Math.max(state.highScore, Math.max(0, Math.round(score))) })),
  updateScore: (score) =>
    set((state) => ({ score: { ...state.score, ...score } })),
  updateLane: (zone, lane) =>
    set((state) => ({
      lanes: {
        ...state.lanes,
        [zone]: { ...state.lanes[zone], ...lane },
      },
    })),
  setHitFlash: (zone, timestamp) =>
    set((state) => ({
      hitFlashes: { ...state.hitFlashes, [zone]: timestamp },
    })),
  resetGameSession: () =>
    set((state) => ({
      score: { ...DEFAULT_SCORE },
      lanes: {
        left: { ...DEFAULT_LANE, instrument: state.lanes.left.instrument },
        middle: { ...DEFAULT_LANE, instrument: state.lanes.middle.instrument },
        right: { ...DEFAULT_LANE, instrument: state.lanes.right.instrument },
      } as Record<ZoneId, LaneState>,
      hitFlashes: { left: 0, middle: 0, right: 0 },
      jamTimeRemainingMs: state.jamDurationSec * 1000,
      tutorialBeatsCompleted: 0,
      tutorialLaneConfirmed: {
        left: false,
        middle: false,
        right: false,
      },
    })),
}));
