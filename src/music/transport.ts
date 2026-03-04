import type { Quantization } from '../types';

export function beatDurationSeconds(bpm: number, resolution: Quantization): number {
  const quarter = 60 / bpm;
  if (resolution === '4n') {
    return quarter;
  }
  if (resolution === '8n') {
    return quarter / 2;
  }
  return quarter / 4;
}

export function nextQuantizedTime(
  nowSeconds: number,
  bpm: number,
  resolution: Quantization,
  lookaheadMs = 80,
): number {
  const step = beatDurationSeconds(bpm, resolution);
  const target = nowSeconds + lookaheadMs / 1000;
  const quantizedStep = Math.ceil(target / step) * step;
  return Number(quantizedStep.toFixed(6));
}

export function computeGridOffsetMs(
  nowSeconds: number,
  bpm: number,
  resolution: Quantization,
): number {
  const step = beatDurationSeconds(bpm, resolution);
  if (step <= 0) {
    return 0;
  }

  const phase = ((nowSeconds % step) + step) % step;
  const signedOffsetSeconds = phase > step / 2 ? phase - step : phase;
  return signedOffsetSeconds * 1000;
}

export interface TransportController {
  now: () => number;
  start: () => Promise<void>;
  stop: () => void;
  setBpm: (bpm: number) => void;
  scheduleRepeat: (
    callback: (time: number) => void,
    interval: Quantization,
    startAtSeconds?: number,
  ) => number;
  clear: (eventId: number) => void;
  schedule: (
    callback: (time: number) => void,
    bpm: number,
    resolution: Quantization,
    lookaheadMs?: number,
  ) => number;
}

export async function createToneTransportController(): Promise<TransportController> {
  const Tone = await import('tone');

  return {
    now: () => Tone.Transport.seconds,
    start: async () => {
      await Tone.start();
      Tone.Transport.start();
    },
    stop: () => {
      Tone.Transport.stop();
      Tone.Transport.cancel();
    },
    setBpm: (bpm: number) => {
      Tone.Transport.bpm.value = bpm;
    },
    scheduleRepeat: (callback, interval, startAtSeconds = Tone.Transport.seconds) => {
      return Tone.Transport.scheduleRepeat((time) => callback(time), interval, startAtSeconds);
    },
    clear: (eventId) => {
      Tone.Transport.clear(eventId);
    },
    schedule: (callback, bpm, resolution, lookaheadMs = 80) => {
      const now = Tone.Transport.seconds;
      const when = nextQuantizedTime(now, bpm, resolution, lookaheadMs);
      Tone.Transport.scheduleOnce((time) => callback(time), when);
      return when;
    },
  };
}
