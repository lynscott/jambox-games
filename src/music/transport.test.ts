import { describe, expect, it } from 'vitest';
import { beatDurationSeconds, nextQuantizedTime } from './transport';

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
});
