import { useCallback, useEffect, useRef, useState } from 'react';
import type { GameSelection } from '../../types';
import type { LyricsLiveState, OnBeatLiveState } from '../../network/lobbyProtocol';
import { pickSupportedAudioMimeType, recordAudioClip, transcribeAudioBlob } from '../../audio/transcription';
import {
  addTrackToSpotifyPlaylist,
  beginSpotifyLogin,
  clearSpotifyConnection,
  ensureVerzuzPlaylist,
  fetchSpotifyPlaylistTracks,
  loadSpotifyConnection,
  removeTrackFromSpotifyPlaylist,
  searchSpotifyTracks,
  VERZUZ_PLAYLIST_NAME,
  type SpotifyPlaylistSummary,
  type SpotifyTrackSummary,
} from '../../spotify/client';
import { useLobbySession } from '../../lobby/useLobbySession';

const MIC_TRIGGER_THRESHOLD = 0.045;
const MIC_DEBOUNCE_MS = 450;
const SPEECH_ONSET_GRACE_MS = 1_500;

function getOnBeatTranscriptionInstruction(expectedWord: string) {
  return `Did the speaker say the word "${expectedWord}"? Return only the single spoken word you hear.`;
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

interface OnBeatPhoneControllerProps {
  playerSlot: 1 | 2;
  pairedRoomName: string;
  message: string;
  phoneName: string;
  setPhoneName: (value: string) => void;
  onBeatState: OnBeatLiveState;
  sendOnBeatAttempt: ReturnType<typeof useLobbySession>['sendOnBeatAttempt'];
}

interface CapturedOnBeatPrompt {
  sessionId: number;
  promptIndex: number;
  promptWord: string;
  promptTimeMs: number;
  perfectWindowMs: number;
  okayWindowMs: number;
  detectedAtMs?: number;
}

function OnBeatPhoneController({
  playerSlot,
  pairedRoomName,
  message,
  phoneName,
  setPhoneName,
  onBeatState,
  sendOnBeatAttempt,
}: OnBeatPhoneControllerProps) {
  const [micStatus, setMicStatus] = useState<'idle' | 'requesting' | 'listening' | 'blocked'>('idle');
  const [lastDetection, setLastDetection] = useState(
    'Enable the microphone, then use this phone only as a mic input.',
  );
  const [liveTranscript, setLiveTranscript] = useState('Waiting for speech...');
  const [transcriptionStatus, setTranscriptionStatus] = useState('No clip sent yet.');
  const [transcriptionCount, setTranscriptionCount] = useState(0);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const mimeTypeRef = useRef('');
  const audioContextRef = useRef<AudioContext | null>(null);
  const micLoopRef = useRef<number | null>(null);
  const controllerRunTokenRef = useRef(0);
  const activePromptCaptureKeyRef = useRef('');
  const lastTriggerAtRef = useRef(0);
  const sentPromptKeysRef = useRef<Set<string>>(new Set());
  const lastVoiceOnsetAtRef = useRef<number | null>(null);
  const capturedPromptRef = useRef<CapturedOnBeatPrompt | null>(null);
  const onBeatStateRef = useRef(onBeatState);
  const transcriptionCountRef = useRef(0);

  useEffect(() => {
    onBeatStateRef.current = onBeatState;
  }, [onBeatState]);

  useEffect(() => {
    sentPromptKeysRef.current.clear();
    capturedPromptRef.current = null;
  }, [onBeatState.sessionId]);

  const incrementTranscriptionCount = useCallback(() => {
    transcriptionCountRef.current += 1;
    setTranscriptionCount(transcriptionCountRef.current);
    return transcriptionCountRef.current;
  }, []);

  useEffect(() => {
    return () => {
      controllerRunTokenRef.current += 1;
      activePromptCaptureKeyRef.current = '';
      if (micLoopRef.current !== null) {
        window.cancelAnimationFrame(micLoopRef.current);
      }
      streamRef.current?.getTracks().forEach((track) => track.stop());
      void audioContextRef.current?.close();
    };
  }, []);

  const submitRecognizedAttempt = useCallback(
    (transcript: string, capturedPrompt?: CapturedOnBeatPrompt | null) => {
      const promptContext =
        capturedPrompt ||
        (onBeatState.status === 'playing' &&
        onBeatState.promptIndex !== null &&
        onBeatState.promptTimeMs !== null &&
        onBeatState.promptWord
          ? {
              sessionId: onBeatState.sessionId,
              promptIndex: onBeatState.promptIndex,
              promptWord: onBeatState.promptWord,
              promptTimeMs: onBeatState.promptTimeMs,
              perfectWindowMs: onBeatState.perfectWindowMs,
              okayWindowMs: onBeatState.okayWindowMs,
              detectedAtMs: Date.now(),
            }
          : null);

      if (!promptContext) {
        setLastDetection(`Heard "${transcript.trim()}", but no active prompt was captured.`);
        return;
      }

      const key = `${promptContext.sessionId}:${promptContext.promptIndex}`;
      if (sentPromptKeysRef.current.has(key)) {
        return;
      }

      const recognizedCorrectly = transcriptMatchesPrompt(transcript, promptContext.promptWord);
      const recentVoiceOnsetAtMs = capturedPrompt?.detectedAtMs
        ? capturedPrompt.detectedAtMs
        : lastVoiceOnsetAtRef.current && Date.now() - lastVoiceOnsetAtRef.current <= SPEECH_ONSET_GRACE_MS
          ? lastVoiceOnsetAtRef.current
          : null;
      const detectedAtMs =
        recentVoiceOnsetAtMs ??
        (recognizedCorrectly ? promptContext.promptTimeMs : Date.now());
      const offsetMs = Math.round(detectedAtMs - promptContext.promptTimeMs);
      const absoluteOffset = Math.abs(offsetMs);

      if (recognizedCorrectly && absoluteOffset > promptContext.okayWindowMs) {
        setLastDetection(
          `Heard "${transcript.trim()}". Word matched, but timing missed by ${offsetMs}ms.`,
        );
        return;
      }

      const grade =
        !recognizedCorrectly
          ? 'miss'
          : absoluteOffset <= promptContext.perfectWindowMs
            ? 'perfect'
            : 'good';
      sentPromptKeysRef.current.add(key);
      sendOnBeatAttempt({
        sessionId: promptContext.sessionId,
        playerSlot,
        promptIndex: promptContext.promptIndex,
        grade,
        offsetMs,
        detectedAtMs,
        transcript: transcript.trim(),
        expectedWord: promptContext.promptWord,
        recognizedCorrectly,
      });
      setLastDetection(
        recognizedCorrectly
          ? `Heard "${transcript.trim()}". ${grade.toUpperCase()} (${offsetMs}ms)${
              recentVoiceOnsetAtMs ? '' : ' using transcript fallback'
            }.`
          : `Heard "${transcript.trim()}". Expected "${promptContext.promptWord}". Marked MISS.`,
      );
    },
    [onBeatState, playerSlot, sendOnBeatAttempt],
  );

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

      if (rms > MIC_TRIGGER_THRESHOLD && now - lastTriggerAtRef.current > MIC_DEBOUNCE_MS) {
        lastTriggerAtRef.current = now;
        lastVoiceOnsetAtRef.current = now;
        const currentOnBeatState = onBeatStateRef.current;
        if (
          currentOnBeatState.status === 'playing' &&
          currentOnBeatState.promptIndex !== null &&
          currentOnBeatState.promptTimeMs !== null &&
          currentOnBeatState.promptWord
        ) {
          capturedPromptRef.current = {
            sessionId: currentOnBeatState.sessionId,
            promptIndex: currentOnBeatState.promptIndex,
            promptWord: currentOnBeatState.promptWord,
            promptTimeMs: currentOnBeatState.promptTimeMs,
            perfectWindowMs: currentOnBeatState.perfectWindowMs,
            okayWindowMs: currentOnBeatState.okayWindowMs,
            detectedAtMs: now,
          };
        }
      }

      micLoopRef.current = window.requestAnimationFrame(loop);
    };

    if (micLoopRef.current !== null) {
      window.cancelAnimationFrame(micLoopRef.current);
    }

    micLoopRef.current = window.requestAnimationFrame(loop);
  }, []);

  const enableMicrophone = useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setMicStatus('blocked');
      setLastDetection('Microphone input is not available in this browser.');
      return;
    }

    if (typeof MediaRecorder === 'undefined') {
      setMicStatus('blocked');
      setLastDetection('MediaRecorder is not supported in this browser.');
      return;
    }

    const mimeType = pickSupportedAudioMimeType();
    if (!mimeType) {
      setMicStatus('blocked');
      setLastDetection('No supported audio recording format was found.');
      return;
    }

    setMicStatus('requesting');

    try {
      controllerRunTokenRef.current += 1;
      activePromptCaptureKeyRef.current = '';
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
        setLastDetection('Web Audio is not available on this phone.');
        return;
      }

      const audioContext = new AudioCtor();
      audioContextRef.current = audioContext;
      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 1024;
      source.connect(analyser);
      analyserRef.current = analyser;

      setMicStatus('listening');
      setLastDetection('Microphone live. The phone is now acting only as a mic input.');
      setLiveTranscript('Listening...');
      setTranscriptionStatus('Microphone ready. Waiting for the next scored prompt...');
      transcriptionCountRef.current = 0;
      setTranscriptionCount(0);
      startMicLoop();
    } catch {
      setMicStatus('blocked');
      setLastDetection('Microphone permission was blocked. Retry and allow mic access.');
    }
  }, [startMicLoop]);

  useEffect(() => {
    if (micStatus === 'idle') {
      const timeoutId = window.setTimeout(() => {
        void enableMicrophone();
      }, 0);
      return () => {
        window.clearTimeout(timeoutId);
      };
    }
  }, [enableMicrophone, micStatus]);

  useEffect(() => {
    if (
      micStatus !== 'listening' ||
      onBeatState.status !== 'playing' ||
      onBeatState.promptIndex === null ||
      onBeatState.promptTimeMs === null ||
      !onBeatState.promptWord ||
      !streamRef.current ||
      !mimeTypeRef.current
    ) {
      return;
    }

    const promptKey = `${onBeatState.sessionId}:${onBeatState.promptIndex}`;
    if (activePromptCaptureKeyRef.current === promptKey) {
      return;
    }

    activePromptCaptureKeyRef.current = promptKey;
    const runToken = controllerRunTokenRef.current;
    const promptSnapshot: CapturedOnBeatPrompt = {
      sessionId: onBeatState.sessionId,
      promptIndex: onBeatState.promptIndex,
      promptWord: onBeatState.promptWord,
      promptTimeMs: onBeatState.promptTimeMs,
      perfectWindowMs: onBeatState.perfectWindowMs,
      okayWindowMs: onBeatState.okayWindowMs,
    };

    void recordAudioClip(streamRef.current, mimeTypeRef.current, 1400)
      .then((clip) => {
        if (runToken !== controllerRunTokenRef.current || clip.size === 0) {
          return '';
        }
        setTranscriptionStatus(`Transcribing prompt ${onBeatState.promptIndex! + 1}...`);
        return transcribeAudioBlob(
          clip,
          getOnBeatTranscriptionInstruction(promptSnapshot.promptWord),
        );
      })
      .then((text) => {
        if (runToken !== controllerRunTokenRef.current) {
          return;
        }

        const clipNumber = incrementTranscriptionCount();
        if (!text) {
          setTranscriptionStatus(`Prompt ${promptSnapshot.promptIndex + 1} clip ${clipNumber} sent. No speech detected.`);
          setLastDetection('No speech detected for that prompt. Speak louder or closer to the mic.');
          return;
        }

        setTranscriptionStatus(`Prompt ${promptSnapshot.promptIndex + 1} clip ${clipNumber} sent. Heard "${text}".`);
        setLiveTranscript(text);
        submitRecognizedAttempt(text, {
          ...promptSnapshot,
          detectedAtMs: lastVoiceOnsetAtRef.current || undefined,
        });
      })
      .catch((error: unknown) => {
        if (runToken !== controllerRunTokenRef.current) {
          return;
        }

        const message = error instanceof Error ? error.message : 'Transcription failed.';
        setTranscriptionStatus(message);
        setLastDetection(message);
      });
  }, [
    incrementTranscriptionCount,
    micStatus,
    onBeatState.okayWindowMs,
    onBeatState.perfectWindowMs,
    onBeatState.promptIndex,
    onBeatState.promptTimeMs,
    onBeatState.promptWord,
    onBeatState.sessionId,
    onBeatState.status,
    submitRecognizedAttempt,
  ]);

  return (
    <section className="phase-screen phone-player-screen" aria-label="Phone Player Screen">
      <div className="phase-card on-beat-card">
        <p className="phase-kicker">Phone Microphone</p>
        <h1 className="phase-title">Player {playerSlot} Mic</h1>
        <p className="phase-copy">
          Paired room: <strong>{pairedRoomName || 'Connecting...'}</strong>
        </p>
        <p className="phase-copy">{message}</p>

        <label className="vs-field">
          <span>Display Name</span>
          <input value={phoneName} onChange={(event) => setPhoneName(event.currentTarget.value)} />
        </label>

        <div className="on-beat-status-card">
          <h2>Mic Status</h2>
          <p>
            {micStatus === 'listening'
              ? 'Listening for your voice and the spoken word.'
              : micStatus === 'requesting'
                ? 'Requesting microphone...'
                : micStatus === 'blocked'
                  ? 'Microphone or speech recognition blocked.'
                  : 'Microphone not enabled.'}
          </p>
          <button
            type="button"
            className="phase-action phase-action--primary"
            onClick={() => void enableMicrophone()}
          >
            {micStatus === 'listening' ? 'Reconnect Microphone' : 'Enable Microphone'}
          </button>
        </div>

        <div className="on-beat-status-card">
          <h2>Round Status</h2>
          {onBeatState.status === 'countdown' ? (
            <p className="on-beat-countdown">{onBeatState.countdownLabel || '...'}</p>
          ) : onBeatState.status === 'preview' ? (
            <p>
              Round {onBeatState.roundNumber}, box {onBeatState.beatNumber}. Preview is loading on the host. Keep the
              phone ready, but no scoring happens yet.
            </p>
          ) : onBeatState.status === 'playing' ? (
            <p>
              Round {onBeatState.roundNumber}, box {onBeatState.beatNumber}. Mic live for this scored box. The host
              owns the visuals; this phone is only capturing voice.
            </p>
          ) : (
            <p>Waiting for the host to start the next On Beat round.</p>
          )}
        </div>

        <div className="on-beat-status-card">
          <h2>Live Transcript</h2>
          <p>{liveTranscript}</p>
        </div>

        <div className="on-beat-status-card">
          <h2>Transcription Loop</h2>
          <p>{transcriptionStatus}</p>
          <p>Clips sent: {transcriptionCount}</p>
        </div>

        <div className="on-beat-status-card">
          <h2>Last Detection</h2>
          <p>{lastDetection}</p>
        </div>
      </div>
    </section>
  );
}

interface PhonePlayerScreenProps {
  lobbyCode: string;
  playerSlot: 1 | 2;
  expectedGame?: GameSelection | null;
}
interface LyricsPhoneControllerProps {
  playerSlot: 1 | 2;
  pairedRoomName: string;
  message: string;
  phoneName: string;
  setPhoneName: (value: string) => void;
  lyricsState: LyricsLiveState;
  sendLyricsAttempt: ReturnType<typeof useLobbySession>['sendLyricsAttempt'];
}

function LyricsPhoneController({
  playerSlot,
  pairedRoomName,
  message,
  phoneName,
  setPhoneName,
  lyricsState,
  sendLyricsAttempt,
}: LyricsPhoneControllerProps) {
  const [micStatus, setMicStatus] = useState<'idle' | 'requesting' | 'listening' | 'blocked'>('idle');
  const [manualTranscript, setManualTranscript] = useState('');
  const [lastSent, setLastSent] = useState('Waiting for host.');
  const [transcriptionStatus, setTranscriptionStatus] = useState('No clip sent yet.');
  const [transcriptionCount, setTranscriptionCount] = useState(0);
  const lastPromptTranscriptRef = useRef<string>('');
  const streamRef = useRef<MediaStream | null>(null);
  const mimeTypeRef = useRef('');
  const activePromptCaptureKeyRef = useRef('');
  const controllerRunTokenRef = useRef(0);
  const transcriptionCountRef = useRef(0);

  const activePromptKey =
    lyricsState.promptIndex === null ? '' : `${lyricsState.sessionId}:${lyricsState.promptIndex}`;

  const submitTranscript = useCallback(
    (transcript: string) => {
      const normalized = transcript.trim();
      if (!normalized || lyricsState.promptIndex === null) {
        return;
      }
      if (normalized.toLowerCase() === lastPromptTranscriptRef.current.toLowerCase()) {
        return;
      }

      lastPromptTranscriptRef.current = normalized;
      sendLyricsAttempt({
        sessionId: lyricsState.sessionId,
        playerSlot,
        cueIndex: lyricsState.promptIndex,
        transcript: normalized,
        detectedAtMs: Date.now(),
      });
      setLastSent(`Sent line ${lyricsState.promptIndex + 1}: "${normalized}"`);
    },
    [lyricsState.promptIndex, lyricsState.sessionId, playerSlot, sendLyricsAttempt],
  );

  useEffect(() => {
    lastPromptTranscriptRef.current = '';
  }, [activePromptKey]);

  const incrementTranscriptionCount = useCallback(() => {
    transcriptionCountRef.current += 1;
    setTranscriptionCount(transcriptionCountRef.current);
    return transcriptionCountRef.current;
  }, []);

  const enableMicrophone = useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setMicStatus('blocked');
      setLastSent('Microphone input is not available in this browser.');
      return;
    }

    if (typeof MediaRecorder === 'undefined') {
      setMicStatus('blocked');
      setLastSent('MediaRecorder is not supported in this browser.');
      return;
    }

    const mimeType = pickSupportedAudioMimeType();
    if (!mimeType) {
      setMicStatus('blocked');
      setLastSent('No supported audio recording format was found.');
      return;
    }

    setMicStatus('requesting');

    try {
      controllerRunTokenRef.current += 1;
      activePromptCaptureKeyRef.current = '';
      streamRef.current?.getTracks().forEach((track) => track.stop());
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      mimeTypeRef.current = mimeType;
      transcriptionCountRef.current = 0;
      setTranscriptionCount(0);
      setTranscriptionStatus('Microphone ready. Waiting for the next lyric round...');
      setMicStatus('listening');
      setLastSent('Microphone live. Sing during your lyric round.');
    } catch {
      setMicStatus('blocked');
      setLastSent('Microphone permission was blocked. Retry and allow mic access.');
    }
  }, []);

  useEffect(() => {
    return () => {
      controllerRunTokenRef.current += 1;
      activePromptCaptureKeyRef.current = '';
      streamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  useEffect(() => {
    if (micStatus === 'idle') {
      const timeoutId = window.setTimeout(() => {
        void enableMicrophone();
      }, 0);
      return () => {
        window.clearTimeout(timeoutId);
      };
    }
  }, [enableMicrophone, micStatus]);

  useEffect(() => {
    if (
      micStatus !== 'listening' ||
      lyricsState.status !== 'playing' ||
      lyricsState.promptIndex === null ||
      !streamRef.current ||
      !mimeTypeRef.current
    ) {
      return;
    }

    const promptKey = `${lyricsState.sessionId}:${lyricsState.promptIndex}`;
    if (activePromptCaptureKeyRef.current === promptKey) {
      return;
    }

    activePromptCaptureKeyRef.current = promptKey;
    const runToken = controllerRunTokenRef.current;
    const roundDurationMs =
      lyricsState.promptStartMs !== null && lyricsState.promptEndMs !== null
        ? Math.max(1800, Math.min(5000, lyricsState.promptEndMs - lyricsState.promptStartMs + 350))
        : 3200;
    const roundNumber = lyricsState.promptIndex + 1;

    void recordAudioClip(streamRef.current, mimeTypeRef.current, roundDurationMs)
      .then((clip) => {
        if (runToken !== controllerRunTokenRef.current || clip.size === 0) {
          return '';
        }

        setTranscriptionStatus(`Transcribing round ${roundNumber}...`);
        return transcribeAudioBlob(
          clip,
          'Transcribe the sung lyric line in English. Return only the words that were sung.',
        );
      })
      .then((text) => {
        if (runToken !== controllerRunTokenRef.current) {
          return;
        }

        const clipNumber = incrementTranscriptionCount();
        if (!text) {
          setTranscriptionStatus(`Round ${roundNumber} clip ${clipNumber} sent. No speech detected.`);
          setLastSent('No lyric speech detected for that round. Sing louder or closer to the mic.');
          return;
        }

        setTranscriptionStatus(`Round ${roundNumber} clip ${clipNumber} sent. Heard "${text}".`);
        submitTranscript(text);
      })
      .catch((error: unknown) => {
        if (runToken !== controllerRunTokenRef.current) {
          return;
        }

        const message = error instanceof Error ? error.message : 'Transcription failed.';
        setTranscriptionStatus(message);
        setLastSent(message);
      });
  }, [
    incrementTranscriptionCount,
    lyricsState.promptEndMs,
    lyricsState.promptIndex,
    lyricsState.promptStartMs,
    lyricsState.sessionId,
    lyricsState.status,
    micStatus,
    submitTranscript,
  ]);

  return (
    <section className="phase-screen phone-player-screen" aria-label="Phone Player Screen">
      <div className="phase-card on-beat-card">
        <p className="phase-kicker">Phone Microphone</p>
        <h1 className="phase-title">Player {playerSlot} Lyrics Mic</h1>
        <p className="phase-copy">
          Paired room: <strong>{pairedRoomName || 'Connecting...'}</strong>
        </p>
        <p className="phase-copy">{message}</p>

        <label className="vs-field">
          <span>Display Name</span>
          <input value={phoneName} onChange={(event) => setPhoneName(event.currentTarget.value)} />
        </label>

        <div className="on-beat-status-card">
          <h2>Mic Status</h2>
          <p>
            {micStatus === 'listening'
              ? 'Recording and transcribing lyric rounds with the server model.'
              : micStatus === 'requesting'
                ? 'Requesting microphone...'
              : micStatus === 'blocked'
                ? 'Microphone or model transcription unavailable.'
                : 'Microphone not enabled.'}
          </p>
          <button
            type="button"
            className="phase-action phase-action--primary"
            onClick={() => void enableMicrophone()}
          >
            {micStatus === 'listening' ? 'Reconnect Microphone' : 'Enable Microphone'}
          </button>
        </div>

        <div className="on-beat-status-card">
          <h2>Live Round</h2>
          {lyricsState.status === 'countdown' ? (
            <p className="on-beat-countdown">{lyricsState.countdownLabel || '...'}</p>
          ) : lyricsState.status === 'playing' ? (
            <p className="lyrics-line">
              Round {(lyricsState.promptIndex || 0) + 1} of {lyricsState.cueCount}
            </p>
          ) : (
            <p>Waiting for the host to start the lyrics run.</p>
          )}
        </div>

        <div className="on-beat-status-card">
          <h2>Transcription Loop</h2>
          <p>{transcriptionStatus}</p>
          <p>Clips sent: {transcriptionCount}</p>
        </div>

        <div className="on-beat-status-card">
          <h2>Manual Transcript Fallback</h2>
          <input
            value={manualTranscript}
            onChange={(event) => setManualTranscript(event.currentTarget.value)}
            placeholder="Type what you sang if mic recognition is blocked"
          />
          <button
            type="button"
            className="phase-action"
            onClick={() => {
              submitTranscript(manualTranscript);
              setManualTranscript('');
            }}
            disabled={lyricsState.promptIndex === null || !manualTranscript.trim()}
          >
            Submit Line
          </button>
          <p>{lastSent}</p>
        </div>
      </div>
    </section>
  );
}

export function PhonePlayerScreen({ lobbyCode, playerSlot, expectedGame = null }: PhonePlayerScreenProps) {
  const {
    socketStatus,
    pairedRoom,
    message,
    phoneName,
    setPhoneName,
    setLobbyCodeInput,
    connect,
    pairPhone,
    onBeatState,
    lyricsState,
    sendSelectedTrack,
    sendOnBeatAttempt,
    sendLyricsAttempt,
  } = useLobbySession();
  const [spotifyName, setSpotifyName] = useState('');
  const [managedPlaylist, setManagedPlaylist] = useState<SpotifyPlaylistSummary | null>(null);
  const [playlistTracks, setPlaylistTracks] = useState<SpotifyTrackSummary[]>([]);
  const [searchResults, setSearchResults] = useState<SpotifyTrackSummary[]>([]);
  const [query, setQuery] = useState('');
  const [isBusy, setIsBusy] = useState(false);
  const [status, setStatus] = useState('Connect Spotify to prepare your Verzuz queue.');

  const refreshManagedPlaylist = useCallback(async () => {
    const connection = loadSpotifyConnection(playerSlot - 1);
    if (!connection) {
      setSpotifyName('');
      setManagedPlaylist(null);
      setPlaylistTracks([]);
      setStatus('Connect Spotify to prepare your Verzuz queue.');
      return;
    }

    setIsBusy(true);
    setSpotifyName(connection.profileName);
    setStatus(`Syncing ${VERZUZ_PLAYLIST_NAME}...`);

    try {
      const playlist = await ensureVerzuzPlaylist(connection);
      const tracks = await fetchSpotifyPlaylistTracks(connection, playlist.id);
      setManagedPlaylist({ ...playlist, trackCount: tracks.length });
      setPlaylistTracks(tracks);
      setStatus(
        tracks.length > 0
          ? `${tracks.length} songs queued. First song is next for the round.`
          : `Your ${VERZUZ_PLAYLIST_NAME} playlist is empty. Search and add songs from Spotify.`,
      );
    } catch {
      setStatus(`Could not load ${VERZUZ_PLAYLIST_NAME}. Reconnect Spotify and try again.`);
    } finally {
      setIsBusy(false);
    }
  }, [playerSlot]);

  useEffect(() => {
    setLobbyCodeInput(lobbyCode);
    connect();
  }, [connect, lobbyCode, setLobbyCodeInput]);

  useEffect(() => {
    if (socketStatus === 'connected' && !pairedRoom) {
      pairPhone(playerSlot);
    }
  }, [pairPhone, pairedRoom, playerSlot, socketStatus]);

  useEffect(() => {
    if (onBeatState?.game === 'on_beat' || lyricsState?.game === 'lyrics') {
      return;
    }

    void refreshManagedPlaylist();
  }, [lyricsState?.game, onBeatState?.game, refreshManagedPlaylist]);

  const runSearch = async () => {
    const connection = loadSpotifyConnection(playerSlot - 1);
    if (!connection || !query.trim()) {
      return;
    }

    setIsBusy(true);
    setStatus(`Searching Spotify for "${query.trim()}"...`);

    try {
      const results = await searchSpotifyTracks(connection, query);
      setSearchResults(results);
      setStatus(results.length > 0 ? `Found ${results.length} songs.` : 'No songs matched that search.');
    } catch {
      setStatus('Spotify search failed. Try again.');
    } finally {
      setIsBusy(false);
    }
  };

  const addToQueue = async (track: SpotifyTrackSummary) => {
    const connection = loadSpotifyConnection(playerSlot - 1);
    if (!connection || !managedPlaylist) {
      return;
    }

    setIsBusy(true);
    setStatus(`Adding ${track.name} to ${VERZUZ_PLAYLIST_NAME}...`);

    try {
      await addTrackToSpotifyPlaylist(connection, managedPlaylist.id, track.uri);
      await refreshManagedPlaylist();
      setStatus(`${track.name} added. The playlist order is now your round queue.`);
    } catch {
      setStatus(`Could not add ${track.name}.`);
    } finally {
      setIsBusy(false);
    }
  };

  const removeFromQueue = async (track: SpotifyTrackSummary) => {
    const connection = loadSpotifyConnection(playerSlot - 1);
    if (!connection || !managedPlaylist) {
      return;
    }

    setIsBusy(true);
    setStatus(`Removing ${track.name} from ${VERZUZ_PLAYLIST_NAME}...`);

    try {
      await removeTrackFromSpotifyPlaylist(connection, managedPlaylist.id, track.uri);
      await refreshManagedPlaylist();
      setStatus(`${track.name} removed from the queue.`);
    } catch {
      setStatus(`Could not remove ${track.name}.`);
    } finally {
      setIsBusy(false);
    }
  };

  const sendFirstTrack = () => {
    const firstTrack = playlistTracks[0];
    if (!firstTrack) {
      return;
    }

    sendSelectedTrack({
      playerSlot,
      trackId: firstTrack.id,
      trackName: firstTrack.name,
      artistNames: firstTrack.artistNames,
      uri: firstTrack.uri,
    });
    setStatus(`${firstTrack.name} is now cued for this round. Remove it after the round to advance the queue.`);
  };

  const reconnectSpotify = async () => {
    clearSpotifyConnection(playerSlot - 1);
    setSpotifyName('');
    setManagedPlaylist(null);
    setPlaylistTracks([]);
    setSearchResults([]);
    setStatus('Reconnect Spotify and approve playlist access.');
    await beginSpotifyLogin(playerSlot - 1, true);
  };

  const showVerzuzQueue = expectedGame === 'vs';

  if (onBeatState?.game === 'on_beat') {
    return (
      <OnBeatPhoneController
        key={onBeatState.sessionId}
        playerSlot={playerSlot}
        pairedRoomName={pairedRoom?.name || ''}
        message={message}
        phoneName={phoneName}
        setPhoneName={setPhoneName}
        onBeatState={onBeatState}
        sendOnBeatAttempt={sendOnBeatAttempt}
      />
    );
  }

  if (lyricsState?.game === 'lyrics') {
    return (
      <LyricsPhoneController
        playerSlot={playerSlot}
        pairedRoomName={pairedRoom?.name || ''}
        message={message}
        phoneName={phoneName}
        setPhoneName={setPhoneName}
        lyricsState={lyricsState}
        sendLyricsAttempt={sendLyricsAttempt}
      />
    );
  }

  if (!showVerzuzQueue) {
    return (
      <section className="phase-screen phone-player-screen" aria-label="Phone Player Waiting Screen">
        <div className="phase-card vs-setup-card">
          <p className="phase-kicker">Phone Controller</p>
          <h1 className="phase-title">Player {playerSlot} Ready</h1>
          <p className="phase-copy">
            Paired room: <strong>{pairedRoom?.name || 'Connecting...'}</strong>
          </p>
          <p className="phase-copy">{message}</p>

          <label className="vs-field">
            <span>Display Name</span>
            <input value={phoneName} onChange={(event) => setPhoneName(event.currentTarget.value)} />
          </label>

          <div className="on-beat-status-card">
            <h2>Waiting For Host</h2>
            <p>
              {expectedGame
                ? `Waiting for the host to start ${expectedGame.replaceAll('_', ' ')}.`
                : 'Waiting for the host to start a phone-enabled game. On Beat will open the microphone controller automatically.'}
            </p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="phase-screen phone-player-screen" aria-label="Phone Player Screen">
      <div className="phase-card vs-setup-card">
        <p className="phase-kicker">Phone Controller</p>
        <h1 className="phase-title">Player {playerSlot} Queue</h1>
        <p className="phase-copy">
          Paired room: <strong>{pairedRoom?.name || 'Connecting...'}</strong>
        </p>
        <p className="phase-copy">{message}</p>

        <label className="vs-field">
          <span>Display Name</span>
          <input value={phoneName} onChange={(event) => setPhoneName(event.currentTarget.value)} />
        </label>

        {spotifyName ? (
          <>
            <p className="phase-copy">
              Connected Spotify: <strong>{spotifyName}</strong>
            </p>
            <p className="phase-copy">{status}</p>
            <div className="phase-actions">
              <button type="button" className="phase-action" onClick={() => void refreshManagedPlaylist()} disabled={isBusy}>
                Refresh Queue
              </button>
              <button type="button" className="phase-action" onClick={() => void reconnectSpotify()} disabled={isBusy}>
                Reconnect Spotify
              </button>
              <button type="button" className="phase-action phase-action--primary" onClick={sendFirstTrack} disabled={isBusy || playlistTracks.length === 0}>
                Send First Song
              </button>
            </div>
          </>
        ) : (
          <button type="button" className="phase-cta" onClick={() => void beginSpotifyLogin(playerSlot - 1)}>
            Connect Spotify
          </button>
        )}

        <div className="vs-history">
          <h2>{VERZUZ_PLAYLIST_NAME}</h2>
          <p className="phase-copy">
            {managedPlaylist ? `${managedPlaylist.trackCount} songs in queue.` : 'This playlist will be created automatically.'}
          </p>
          <ul>
            {playlistTracks.length === 0 ? (
              <li>No songs queued yet</li>
            ) : (
              playlistTracks.map((track, index) => (
                <li key={`${track.id}-${index}`}>
                  <div className="phone-track-row">
                    <div>
                      <strong>{index === 0 ? 'Next up: ' : ''}{track.name}</strong>
                      <p>{track.artistNames}</p>
                    </div>
                    <div className="phone-track-row__actions">
                      {index === 0 ? (
                        <button
                          type="button"
                          className="phase-action phase-action--primary"
                          onClick={sendFirstTrack}
                          disabled={isBusy}
                        >
                          Cue
                        </button>
                      ) : null}
                      <button
                        type="button"
                        className="phase-action"
                        onClick={() => void removeFromQueue(track)}
                        disabled={isBusy}
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                </li>
              ))
            )}
          </ul>
        </div>

        <div className="vs-history">
          <h2>Add Songs To Queue</h2>
          <label className="vs-field">
            <span>Search Spotify</span>
            <input
              aria-label="Phone Spotify Search"
              value={query}
              onChange={(event) => setQuery(event.currentTarget.value)}
              placeholder="Search song, artist, or album"
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  void runSearch();
                }
              }}
            />
          </label>
          <button type="button" className="phase-action" onClick={() => void runSearch()} disabled={isBusy || !spotifyName}>
            {isBusy ? 'Working...' : 'Search Spotify'}
          </button>
          <ul>
            {searchResults.length === 0 ? (
              <li>No search results yet</li>
            ) : (
              searchResults.map((track) => (
                <li key={track.id}>
                  <div className="phone-track-row">
                    <div>
                      <strong>{track.name}</strong>
                      <p>{track.artistNames}</p>
                    </div>
                    <button
                      type="button"
                      className="phase-action"
                      onClick={() => void addToQueue(track)}
                      disabled={isBusy || !managedPlaylist}
                    >
                      Add to Queue
                    </button>
                  </div>
                </li>
              ))
            )}
          </ul>
        </div>
      </div>
    </section>
  );
}
