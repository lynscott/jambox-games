import type { ZoneFeatureSnapshot, ZoneId } from '../types';
import type { PoseSample } from './movenet';

interface Point2D {
  x: number;
  y: number;
}

interface ZoneFeatureInternal {
  prevPoints: Record<string, Point2D> | null;
  prevTimestamp: number | null;
  energyWindow: number[];
}

export interface FeatureState {
  byZone: Record<ZoneId, ZoneFeatureInternal>;
}

interface ComputeFeatureParams {
  zonePoses: Record<ZoneId, PoseSample | null>;
  timestamp: number;
  state: FeatureState;
  windowSize?: number;
}

interface ComputeFeatureResult {
  features: Record<ZoneId, ZoneFeatureSnapshot>;
  nextState: FeatureState;
}

function createZoneInternal(): ZoneFeatureInternal {
  return {
    prevPoints: null,
    prevTimestamp: null,
    energyWindow: [],
  };
}

export function createInitialFeatureState(): FeatureState {
  return {
    byZone: {
      left: createZoneInternal(),
      middle: createZoneInternal(),
      right: createZoneInternal(),
    },
  };
}

function getPoint(points: Record<string, Point2D>, name: string): Point2D | null {
  return points[name] ?? null;
}

function distance(a: Point2D, b: Point2D): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

function mean(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

export function computeZoneFeatures({
  zonePoses,
  timestamp,
  state,
  windowSize = 12,
}: ComputeFeatureParams): ComputeFeatureResult {
  const zones: ZoneId[] = ['left', 'middle', 'right'];
  const features: Record<ZoneId, ZoneFeatureSnapshot> = {
    left: { wristVelocity: 0, torsoY: 0, shoulderWristAngle: 0, energy: 0 },
    middle: { wristVelocity: 0, torsoY: 0, shoulderWristAngle: 0, energy: 0 },
    right: { wristVelocity: 0, torsoY: 0, shoulderWristAngle: 0, energy: 0 },
  };

  const nextState: FeatureState = {
    byZone: {
      left: createZoneInternal(),
      middle: createZoneInternal(),
      right: createZoneInternal(),
    },
  };

  zones.forEach((zone) => {
    const pose = zonePoses[zone];
    const previous = state.byZone[zone];

    if (!pose) {
      const decayedEnergy = previous.energyWindow.map((value) => value * 0.85);
      nextState.byZone[zone] = {
        prevPoints: previous.prevPoints,
        prevTimestamp: previous.prevTimestamp,
        energyWindow: decayedEnergy,
      };
      features[zone] = {
        wristVelocity: 0,
        torsoY: 0,
        shoulderWristAngle: 0,
        energy: mean(decayedEnergy),
      };
      return;
    }

    const currentPoints: Record<string, Point2D> = {};
    pose.keypoints.forEach((point) => {
      currentPoints[point.name] = { x: point.x, y: point.y };
    });

    const dt = previous.prevTimestamp === null ? 0 : Math.max(1, timestamp - previous.prevTimestamp);

    const leftWrist = getPoint(currentPoints, 'left_wrist');
    const rightWrist = getPoint(currentPoints, 'right_wrist');
    const leftHip = getPoint(currentPoints, 'left_hip');
    const rightHip = getPoint(currentPoints, 'right_hip');
    const leftShoulder = getPoint(currentPoints, 'left_shoulder');
    const rightShoulder = getPoint(currentPoints, 'right_shoulder');

    const prevLeftWrist = previous.prevPoints ? getPoint(previous.prevPoints, 'left_wrist') : null;
    const prevRightWrist = previous.prevPoints ? getPoint(previous.prevPoints, 'right_wrist') : null;

    const wristMovements: number[] = [];
    if (leftWrist && prevLeftWrist) {
      wristMovements.push(distance(leftWrist, prevLeftWrist));
    }
    if (rightWrist && prevRightWrist) {
      wristMovements.push(distance(rightWrist, prevRightWrist));
    }
    const wristVelocity = wristMovements.length > 0 ? mean(wristMovements) / dt : 0;

    const torsoY =
      leftHip && rightHip
        ? (leftHip.y + rightHip.y) / 2
        : leftShoulder && rightShoulder
          ? (leftShoulder.y + rightShoulder.y) / 2
          : pose.centerY;

    const shoulderAnchor =
      leftShoulder && rightShoulder
        ? { x: (leftShoulder.x + rightShoulder.x) / 2, y: (leftShoulder.y + rightShoulder.y) / 2 }
        : { x: pose.centerX, y: pose.centerY };

    const angleTarget = rightWrist ?? leftWrist ?? shoulderAnchor;
    const shoulderWristAngle = Math.atan2(
      angleTarget.y - shoulderAnchor.y,
      angleTarget.x - shoulderAnchor.x,
    );

    const movementMagnitudes: number[] = [];
    if (previous.prevPoints) {
      Object.entries(currentPoints).forEach(([name, point]) => {
        const prevPoint = previous.prevPoints?.[name];
        if (prevPoint) {
          movementMagnitudes.push(distance(point, prevPoint));
        }
      });
    }
    const instantaneousEnergy = movementMagnitudes.length > 0 ? mean(movementMagnitudes) / dt : 0;
    const energyWindow = [...previous.energyWindow, instantaneousEnergy].slice(-windowSize);
    const energy = mean(energyWindow);

    features[zone] = {
      wristVelocity,
      torsoY,
      shoulderWristAngle,
      energy,
    };

    nextState.byZone[zone] = {
      prevPoints: currentPoints,
      prevTimestamp: timestamp,
      energyWindow,
    };
  });

  return {
    features,
    nextState,
  };
}
