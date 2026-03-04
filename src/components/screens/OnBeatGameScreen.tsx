import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { pickSupportedAudioMimeType, recordAudioClip, transcribeAudioBlob } from '../../audio/transcription';
import {
  ON_BEAT_ACTIVE_ROUND_COUNT,
  computeOnBeatScore,
  ON_BEAT_BREAK_START_MS,
  ON_BEAT_FIRST_ROUND_START_MS,
  getOnBeatDifficulty,
  type OnBeatDifficulty,
  type OnBeatJudgement,
  type OnBeatResultSummary,
} from '../../game/onBeat';

const AUDIO_SRC = '/audio/say-the-word-on-beat-original.mp3';
const ON_BEAT_TRANSCRIPTION_GRACE_MS = 2500;
const HOST_MIC_TRIGGER_THRESHOLD = 0.045;
const HOST_MIC_DEBOUNCE_MS = 450;
const HOST_CLIP_DURATION_MS = 1100;

type AttemptLabel = 'Host';
type OnBeatLoopMode = 'preview' | 'test';

interface OnBeatGameScreenProps {
  sessionId: number;
  difficulty: OnBeatDifficulty;
  onComplete: (result: OnBeatResultSummary) => void;
  onBackToSetup: () => void;
}

interface ScheduledOnBeatLoop {
  roundNumber: number;
  loopMode: OnBeatLoopMode;
  prompts: ReturnType<typeof getOnBeatDifficulty>['rounds'][number];
}

interface ScheduledOnBeatBeat {
  prompt: ReturnType<typeof getOnBeatDifficulty>['rounds'][number][number];
  loopIndex: number;
  roundNumber: number;
  loopMode: OnBeatLoopMode;
  beatInRound: number;
  scoreIndex: number | null;
  startOffsetMs: number;
}

interface AttemptView {
  label: AttemptLabel;
  grade: 'perfect' | 'good' | 'miss';
  transcript?: string;
  expectedWord?: string;
  recognizedCorrectly?: boolean;
}

function normalizeSpeechValue(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

function transcriptMatchesPrompt(transcript: string, expectedWord: string) {
  const normalizedTranscript = normalizeSpeechValue(transcript);
  const normalizedExpected = normalizeSpeechValue(expectedWord);

  if (!normalizedTranscript || !normalizedExpected) {
    return false;
  }

  return normalizedTranscript.split(' ').includes(normalizedExpected);
}

export function OnBeatGameScreen({ sessionId, difficulty, onComplete, onBackToSetup }: OnBeatGameScreenProps) {
  const baseConfig = useMemo(() => getOnBeatDifficulty(difficulty), [difficulty]);
  const config = useMemo(
    () => ({
      ...baseConfig,
      rounds: baseConfig.rounds.slice(0, ON_BEAT_ACTIVE_ROUND_COUNT),
    }),
    [baseConfig],
  );
  const beatIntervalMs = 60_000 / config.bpm;
  const boxIntervalMs = beatIntervalMs / 2;
  const countdownDurationMs = ON_BEAT_FIRST_ROUND_START_MS - ON_BEAT_BREAK_START_MS;
  const roundCount = config.rounds.length;
  const promptsPerRound = config.rounds[0]?.length ?? 0;
  const scoredPromptSchedule = useMemo(() => config.rounds.flat().map((prompt) => ({ ...prompt })), [config.rounds]);
  const loopSchedule = useMemo<ScheduledOnBeatLoop[]>(
    () =>
      config.rounds.flatMap((round, index) => [
        { roundNumber: index + 1, loopMode: 'preview' as const, prompts: round },
        { roundNumber: index + 1, loopMode: 'test' as const, prompts: round },
      ]),
    [config.rounds],
  );
  const beatSchedule = useMemo<ScheduledOnBeatBeat[]>(
    () =>
      loopSchedule.reduce<{ beats: ScheduledOnBeatBeat[]; offsetMs: number }>(
        (acc, loop, loopIndex) => {
          const nextBeats = loop.prompts.map((prompt, beatIndex) => ({
            prompt,
            loopIndex,
            roundNumber: loop.roundNumber,
            loopMode: loop.loopMode,
            beatInRound: beatIndex + 1,
            scoreIndex: loop.loopMode === 'test' ? (loop.roundNumber - 1) * promptsPerRound + beatIndex : null,
            startOffsetMs: acc.offsetMs + beatIndex * boxIntervalMs,
          }));

          return {
            beats: [...acc.beats, ...nextBeats],
            offsetMs: acc.offsetMs + loop.prompts.length * boxIntervalMs,
          };
        },
        { beats: [], offsetMs: 0 },
      ).beats,
    [boxIntervalMs, loopSchedule, promptsPerRound],
  );
  const totalScoredPrompts = scoredPromptSchedule.length;
  const timelineDurationMs =
    beatSchedule.length === 0 ? 0 : beatSchedule[beatSchedule.length - 1].startOffsetMs + boxIntervalMs;
  const gameDurationMs = countdownDurationMs + timelineDurationMs + config.okayWindowMs + ON_BEAT_TRANSCRIPTION_GRACE_MS;
  const emptyJudgements = useMemo<Array<OnBeatJudgement | null>>(
    () => Array(totalScoredPrompts).fill(null),
    [totalScoredPrompts],
  );

  const judgementsRef = useRef<Array<OnBeatJudgement | null>>(emptyJudgements);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const startWallTimeRef = useRef<number | null>(null);
  const hasCompletedRef = useRef(false);
  const streamRef = useRef<MediaStream | null>(null);
  const mimeTypeRef = useRef('');
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const micLoopRef = useRef<number | null>(null);
  const lastTriggerAtRef = useRef(0);
  const micRunTokenRef = useRef(0);
  const activePromptCaptureKeyRef = useRef('');
  const activePromptIndexRef = useRef<number | null>(null);
  const promptOnsetsRef = useRef<Record<number, number>>({});
  const hostAttemptsRef = useRef<Record<number, AttemptView>>({});

  const [gameState, setGameState] = useState<'ready' | 'countdown' | 'preview' | 'playing'>('ready');
  const [activeBeatIndex, setActiveBeatIndex] = useState(0);
  const [countdownLabel, setCountdownLabel] = useState<string | null>(null);
  const [judgements, setJudgements] = useState<Array<OnBeatJudgement | null>>(emptyJudgements);
  const [score, setScore] = useState(0);
  const [lastGrade, setLastGrade] = useState<OnBeatJudgement['grade'] | null>(null);
  const [micStatus, setMicStatus] = useState<'idle' | 'requesting' | 'listening' | 'blocked'>('idle');
  const [transcriptionStatus, setTranscriptionStatus] = useState('Enable computer mic to score with voice.');
  const [liveTranscript, setLiveTranscript] = useState('Waiting for speech...');
  const [hostAttempts, setHostAttempts] = useState<Record<number, AttemptView>>({});

  useEffect(() => {
    return () => {
      if (rafRef.current !== null) {
        window.cancelAnimationFrame(rafRef.current);
      }
      if (micLoopRef.current !== null) {
        window.cancelAnimationFrame(micLoopRef.current);
      }
      if (audioRef.current) {
        audioRef.current.pause();
      }
      micRunTokenRef.current += 1;
      streamRef.current?.getTracks().forEach((track) => track.stop());
      void audioContextRef.current?.close();
    };
  }, []);

  const applyJudgement = useCallback(
    (promptIndex: number, grade: OnBeatJudgement['grade'], offsetMs: number | null) => {
      if (promptIndex < 0 || promptIndex >= totalScoredPrompts || judgementsRef.current[promptIndex]) {
        return;
      }

      judgementsRef.current[promptIndex] = {
        prompt: scoredPromptSchedule[promptIndex],
        grade,
        offsetMs,
      };
      setJudgements([...judgementsRef.current]);
      setLastGrade(grade);
      setScore((current) => current + computeOnBeatScore(grade));
    },
    [scoredPromptSchedule, totalScoredPrompts],
  );

  const recordHostAttempt = useCallback((promptIndex: number, attempt: AttemptView) => {
    hostAttemptsRef.current = {
      ...hostAttemptsRef.current,
      [promptIndex]: attempt,
    };
    setHostAttempts(hostAttemptsRef.current);
  }, []);

  const finishGame = useCallback(() => {
    if (hasCompletedRef.current) {
      return;
    }

    hasCompletedRef.current = true;
    if (rafRef.current !== null) {
      window.cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (audioRef.current) {
      audioRef.current.pause();
    }

    const completedJudgements: OnBeatJudgement[] = judgementsRef.current.map((entry, index) => {
      return entry || { prompt: scoredPromptSchedule[index], grade: 'miss', offsetMs: null };
    });

    const perfectHits = completedJudgements.filter((entry) => entry.grade === 'perfect').length;
    const goodHits = completedJudgements.filter((entry) => entry.grade === 'good').length;
    const misses = completedJudgements.filter((entry) => entry.grade === 'miss').length;

    onComplete({
      difficulty,
      score: completedJudgements.reduce((total, entry) => total + computeOnBeatScore(entry.grade), 0),
      perfectHits,
      goodHits,
      misses,
      roundCount,
      promptsPerRound,
      totalPrompts: completedJudgements.length,
      judgements: completedJudgements,
    });
  }, [difficulty, onComplete, promptsPerRound, roundCount, scoredPromptSchedule]);

  const getElapsedMs = useCallback((audio: HTMLAudioElement) => {
    return Math.max(0, audio.currentTime * 1000 - ON_BEAT_BREAK_START_MS);
  }, []);

  const primeAudio = useCallback((audio: HTMLAudioElement) => {
    return new Promise<void>((resolve, reject) => {
      if (audio.readyState >= 1) {
        resolve();
        return;
      }

      const handleLoadedMetadata = () => {
        cleanup();
        resolve();
      };
      const handleError = () => {
        cleanup();
        reject(audio.error ?? new Error('Unable to load On Beat audio.'));
      };
      const cleanup = () => {
        audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
        audio.removeEventListener('error', handleError);
      };

      audio.addEventListener('loadedmetadata', handleLoadedMetadata, { once: true });
      audio.addEventListener('error', handleError, { once: true });
      audio.load();
    });
  }, []);

  const updateLoop = useCallback(function tick() {
    const audio = audioRef.current;
    if (!audio) {
      return;
    }

    const elapsedMs = getElapsedMs(audio);
    if (elapsedMs > gameDurationMs) {
      finishGame();
      return;
    }

    if (elapsedMs < countdownDurationMs) {
      setGameState('countdown');
      setCountdownLabel('Get Ready');
      activePromptIndexRef.current = null;
    } else {
      setCountdownLabel(null);

      const promptElapsed = elapsedMs - countdownDurationMs;
      let currentIndex = 0;
      for (let index = 0; index < beatSchedule.length; index += 1) {
        if (beatSchedule[index].startOffsetMs <= promptElapsed) {
          currentIndex = index;
        } else {
          break;
        }
      }

      const activeBeat = beatSchedule[currentIndex];
      setActiveBeatIndex(currentIndex);
      setGameState(activeBeat?.loopMode === 'preview' ? 'preview' : 'playing');
      activePromptIndexRef.current = activeBeat?.scoreIndex ?? null;

      beatSchedule.forEach((scheduledBeat) => {
        if (scheduledBeat.scoreIndex === null || judgementsRef.current[scheduledBeat.scoreIndex]) {
          return;
        }

        const beatTime = countdownDurationMs + scheduledBeat.startOffsetMs;
        if (elapsedMs > beatTime + config.okayWindowMs + ON_BEAT_TRANSCRIPTION_GRACE_MS) {
          judgementsRef.current[scheduledBeat.scoreIndex] = {
            prompt: scheduledBeat.prompt,
            grade: 'miss',
            offsetMs: null,
          };
        }
      });

      setJudgements([...judgementsRef.current]);
    }

    rafRef.current = window.requestAnimationFrame(tick);
  }, [beatSchedule, config.okayWindowMs, countdownDurationMs, finishGame, gameDurationMs, getElapsedMs]);

  const handleBeatTap = useCallback(() => {
    if (gameState !== 'playing') {
      return;
    }

    const audio = audioRef.current;
    if (!audio) {
      return;
    }

    const elapsedMs = getElapsedMs(audio);
    const candidateBeat = beatSchedule[activeBeatIndex];
    if (!candidateBeat || candidateBeat.scoreIndex === null || judgementsRef.current[candidateBeat.scoreIndex]) {
      return;
    }

    const beatTime = countdownDurationMs + candidateBeat.startOffsetMs;
    const offsetMs = Math.round(elapsedMs - beatTime);
    const absoluteOffset = Math.abs(offsetMs);
    if (absoluteOffset > config.okayWindowMs) {
      return;
    }

    const grade = absoluteOffset <= config.perfectWindowMs ? 'perfect' : 'good';
    recordHostAttempt(candidateBeat.scoreIndex, {
      label: 'Host',
      grade,
      transcript: 'manual tap',
      expectedWord: candidateBeat.prompt.word,
      recognizedCorrectly: true,
    });
    applyJudgement(candidateBeat.scoreIndex, grade, offsetMs);
  }, [activeBeatIndex, applyJudgement, beatSchedule, config.okayWindowMs, config.perfectWindowMs, countdownDurationMs, gameState, getElapsedMs, recordHostAttempt]);

  const startMicLoop = useCallback(() => {
    const analyser = analyserRef.current;
    if (!analyser) {
      return;
    }

    const data = new Uint8Array(analyser.fftSize);
    const loop = () => {
      analyser.getByteTimeDomainData(data);
      let total = 0;
      for (let index = 0; index < data.length; index += 1) {
        const normalized = (data[index] - 128) / 128;
        total += normalized * normalized;
      }

      const rms = Math.sqrt(total / data.length);
      const now = Date.now();
      const promptIndex = activePromptIndexRef.current;
      if (rms > HOST_MIC_TRIGGER_THRESHOLD && now - lastTriggerAtRef.current > HOST_MIC_DEBOUNCE_MS) {
        lastTriggerAtRef.current = now;
        if (promptIndex !== null && promptOnsetsRef.current[promptIndex] === undefined) {
          promptOnsetsRef.current[promptIndex] = now;
        }
      }

      micLoopRef.current = window.requestAnimationFrame(loop);
    };

    if (micLoopRef.current !== null) {
      window.cancelAnimationFrame(micLoopRef.current);
    }

    micLoopRef.current = window.requestAnimationFrame(loop);
  }, []);

  const enableComputerMic = useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setMicStatus('blocked');
      setTranscriptionStatus('Microphone input is not available in this browser.');
      return;
    }

    if (typeof MediaRecorder === 'undefined') {
      setMicStatus('blocked');
      setTranscriptionStatus('MediaRecorder is not supported in this browser.');
      return;
    }

    const mimeType = pickSupportedAudioMimeType();
    if (!mimeType) {
      setMicStatus('blocked');
      setTranscriptionStatus('No supported audio recording format was found.');
      return;
    }

    setMicStatus('requesting');
    setTranscriptionStatus('Requesting computer microphone...');

    try {
      micRunTokenRef.current += 1;
      streamRef.current?.getTracks().forEach((track) => track.stop());
      void audioContextRef.current?.close();

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      mimeTypeRef.current = mimeType;

      const AudioCtor =
        window.AudioContext ||
        (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtor) {
        setMicStatus('blocked');
        setTranscriptionStatus('Web Audio is not available in this browser.');
        return;
      }

      const audioContext = new AudioCtor();
      audioContextRef.current = audioContext;
      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 1024;
      source.connect(analyser);
      analyserRef.current = analyser;
      startMicLoop();
      setMicStatus('listening');
      setTranscriptionStatus('Computer mic ready. Each scored box will record and transcribe here.');
    } catch {
      setMicStatus('blocked');
      setTranscriptionStatus('Computer microphone permission was blocked.');
    }
  }, [startMicLoop]);

  const handleStart = useCallback(async () => {
    if (gameState !== 'ready') {
      return;
    }

    if (micStatus !== 'listening') {
      await enableComputerMic();
      if (!streamRef.current || !mimeTypeRef.current) {
        setTranscriptionStatus('Computer mic is required for transcription. Allow mic access and try again.');
        return;
      }
    }

    hasCompletedRef.current = false;
    activePromptCaptureKeyRef.current = '';
    promptOnsetsRef.current = {};
    hostAttemptsRef.current = {};
    setHostAttempts({});
    judgementsRef.current = Array(totalScoredPrompts).fill(null);
    setJudgements(judgementsRef.current);
    setScore(0);
    setLastGrade(null);
    setActiveBeatIndex(0);
    setLiveTranscript('Waiting for speech...');
    setTranscriptionStatus('Starting challenge...');

    const audio = new Audio(AUDIO_SRC);
    audioRef.current = audio;
    audio.preload = 'auto';
    audio.loop = false;
    await primeAudio(audio).catch(() => {
      // Keep gameplay running even if audio metadata fails to load.
    });
    audio.currentTime = ON_BEAT_BREAK_START_MS / 1000;
    void audio.play().catch(() => {
      // Keep gameplay running even if autoplay is blocked.
    });

    startWallTimeRef.current = Date.now();
    rafRef.current = window.requestAnimationFrame(updateLoop);
  }, [enableComputerMic, gameState, micStatus, primeAudio, totalScoredPrompts, updateLoop]);

  useEffect(() => {
    if (micStatus !== 'listening' || gameState !== 'playing' || !streamRef.current || !mimeTypeRef.current) {
      return;
    }

    const activeBeat = beatSchedule[activeBeatIndex];
    if (!activeBeat || activeBeat.scoreIndex === null || judgementsRef.current[activeBeat.scoreIndex]) {
      return;
    }

    const promptKey = `${sessionId}:${activeBeat.scoreIndex}`;
    if (activePromptCaptureKeyRef.current === promptKey) {
      return;
    }

    activePromptCaptureKeyRef.current = promptKey;
    const runToken = micRunTokenRef.current;
    const promptIndex = activeBeat.scoreIndex;
    const promptWord = activeBeat.prompt.word;
    const promptTimeMs =
      startWallTimeRef.current === null
        ? Date.now()
        : Math.round(startWallTimeRef.current + countdownDurationMs + activeBeat.startOffsetMs);

    void recordAudioClip(streamRef.current, mimeTypeRef.current, HOST_CLIP_DURATION_MS)
      .then((clip) => {
        if (runToken !== micRunTokenRef.current || clip.size === 0) {
          return '';
        }
        setTranscriptionStatus(`Transcribing box ${activeBeat.beatInRound}...`);
        return transcribeAudioBlob(clip, `Expected one spoken English word: ${promptWord}`);
      })
      .then((text) => {
        if (runToken !== micRunTokenRef.current || judgementsRef.current[promptIndex]) {
          return;
        }

        if (!text) {
          setLiveTranscript('No speech detected.');
          setTranscriptionStatus(`Box ${activeBeat.beatInRound} recorded. No speech detected.`);
          return;
        }

        const transcript = text.trim();
        const recognizedCorrectly = transcriptMatchesPrompt(transcript, promptWord);
        const detectedAtMs = promptOnsetsRef.current[promptIndex] ?? null;
        const offsetMs = detectedAtMs === null ? null : Math.round(detectedAtMs - promptTimeMs);
        const absoluteOffset = offsetMs === null ? null : Math.abs(offsetMs);
        const grade =
          !recognizedCorrectly
            ? 'miss'
            : absoluteOffset === null
              ? 'good'
            : absoluteOffset <= config.perfectWindowMs
              ? 'perfect'
              : absoluteOffset <= config.okayWindowMs
                ? 'good'
                : 'miss';

        setLiveTranscript(transcript);
        setTranscriptionStatus(
          !recognizedCorrectly
            ? `Computer heard "${transcript}" instead of "${promptWord}".`
            : absoluteOffset === null
              ? `Computer heard "${transcript}", but did not capture timing for this box. Scored GOOD fallback.`
              : recognizedCorrectly
            ? `Computer heard "${transcript}" and graded ${grade.toUpperCase()}.`
            : `Computer heard "${transcript}" instead of "${promptWord}".`,
        );
        recordHostAttempt(promptIndex, {
          label: 'Host',
          grade,
          transcript,
          expectedWord: promptWord,
          recognizedCorrectly,
        });
        applyJudgement(promptIndex, grade, offsetMs);
      })
      .catch((error: unknown) => {
        if (runToken !== micRunTokenRef.current) {
          return;
        }

        const message = error instanceof Error ? error.message : 'Desktop transcription failed.';
        setTranscriptionStatus(message);
      });
  }, [
    activeBeatIndex,
    applyJudgement,
    beatSchedule,
    config.okayWindowMs,
    config.perfectWindowMs,
    countdownDurationMs,
    gameState,
    micStatus,
    recordHostAttempt,
    sessionId,
  ]);

  const attemptsByPrompt = useMemo(() => {
    const attempts: Record<number, AttemptView[]> = {};
    for (const [promptIndex, attempt] of Object.entries(hostAttempts)) {
      const numericIndex = Number(promptIndex);
      attempts[numericIndex] = attempts[numericIndex] || [];
      attempts[numericIndex].unshift(attempt);
    }

    return attempts;
  }, [hostAttempts]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.code === 'Space') {
        event.preventDefault();
        handleBeatTap();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleBeatTap]);

  const perfectHits = judgements.filter((entry) => entry?.grade === 'perfect').length;
  const goodHits = judgements.filter((entry) => entry?.grade === 'good').length;
  const missHits = judgements.filter((entry) => entry?.grade === 'miss').length;
  const activeScheduledBeat = beatSchedule[activeBeatIndex] ?? null;
  const currentLoopIndex = activeScheduledBeat?.loopIndex ?? 0;
  const currentLoop = loopSchedule[currentLoopIndex] ?? loopSchedule[0] ?? null;
  const activeRound = activeScheduledBeat?.roundNumber ?? 1;
  const activeBeat = activeScheduledBeat?.beatInRound ?? 1;
  const currentLoopMode = currentLoop?.loopMode ?? 'preview';
  const currentLoopRoundNumber = currentLoop?.roundNumber ?? activeRound;
  const isPreviewLoop = gameState === 'preview' || currentLoopMode === 'preview';

  return (
    <section className="phase-screen on-beat-game-screen" aria-label="On Beat Game Screen">
      <div className="phase-card on-beat-card">
        <div className="on-beat-header">
          <div>
            <p className="phase-kicker">Say The Word On Beat</p>
            <h1 className="phase-title">On Beat Challenge</h1>
            <p className="phase-copy">
              {roundCount} rounds. Boxes 1 through {promptsPerRound} load first, then the same order repeats for the
              scored turn. Box {Math.min(activeBeat, promptsPerRound)} of {promptsPerRound}.
            </p>
          </div>
          <div className="on-beat-score-strip">
            <span>Score {score}</span>
            <span>P {perfectHits}</span>
            <span>G {goodHits}</span>
            <span>M {missHits}</span>
          </div>
        </div>

        <div className="on-beat-status-card">
          {gameState === 'ready' ? (
            <>
              <h2>Ready</h2>
              <p>
                This game now runs entirely on the computer. Enable the mic if you want voice scoring, then start the
                round. The host records and transcribes each scored box directly.
              </p>
              <p>{transcriptionStatus}</p>
              <div className="phase-actions">
                <button type="button" className="phase-action" onClick={() => void enableComputerMic()}>
                  {micStatus === 'listening' ? 'Reconnect Computer Mic' : 'Enable Computer Mic'}
                </button>
                <button type="button" className="phase-cta" onClick={() => void handleStart()}>
                  Start Challenge
                </button>
              </div>
            </>
          ) : countdownLabel ? (
            <>
              <h2>Countdown</h2>
              <p className="on-beat-countdown">{countdownLabel}</p>
            </>
          ) : gameState === 'preview' ? (
            <>
              <h2>Load The Boxes</h2>
              <div className="on-beat-now-up">
                <div className="on-beat-now-up__emoji" aria-hidden="true">
                  {activeScheduledBeat?.prompt.emoji}
                </div>
                <p>
                  Round {activeRound}, box {activeBeat}. Let the board load from 1 to {promptsPerRound}. No scoring
                  yet. Your turn starts after box {promptsPerRound}.
                </p>
              </div>
            </>
          ) : (
            <>
              <h2>Your Turn</h2>
              <div className="on-beat-now-up">
                <div className="on-beat-now-up__emoji" aria-hidden="true">
                  {activeScheduledBeat?.prompt.emoji}
                </div>
                <p>
                  Round {activeRound}, box {activeBeat}. Say the word and let the computer mic score it. Manual tap is
                  still available as a local fallback.
                </p>
              </div>
              <button type="button" className="phase-action phase-action--primary" onClick={handleBeatTap}>
                Tap On Beat
              </button>
            </>
          )}
        </div>

        <div className="on-beat-status-card">
          <h2>Computer Mic</h2>
          <p>{transcriptionStatus}</p>
          <p>Live Transcript: {liveTranscript}</p>
        </div>

        <div className="on-beat-prompt-grid">
          {currentLoop?.prompts.map((prompt, index) => {
            const isActive = index + 1 === activeBeat;
            const scoreIndex = currentLoopMode === 'test' ? (currentLoopRoundNumber - 1) * promptsPerRound + index : null;
            const judgement = scoreIndex !== null ? judgements[scoreIndex] : null;
            const attempts = scoreIndex !== null ? attemptsByPrompt[scoreIndex] : null;
            const isRevealed = !isPreviewLoop || index + 1 <= activeBeat;

            return (
              <article
                key={`${prompt.word}-${index}`}
                className={`on-beat-prompt-card${isActive ? ' on-beat-prompt-card--active' : ''}${
                  judgement ? ` on-beat-prompt-card--${judgement.grade}` : ''
                }`}
              >
                <div className="on-beat-prompt-card__emoji" aria-hidden="true">
                  {isRevealed ? prompt.emoji : '◻️'}
                </div>
                <span>
                  {judgement ? judgement.grade : `${currentLoopMode === 'preview' ? 'Load' : 'Play'} • ${index + 1}`}
                </span>
                {attempts?.length ? (
                  <div className="on-beat-prompt-card__attempts">
                    {attempts.map((attempt) => (
                      <span
                        key={`${scoreIndex}-${attempt.label}-${attempt.grade}-${attempt.transcript || 'none'}`}
                        className={`on-beat-attempt-chip on-beat-attempt-chip--${attempt.grade}`}
                        title={
                          attempt.transcript
                            ? `Heard "${attempt.transcript}"${attempt.expectedWord ? `, expected "${attempt.expectedWord}"` : ''}`
                            : undefined
                        }
                      >
                        {attempt.label} {attempt.grade}
                      </span>
                    ))}
                  </div>
                ) : null}
                {attempts?.length ? (
                  <p className="phase-copy">
                    {attempts
                      .map((attempt) =>
                        attempt.transcript
                          ? `${attempt.label} heard "${attempt.transcript}"${
                              attempt.recognizedCorrectly === false && attempt.expectedWord
                                ? ` not "${attempt.expectedWord}"`
                                : ''
                            }`
                          : `${attempt.label} no transcript`,
                      )
                      .join(' • ')}
                  </p>
                ) : null}
              </article>
            );
          })}
        </div>

        <div className="on-beat-footer">
          <p>
            Timing window: Perfect within {config.perfectWindowMs}ms. Good within {config.okayWindowMs}ms.
          </p>
          <p>
            {gameState === 'preview'
              ? `Boxes are loading in order. Watch 1 through ${promptsPerRound}, then speak that same order on your turn.`
              : lastGrade
                ? `Last grade: ${lastGrade.toUpperCase()}`
                : 'No hits locked yet.'}
          </p>
        </div>

        <button type="button" className="phase-action" onClick={onBackToSetup}>
          Back To Setup
        </button>
      </div>
    </section>
  );
}
