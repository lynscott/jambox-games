import * as poseDetection from '@tensorflow-models/pose-detection';
import '@tensorflow/tfjs-backend-cpu';
import '@tensorflow/tfjs-backend-wasm';
import '@tensorflow/tfjs-backend-webgl';
import * as tf from '@tensorflow/tfjs-core';

export interface PosePoint {
  x: number;
  y: number;
  score: number;
  name: string;
}

export interface PoseSample {
  score: number;
  centerX: number;
  centerY: number;
  keypoints: PosePoint[];
}

export interface PoseEstimator {
  backend: string;
  estimate: (video: HTMLVideoElement) => Promise<PoseSample[]>;
  dispose: () => void;
}

let cachedEstimatorPromise: Promise<PoseEstimator> | null = null;

async function configureBackend(): Promise<string> {
  const backends = ['webgl', 'wasm', 'cpu'];

  for (const backend of backends) {
    try {
      await tf.setBackend(backend);
      await tf.ready();
      return backend;
    } catch {
      // Try next backend.
    }
  }

  throw new Error('No TensorFlow backend available.');
}

function calcCenter(keypoints: PosePoint[]) {
  const confident = keypoints.filter((point) => point.score >= 0.2);
  if (confident.length === 0) {
    return { centerX: 0, centerY: 0 };
  }

  const centerX = confident.reduce((sum, point) => sum + point.x, 0) / confident.length;
  const centerY = confident.reduce((sum, point) => sum + point.y, 0) / confident.length;
  return { centerX, centerY };
}

export async function loadMoveNet(): Promise<PoseEstimator> {
  if (cachedEstimatorPromise) {
    return cachedEstimatorPromise;
  }

  cachedEstimatorPromise = (async () => {
    const backend = await configureBackend();

    const detector = await poseDetection.createDetector(poseDetection.SupportedModels.MoveNet, {
      modelType: poseDetection.movenet.modelType.MULTIPOSE_LIGHTNING,
      enableTracking: true,
      trackerType: poseDetection.TrackerType.BoundingBox,
    });

    return {
      backend,
      estimate: async (video: HTMLVideoElement) => {
        const results = await detector.estimatePoses(video, {
          maxPoses: 6,
          flipHorizontal: true,
        });

        return results.map((pose) => {
          const keypoints = (pose.keypoints ?? []).map((point) => ({
            x: point.x,
            y: point.y,
            score: point.score ?? 0,
            name: point.name ?? 'unknown',
          }));
          const { centerX, centerY } = calcCenter(keypoints);
          const avgScore =
            keypoints.length > 0
              ? keypoints.reduce((sum, point) => sum + point.score, 0) / keypoints.length
              : pose.score ?? 0;

          return {
            score: avgScore,
            centerX,
            centerY,
            keypoints,
          };
        });
      },
      dispose: () => {
        detector.dispose();
        cachedEstimatorPromise = null;
      },
    };
  })();

  return cachedEstimatorPromise;
}
