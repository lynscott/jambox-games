import { describe, expect, it } from 'vitest';
import { createConductor } from './conductor';

describe('conductor', () => {
  it('loops progression deterministically', () => {
    const conductor = createConductor();

    expect(conductor.currentChord()).toBe('Am');
    expect(conductor.advanceChord()).toBe('F');
    expect(conductor.advanceChord()).toBe('C');
    expect(conductor.advanceChord()).toBe('G');
    expect(conductor.advanceChord()).toBe('Am');
  });

  it('constrains notes to current chord tones', () => {
    const conductor = createConductor();
    const constrained = conductor.constrainNoteToChord('D3');
    expect(['A3', 'C3', 'E3']).toContain(constrained);
  });

  it('flags fills on global energy spikes and support on idle', () => {
    const conductor = createConductor();

    expect(conductor.shouldAddFill(0.9, 0.3)).toBe(true);
    expect(conductor.shouldAddFill(0.95, 0.92)).toBe(false);
    expect(conductor.shouldSupportIdle(0.02)).toBe(true);
    expect(conductor.shouldSupportIdle(0.4)).toBe(false);
  });
});
