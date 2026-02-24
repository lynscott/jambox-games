import { describe, expect, it } from 'vitest';
import { computeZoneFeatures, createInitialFeatureState } from './features';
import type { PoseSample } from './movenet';

function pose(points: Array<{ name: string; x: number; y: number; score?: number }>): PoseSample {
  return {
    score: 0.9,
    centerX: 0,
    centerY: 0,
    keypoints: points.map((point) => ({ ...point, score: point.score ?? 0.9 })),
  };
}

describe('computeZoneFeatures', () => {
  it('extracts wrist velocity, torso y, angle and rolling energy', () => {
    let state = createInitialFeatureState();

    const base = {
      left: pose([
        { name: 'left_wrist', x: 100, y: 200 },
        { name: 'right_wrist', x: 150, y: 210 },
        { name: 'left_shoulder', x: 90, y: 120 },
        { name: 'right_shoulder', x: 140, y: 122 },
        { name: 'left_hip', x: 98, y: 260 },
        { name: 'right_hip', x: 142, y: 262 },
      ]),
      middle: null,
      right: null,
    };

    ({ nextState: state } = computeZoneFeatures({
      zonePoses: base,
      timestamp: 0,
      state,
    }));

    const moved = computeZoneFeatures({
      zonePoses: {
        left: pose([
          { name: 'left_wrist', x: 120, y: 180 },
          { name: 'right_wrist', x: 170, y: 192 },
          { name: 'left_shoulder', x: 90, y: 120 },
          { name: 'right_shoulder', x: 140, y: 122 },
          { name: 'left_hip', x: 98, y: 250 },
          { name: 'right_hip', x: 142, y: 252 },
        ]),
        middle: null,
        right: null,
      },
      timestamp: 100,
      state,
    });

    expect(moved.features.left.wristVelocity).toBeGreaterThan(0.1);
    expect(moved.features.left.torsoY).toBeCloseTo(251, 0);
    expect(Math.abs(moved.features.left.shoulderWristAngle)).toBeGreaterThan(0);
    expect(moved.features.left.energy).toBeGreaterThan(0);
  });
});
