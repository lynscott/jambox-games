import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CameraView } from './components/CameraView';
import { Controls } from './components/Controls';
import { Diagnostics } from './components/Diagnostics';
import { OverlayCanvas } from './components/OverlayCanvas';
import { createConductor } from './music/conductor';
import { createInstruments, type GarageBandInstruments } from './music/instruments';
import { createInitialMappingState, mapFeaturesToEvents } from './music/mapping';
import {
  createToneTransportController,
  type TransportController,
} from './music/transport';
import { computeZoneFeatures, createInitialFeatureState } from './pose/features';
import { loadMoveNet, type PoseSample } from './pose/movenet';
import { assignZones, createInitialZoningState } from './pose/zoning';
import { useAppStore } from './state/store';
import type { ZoneId } from './types';
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

function zoneForX(centerX: number, width: number): ZoneId {
  if (centerX < width / 3) {
    return 'left';
  }
  if (centerX < (width * 2) / 3) {
    return 'middle';
  }
  return 'right';
}

function hasRaisedHands(pose: PoseSample): boolean {
  const byName = new Map(pose.keypoints.map((point) => [point.name, point]));
  const leftWrist = byName.get('left_wrist');
  const rightWrist = byName.get('right_wrist');
  const leftShoulder = byName.get('left_shoulder');
  const rightShoulder = byName.get('right_shoulder');

  if (!leftWrist || !rightWrist || !leftShoulder || !rightShoulder) {
    return false;
  }

  return leftWrist.y < leftShoulder.y && rightWrist.y < rightShoulder.y;
}

function App() {
  const isSessionRunning = useAppStore((state) => state.isSessionRunning);
  const setSessionRunning = useAppStore((state) => state.setSessionRunning);
  const showSkeleton = useAppStore((state) => state.showSkeleton);
  const setDiagnostics = useAppStore((state) => state.setDiagnostics);
  const setZoneOccupants = useAppStore((state) => state.setZoneOccupants);
  const setZoneFeature = useAppStore((state) => state.setZoneFeature);
  const bpm = useAppStore((state) => state.bpm);
  const quantization = useAppStore((state) => state.quantization);
  const conductorEnabled = useAppStore((state) => state.conductorEnabled);
  const calibrationRequestToken = useAppStore((state) => state.calibrationRequestToken);
  const isCalibrating = useAppStore((state) => state.isCalibrating);
  const setCalibrating = useAppStore((state) => state.setCalibrating);
  const calibrationLocks = useAppStore((state) => state.calibrationLocks);
  const setCalibrationLocks = useAppStore((state) => state.setCalibrationLocks);

  const [videoElement, setVideoElement] = useState<HTMLVideoElement | null>(null);
  const [poses, setPoses] = useState<PoseSample[]>([]);
  const [beatPhase, setBeatPhase] = useState(0);
  const zoningStateRef = useRef(createInitialZoningState());
  const featureStateRef = useRef(createInitialFeatureState());
  const mappingStateRef = useRef(createInitialMappingState());
  const previousGlobalEnergyRef = useRef(0);
  const conductorRef = useRef(createConductor());
  const transportRef = useRef<TransportController | null>(null);
  const instrumentsRef = useRef<GarageBandInstruments | null>(null);
  const calibrationWindowRef = useRef<{
    startedAt: number;
    anchors: Record<ZoneId, number | null>;
  } | null>(null);

  const handleToggleSession = useCallback(async () => {
    if (isSessionRunning) {
      setSessionRunning(false);
      return;
    }

    try {
      if (!transportRef.current) {
        transportRef.current = await createToneTransportController();
      }
      if (!instrumentsRef.current) {
        instrumentsRef.current = await createInstruments();
      }
      await transportRef.current.start();
      transportRef.current.setBpm(bpm);
    } catch {
      // Camera can still run without audio start.
    }

    setSessionRunning(true);
  }, [bpm, isSessionRunning, setSessionRunning]);

  useEffect(() => {
    if (!isSessionRunning) {
      transportRef.current?.stop();
      mappingStateRef.current = createInitialMappingState();
      previousGlobalEnergyRef.current = 0;
      conductorRef.current = createConductor();
      setDiagnostics({ currentChord: 'Am', movementToAudioMs: 0 });
      return;
    }

    if (transportRef.current) {
      transportRef.current.setBpm(bpm);
    }

    setDiagnostics({ currentChord: conductorRef.current.currentChord() });
    const msPerChord = (60 / bpm) * 4 * 1000;
    const intervalId = window.setInterval(() => {
      const nextChord = conductorRef.current.advanceChord();
      setDiagnostics({ currentChord: nextChord });
    }, msPerChord);

    return () => window.clearInterval(intervalId);
  }, [bpm, isSessionRunning, setDiagnostics]);

  useEffect(() => {
    if (!isSessionRunning || calibrationRequestToken === 0) {
      return;
    }

    calibrationWindowRef.current = {
      startedAt: performance.now(),
      anchors: {
        left: null,
        middle: null,
        right: null,
      },
    };
    setCalibrating(true);
  }, [calibrationRequestToken, isSessionRunning, setCalibrating]);

  useEffect(() => {
    let rafId = 0;

    const tick = () => {
      const nowSeconds = transportRef.current ? transportRef.current.now() : performance.now() / 1000;
      const beatLength = 60 / bpm;
      setBeatPhase((nowSeconds % beatLength) / beatLength);
      rafId = window.requestAnimationFrame(tick);
    };

    rafId = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(rafId);
  }, [bpm]);

  useEffect(() => {
    if (!isSessionRunning || !videoElement) {
      setPoses([]);
      zoningStateRef.current = createInitialZoningState();
      featureStateRef.current = createInitialFeatureState();
      setDiagnostics({ personCount: 0, inferenceMs: 0, fps: 0 });
      setZoneOccupants({ left: null, middle: null, right: null });
      return;
    }

    let rafId = 0;
    let cancelled = false;
    let inferInFlight = false;
    let lastInferenceTime = 0;
    let frameCount = 0;
    let fpsWindowStart = performance.now();

    const inferenceIntervalMs = 1000 / 30;

    const run = async () => {
      const estimator = await loadMoveNet();

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

              if (isCalibrating && calibrationWindowRef.current) {
                const raised = results.filter(hasRaisedHands);
                raised.forEach((pose) => {
                  const zone = zoneForX(pose.centerX, width);
                  calibrationWindowRef.current!.anchors[zone] = pose.centerX;
                });

                if (now - calibrationWindowRef.current.startedAt >= 2000) {
                  setCalibrationLocks(calibrationWindowRef.current.anchors);
                  setCalibrating(false);
                  calibrationWindowRef.current = null;
                }
              }

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
                anchorX: calibrationLocks,
              });
              zoningStateRef.current = nextZoning;

              const zonePoses = {
                left:
                  nextZoning.occupants.left?.poseIndex !== undefined
                    ? results[nextZoning.occupants.left.poseIndex] ?? null
                    : null,
                middle:
                  nextZoning.occupants.middle?.poseIndex !== undefined
                    ? results[nextZoning.occupants.middle.poseIndex] ?? null
                    : null,
                right:
                  nextZoning.occupants.right?.poseIndex !== undefined
                    ? results[nextZoning.occupants.right.poseIndex] ?? null
                    : null,
              };

              const featureResult = computeZoneFeatures({
                zonePoses,
                timestamp: now,
                state: featureStateRef.current,
              });
              featureStateRef.current = featureResult.nextState;

              setPoses(results);
              setZoneFeature('left', featureResult.features.left);
              setZoneFeature('middle', featureResult.features.middle);
              setZoneFeature('right', featureResult.features.right);
              setDiagnostics({
                inferenceMs,
                personCount: results.length,
                zoneEnergy: {
                  left: featureResult.features.left.energy,
                  middle: featureResult.features.middle.energy,
                  right: featureResult.features.right.energy,
                },
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

              const transport = transportRef.current;
              const instruments = instrumentsRef.current;
              if (transport && instruments) {
                const mappingResult = mapFeaturesToEvents({
                  timestamp: now,
                  state: mappingStateRef.current,
                  conductor: conductorRef.current,
                  features: featureResult.features,
                  previousGlobalEnergy: previousGlobalEnergyRef.current,
                });

                mappingStateRef.current = mappingResult.nextState;
                previousGlobalEnergyRef.current = mappingResult.globalEnergy;

                const delays: number[] = [];
                mappingResult.events.forEach((event) => {
                  if (!conductorEnabled && event.instrument === 'pad' && event.velocity <= 0.18) {
                    return;
                  }

                  const scheduled = transport.schedule(
                    (time) => {
                      if (event.instrument === 'drums') {
                        if (event.kind === 'kick') {
                          instruments.triggerKick(time, event.velocity);
                        } else if (event.kind === 'snare') {
                          instruments.triggerSnare(time, event.velocity);
                        } else {
                          instruments.triggerHat(time, event.velocity);
                        }
                        return;
                      }

                      if (event.instrument === 'bass') {
                        instruments.triggerBass(event.note, time, event.velocity);
                        return;
                      }

                      instruments.triggerPad(event.notes, time, event.velocity, event.filterCutoff);
                    },
                    bpm,
                    quantization,
                  );

                  const delayMs = Math.max(0, (scheduled - transport.now()) * 1000);
                  delays.push(delayMs);
                });

                if (delays.length > 0) {
                  const avgDelay = delays.reduce((sum, delay) => sum + delay, 0) / delays.length;
                  setDiagnostics({ movementToAudioMs: avgDelay });
                }
              }
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
      window.cancelAnimationFrame(rafId);
    };
  }, [
    bpm,
    calibrationLocks,
    conductorEnabled,
    isCalibrating,
    isSessionRunning,
    quantization,
    setCalibrating,
    setCalibrationLocks,
    setDiagnostics,
    setZoneFeature,
    setZoneOccupants,
    videoElement,
  ]);

  const drawOverlay = useMemo(
    () => (ctx: CanvasRenderingContext2D, _width: number, _height: number) => {
      if (!showSkeleton) {
        return;
      }

      ctx.save();
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
      <Controls onToggleSession={() => void handleToggleSession()} />
      <CameraView isRunning={isSessionRunning} onVideoElementChange={handleVideoElementChange}>
        {(video) => <OverlayCanvas video={video} onDraw={drawOverlay} enabled={true} beatPhase={beatPhase} />}
      </CameraView>
      <p className="status-text">Session: {isSessionRunning ? 'Running' : 'Stopped'}</p>
      <Diagnostics />
    </main>
  );
}

export default App;
