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

export interface TransportController {
  start: () => Promise<void>;
  stop: () => void;
  setBpm: (bpm: number) => void;
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
    schedule: (callback, bpm, resolution, lookaheadMs = 80) => {
      const now = Tone.now();
      const when = nextQuantizedTime(now, bpm, resolution, lookaheadMs);
      Tone.Transport.scheduleOnce((time) => callback(time), when);
      return when;
    },
  };
}
