import type { GarageBandInstruments } from './instruments';
import type { TrackPreset } from './tracks';
import type { TransportController } from './transport';

const STEPS_PER_BAR = 8;

const CHORD_VOICINGS: Record<string, string[]> = {
  Am: ['A4', 'C5', 'E5'],
  F: ['F4', 'A4', 'C5'],
  C: ['C4', 'E4', 'G4'],
  G: ['G4', 'B4', 'D5'],
};

const BASS_ROOTS: Record<string, string> = {
  Am: 'A2',
  F: 'F2',
  C: 'C2',
  G: 'G2',
};

export interface BackingTrackScheduler {
  start: (startAtSeconds?: number) => number;
  stop: () => void;
  isRunning: () => boolean;
}

export function syncBackingTrackPlayback({
  scheduler,
  shouldRun,
  startAtSeconds,
}: {
  scheduler: BackingTrackScheduler;
  shouldRun: boolean;
  startAtSeconds: number;
}): void {
  if (shouldRun) {
    if (!scheduler.isRunning()) {
      scheduler.start(startAtSeconds);
    }
    return;
  }

  scheduler.stop();
}

function chordForStep(track: TrackPreset, stepIndex: number): string {
  const barIndex = Math.floor(stepIndex / STEPS_PER_BAR) % track.chordLoop.length;
  return track.chordLoop[barIndex];
}

export function createBackingTrackScheduler({
  track,
  transport,
  instruments,
}: {
  track: TrackPreset;
  transport: TransportController;
  instruments: GarageBandInstruments;
}): BackingTrackScheduler {
  let eventId: number | null = null;
  let stepIndex = 0;

  return {
    start: (startAtSeconds = transport.now() + 0.05) => {
      if (eventId !== null) {
        return eventId;
      }

      stepIndex = 0;
      eventId = transport.scheduleRepeat((time) => {
        const barStep = stepIndex % STEPS_PER_BAR;
        const chord = chordForStep(track, stepIndex);

        if (barStep === 0 || barStep === 5) {
          instruments.triggerKick(time, 0.16);
        }
        if (barStep === 4) {
          instruments.triggerSnare(time, 0.18);
        }
        if (barStep === 2 || barStep === 6) {
          instruments.triggerHat(time, 0.1);
        }
        if (barStep === 0 || barStep === 4) {
          instruments.triggerBass(BASS_ROOTS[chord], time, 0.17);
        }
        if (barStep === 0) {
          instruments.triggerPad(CHORD_VOICINGS[chord], time, 0.14, 1200);
        }

        stepIndex += 1;
      }, '8n', startAtSeconds);

      return eventId;
    },
    stop: () => {
      if (eventId !== null) {
        transport.clear(eventId);
      }
      eventId = null;
      stepIndex = 0;
    },
    isRunning: () => eventId !== null,
  };
}
