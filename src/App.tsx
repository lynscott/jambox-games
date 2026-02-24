import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CameraView } from './components/CameraView';
import { Controls } from './components/Controls';
import { OverlayCanvas } from './components/OverlayCanvas';
import { loadMoveNet, type PoseSample } from './pose/movenet';
import { assignZones, createInitialZoningState } from './pose/zoning';
import { useAppStore } from './state/store';
import './App.css';

const SKELETON_EDGES: Array<[string, string]> = [
  ['left_shoulder', 'right_shoulder'],
  ['left_hip', 'right_hip'],
  ['left_shoulder', 'left_elbow'],
  ['left_elbow', 'left_wrist'],
  ['right_shoulder', 'right_elbow'],
  ['right_elbow', 'right_wrist'],
  ['left_shoulder', 'left_hip'],
  ['right_shoulder', 'right_hip'],
  ['left_hip', 'left_knee'],
  ['left_knee', 'left_ankle'],
  ['right_hip', 'right_knee'],
  ['right_knee', 'right_ankle'],
];

function App() {
  const isSessionRunning = useAppStore((state) => state.isSessionRunning);
  const setSessionRunning = useAppStore((state) => state.setSessionRunning);
  const showSkeleton = useAppStore((state) => state.showSkeleton);
  const setDiagnostics = useAppStore((state) => state.setDiagnostics);
  const setZoneOccupants = useAppStore((state) => state.setZoneOccupants);

  const [videoElement, setVideoElement] = useState<HTMLVideoElement | null>(null);
  const [poses, setPoses] = useState<PoseSample[]>([]);
  const zoningStateRef = useRef(createInitialZoningState());

  useEffect(() => {
    if (!isSessionRunning || !videoElement) {
      setPoses([]);
      zoningStateRef.current = createInitialZoningState();
      setDiagnostics({ personCount: 0, inferenceMs: 0, fps: 0 });
      setZoneOccupants({ left: null, middle: null, right: null });
      return;
    }

    let rafId = 0;
    let cancelled = false;
    let estimatorLoaded = false;
    let inferInFlight = false;
    let lastInferenceTime = 0;
    let frameCount = 0;
    let fpsWindowStart = performance.now();

    const inferenceIntervalMs = 1000 / 30;

    const run = async () => {
      const estimator = await loadMoveNet();
      estimatorLoaded = true;

      const loop = (timestamp: number) => {
        if (cancelled) {
          return;
        }

        frameCount += 1;
        const fpsElapsed = timestamp - fpsWindowStart;
        if (fpsElapsed >= 500) {
          setDiagnostics({ fps: (frameCount * 1000) / fpsElapsed });
          frameCount = 0;
          fpsWindowStart = timestamp;
        }

        if (!inferInFlight && timestamp - lastInferenceTime >= inferenceIntervalMs) {
          inferInFlight = true;
          lastInferenceTime = timestamp;
          const inferStart = performance.now();

          void estimator
            .estimate(videoElement)
            .then((results) => {
              const inferenceMs = performance.now() - inferStart;
              if (cancelled) {
                return;
              }

              const width = videoElement.videoWidth || videoElement.clientWidth || 640;
              const now = performance.now();
              const nextZoning = assignZones({
                poses: results.map((pose, poseIndex) => ({
                  score: pose.score,
                  centerX: pose.centerX,
                  centerY: pose.centerY,
                  poseIndex,
                })),
                width,
                now,
                state: zoningStateRef.current,
              });
              zoningStateRef.current = nextZoning;

              setPoses(results);
              setDiagnostics({
                inferenceMs,
                personCount: results.length,
              });
              setZoneOccupants({
                left: nextZoning.occupants.left
                  ? {
                      score: nextZoning.occupants.left.score,
                      centerX: nextZoning.occupants.left.centerX,
                      centerY: nextZoning.occupants.left.centerY ?? 0,
                    }
                  : null,
                middle: nextZoning.occupants.middle
                  ? {
                      score: nextZoning.occupants.middle.score,
                      centerX: nextZoning.occupants.middle.centerX,
                      centerY: nextZoning.occupants.middle.centerY ?? 0,
                    }
                  : null,
                right: nextZoning.occupants.right
                  ? {
                      score: nextZoning.occupants.right.score,
                      centerX: nextZoning.occupants.right.centerX,
                      centerY: nextZoning.occupants.right.centerY ?? 0,
                    }
                  : null,
              });
            })
            .finally(() => {
              inferInFlight = false;
            });
        }

        rafId = window.requestAnimationFrame(loop);
      };

      rafId = window.requestAnimationFrame(loop);
    };

    void run();

    return () => {
      cancelled = true;
      if (estimatorLoaded) {
        // Keep loaded model cached for subsequent start/stop toggles.
      }
      window.cancelAnimationFrame(rafId);
    };
  }, [isSessionRunning, setDiagnostics, setZoneOccupants, videoElement]);

  const drawOverlay = useMemo(
    () => (ctx: CanvasRenderingContext2D, width: number, height: number) => {
      const zoneWidth = width / 3;

      ctx.save();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(zoneWidth, 0);
      ctx.lineTo(zoneWidth, height);
      ctx.moveTo(zoneWidth * 2, 0);
      ctx.lineTo(zoneWidth * 2, height);
      ctx.stroke();

      if (!showSkeleton) {
        ctx.restore();
        return;
      }

      poses.forEach((pose) => {
        const byName = new Map(pose.keypoints.map((point) => [point.name, point]));
        ctx.strokeStyle = 'rgba(16, 185, 129, 0.9)';
        ctx.lineWidth = 2;

        SKELETON_EDGES.forEach(([from, to]) => {
          const a = byName.get(from);
          const b = byName.get(to);
          if (!a || !b || a.score < 0.2 || b.score < 0.2) {
            return;
          }

          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.stroke();
        });

        pose.keypoints.forEach((point) => {
          if (point.score < 0.2) {
            return;
          }

          ctx.fillStyle = 'rgba(99, 102, 241, 0.9)';
          ctx.beginPath();
          ctx.arc(point.x, point.y, 4, 0, Math.PI * 2);
          ctx.fill();
        });
      });

      ctx.restore();
    },
    [poses, showSkeleton],
  );

  const handleVideoElementChange = useCallback((video: HTMLVideoElement | null) => {
    setVideoElement(video);
  }, []);

  return (
    <main className="app-shell">
      <h1>AI Garage Band</h1>
      <Controls onToggleSession={() => setSessionRunning(!isSessionRunning)} />
      <CameraView isRunning={isSessionRunning} onVideoElementChange={handleVideoElementChange}>
        {(video) => <OverlayCanvas video={video} onDraw={drawOverlay} enabled={true} />}
      </CameraView>
      <p className="status-text">Session: {isSessionRunning ? 'Running' : 'Stopped'}</p>
    </main>
  );
}

export default App;
