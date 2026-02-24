import { create } from 'zustand';
import type {
  AppDiagnostics,
  Quantization,
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
}

const DEFAULT_ZONE_FEATURE: ZoneFeatureSnapshot = {
  wristVelocity: 0,
  torsoY: 0,
  shoulderWristAngle: 0,
  energy: 0,
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
}));
