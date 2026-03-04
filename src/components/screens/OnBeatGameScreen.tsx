import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  computeOnBeatScore,
  ON_BEAT_BREAK_START_MS,
  ON_BEAT_FIRST_ROUND_START_MS,
  getOnBeatDifficulty,
  type OnBeatDifficulty,
  type OnBeatJudgement,
  type OnBeatResultSummary,
} from '../../game/onBeat';
import { useLobbySession } from '../../lobby/useLobbySession';

const AUDIO_SRC = '/audio/say-the-word-on-beat-original.mp3';

interface OnBeatGameScreenProps {
  sessionId: number;
  difficulty: OnBeatDifficulty;
  onComplete: (result: OnBeatResultSummary) => void;
  onBackToSetup: () => void;
}

type OnBeatLoopMode = 'preview' | 'test';

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

export function OnBeatGameScreen({ sessionId, difficulty, onComplete, onBackToSetup }: OnBeatGameScreenProps) {
  const config = useMemo(() => getOnBeatDifficulty(difficulty), [difficulty]);
  const { onBeatAttempts, publishOnBeatState } = useLobbySession();
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
          const loopBeatDurationMs = boxIntervalMs;
          const nextBeats = loop.prompts.map((prompt, beatIndex) => ({
            prompt,
            loopIndex,
            roundNumber: loop.roundNumber,
            loopMode: loop.loopMode,
            beatInRound: beatIndex + 1,
            scoreIndex: loop.loopMode === 'test' ? (loop.roundNumber - 1) * promptsPerRound + beatIndex : null,
            startOffsetMs: acc.offsetMs + beatIndex * loopBeatDurationMs,
          }));

          return {
            beats: [...acc.beats, ...nextBeats],
            offsetMs: acc.offsetMs + loop.prompts.length * loopBeatDurationMs,
          };
        },
        { beats: [], offsetMs: 0 },
      ).beats,
    [boxIntervalMs, loopSchedule, promptsPerRound],
  );
  const totalScoredPrompts = scoredPromptSchedule.length;
  const timelineDurationMs =
    beatSchedule.length === 0
      ? 0
      : beatSchedule[beatSchedule.length - 1].startOffsetMs +
        boxIntervalMs;
  const gameDurationMs = countdownDurationMs + timelineDurationMs + config.okayWindowMs;
  const emptyJudgements = useMemo<Array<OnBeatJudgement | null>>(
    () => Array(totalScoredPrompts).fill(null),
    [totalScoredPrompts],
  );
  const judgementsRef = useRef<Array<OnBeatJudgement | null>>(emptyJudgements);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const startWallTimeRef = useRef<number | null>(null);
  const hasCompletedRef = useRef(false);

  const [gameState, setGameState] = useState<'ready' | 'countdown' | 'preview' | 'playing'>('ready');
  const [activeBeatIndex, setActiveBeatIndex] = useState(0);
  const [countdownLabel, setCountdownLabel] = useState<string | null>(null);
  const [judgements, setJudgements] = useState<Array<OnBeatJudgement | null>>(emptyJudgements);
  const [score, setScore] = useState(0);
  const [lastGrade, setLastGrade] = useState<OnBeatJudgement['grade'] | null>(null);

  useEffect(() => {
    return () => {
      if (rafRef.current !== null) {
        window.cancelAnimationFrame(rafRef.current);
      }
      if (audioRef.current) {
        audioRef.current.pause();
      }
    };
  }, []);

  const applyJudgement = useCallback((
    promptIndex: number,
    grade: OnBeatJudgement['grade'],
    offsetMs: number | null,
  ) => {
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
  }, [scoredPromptSchedule, totalScoredPrompts]);

  const finishGame = () => {
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
  };

  useEffect(() => {
    const attemptsForSession = onBeatAttempts.filter((attempt) => attempt.sessionId === sessionId);
    attemptsForSession.forEach((attempt) => {
      applyJudgement(attempt.promptIndex, attempt.grade, attempt.offsetMs);
    });
  }, [applyJudgement, onBeatAttempts, sessionId]);

  const getElapsedMs = (audio: HTMLAudioElement) => {
    return Math.max(0, audio.currentTime * 1000 - ON_BEAT_BREAK_START_MS);
  };

  const primeAudio = (audio: HTMLAudioElement) => {
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
  };

  const updateLoop = () => {
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

      beatSchedule.forEach((scheduledBeat) => {
        if (scheduledBeat.scoreIndex === null || judgementsRef.current[scheduledBeat.scoreIndex]) {
          return;
        }

        const beatTime = countdownDurationMs + scheduledBeat.startOffsetMs;
        if (elapsedMs > beatTime + config.okayWindowMs) {
          judgementsRef.current[scheduledBeat.scoreIndex] = {
            prompt: scheduledBeat.prompt,
            grade: 'miss',
            offsetMs: null,
          };
        }
      });

      setJudgements([...judgementsRef.current]);
    }

    rafRef.current = window.requestAnimationFrame(() => {
      updateLoop();
    });
  };

  const handleBeatTap = () => {
    if (gameState !== 'playing') {
      return;
    }

    const audio = audioRef.current;
    if (!audio) {
      return;
    }
    const elapsedMs = getElapsedMs(audio);
    const candidateBeat = beatSchedule[activeBeatIndex];

    if (
      !candidateBeat ||
      candidateBeat.scoreIndex === null ||
      judgementsRef.current[candidateBeat.scoreIndex]
    ) {
      return;
    }

    const beatTime = countdownDurationMs + candidateBeat.startOffsetMs;
    const offsetMs = Math.round(elapsedMs - beatTime);
    const absoluteOffset = Math.abs(offsetMs);

    if (absoluteOffset > config.okayWindowMs) {
      return;
    }

    const grade = absoluteOffset <= config.perfectWindowMs ? 'perfect' : 'good';
    applyJudgement(candidateBeat.scoreIndex, grade, offsetMs);
  };

  const handleStart = async () => {
    if (gameState !== 'ready') {
      return;
    }

    hasCompletedRef.current = false;
    judgementsRef.current = Array(totalScoredPrompts).fill(null);
    setJudgements(judgementsRef.current);
    setScore(0);
    setLastGrade(null);
    setActiveBeatIndex(0);

    const audio = new Audio(AUDIO_SRC);
    audioRef.current = audio;
    audio.preload = 'auto';
    audio.loop = false;
    await primeAudio(audio).catch(() => {
      // Keep gameplay running even if the audio metadata fails to load.
    });
    audio.currentTime = ON_BEAT_BREAK_START_MS / 1000;
    void audio.play().catch(() => {
      // Keep gameplay running even if autoplay is blocked.
    });

    startWallTimeRef.current = Date.now();
    rafRef.current = window.requestAnimationFrame(() => {
      updateLoop();
    });
  };

  useEffect(() => {
    const activeBeat = beatSchedule[activeBeatIndex] ?? null;
    const promptTimeMs =
      (gameState === 'preview' || gameState === 'playing') && startWallTimeRef.current !== null
        ? Math.round(startWallTimeRef.current + countdownDurationMs + (activeBeat?.startOffsetMs ?? 0))
        : null;

    publishOnBeatState({
      game: 'on_beat',
      sessionId,
      status: gameState === 'ready' ? 'ready' : gameState,
      difficulty,
      roundNumber: gameState === 'preview' || gameState === 'playing' ? activeBeat?.roundNumber ?? null : null,
      beatNumber: gameState === 'preview' || gameState === 'playing' ? activeBeat?.beatInRound ?? null : null,
      promptIndex: gameState === 'playing' ? activeBeat?.scoreIndex ?? null : null,
      promptWord: gameState === 'preview' || gameState === 'playing' ? activeBeat?.prompt.word || null : null,
      promptEmoji: gameState === 'preview' || gameState === 'playing' ? activeBeat?.prompt.emoji || null : null,
      promptTimeMs,
      countdownLabel,
      perfectWindowMs: config.perfectWindowMs,
      okayWindowMs: config.okayWindowMs,
      totalPrompts: totalScoredPrompts,
    });
  }, [
    activeBeatIndex,
    beatSchedule,
    boxIntervalMs,
    config.perfectWindowMs,
    config.okayWindowMs,
    countdownDurationMs,
    countdownLabel,
    difficulty,
    gameState,
    publishOnBeatState,
    sessionId,
    totalScoredPrompts,
  ]);

  useEffect(() => {
    return () => {
      publishOnBeatState({
        game: 'on_beat',
        sessionId,
        status: 'results',
        difficulty,
        roundNumber: null,
        beatNumber: null,
        promptIndex: null,
        promptWord: null,
        promptEmoji: null,
        promptTimeMs: null,
        countdownLabel: null,
        perfectWindowMs: config.perfectWindowMs,
        okayWindowMs: config.okayWindowMs,
        totalPrompts: totalScoredPrompts,
      });
    };
  }, [config.okayWindowMs, config.perfectWindowMs, difficulty, publishOnBeatState, sessionId, totalScoredPrompts]);

  const attemptsByPrompt = useMemo(() => {
    return onBeatAttempts
      .filter((attempt) => attempt.sessionId === sessionId)
      .reduce<
        Record<
          number,
          Array<{
            playerSlot: 1 | 2;
            grade: 'perfect' | 'good' | 'miss';
            transcript?: string;
            expectedWord?: string;
            recognizedCorrectly?: boolean;
          }>
        >
      >((acc, attempt) => {
        acc[attempt.promptIndex] = acc[attempt.promptIndex] || [];
        acc[attempt.promptIndex].push({
          playerSlot: attempt.playerSlot,
          grade: attempt.grade,
          transcript: attempt.transcript,
          expectedWord: attempt.expectedWord,
          recognizedCorrectly: attempt.recognizedCorrectly,
        });
        return acc;
      }, {});
  }, [onBeatAttempts, sessionId]);

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
  });

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
            <h1 className="phase-title">Level {difficulty.slice(-1)} Challenge</h1>
            <p className="phase-copy">
              {roundCount} rounds. Each round loads boxes 1 through {promptsPerRound}, then your turn starts on the
              repeated loop. Round {Math.min(activeRound, roundCount)} of {roundCount}, box{' '}
              {Math.min(activeBeat, promptsPerRound)} of {promptsPerRound}.
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
                Press start and play through all {roundCount} rounds without stopping. Each round first loads all 8
                boxes one by one, then repeats that same 8-box pattern for the scored turn. Both passes now move at
                the faster box cadence.
              </p>
              <button type="button" className="phase-cta" onClick={handleStart}>
                Start Challenge
              </button>
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
                  Round {activeRound}, box {activeBeat}. Follow the same 8-box order and tap on beat to lock the
                  timing.
                </p>
              </div>
              <button type="button" className="phase-action phase-action--primary" onClick={handleBeatTap}>
                Tap On Beat
              </button>
            </>
          )}
        </div>

        <div className="on-beat-prompt-grid">
          {currentLoop?.prompts.map((prompt, index) => {
            const isActive = index + 1 === activeBeat;
            const scoreIndex =
              currentLoopMode === 'test' ? (currentLoopRoundNumber - 1) * promptsPerRound + index : null;
            const judgement = scoreIndex !== null ? judgements[scoreIndex] : null;
            const attempts = scoreIndex !== null ? attemptsByPrompt[scoreIndex] : null;
            const isRevealed = !isPreviewLoop || index + 1 <= activeBeat;

            return (
              <article
                key={`${prompt.word}-${index}`}
                className={`on-beat-prompt-card${
                  isActive ? ' on-beat-prompt-card--active' : ''
                }${judgement ? ` on-beat-prompt-card--${judgement.grade}` : ''}`}
              >
                <div className="on-beat-prompt-card__emoji" aria-hidden="true">
                  {isRevealed ? prompt.emoji : '◻️'}
                </div>
                <span>
                  {judgement
                    ? judgement.grade
                    : `${currentLoopMode === 'preview' ? 'Load' : 'Play'} • ${index + 1}`}
                </span>
                {attempts?.length ? (
                  <div className="on-beat-prompt-card__attempts">
                    {attempts.map((attempt) => (
                      <span
                        key={`${scoreIndex}-${attempt.playerSlot}-${attempt.grade}`}
                        className={`on-beat-attempt-chip on-beat-attempt-chip--${attempt.grade}`}
                        title={
                          attempt.transcript
                            ? `Heard "${attempt.transcript}"${
                                attempt.expectedWord ? `, expected "${attempt.expectedWord}"` : ''
                              }`
                            : undefined
                        }
                      >
                        P{attempt.playerSlot} {attempt.grade}
                      </span>
                    ))}
                  </div>
                ) : null}
                {attempts?.length ? (
                  <p className="phase-copy">
                    {attempts
                      .map((attempt) =>
                        attempt.transcript
                          ? `P${attempt.playerSlot} heard "${attempt.transcript}"${
                              attempt.recognizedCorrectly === false && attempt.expectedWord
                                ? ` not "${attempt.expectedWord}"`
                                : ''
                            }`
                          : `P${attempt.playerSlot} no transcript`,
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
              ? `Boxes are loading in order. Watch 1 through ${promptsPerRound}, then play that same order on your turn.`
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
