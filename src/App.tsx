import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CameraView } from './components/CameraView';
import { OverlayCanvas } from './components/OverlayCanvas';
import { JamScreen } from './components/screens/JamScreen';
import { CalibrationScreen } from './components/screens/CalibrationScreen';
import { PermissionsScreen } from './components/screens/PermissionsScreen';
import { ResultsScreen } from './components/screens/ResultsScreen';
import { SetupScreen } from './components/screens/SetupScreen';
import { TutorialScreen } from './components/screens/TutorialScreen';
import { computeLoopArrangement, type LoopArrangement } from './game/arrangement';
import {
  applyEvent,
  computeFinalScore,
  createInitialScoringState,
  type ScoringState,
} from './game/scoring';
import { computeCueWindowActive, countdownSecond, shouldTriggerCountdownTick } from './game/cues';
import { createConductor } from './music/conductor';
import { createInstruments, type GarageBandInstruments } from './music/instruments';
import { createInitialMappingState, mapFeaturesToEvents } from './music/mapping';
import {
  computeGridOffsetMs,
  createToneTransportController,
  type TransportController,
} from './music/transport';
import { computeZoneFeatures, createInitialFeatureState } from './pose/features';
import { loadMoveNet, type PoseSample } from './pose/movenet';
import { assignZones, createInitialZoningState } from './pose/zoning';
import { useAppStore } from './state/store';
import type { LaneInstrument, ZoneId } from './types';
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

const ACTIVITY_SMOOTHING = 0.15;
const TUTORIAL_ENERGY_CONFIRM_THRESHOLD = 0.08;
const HIGH_SCORE_STORAGE_KEY = 'ai-garage-band-high-score-v1';
const ALL_ACTIVE_ZONES: Record<ZoneId, boolean> = {
  left: true,
  middle: true,
  right: true,
};

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
  const requestCalibration = useAppStore((state) => state.requestCalibration);
  const isCalibrating = useAppStore((state) => state.isCalibrating);
  const setCalibrating = useAppStore((state) => state.setCalibrating);
  const calibrationLocks = useAppStore((state) => state.calibrationLocks);
  const setCalibrationLocks = useAppStore((state) => state.setCalibrationLocks);
  const gamePhase = useAppStore((state) => state.gamePhase);
  const setGamePhase = useAppStore((state) => state.setGamePhase);
  const updateScore = useAppStore((state) => state.updateScore);
  const updateLane = useAppStore((state) => state.updateLane);
  const setHitFlash = useAppStore((state) => state.setHitFlash);
  const updateJamTimer = useAppStore((state) => state.updateJamTimer);
  const resetGameSession = useAppStore((state) => state.resetGameSession);
  const jamDurationSec = useAppStore((state) => state.jamDurationSec);
  const jamTimeRemainingMs = useAppStore((state) => state.jamTimeRemainingMs);
  const score = useAppStore((state) => state.score);
  const hitFlashes = useAppStore((state) => state.hitFlashes);
  const lanes = useAppStore((state) => state.lanes);
  const tutorialBeatsCompleted = useAppStore((state) => state.tutorialBeatsCompleted);
  const tutorialBeatsTarget = useAppStore((state) => state.tutorialBeatsTarget);
  const tutorialLaneConfirmed = useAppStore((state) => state.tutorialLaneConfirmed);
  const setTutorialProgress = useAppStore((state) => state.setTutorialProgress);
  const setTutorialLaneConfirmed = useAppStore((state) => state.setTutorialLaneConfirmed);
  const resetTutorialProgress = useAppStore((state) => state.resetTutorialProgress);
  const highScore = useAppStore((state) => state.highScore);
  const commitHighScore = useAppStore((state) => state.commitHighScore);

  const [videoElement, setVideoElement] = useState<HTMLVideoElement | null>(null);
  const [poses, setPoses] = useState<PoseSample[]>([]);
  const [beatPhase, setBeatPhase] = useState(0);
  const [loopArrangement, setLoopArrangement] = useState<LoopArrangement>(() =>
    computeLoopArrangement({
      nowSeconds: 0,
      jamStartSeconds: 0,
      bpm: 110,
    }),
  );
  const [cameraReady, setCameraReady] = useState(false);
  const [audioReady, setAudioReady] = useState(false);
  const [isPermissionBusy, setIsPermissionBusy] = useState(false);
  const [isNewHighScore, setIsNewHighScore] = useState(false);

  const zoningStateRef = useRef(createInitialZoningState());
  const featureStateRef = useRef(createInitialFeatureState());
  const mappingStateRef = useRef(createInitialMappingState());
  const conductorRef = useRef(createConductor());
  const transportRef = useRef<TransportController | null>(null);
  const instrumentsRef = useRef<GarageBandInstruments | null>(null);
  const scoringStateRef = useRef<ScoringState>(createInitialScoringState());
  const previousCountdownRemainingMsRef = useRef<number | null>(null);
  const jamStartTransportSecondsRef = useRef(0);
  const guideBeatEventRef = useRef<number | null>(null);
  const guideBeatCounterRef = useRef(0);
  const calibrationWindowRef = useRef<{
    startedAt: number;
    anchors: Record<ZoneId, number | null>;
  } | null>(null);

  const finalizeSession = useCallback(
    (sessionDurationMs: number) => {
      const finalScore = computeFinalScore(scoringStateRef.current, sessionDurationMs);
      const previousHigh = useAppStore.getState().highScore;

      updateScore(finalScore);
      commitHighScore(finalScore.total);
      setIsNewHighScore(finalScore.total > previousHigh);
      setSessionRunning(false);
      setGamePhase('results');
    },
    [commitHighScore, setGamePhase, setSessionRunning, updateScore],
  );

  const prepareNewRun = useCallback(() => {
    const transport = transportRef.current;
    if (transport && guideBeatEventRef.current !== null) {
      transport.clear(guideBeatEventRef.current);
      guideBeatEventRef.current = null;
    }
    guideBeatCounterRef.current = 0;
    jamStartTransportSecondsRef.current = 0;
    setLoopArrangement(
      computeLoopArrangement({
        nowSeconds: 0,
        jamStartSeconds: 0,
        bpm,
      }),
    );
    resetGameSession();
    resetTutorialProgress();
    setCameraReady(false);
    setAudioReady(false);
    setIsNewHighScore(false);
  }, [bpm, resetGameSession, resetTutorialProgress]);

  const handleSetupStart = useCallback(() => {
    prepareNewRun();
    setSessionRunning(false);
    setGamePhase('permissions');
  }, [prepareNewRun, setGamePhase, setSessionRunning]);

  const handleRequestPermissions = useCallback(async () => {
    setIsPermissionBusy(true);

    try {
      if (!transportRef.current) {
        transportRef.current = await createToneTransportController();
      }
      if (!instrumentsRef.current) {
        instrumentsRef.current = await createInstruments();
      }
      await transportRef.current.start();
      transportRef.current.setBpm(bpm);
      setAudioReady(true);
    } catch {
      setAudioReady(false);
    } finally {
      setSessionRunning(true);
      setIsPermissionBusy(false);
    }
  }, [bpm, setSessionRunning]);

  const startJam = useCallback(() => {
    scoringStateRef.current = createInitialScoringState(performance.now());
    previousCountdownRemainingMsRef.current = null;
    guideBeatCounterRef.current = 0;

    const transportNow = transportRef.current?.now() ?? performance.now() / 1000;
    jamStartTransportSecondsRef.current = transportNow;
    setLoopArrangement(
      computeLoopArrangement({
        nowSeconds: transportNow,
        jamStartSeconds: transportNow,
        bpm,
      }),
    );

    updateScore({
      total: 0,
      timing: 0,
      consistency: 0,
      comboBonus: 0,
      combo: 0,
      maxCombo: 0,
      multiplier: 1,
    });
    setGamePhase('jam');
  }, [bpm, setGamePhase, updateScore]);

  const handleToggleSession = useCallback(() => {
    if (!isSessionRunning) {
      return;
    }
    finalizeSession(jamDurationSec * 1000);
  }, [finalizeSession, isSessionRunning, jamDurationSec]);

  const handlePlayAgain = useCallback(() => {
    prepareNewRun();
    setSessionRunning(false);
    setGamePhase('permissions');
  }, [prepareNewRun, setGamePhase, setSessionRunning]);

  const handleChangeSetup = useCallback(() => {
    prepareNewRun();
    setSessionRunning(false);
    setGamePhase('setup');
  }, [prepareNewRun, setGamePhase, setSessionRunning]);

  useEffect(() => {
    const value = window.localStorage.getItem(HIGH_SCORE_STORAGE_KEY);
    const parsed = value ? Number(value) : 0;
    if (Number.isFinite(parsed) && parsed > 0) {
      commitHighScore(parsed);
    }
  }, [commitHighScore]);

  useEffect(() => {
    window.localStorage.setItem(HIGH_SCORE_STORAGE_KEY, String(highScore));
  }, [highScore]);

  useEffect(() => {
    const codexWindow = window as Window & {
      render_game_to_text?: () => string;
      advanceTime?: (ms: number) => void;
    };

    codexWindow.render_game_to_text = () =>
      JSON.stringify({
        coordinate_system: 'origin top-left, +x right, +y down',
        mode: gamePhase,
        permissions: {
          cameraReady,
          audioReady,
        },
        tutorial: {
          beatsCompleted: tutorialBeatsCompleted,
          beatsTarget: tutorialBeatsTarget,
          laneConfirmed: tutorialLaneConfirmed,
        },
        jam: {
          timeRemainingMs: useAppStore.getState().jamTimeRemainingMs,
          score: useAppStore.getState().score,
          arrangement: loopArrangement,
        },
        lanes: {
          left: useAppStore.getState().lanes.left,
          middle: useAppStore.getState().lanes.middle,
          right: useAppStore.getState().lanes.right,
        },
      });

    codexWindow.advanceTime = () => {
      // This app currently runs from real-time camera/audio loops.
    };

    return () => {
      delete codexWindow.render_game_to_text;
      delete codexWindow.advanceTime;
    };
  }, [
    audioReady,
    cameraReady,
    gamePhase,
    loopArrangement,
    tutorialBeatsCompleted,
    tutorialBeatsTarget,
    tutorialLaneConfirmed,
  ]);

  // Permissions readiness checks
  useEffect(() => {
    if (gamePhase === 'permissions' && isSessionRunning && videoElement) {
      setCameraReady(true);
    }
  }, [gamePhase, isSessionRunning, videoElement]);

  useEffect(() => {
    if (gamePhase === 'permissions' && cameraReady && audioReady) {
      setGamePhase('calibration');
      requestCalibration();
    }
  }, [audioReady, cameraReady, gamePhase, requestCalibration, setGamePhase]);

  // Enter calibration mode by requesting lock capture.
  useEffect(() => {
    if (gamePhase !== 'calibration' || !isSessionRunning || isCalibrating) {
      return;
    }
    requestCalibration();
  }, [gamePhase, isCalibrating, isSessionRunning, requestCalibration]);

  // Auto-advance calibration when all zones lock.
  useEffect(() => {
    if (gamePhase !== 'calibration') {
      return;
    }

    const allLocked = (['left', 'middle', 'right'] as ZoneId[]).every(
      (zone) => calibrationLocks[zone] !== null,
    );

    if (allLocked) {
      resetTutorialProgress();
      setGamePhase('tutorial');
    }
  }, [calibrationLocks, gamePhase, resetTutorialProgress, setGamePhase]);

  // Tutorial beat counter and completion gate.
  useEffect(() => {
    if (gamePhase !== 'tutorial' || !isSessionRunning) {
      return;
    }

    const tutorialStart = performance.now();
    const beatLengthMs = (60 / bpm) * 1000;
    setTutorialProgress(0, 8);

    const intervalId = window.setInterval(() => {
      const beats = Math.min(8, Math.floor((performance.now() - tutorialStart) / beatLengthMs));
      setTutorialProgress(beats, 8);

      const confirmed = useAppStore.getState().tutorialLaneConfirmed;
      const allConfirmed = confirmed.left && confirmed.middle && confirmed.right;
      if (beats >= 8 && allConfirmed) {
        startJam();
      }
    }, 60);

    return () => window.clearInterval(intervalId);
  }, [bpm, gamePhase, isSessionRunning, setTutorialProgress, startJam]);

  // Chord progression timer
  useEffect(() => {
    if (!isSessionRunning) {
      if (transportRef.current && guideBeatEventRef.current !== null) {
        transportRef.current.clear(guideBeatEventRef.current);
        guideBeatEventRef.current = null;
      }
      guideBeatCounterRef.current = 0;
      jamStartTransportSecondsRef.current = 0;
      transportRef.current?.stop();
      mappingStateRef.current = createInitialMappingState();
      previousCountdownRemainingMsRef.current = null;
      conductorRef.current = createConductor();
      setLoopArrangement(
        computeLoopArrangement({
          nowSeconds: 0,
          jamStartSeconds: 0,
          bpm,
        }),
      );
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

  // Jam timer countdown
  useEffect(() => {
    if (!isSessionRunning || gamePhase !== 'jam') {
      return;
    }

    const startedAt = performance.now();
    const durationMs = jamDurationSec * 1000;

    const tick = () => {
      const elapsed = performance.now() - startedAt;
      const remaining = Math.max(0, durationMs - elapsed);
      updateJamTimer(remaining);

      if (remaining <= 0) {
        finalizeSession(durationMs);
      }
    };

    const intervalId = window.setInterval(tick, 100);
    return () => window.clearInterval(intervalId);
  }, [finalizeSession, gamePhase, isSessionRunning, jamDurationSec, updateJamTimer]);

  // Guide beat loop: provides a clear tempo bed during jam.
  useEffect(() => {
    const transport = transportRef.current;
    const instruments = instrumentsRef.current;
    if (!transport || !instruments) {
      return;
    }

    if (!isSessionRunning || gamePhase !== 'jam' || !conductorEnabled) {
      if (guideBeatEventRef.current !== null) {
        transport.clear(guideBeatEventRef.current);
        guideBeatEventRef.current = null;
      }
      guideBeatCounterRef.current = 0;
      return;
    }

    if (guideBeatEventRef.current !== null) {
      return;
    }

    guideBeatCounterRef.current = 0;
    guideBeatEventRef.current = transport.scheduleRepeat(
      (time) => {
        const beat = guideBeatCounterRef.current;
        const isDownbeat = beat % 4 === 0;
        instruments.triggerHat(time, isDownbeat ? 0.22 : 0.11);
        guideBeatCounterRef.current = beat + 1;
      },
      '4n',
      transport.now() + 0.05,
    );

    return () => {
      if (guideBeatEventRef.current !== null) {
        transport.clear(guideBeatEventRef.current);
        guideBeatEventRef.current = null;
      }
      guideBeatCounterRef.current = 0;
    };
  }, [conductorEnabled, gamePhase, isSessionRunning]);

  // Last-10-seconds warning: visual countdown is rendered in JamScreen and this hook adds short audio ticks.
  useEffect(() => {
    if (gamePhase !== 'jam' || !isSessionRunning) {
      previousCountdownRemainingMsRef.current = null;
      return;
    }

    const previous = previousCountdownRemainingMsRef.current;
    const current = jamTimeRemainingMs;
    const shouldTick = shouldTriggerCountdownTick(previous, current);

    if (shouldTick) {
      const instruments = instrumentsRef.current;
      const transport = transportRef.current;
      if (instruments && transport) {
        const warningTime = transport.now() + 0.01;
        const sec = countdownSecond(current);
        if (sec <= 3) {
          instruments.triggerSnare(warningTime, 0.22);
          instruments.triggerHat(warningTime + 0.08, 0.16);
        } else {
          instruments.triggerHat(warningTime, 0.16);
        }
      }
    }

    previousCountdownRemainingMsRef.current = current;
  }, [gamePhase, isSessionRunning, jamTimeRemainingMs]);

  // Calibration window
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

  // Beat phase animation
  useEffect(() => {
    let rafId = 0;

    const tick = () => {
      const nowSeconds = transportRef.current ? transportRef.current.now() : performance.now() / 1000;
      const beatLength = 60 / bpm;

      const jamStartSeconds = jamStartTransportSecondsRef.current || nowSeconds;
      const beatReferenceSeconds =
        gamePhase === 'jam' ? Math.max(0, nowSeconds - jamStartSeconds) : nowSeconds;
      setBeatPhase(((beatReferenceSeconds % beatLength) + beatLength) % beatLength / beatLength);

      if (gamePhase === 'jam') {
        setLoopArrangement(
          computeLoopArrangement({
            nowSeconds,
            jamStartSeconds,
            bpm,
          }),
        );
      }

      rafId = window.requestAnimationFrame(tick);
    };

    rafId = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(rafId);
  }, [bpm, gamePhase]);

  // Main inference + event loop
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

              const zones: ZoneId[] = ['left', 'middle', 'right'];
              zones.forEach((zone) => {
                const energy = featureResult.features[zone].energy;
                const store = useAppStore.getState();
                const prev = store.lanes[zone].activity;
                const smoothed = prev + ACTIVITY_SMOOTHING * (energy - prev);
                updateLane(zone, { activity: Math.min(1, smoothed) });

                if (gamePhase === 'tutorial' && energy > TUTORIAL_ENERGY_CONFIRM_THRESHOLD) {
                  setTutorialLaneConfirmed(zone, true);
                }
              });

              const transport = transportRef.current;
              const instruments = instrumentsRef.current;
              if (transport && instruments && (gamePhase === 'jam' || gamePhase === 'tutorial')) {
                const selectedLanes = useAppStore.getState().lanes;
                const laneInstruments: Record<ZoneId, LaneInstrument> = {
                  left: selectedLanes.left.instrument,
                  middle: selectedLanes.middle.instrument,
                  right: selectedLanes.right.instrument,
                };

                const mappingResult = mapFeaturesToEvents({
                  timestamp: now,
                  state: mappingStateRef.current,
                  conductor: conductorRef.current,
                  features: featureResult.features,
                  laneInstruments,
                });

                mappingStateRef.current = mappingResult.nextState;
                const transportNow = transport.now();
                const activeZones =
                  gamePhase === 'jam'
                    ? computeLoopArrangement({
                        nowSeconds: transportNow,
                        jamStartSeconds: jamStartTransportSecondsRef.current || transportNow,
                        bpm,
                      }).activeZones
                    : ALL_ACTIVE_ZONES;
                const delays: number[] = [];

                mappingResult.events.forEach((event) => {
                  if (!activeZones[event.zone]) {
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

                  if (gamePhase !== 'jam') {
                    return;
                  }

                  if (event.source !== 'player') {
                    return;
                  }

                  const offsetMs = computeGridOffsetMs(transportNow, bpm, quantization);
                  const zone = event.zone;
                  const result = applyEvent(scoringStateRef.current, {
                    timestamp: now,
                    zone,
                    offsetMs,
                  });

                  if (!result.jitterRejected) {
                    const currentInstrument = useAppStore.getState().lanes[zone].instrument;
                    updateScore({
                      total: scoringStateRef.current.timingPoints,
                      timing: scoringStateRef.current.timingPoints,
                      combo: result.combo,
                      maxCombo: scoringStateRef.current.maxCombo,
                      multiplier: result.multiplier,
                    });
                    updateLane(zone, {
                      lastGrade: result.grade,
                      hitCount: scoringStateRef.current.laneHits[zone],
                      instrument: currentInstrument,
                    });
                    setHitFlash(zone, now);
                  }
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
    gamePhase,
    isCalibrating,
    isSessionRunning,
    quantization,
    setCalibrating,
    setCalibrationLocks,
    setDiagnostics,
    setHitFlash,
    setTutorialLaneConfirmed,
    setZoneFeature,
    setZoneOccupants,
    updateLane,
    updateScore,
    videoElement,
  ]);

  const drawOverlay = useMemo(
    () => (ctx: CanvasRenderingContext2D) => {
      if (!showSkeleton) {
        return;
      }

      ctx.save();
      poses.forEach((pose) => {
        const byName = new Map(pose.keypoints.map((point) => [point.name, point]));

        ctx.strokeStyle = 'rgba(124, 77, 255, 0.8)';
        ctx.lineWidth = 2;
        ctx.shadowColor = 'rgba(124, 77, 255, 0.5)';
        ctx.shadowBlur = 6;

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

        ctx.shadowColor = 'transparent';
        ctx.shadowBlur = 0;

        pose.keypoints.forEach((point) => {
          if (point.score < 0.2) {
            return;
          }

          ctx.fillStyle = 'rgba(0, 229, 255, 0.9)';
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

  const strikeWindowActive = useMemo(
    () => computeCueWindowActive(beatPhase, quantization),
    [beatPhase, quantization],
  );

  const countdownUrgentSecond =
    gamePhase === 'jam' && jamTimeRemainingMs > 0 && jamTimeRemainingMs <= 10_000
      ? countdownSecond(jamTimeRemainingMs)
      : null;

  const renderLiveStage = () => (
    <CameraView isRunning={isSessionRunning} onVideoElementChange={handleVideoElementChange}>
      {(video) => (
        <OverlayCanvas
          video={video}
          onDraw={drawOverlay}
          enabled={true}
          beatPhase={beatPhase}
          cueWindowActive={strikeWindowActive}
          activeZones={gamePhase === 'jam' ? loopArrangement.activeZones : ALL_ACTIVE_ZONES}
          hitFlashes={hitFlashes}
        />
      )}
    </CameraView>
  );

  const renderPhase = () => {
    switch (gamePhase) {
      case 'setup':
        return <SetupScreen onStartSession={handleSetupStart} />;

      case 'permissions':
        return (
          <PermissionsScreen
            cameraReady={cameraReady}
            audioReady={audioReady}
            isBusy={isPermissionBusy}
            onRequestPermissions={() => void handleRequestPermissions()}
          >
            {renderLiveStage()}
          </PermissionsScreen>
        );

      case 'calibration':
        return (
          <CalibrationScreen
            locks={calibrationLocks}
            isCalibrating={isCalibrating}
            onRecalibrate={requestCalibration}
            onContinue={() => {
              resetTutorialProgress();
              setGamePhase('tutorial');
            }}
            onSkip={() => {
              resetTutorialProgress();
              setGamePhase('tutorial');
            }}
          >
            {renderLiveStage()}
          </CalibrationScreen>
        );

      case 'tutorial':
        return (
          <TutorialScreen
            beatsCompleted={tutorialBeatsCompleted}
            beatsTarget={tutorialBeatsTarget}
            laneConfirmed={tutorialLaneConfirmed}
            lanes={lanes}
            onStartJam={startJam}
          >
            {renderLiveStage()}
          </TutorialScreen>
        );

      case 'jam':
        return (
          <JamScreen
            onToggleSession={handleToggleSession}
            arrangement={loopArrangement}
            strikeWindowActive={strikeWindowActive}
            countdownSecond={countdownUrgentSecond}
          >
            {renderLiveStage()}
          </JamScreen>
        );

      case 'results':
        return (
          <ResultsScreen
            score={score}
            highScore={highScore}
            isNewHighScore={isNewHighScore}
            onPlayAgain={handlePlayAgain}
            onChangeSetup={handleChangeSetup}
          />
        );

      default:
        return null;
    }
  };

  return <main className="app-shell">{renderPhase()}</main>;
}

export default App;
