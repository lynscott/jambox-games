import { useCallback, useEffect, useRef, useState } from 'react';
import { ON_BEAT_DIFFICULTIES, type OnBeatDifficulty } from '../../game/onBeat';

interface SpeechRecognitionLike extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: Event) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
}

interface SpeechRecognitionEventLike extends Event {
  resultIndex: number;
  results: ArrayLike<{
    isFinal: boolean;
    0: { transcript: string };
  }>;
}

interface SpeechRecognitionErrorEventLike extends Event {
  error?: string;
  message?: string;
}

type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

interface OnBeatSetupScreenProps {
  difficulty: OnBeatDifficulty;
  onDifficultyChange: (difficulty: OnBeatDifficulty) => void;
  onStart: () => void;
  onBackToMenu: () => void;
}

export function OnBeatSetupScreen({
  difficulty,
  onDifficultyChange,
  onStart,
  onBackToMenu,
}: OnBeatSetupScreenProps) {
  const [micStatus, setMicStatus] = useState<'idle' | 'listening' | 'blocked'>('idle');
  const [liveTranscript, setLiveTranscript] = useState('Waiting for mic test.');
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const micStatusRef = useRef<'idle' | 'listening' | 'blocked'>('idle');

  useEffect(() => {
    micStatusRef.current = micStatus;
  }, [micStatus]);

  const startMicTest = useCallback(async () => {
    const SpeechCtor = (
      window as Window & {
        webkitSpeechRecognition?: SpeechRecognitionCtor;
        SpeechRecognition?: SpeechRecognitionCtor;
      }
    ).SpeechRecognition || (
      window as Window & {
        webkitSpeechRecognition?: SpeechRecognitionCtor;
        SpeechRecognition?: SpeechRecognitionCtor;
      }
    ).webkitSpeechRecognition;

    if (!SpeechCtor) {
      setMicStatus('blocked');
      setLiveTranscript('Speech recognition is not supported in this browser.');
      return;
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      setMicStatus('blocked');
      setLiveTranscript('Microphone access is not available in this browser.');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((track) => track.stop());
    } catch {
      setMicStatus('blocked');
      setLiveTranscript('Microphone permission was denied or unavailable.');
      return;
    }

    recognitionRef.current?.stop();
    const recognition = new SpeechCtor();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';
    recognition.onresult = (event) => {
      const result = event.results[event.resultIndex];
      const transcript = result?.[0]?.transcript?.trim() || '';
      if (!transcript) {
        return;
      }
      setLiveTranscript(transcript);
    };
    recognition.onerror = (event) => {
      const error = (event as SpeechRecognitionErrorEventLike).error || 'unknown';
      if (error === 'no-speech') {
        setMicStatus('listening');
        setLiveTranscript('No speech detected yet. Speak louder or closer to the mic.');
        return;
      }

      setMicStatus('blocked');
      setLiveTranscript(`Mic test failed (${error}). Retry or check browser mic permissions.`);
    };
    recognition.onend = () => {
      if (recognitionRef.current === recognition && micStatusRef.current === 'listening') {
        try {
          recognition.start();
        } catch {
          setMicStatus('blocked');
          setLiveTranscript('Mic test stopped. Retry to listen again.');
        }
      }
    };

    try {
      recognition.start();
      recognitionRef.current = recognition;
      setMicStatus('listening');
      setLiveTranscript('Listening... say cat, hat, or any test word.');
    } catch {
      setMicStatus('blocked');
      setLiveTranscript('Could not start speech recognition.');
    }
  }, []);

  useEffect(() => {
    return () => {
      recognitionRef.current?.stop();
      recognitionRef.current = null;
    };
  }, []);

  return (
    <section className="phase-screen on-beat-setup-screen" aria-label="On Beat Setup Screen">
      <div className="phase-card on-beat-card">
        <p className="phase-kicker">Say The Word On Beat</p>
        <h1 className="phase-title">On Beat Challenge</h1>
        <p className="phase-copy">
          Watch the emoji prompt, say what it is on the beat, then tap to lock your timing. The provided challenge
          track runs underneath as the loop reference for this prototype. The groove stays locked at 91.5 BPM, with
          the break anchored at `00:00:02.0` and the first round hit at `00:00:02.8`. Each round loads boxes 1-8
          first, then repeats that same order for the scored player turn.
        </p>

        <div className="on-beat-difficulty-grid">
          {ON_BEAT_DIFFICULTIES.map((option) => {
            const selected = option.id === difficulty;
            return (
              <button
                key={option.id}
                type="button"
                className={`on-beat-difficulty-card${selected ? ' on-beat-difficulty-card--selected' : ''}`}
                onClick={() => onDifficultyChange(option.id)}
              >
                <strong>{option.label}</strong>
                <span>{option.bpm.toFixed(1)} BPM</span>
                <span>Perfect {option.perfectWindowMs}ms</span>
                <span>
                  {option.rounds.length} rounds x {option.rounds[0]?.length ?? 0} beats
                </span>
              </button>
            );
          })}
        </div>

        <div className="on-beat-info-grid">
          <section className="on-beat-info-card">
            <h2>How To Play</h2>
            <p>Let boxes 1-8 load in order, then play the same 8-box sequence on your turn and tap on beat.</p>
          </section>
          <section className="on-beat-info-card">
            <h2>Track</h2>
            <p>Using `Say The Word On Beat Original Moo Ma Ga Gai Pig Dog Crow Chicken` as the backing loop.</p>
          </section>
          <section className="on-beat-info-card">
            <h2>Mic Test</h2>
            <p>
              {micStatus === 'listening'
                ? 'Listening for your words before the round starts.'
                : micStatus === 'blocked'
                  ? 'Speech recognition unavailable.'
                  : 'Test the mic here before you start.'}
            </p>
            <button type="button" className="phase-action phase-action--primary" onClick={startMicTest}>
              {micStatus === 'listening' ? 'Restart Mic Test' : 'Enable Mic Test'}
            </button>
            <p>{liveTranscript}</p>
          </section>
        </div>

        <div className="phase-actions">
          <button type="button" className="phase-action phase-action--primary" onClick={onStart}>
            Start On Beat
          </button>
          <button type="button" className="phase-action" onClick={onBackToMenu}>
            Back To Menu
          </button>
        </div>
      </div>
    </section>
  );
}
