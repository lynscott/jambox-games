import { describe, expect, it } from 'vitest';
import { beatDurationSeconds, computeGridOffsetMs, nextQuantizedTime } from './transport';

describe('transport quantization helpers', () => {
  it('computes beat durations from bpm and resolution', () => {
    expect(beatDurationSeconds(120, '4n')).toBeCloseTo(0.5);
    expect(beatDurationSeconds(120, '8n')).toBeCloseTo(0.25);
    expect(beatDurationSeconds(120, '16n')).toBeCloseTo(0.125);
  });

  it('snaps to next quantized step with lookahead', () => {
    const scheduled = nextQuantizedTime(0.37, 110, '8n', 80);
    expect(scheduled).toBeGreaterThan(0.37);
    expect(scheduled).toBeCloseTo(0.545454, 5);
  });

  it('computes timing offset against the active transport grid', () => {
    expect(computeGridOffsetMs(4.0, 120, '8n')).toBeCloseTo(0, 6);
    expect(computeGridOffsetMs(4.0625, 120, '8n')).toBeCloseTo(62.5, 3);
    expect(computeGridOffsetMs(4.1875, 120, '8n')).toBeCloseTo(-62.5, 3);
  });
});
