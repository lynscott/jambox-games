import { useCallback, useEffect, useRef, useState } from 'react';
import { pickSupportedAudioMimeType, recordAudioClip, transcribeAudioBlob } from '../../audio/transcription';
import type { OnBeatDifficulty } from '../../game/onBeat';

interface OnBeatSetupScreenProps {
  difficulty: OnBeatDifficulty;
  onStart: () => void;
  onBackToMenu: () => void;
}

export function OnBeatSetupScreen({
  onStart,
  onBackToMenu,
}: OnBeatSetupScreenProps) {
  const [micStatus, setMicStatus] = useState<'idle' | 'requesting' | 'listening' | 'blocked'>('idle');
  const [liveTranscript, setLiveTranscript] = useState('Waiting for mic test.');
  const streamRef = useRef<MediaStream | null>(null);

  const stopMicTest = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }, []);

  const startMicTest = useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setMicStatus('blocked');
      setLiveTranscript('Microphone access is not available in this browser.');
      return;
    }

    if (typeof MediaRecorder === 'undefined') {
      setMicStatus('blocked');
      setLiveTranscript('MediaRecorder is not supported in this browser.');
      return;
    }

    const mimeType = pickSupportedAudioMimeType();
    if (!mimeType) {
      setMicStatus('blocked');
      setLiveTranscript('No supported audio recording format was found.');
      return;
    }

    stopMicTest();
    setMicStatus('requesting');
    setLiveTranscript('Requesting microphone...');

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      setMicStatus('listening');
      setLiveTranscript('Recording a short test clip... say cat, hat, or any test word.');

      const clip = await recordAudioClip(stream, mimeType, 1500);
      const text = await transcribeAudioBlob(clip, 'Transcribe a short spoken English mic test phrase.');
      setLiveTranscript(text || 'No speech detected in that clip. Try again and speak closer to the mic.');
    } catch {
      setMicStatus('blocked');
      setLiveTranscript('Microphone permission was denied or unavailable.');
    } finally {
      stopMicTest();
      setMicStatus('idle');
    }
  }, [stopMicTest]);

  useEffect(() => {
    return () => {
      stopMicTest();
    };
  }, [stopMicTest]);

  return (
    <section className="phase-screen on-beat-setup-screen" aria-label="On Beat Setup Screen">
      <div className="phase-card on-beat-card">
        <p className="phase-kicker">Say The Word On Beat</p>
        <h1 className="phase-title">On Beat Challenge</h1>
        <p className="phase-copy">
          Watch the emoji prompt, say what it is on the beat, then tap to lock your timing. The game now runs three
          rounds on the computer. Boxes 1-8 load first, then that same order repeats for the scored player turn.
        </p>

        <div className="on-beat-info-grid">
          <section className="on-beat-info-card">
            <h2>How To Play</h2>
            <p>Let boxes 1-8 load in order, then play the same 8-box sequence on your turn and tap on beat.</p>
          </section>
          <section className="on-beat-info-card">
            <h2>Mic Test</h2>
            <p>
              {micStatus === 'listening'
                ? 'Listening for your words before the round starts.'
                : micStatus === 'requesting'
                  ? 'Requesting microphone...'
                  : micStatus === 'blocked'
                    ? 'Backend transcription unavailable.'
                    : 'Test the mic here before you start.'}
            </p>
            <button type="button" className="phase-action phase-action--primary" onClick={() => void startMicTest()}>
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
