import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CameraView } from './components/CameraView';
import { OverlayCanvas } from './components/OverlayCanvas';
import { JamScreen } from './components/screens/JamScreen';
import { CalibrationScreen } from './components/screens/CalibrationScreen';
import { ComingSoonScreen } from './components/screens/ComingSoonScreen';
import { HomeScreen } from './components/screens/HomeScreen';
import { LyricsGameScreen } from './components/screens/LyricsGameScreen';
import { LyricsResultsScreen } from './components/screens/LyricsResultsScreen';
import { LyricsSetupScreen } from './components/screens/LyricsSetupScreen';
import { LobbyScreen } from './components/screens/LobbyScreen';
import { OnBeatGameScreen } from './components/screens/OnBeatGameScreen';
import { OnBeatResultsScreen } from './components/screens/OnBeatResultsScreen';
import { OnBeatSetupScreen } from './components/screens/OnBeatSetupScreen';
import { PermissionsScreen } from './components/screens/PermissionsScreen';
import { ResultsScreen } from './components/screens/ResultsScreen';
import { SetupScreen } from './components/screens/SetupScreen';
import { TutorialScreen } from './components/screens/TutorialScreen';
import { PhonePlayerScreen } from './components/screens/PhonePlayerScreen';
import { VsBattleScreen } from './components/screens/VsBattleScreen';
import { VsResultsScreen } from './components/screens/VsResultsScreen';
import { VsSetupScreen } from './components/screens/VsSetupScreen';
import { getGameById } from './game/catalog';
import { computeLoopArrangement, type LoopArrangement } from './game/arrangement';
import {
  applyEvent,
  computeFinalScore,
  createInitialScoringState,
  type ScoringState,
} from './game/scoring';
import { shouldProcessPlayerFeedback } from './game/scoring-gates';
import { countdownSecond, shouldTriggerCountdownTick } from './game/cues';
import { shouldShowSkeletonOverlay } from './game/visuals';
import { createBackingTrackScheduler, syncBackingTrackPlayback, type BackingTrackScheduler } from './music/backing-track';
import { createConductor } from './music/conductor';
import { createInstruments, type GarageBandInstruments } from './music/instruments';
import { createInitialMappingState, mapFeaturesToEvents } from './music/mapping';
import { TRACK_PRESETS } from './music/tracks';
import {
  computeGridOffsetMs,
  createToneTransportController,
  type TransportController,
} from './music/transport';
import { computeZoneFeatures, createInitialFeatureState } from './pose/features';
import { loadMoveNet, type PoseSample } from './pose/movenet';
import { assignZones, createInitialZoningState } from './pose/zoning';
import { useAppStore } from './state/store';
import { buildVerzuzRoundDeck, type VerzuzPlayer, type VerzuzRoundResult } from './game/verzuz';
import { type OnBeatDifficulty, type OnBeatResultSummary } from './game/onBeat';
import { type LyricsResultSummary, type LyricsTrack } from './game/lyrics';
import { LYRICS_TRACKS } from './game/lyricsCatalog.generated';
import { LobbySessionProvider, useLobbySession } from './lobby/useLobbySession';
import {
  beginSpotifyLogin,
  clearSpotifyConnection,
  completeSpotifyLoginFromUrl,
  hasSpotifyClientConfig,
  loadSpotifyConnection,
  type SpotifyConnection,
  type SpotifyTrackSummary,
} from './spotify/client';
import type { GameSelection, LaneInstrument, ZoneId } from './types';
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

const ROUTABLE_PHASES = new Set([
  'lobby',
  'home',
  'setup',
  'vs_setup',
  'vs_battle',
  'vs_results',
  'on_beat_setup',
  'on_beat_play',
  'on_beat_results',
  'lyrics_setup',
  'lyrics_play',
  'lyrics_results',
  'permissions',
  'calibration',
  'tutorial',
  'jam',
  'results',
  'vs_placeholder',
]);

function parseGameSelection(value: string | null): GameSelection | null {
  if (value === 'jam_hero' || value === 'vs' || value === 'on_beat' || value === 'know_your_lyrics') {
    return value;
  }
  return null;
}

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

function AppContent() {
  const isSessionRunning = useAppStore((state) => state.isSessionRunning);
  const setSessionRunning = useAppStore((state) => state.setSessionRunning);
  const showSkeleton = useAppStore((state) => state.showSkeleton);
  const setDiagnostics = useAppStore((state) => state.setDiagnostics);
  const setZoneOccupants = useAppStore((state) => state.setZoneOccupants);
  const setZoneFeature = useAppStore((state) => state.setZoneFeature);
  const bpm = useAppStore((state) => state.bpm);
  const quantization = useAppStore((state) => state.quantization);
  const calibrationRequestToken = useAppStore((state) => state.calibrationRequestToken);
  const requestCalibration = useAppStore((state) => state.requestCalibration);
  const isCalibrating = useAppStore((state) => state.isCalibrating);
  const setCalibrating = useAppStore((state) => state.setCalibrating);
  const calibrationLocks = useAppStore((state) => state.calibrationLocks);
  const setCalibrationLocks = useAppStore((state) => state.setCalibrationLocks);
  const gamePhase = useAppStore((state) => state.gamePhase);
  const selectedGame = useAppStore((state) => state.selectedGame);
  const setGamePhase = useAppStore((state) => state.setGamePhase);
  const setSelectedGame = useAppStore((state) => state.setSelectedGame);
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
  const currentTrackId = useAppStore((state) => state.currentTrackId);
  const currentTrack = TRACK_PRESETS[currentTrackId];
  const { lobby, accessPoint, socketStatus, selectedTracks } = useLobbySession();

  const [videoElement, setVideoElement] = useState<HTMLVideoElement | null>(null);
  const [poses, setPoses] = useState<PoseSample[]>([]);
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
  const [vsPlayers, setVsPlayers] = useState<VerzuzPlayer[]>([
    { name: 'Player 1' },
    { name: 'Player 2' },
  ]);
  const [vsRoundCount, setVsRoundCount] = useState(5);
  const [vsSelectedCategories, setVsSelectedCategories] = useState<string[]>([
    'Best Collaboration',
    'Heartbreak',
    'West Coast Anthems',
    '90s R&B Hits',
    'Best Remix Songs',
  ]);
  const [vsScores, setVsScores] = useState<[number, number]>([0, 0]);
  const [vsRoundIndex, setVsRoundIndex] = useState(0);
  const [vsRoundHistory, setVsRoundHistory] = useState<VerzuzRoundResult[]>([]);
  const [vsSpotifyConnections, setVsSpotifyConnections] = useState<Array<SpotifyConnection | null>>([
    null,
    null,
  ]);
  const [vsRoundTracks, setVsRoundTracks] = useState<Record<number, SpotifyTrackSummary | null>>({});
  const [onBeatDifficulty, setOnBeatDifficulty] = useState<OnBeatDifficulty>('level1');
  const [onBeatResult, setOnBeatResult] = useState<OnBeatResultSummary | null>(null);
  const [onBeatSessionKey, setOnBeatSessionKey] = useState(0);
  const [lyricsTrack, setLyricsTrack] = useState<LyricsTrack | null>(LYRICS_TRACKS[0] || null);
  const [lyricsResult, setLyricsResult] = useState<LyricsResultSummary | null>(null);
  const [lyricsSessionKey, setLyricsSessionKey] = useState(0);

  const zoningStateRef = useRef(createInitialZoningState());
  const featureStateRef = useRef(createInitialFeatureState());
  const mappingStateRef = useRef(createInitialMappingState());
  const conductorRef = useRef(createConductor());
  const transportRef = useRef<TransportController | null>(null);
  const instrumentsRef = useRef<GarageBandInstruments | null>(null);
  const backingTrackRef = useRef<BackingTrackScheduler | null>(null);
  const scoringStateRef = useRef<ScoringState>(createInitialScoringState());
  const previousCountdownRemainingMsRef = useRef<number | null>(null);
  const jamStartTransportSecondsRef = useRef(0);
  const calibrationWindowRef = useRef<{
    startedAt: number;
    anchors: Record<ZoneId, number | null>;
  } | null>(null);

  const resetVsBattle = useCallback(() => {
    setVsScores([0, 0]);
    setVsRoundIndex(0);
    setVsRoundHistory([]);
    setVsRoundTracks({});
  }, []);

  const vsRoundDeck = useMemo(
    () => buildVerzuzRoundDeck(vsSelectedCategories, vsRoundCount),
    [vsRoundCount, vsSelectedCategories],
  );

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

  const handleOpenLobby = useCallback(() => {
    setGamePhase('lobby');
  }, [setGamePhase]);

  const handleSelectGame = useCallback(
    (gameId: GameSelection) => {
      prepareNewRun();
      setSessionRunning(false);
      setSelectedGame(gameId);
      setGamePhase(getGameById(gameId).phase);
    },
    [prepareNewRun, setGamePhase, setSelectedGame, setSessionRunning],
  );

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

  const handleBackToMenu = useCallback(() => {
    prepareNewRun();
    resetVsBattle();
    setOnBeatResult(null);
    setLyricsResult(null);
    setSessionRunning(false);
    setSelectedGame(null);
    setGamePhase('home');
  }, [prepareNewRun, resetVsBattle, setGamePhase, setSelectedGame, setSessionRunning]);

  const handleVsPlayerChange = useCallback(
    (playerIndex: number, field: 'name', value: string) => {
      setVsPlayers((current) =>
        current.map((player, index) =>
          index === playerIndex ? { ...player, [field]: value } : player,
        ),
      );
    },
    [],
  );

  const handleToggleVsCategory = useCallback((category: string) => {
    setVsSelectedCategories((current) => {
      if (current.includes(category)) {
        return current.length === 1 ? current : current.filter((item) => item !== category);
      }

      return [...current, category];
    });
  }, []);

  const handleStartVsBattle = useCallback(() => {
    resetVsBattle();
    setGamePhase('vs_battle');
  }, [resetVsBattle, setGamePhase]);

  const handleStartOnBeat = useCallback(() => {
    setOnBeatResult(null);
    setOnBeatSessionKey((current) => current + 1);
    setGamePhase('on_beat_play');
  }, [setGamePhase]);

  const handleCompleteOnBeat = useCallback(
    (result: OnBeatResultSummary) => {
      setOnBeatResult(result);
      setGamePhase('on_beat_results');
    },
    [setGamePhase],
  );

  const handleReplayOnBeat = useCallback(() => {
    setOnBeatResult(null);
    setOnBeatSessionKey((current) => current + 1);
    setGamePhase('on_beat_play');
  }, [setGamePhase]);

  const handleChangeOnBeatSetup = useCallback(() => {
    setGamePhase('on_beat_setup');
  }, [setGamePhase]);

  const handleStartLyrics = useCallback(() => {
    if (!lyricsTrack) {
      return;
    }
    setLyricsResult(null);
    setLyricsSessionKey((current) => current + 1);
    setGamePhase('lyrics_play');
  }, [lyricsTrack, setGamePhase]);

  const handleCompleteLyrics = useCallback(
    (result: LyricsResultSummary) => {
      setLyricsResult(result);
      setGamePhase('lyrics_results');
    },
    [setGamePhase],
  );

  const handleReplayLyrics = useCallback(() => {
    setLyricsResult(null);
    setLyricsSessionKey((current) => current + 1);
    setGamePhase('lyrics_play');
  }, [setGamePhase]);

  const handleChangeLyricsSetup = useCallback(() => {
    setGamePhase('lyrics_setup');
  }, [setGamePhase]);

  const handlePlayAgain = useCallback(() => {
    if (selectedGame === 'vs') {
      resetVsBattle();
      setGamePhase('vs_battle');
      return;
    }
    if (selectedGame === 'on_beat') {
      handleReplayOnBeat();
      return;
    }
    if (selectedGame === 'know_your_lyrics') {
      handleReplayLyrics();
      return;
    }
    prepareNewRun();
    setSessionRunning(false);
    setGamePhase('permissions');
  }, [
    handleReplayLyrics,
    handleReplayOnBeat,
    prepareNewRun,
    resetVsBattle,
    selectedGame,
    setGamePhase,
    setSessionRunning,
  ]);

  const handleChangeSetup = useCallback(() => {
    if (selectedGame === 'vs') {
      resetVsBattle();
      setGamePhase('vs_setup');
      return;
    }
    if (selectedGame === 'on_beat') {
      handleChangeOnBeatSetup();
      return;
    }
    if (selectedGame === 'know_your_lyrics') {
      handleChangeLyricsSetup();
      return;
    }
    prepareNewRun();
    setSessionRunning(false);
    setGamePhase('setup');
  }, [
    handleChangeLyricsSetup,
    handleChangeOnBeatSetup,
    prepareNewRun,
    resetVsBattle,
    selectedGame,
    setGamePhase,
    setSessionRunning,
  ]);

  const handleConnectSpotify = useCallback((playerIndex: number) => {
    void beginSpotifyLogin(playerIndex);
  }, []);

  const handleDisconnectSpotify = useCallback((playerIndex: number) => {
    clearSpotifyConnection(playerIndex);
    setVsSpotifyConnections((current) =>
      current.map((connection, index) => (index === playerIndex ? null : connection)),
    );
  }, []);

  const handleAwardVsRound = useCallback(
    (winner: 'player1' | 'player2' | 'tie') => {
      const category = vsRoundDeck[vsRoundIndex] || 'Best Collaboration';

      setVsScores((current) => {
        if (winner === 'player1') {
          return [current[0] + 1, current[1]];
        }
        if (winner === 'player2') {
          return [current[0], current[1] + 1];
        }
        return current;
      });

      setVsRoundHistory((current) => [
        ...current,
        {
          round: vsRoundIndex + 1,
          category,
          winner,
        },
      ]);

      if (vsRoundIndex + 1 >= vsRoundCount) {
        setGamePhase('vs_results');
        return;
      }

      setVsRoundIndex((current) => current + 1);
    },
    [setGamePhase, vsRoundCount, vsRoundDeck, vsRoundIndex],
  );

  useEffect(() => {
    setVsSpotifyConnections([loadSpotifyConnection(0), loadSpotifyConnection(1)]);
    void completeSpotifyLoginFromUrl()
      .then((result) => {
        if (!result) {
          return;
        }

        setVsSpotifyConnections((current) =>
          current.map((connection, index) =>
            index === result.playerIndex ? result.connection : connection,
          ),
        );
      })
      .catch(() => {
        // Ignore callback failures and leave the player disconnected.
      });
  }, []);

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
          backingTrackRunning: backingTrackRef.current?.isRunning() ?? false,
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
      jamStartTransportSecondsRef.current = 0;
      transportRef.current?.stop();
      backingTrackRef.current?.stop();
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
      setDiagnostics({
        trackTitle: currentTrack.title,
        currentChord: 'Am',
        movementToAudioMs: 0,
        gesturePhase: {
          left: 'idle',
          middle: 'idle',
          right: 'idle',
        },
      });
      updateLane('left', { occupied: false, status: 'no_player', gesturePhase: 'idle' });
      updateLane('middle', { occupied: false, status: 'no_player', gesturePhase: 'idle' });
      updateLane('right', { occupied: false, status: 'no_player', gesturePhase: 'idle' });
      return;
    }

    if (transportRef.current) {
      transportRef.current.setBpm(bpm);
    }

    setDiagnostics({
      trackTitle: currentTrack.title,
      currentChord: conductorRef.current.currentChord(),
    });
    const msPerChord = (60 / bpm) * 4 * 1000;
    const intervalId = window.setInterval(() => {
      const nextChord = conductorRef.current.advanceChord();
      setDiagnostics({ currentChord: nextChord });
    }, msPerChord);

    return () => window.clearInterval(intervalId);
  }, [bpm, currentTrack.title, isSessionRunning, setDiagnostics]);

  // Midnight Soul backing groove: provides the continuous pocket so player sounds sit on top of a stable bed.
  useEffect(() => {
    const transport = transportRef.current;
    const instruments = instrumentsRef.current;
    if (!transport || !instruments) {
      return;
    }

    if (!backingTrackRef.current) {
      backingTrackRef.current = createBackingTrackScheduler({
        track: currentTrack,
        transport,
        instruments,
      });
    }

    syncBackingTrackPlayback({
      scheduler: backingTrackRef.current,
      shouldRun: isSessionRunning && gamePhase === 'jam',
      startAtSeconds: transport.now() + 0.05,
    });

    return () => {
      backingTrackRef.current?.stop();
    };
  }, [currentTrack, gamePhase, isSessionRunning]);

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

  // Main inference + event loop
  useEffect(() => {
    if (!isSessionRunning || !videoElement) {
      setPoses([]);
      zoningStateRef.current = createInitialZoningState();
      featureStateRef.current = createInitialFeatureState();
      setDiagnostics({
        personCount: 0,
        inferenceMs: 0,
        fps: 0,
        gesturePhase: {
          left: 'idle',
          middle: 'idle',
          right: 'idle',
        },
      });
      setZoneOccupants({ left: null, middle: null, right: null });
      updateLane('left', { occupied: false, status: 'no_player', gesturePhase: 'idle' });
      updateLane('middle', { occupied: false, status: 'no_player', gesturePhase: 'idle' });
      updateLane('right', { occupied: false, status: 'no_player', gesturePhase: 'idle' });
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
                const feature = featureResult.features[zone];
                const energy = feature.energy;
                const store = useAppStore.getState();
                const prev = store.lanes[zone].activity;
                const smoothed = prev + ACTIVITY_SMOOTHING * (energy - prev);
                updateLane(zone, {
                  activity: Math.min(1, smoothed),
                  occupied: feature.occupied,
                  status: feature.occupied ? store.lanes[zone].status : 'no_player',
                });

                if (gamePhase === 'tutorial' && feature.occupied && energy > TUTORIAL_ENERGY_CONFIRM_THRESHOLD) {
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
                setDiagnostics({
                  gesturePhase: {
                    left: mappingResult.nextState.gesture.left.phase,
                    middle: mappingResult.nextState.gesture.middle.phase,
                    right: mappingResult.nextState.gesture.right.phase,
                  },
                });
                zones.forEach((zone) => {
                  updateLane(zone, {
                    occupied: featureResult.features[zone].occupied,
                    status: mappingResult.statuses[zone],
                    gesturePhase: mappingResult.nextState.gesture[zone].phase,
                  });
                });
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
                  const currentLane = useAppStore.getState().lanes[zone];
                  if (
                    !shouldProcessPlayerFeedback({
                      occupied: currentLane.occupied,
                      status: currentLane.status,
                    })
                  ) {
                    return;
                  }
                  const result = applyEvent(scoringStateRef.current, {
                    timestamp: now,
                    zone,
                    offsetMs,
                  });

                  if (!result.jitterRejected) {
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
                      instrument: currentLane.instrument,
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
      if (!shouldShowSkeletonOverlay(gamePhase, showSkeleton)) {
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
    [gamePhase, poses, showSkeleton],
  );

  const handleVideoElementChange = useCallback((video: HTMLVideoElement | null) => {
    setVideoElement(video);
  }, []);

  const countdownUrgentSecond =
    gamePhase === 'jam' && jamTimeRemainingMs > 0 && jamTimeRemainingMs <= 10_000
      ? countdownSecond(jamTimeRemainingMs)
      : null;

  const phoneQuery = typeof window === 'undefined' ? '' : window.location.search;
  const phoneParams = useMemo(() => {
    const params = new URLSearchParams(phoneQuery);
    const mode = params.get('mode');
    const lobbyCode = params.get('lobby') || '';
    const player = Number(params.get('player'));

    return {
      isPhoneMode: mode === 'phone' && Boolean(lobbyCode) && (player === 1 || player === 2),
      lobbyCode,
      playerSlot: player === 1 || player === 2 ? (player as 1 | 2) : null,
    };
  }, [phoneQuery]);

  useEffect(() => {
    if (phoneParams.isPhoneMode || typeof window === 'undefined') {
      return;
    }

    const params = new URLSearchParams(window.location.search);
    const routePhase = params.get('phase');
    const routeGame = parseGameSelection(params.get('game'));

    if (routeGame) {
      setSelectedGame(routeGame);
    }

    if (routePhase && ROUTABLE_PHASES.has(routePhase)) {
      setGamePhase(routePhase as typeof gamePhase);
      return;
    }

    setGamePhase('lobby');
  }, [phoneParams.isPhoneMode, setGamePhase, setSelectedGame]);

  useEffect(() => {
    if (phoneParams.isPhoneMode || typeof window === 'undefined') {
      return;
    }

    const params = new URLSearchParams(window.location.search);
    params.set('phase', gamePhase);

    if (selectedGame) {
      params.set('game', selectedGame);
    } else {
      params.delete('game');
    }

    window.history.replaceState({}, document.title, `${window.location.pathname}?${params.toString()}`);
  }, [gamePhase, phoneParams.isPhoneMode, selectedGame]);

  const renderLiveStage = () => (
    <CameraView isRunning={isSessionRunning} onVideoElementChange={handleVideoElementChange}>
      {(video) => (
        <OverlayCanvas
          video={video}
          onDraw={drawOverlay}
          enabled={true}
          activeZones={gamePhase === 'jam' ? loopArrangement.activeZones : ALL_ACTIVE_ZONES}
          hitFlashes={hitFlashes}
        />
      )}
    </CameraView>
  );

  const renderPhase = () => {
    if (phoneParams.isPhoneMode && phoneParams.playerSlot) {
      return (
        <PhonePlayerScreen
          lobbyCode={phoneParams.lobbyCode}
          playerSlot={phoneParams.playerSlot}
        />
      );
    }

    switch (gamePhase) {
      case 'lobby':
        return (
          <LobbyScreen onOpenGame={handleSelectGame} onBackToMainMenu={handleBackToMenu} />
        );

      case 'home':
        return (
          <HomeScreen
            onSelectGame={handleSelectGame}
            onOpenLobby={handleOpenLobby}
            connectedPlayerCount={accessPoint?.phoneCount ?? 0}
          />
        );

      case 'setup':
        return <SetupScreen onStartSession={handleSetupStart} onBackToMenu={handleBackToMenu} />;

      case 'vs_setup':
        return (
          <VsSetupScreen
            players={vsPlayers}
            spotifyConnections={vsSpotifyConnections}
            spotifyEnabled={hasSpotifyClientConfig()}
            roundCount={vsRoundCount}
            selectedCategories={vsSelectedCategories}
            onPlayerChange={handleVsPlayerChange}
            onConnectSpotify={handleConnectSpotify}
            onDisconnectSpotify={handleDisconnectSpotify}
            onRoundCountChange={setVsRoundCount}
            onToggleCategory={handleToggleVsCategory}
            onStartBattle={handleStartVsBattle}
            onBackToMenu={handleBackToMenu}
          />
        );

      case 'vs_battle':
        return (
          <VsBattleScreen
            players={vsPlayers}
            spotifyConnections={vsSpotifyConnections}
            scores={vsScores}
            roundIndex={vsRoundIndex}
            roundCount={vsRoundCount}
            currentCategory={vsRoundDeck[vsRoundIndex] || 'Best Collaboration'}
            history={vsRoundHistory}
            currentTrack={
              selectedTracks[(vsRoundIndex % 2) + 1]
                ? {
                    id: selectedTracks[(vsRoundIndex % 2) + 1]!.trackId,
                    name: selectedTracks[(vsRoundIndex % 2) + 1]!.trackName,
                    artistNames: selectedTracks[(vsRoundIndex % 2) + 1]!.artistNames,
                    uri: selectedTracks[(vsRoundIndex % 2) + 1]!.uri,
                  }
                : vsRoundTracks[vsRoundIndex + 1] || null
            }
            onAwardRound={handleAwardVsRound}
            onBackToSetup={handleChangeSetup}
          />
        );

      case 'vs_results':
        return (
          <VsResultsScreen
            players={vsPlayers}
            scores={vsScores}
            history={vsRoundHistory}
            roundTracks={vsRoundTracks}
            onPlayAgain={handlePlayAgain}
            onChangeSetup={handleChangeSetup}
            onBackToMenu={handleBackToMenu}
          />
        );

      case 'on_beat_setup':
        return (
          <OnBeatSetupScreen
            difficulty={onBeatDifficulty}
            onDifficultyChange={setOnBeatDifficulty}
            onStart={handleStartOnBeat}
            onBackToMenu={handleBackToMenu}
          />
        );

      case 'on_beat_play':
        return (
          <OnBeatGameScreen
            key={onBeatSessionKey}
            sessionId={onBeatSessionKey}
            difficulty={onBeatDifficulty}
            onComplete={handleCompleteOnBeat}
            onBackToSetup={handleChangeOnBeatSetup}
          />
        );

      case 'on_beat_results':
        return onBeatResult ? (
          <OnBeatResultsScreen
            result={onBeatResult}
            onPlayAgain={handleReplayOnBeat}
            onChangeSetup={handleChangeOnBeatSetup}
            onBackToMenu={handleBackToMenu}
          />
        ) : (
          <OnBeatSetupScreen
            difficulty={onBeatDifficulty}
            onDifficultyChange={setOnBeatDifficulty}
            onStart={handleStartOnBeat}
            onBackToMenu={handleBackToMenu}
          />
        );

      case 'lyrics_setup':
        return (
          <LyricsSetupScreen
            fallbackTracks={LYRICS_TRACKS}
            selectedTrack={lyricsTrack}
            onSelectTrack={setLyricsTrack}
            onStart={handleStartLyrics}
            onBackToMenu={handleBackToMenu}
          />
        );

      case 'lyrics_play':
        return lyricsTrack ? (
          <LyricsGameScreen
            key={lyricsSessionKey}
            sessionId={lyricsSessionKey}
            track={lyricsTrack}
            onComplete={handleCompleteLyrics}
            onBackToSetup={handleChangeLyricsSetup}
          />
        ) : (
          <LyricsSetupScreen
            fallbackTracks={LYRICS_TRACKS}
            selectedTrack={lyricsTrack}
            onSelectTrack={setLyricsTrack}
            onStart={handleStartLyrics}
            onBackToMenu={handleBackToMenu}
          />
        );

      case 'lyrics_results':
        return lyricsResult ? (
          <LyricsResultsScreen
            result={lyricsResult}
            onPlayAgain={handleReplayLyrics}
            onChangeSetup={handleChangeLyricsSetup}
            onBackToMenu={handleBackToMenu}
          />
        ) : (
          <LyricsSetupScreen
            fallbackTracks={LYRICS_TRACKS}
            selectedTrack={lyricsTrack}
            onSelectTrack={setLyricsTrack}
            onStart={handleStartLyrics}
            onBackToMenu={handleBackToMenu}
          />
        );

      case 'vs_placeholder':
        return (
          <ComingSoonScreen
            title="Vs."
            description="Face off in a fast musical showdown."
            onBack={handleBackToMenu}
          />
        );

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
            sectionCallout={loopArrangement.callout}
            nextSectionCallout={
              loopArrangement.nextSection
                ? loopArrangement.nextSection === 'solo' && loopArrangement.nextFocusZone
                  ? `Next SOLO ${loopArrangement.nextFocusZone.toUpperCase()}`
                  : `Next ${loopArrangement.nextSection}`
                : null
            }
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
            onBackToMenu={handleBackToMenu}
          />
        );

      default:
        return null;
    }
  };

  const showLobbyHeader = !phoneParams.isPhoneMode;

  return (
    <main className="app-shell">
      {showLobbyHeader ? (
        <header className="lobby-status-bar" aria-label="Lobby Status Bar">
          <div className="lobby-status-bar__meta">
            <span className={`lobby-status-bar__pill lobby-status-bar__pill--${socketStatus}`}>
              {socketStatus === 'connected' ? 'WS Connected' : 'WS Disconnected'}
            </span>
            <span className="lobby-status-bar__item">
              Lobby: <strong>{lobby?.code || 'Not ready'}</strong>
            </span>
            <span className="lobby-status-bar__item">
              Phones: <strong>{accessPoint?.phoneCount || 0}</strong>
            </span>
            {selectedGame ? (
              <span className="lobby-status-bar__item">
                Game: <strong>{getGameById(selectedGame).title}</strong>
              </span>
            ) : null}
          </div>
          <button type="button" className="phase-action lobby-status-bar__action" onClick={handleOpenLobby}>
            Back To Lobby
          </button>
        </header>
      ) : null}
      {renderPhase()}
    </main>
  );
}

export default function App() {
  return (
    <LobbySessionProvider>
      <AppContent />
    </LobbySessionProvider>
  );
}
