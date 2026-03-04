import type { Quantization } from '../types';

const SUBDIVISIONS: Record<Quantization, number> = {
  '4n': 1,
  '8n': 2,
  '16n': 4,
};

const CUE_WINDOW_RATIO = 0.22;

export function computeCueWindowActive(beatPhase: number, quantization: Quantization): boolean {
  const subdivisions = SUBDIVISIONS[quantization];
  const wrapped = ((beatPhase * subdivisions) % 1 + 1) % 1;
  const distance = Math.min(wrapped, 1 - wrapped);
  return distance <= CUE_WINDOW_RATIO;
}

export function countdownSecond(remainingMs: number): number {
  return Math.max(0, Math.ceil(remainingMs / 1000));
}

export function shouldTriggerCountdownTick(
  previousRemainingMs: number | null,
  currentRemainingMs: number,
): boolean {
  const previousSecond = previousRemainingMs === null ? null : countdownSecond(previousRemainingMs);
  const currentSecond = countdownSecond(currentRemainingMs);

  if (currentSecond <= 0 || currentSecond > 10) {
    return false;
  }

  if (previousSecond === null) {
    return true;
  }

  return currentSecond < previousSecond;
}
