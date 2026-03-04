import { useEffect, useMemo, useRef, useState } from 'react';
import {
  evaluateLyricsCue,
  summarizeLyricsHeadToHead,
  type LyricsCueResult,
  type LyricsPlayerSlot,
  type LyricsResultSummary,
  type LyricsTrack,
} from '../../game/lyrics';
import { pickSupportedAudioMimeType, recordAudioClip, transcribeAudioBlob } from '../../audio/transcription';
import { useLobbySession } from '../../lobby/useLobbySession';

const COUNTDOWN_STEPS = ['3', '2', '1', 'GO'];
const COUNTDOWN_STEP_MS = 1_000;
const GRACE_WINDOW_MS = 1_200;

interface LyricsGameScreenProps {
  sessionId: number;
  track: LyricsTrack;
  onComplete: (result: LyricsResultSummary) => void;
  onBackToSetup: () => void;
}

function createPlayerMatrix(length: number): Record<LyricsPlayerSlot, Array<LyricsCueResult | null>> {
  return {
    1: Array(length).fill(null),
    2: Array(length).fill(null),
  };
}

export function LyricsGameScreen({ sessionId, track, onComplete, onBackToSetup }: LyricsGameScreenProps) {
  const { lyricsAttempts, publishLyricsState } = useLobbySession();

  const totalDurationMs = track.cues[track.cues.length - 1]?.endMs ?? 0;
  const countdownDurationMs = COUNTDOWN_STEPS.length * COUNTDOWN_STEP_MS;
  const cueResultsByPlayerRef = useRef<Record<LyricsPlayerSlot, Array<LyricsCueResult | null>>>(
    createPlayerMatrix(track.cues.length),
  );
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const startTimeRef = useRef<number | null>(null);
  const startWallTimeRef = useRef<number | null>(null);
  const hasCompletedRef = useRef(false);
  const streamRef = useRef<MediaStream | null>(null);
  const mimeTypeRef = useRef('');
  const activeHostPromptKeyRef = useRef('');
  const hostRunTokenRef = useRef(0);
  const hostTranscriptionCountRef = useRef(0);

  const [gameState, setGameState] = useState<'ready' | 'countdown' | 'playing'>('ready');
  const [countdownLabel, setCountdownLabel] = useState<string | null>(null);
  const [activeCueIndex, setActiveCueIndex] = useState(0);
  const [showYoutubePlayer, setShowYoutubePlayer] = useState(false);
  const [hostMicStatus, setHostMicStatus] = useState<'idle' | 'requesting' | 'listening' | 'blocked'>('idle');
  const [hostTranscriptStatus, setHostTranscriptStatus] = useState('Laptop mic idle.');
  const [hostTranscriptCount, setHostTranscriptCount] = useState(0);
  const [cueResultsByPlayer, setCueResultsByPlayer] = useState<Record<LyricsPlayerSlot, Array<LyricsCueResult | null>>>(
    cueResultsByPlayerRef.current,
  );

  useEffect(() => {
    return () => {
      if (rafRef.current !== null) {
        window.cancelAnimationFrame(rafRef.current);
      }
      if (audioRef.current) {
        audioRef.current.pause();
      }
      hostRunTokenRef.current += 1;
      activeHostPromptKeyRef.current = '';
      streamRef.current?.getTracks().forEach((track) => track.stop());
      setShowYoutubePlayer(false);
    };
  }, []);

  const applyAttempt = (
    playerSlot: LyricsPlayerSlot,
    cueIndex: number,
    transcript: string,
    detectedAtMs: number,
  ) => {
    if (cueIndex < 0 || cueIndex >= track.cues.length) {
      return;
    }

    const nextResult = evaluateLyricsCue(track.cues[cueIndex], cueIndex, transcript, detectedAtMs);
    const existing = cueResultsByPlayerRef.current[playerSlot][cueIndex];

    if (!existing || nextResult.totalScore > existing.totalScore) {
      cueResultsByPlayerRef.current[playerSlot][cueIndex] = nextResult;
      setCueResultsByPlayer({
        1: [...cueResultsByPlayerRef.current[1]],
        2: [...cueResultsByPlayerRef.current[2]],
      });
    }
  };

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
    hostRunTokenRef.current += 1;
    activeHostPromptKeyRef.current = '';
    streamRef.current?.getTracks().forEach((track) => track.stop());
    setShowYoutubePlayer(false);

    onComplete(summarizeLyricsHeadToHead(track, cueResultsByPlayerRef.current));
  };

  useEffect(() => {
    if (hostMicStatus !== 'idle') {
      return;
    }

    const enableMicrophone = async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setHostMicStatus('blocked');
        setHostTranscriptStatus('Laptop microphone is not available.');
        return;
      }

      if (typeof MediaRecorder === 'undefined') {
        setHostMicStatus('blocked');
        setHostTranscriptStatus('MediaRecorder is not supported in this browser.');
        return;
      }

      const mimeType = pickSupportedAudioMimeType();
      if (!mimeType) {
        setHostMicStatus('blocked');
        setHostTranscriptStatus('No supported recording format was found for the laptop mic.');
        return;
      }

      setHostMicStatus('requesting');

      try {
        streamRef.current?.getTracks().forEach((track) => track.stop());
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        streamRef.current = stream;
        mimeTypeRef.current = mimeType;
        hostTranscriptionCountRef.current = 0;
        setHostTranscriptCount(0);
        setHostMicStatus('listening');
        setHostTranscriptStatus('Laptop mic ready. The host can sing as Player 1.');
      } catch {
        setHostMicStatus('blocked');
        setHostTranscriptStatus('Microphone permission was blocked on the laptop.');
      }
    };

    void enableMicrophone();
  }, [hostMicStatus]);

  useEffect(() => {
    if (
      hostMicStatus !== 'listening' ||
      gameState !== 'playing' ||
      startWallTimeRef.current === null ||
      !streamRef.current ||
      !mimeTypeRef.current
    ) {
      return;
    }

    const prompt = track.cues[activeCueIndex];
    if (!prompt) {
      return;
    }

    const promptKey = `${sessionId}:${activeCueIndex}`;
    if (activeHostPromptKeyRef.current === promptKey) {
      return;
    }

    activeHostPromptKeyRef.current = promptKey;
    const runToken = hostRunTokenRef.current;
    const durationMs = Math.max(1800, Math.min(5000, prompt.endMs - prompt.startMs + 350));

    void recordAudioClip(streamRef.current, mimeTypeRef.current, durationMs)
      .then((clip) => {
        if (runToken !== hostRunTokenRef.current || clip.size === 0) {
          return '';
        }

        setHostTranscriptStatus(`Transcribing laptop clip for round ${activeCueIndex + 1}...`);
        return transcribeAudioBlob(
          clip,
          'Transcribe the sung lyric line in English. Return only the words that were sung.',
        );
      })
      .then((text) => {
        if (runToken !== hostRunTokenRef.current) {
          return;
        }

        hostTranscriptionCountRef.current += 1;
        setHostTranscriptCount(hostTranscriptionCountRef.current);

        if (!text) {
          setHostTranscriptStatus(`Round ${activeCueIndex + 1}: no speech detected from laptop mic.`);
          return;
        }

        const detectedAtMs = startWallTimeRef.current! + countdownDurationMs + (prompt.startMs + prompt.endMs) / 2;
        applyAttempt(1, activeCueIndex, text, detectedAtMs);
        setHostTranscriptStatus(`Round ${activeCueIndex + 1}: heard "${text}" on laptop mic.`);
      })
      .catch((error: unknown) => {
        if (runToken !== hostRunTokenRef.current) {
          return;
        }

        const message = error instanceof Error ? error.message : 'Laptop transcription failed.';
        setHostTranscriptStatus(message);
      });
  }, [activeCueIndex, countdownDurationMs, gameState, hostMicStatus, sessionId, track.cues]);

  useEffect(() => {
    const attemptsForSession = lyricsAttempts.filter((attempt) => attempt.sessionId === sessionId);
    attemptsForSession.forEach((attempt) => {
      applyAttempt(attempt.playerSlot, attempt.cueIndex, attempt.transcript, attempt.detectedAtMs);
    });
  }, [lyricsAttempts, sessionId]);

  const updateLoop = (now: number) => {
    const startTime = startTimeRef.current;
    if (startTime === null) {
      return;
    }

    const elapsedMs = now - startTime;

    if (elapsedMs < countdownDurationMs) {
      setGameState('countdown');
      const countdownIndex = Math.min(
        COUNTDOWN_STEPS.length - 1,
        Math.floor(elapsedMs / COUNTDOWN_STEP_MS),
      );
      setCountdownLabel(COUNTDOWN_STEPS[countdownIndex]);
    } else {
      setGameState('playing');
      setCountdownLabel(null);

      const promptElapsed = elapsedMs - countdownDurationMs;
      const index = track.cues.findIndex((cue) => promptElapsed >= cue.startMs && promptElapsed <= cue.endMs);
      if (index >= 0) {
        setActiveCueIndex(index);
      }

      track.cues.forEach((cue, cueIndex) => {
        if (promptElapsed <= cue.endMs + GRACE_WINDOW_MS) {
          return;
        }

        if (!cueResultsByPlayerRef.current[1][cueIndex]) {
          cueResultsByPlayerRef.current[1][cueIndex] = evaluateLyricsCue(cue, cueIndex, '', cue.endMs);
        }

        if (!cueResultsByPlayerRef.current[2][cueIndex]) {
          cueResultsByPlayerRef.current[2][cueIndex] = evaluateLyricsCue(cue, cueIndex, '', cue.endMs);
        }
      });

      setCueResultsByPlayer({
        1: [...cueResultsByPlayerRef.current[1]],
        2: [...cueResultsByPlayerRef.current[2]],
      });

      if (promptElapsed > totalDurationMs + GRACE_WINDOW_MS) {
        finishGame();
        return;
      }
    }

    rafRef.current = window.requestAnimationFrame(updateLoop);
  };

  const handleStart = async () => {
    if (gameState !== 'ready') {
      return;
    }

    hasCompletedRef.current = false;
    cueResultsByPlayerRef.current = createPlayerMatrix(track.cues.length);
    setCueResultsByPlayer(cueResultsByPlayerRef.current);
    setActiveCueIndex(0);

    if (track.youtubeVideoId) {
      setShowYoutubePlayer(true);
    } else {
      const audio = new Audio(track.instrumentalSrc);
      audioRef.current = audio;
      audio.currentTime = 0;
      audio.loop = false;
      void audio.play().catch(() => {
        // Keep game running if autoplay blocks.
      });
    }

    startTimeRef.current = performance.now();
    startWallTimeRef.current = Date.now();
    rafRef.current = window.requestAnimationFrame(updateLoop);
  };

  useEffect(() => {
    const prompt = gameState === 'playing' ? track.cues[activeCueIndex] : null;
    const promptStartMs =
      prompt && startWallTimeRef.current !== null
        ? Math.round(startWallTimeRef.current + countdownDurationMs + prompt.startMs)
        : null;
    const promptEndMs =
      prompt && startWallTimeRef.current !== null
        ? Math.round(startWallTimeRef.current + countdownDurationMs + prompt.endMs)
        : null;

    publishLyricsState({
      game: 'lyrics',
      sessionId,
      status: gameState === 'ready' ? 'ready' : gameState,
      trackId: track.id,
      trackTitle: track.title,
      promptIndex: prompt ? activeCueIndex : null,
      promptText: null,
      promptStartMs,
      promptEndMs,
      countdownLabel,
      cueCount: track.cues.length,
    });
  }, [activeCueIndex, countdownDurationMs, countdownLabel, gameState, publishLyricsState, sessionId, track]);

  useEffect(() => {
    return () => {
      publishLyricsState({
        game: 'lyrics',
        sessionId,
        status: 'results',
        trackId: track.id,
        trackTitle: track.title,
        promptIndex: null,
        promptText: null,
        promptStartMs: null,
        promptEndMs: null,
        countdownLabel: null,
        cueCount: track.cues.length,
      });
    };
  }, [publishLyricsState, sessionId, track.cues.length, track.id, track.title]);

  const scoreBreakdown = useMemo(
    () => summarizeLyricsHeadToHead(track, cueResultsByPlayer),
    [cueResultsByPlayer, track],
  );

  const playerOne = scoreBreakdown.players[1];
  const playerTwo = scoreBreakdown.players[2];

  return (
    <section className="phase-screen lyrics-game-screen" aria-label="Lyrics Game Screen">
      <div className="phase-card lyrics-card">
        <div className="on-beat-header">
          <div>
            <p className="phase-kicker">Know Your Lyrics</p>
            <h1 className="phase-title">{track.title}</h1>
          </div>
          <div className="on-beat-score-strip">
            <span>P1 {playerOne.score}</span>
            <span>P2 {playerTwo.score}</span>
            <span>Round {Math.min(track.cues.length, activeCueIndex + 1)}</span>
          </div>
        </div>

        {showYoutubePlayer && track.youtubeVideoId ? (
          <div className="on-beat-status-card">
            <h2>Instrumental</h2>
            <iframe
              title={`${track.title} instrumental`}
              width="100%"
              height="220"
              src={`https://www.youtube.com/embed/${track.youtubeVideoId}?autoplay=1&controls=1&modestbranding=1&playsinline=1&rel=0`}
              allow="autoplay; encrypted-media; picture-in-picture"
            />
          </div>
        ) : null}

        <div className="on-beat-status-card">
          <h2>Laptop Mic</h2>
          <p>
            {hostMicStatus === 'listening'
              ? 'Listening and transcribing as Player 1.'
              : hostMicStatus === 'requesting'
                ? 'Requesting microphone...'
                : hostMicStatus === 'blocked'
                  ? 'Laptop microphone unavailable.'
                  : 'Laptop microphone not enabled.'}
          </p>
          <p>{hostTranscriptStatus}</p>
          <p>Laptop clips sent: {hostTranscriptCount}</p>
        </div>

        <div className="on-beat-status-card">
          {gameState === 'ready' ? (
            <>
              <h2>Ready</h2>
              <p>Blind round mode: lyrics stay hidden. The laptop mic scores Player 1 automatically.</p>
              <button type="button" className="phase-cta" onClick={handleStart}>
                Start Lyrics Run
              </button>
            </>
          ) : gameState === 'countdown' ? (
            <>
              <h2>Get Ready</h2>
              <p className="on-beat-countdown">{countdownLabel}</p>
            </>
          ) : (
            <>
              <h2>Now Singing</h2>
              <p className="lyrics-line">Round {activeCueIndex + 1} of {track.cues.length}</p>
              <p>Sing into the laptop mic now. No lyric text shown.</p>
            </>
          )}
        </div>

        <div className="vs-history">
          <h2>Round Scores</h2>
          <ul>
            {scoreBreakdown.rounds.map((round) => (
              <li key={`round-${round.round}`}>
                Round {round.round}: P1 {round.playerOne.grade.toUpperCase()} ({round.playerOne.totalScore}) | P2{' '}
                {round.playerTwo.grade.toUpperCase()} ({round.playerTwo.totalScore})
              </li>
            ))}
          </ul>
        </div>

        <div className="phase-actions">
          <button type="button" className="phase-action" onClick={finishGame}>
            End Run
          </button>
          <button type="button" className="phase-action" onClick={onBackToSetup}>
            Back To Setup
          </button>
        </div>
      </div>
    </section>
  );
}
