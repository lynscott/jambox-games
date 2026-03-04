import { describe, expect, it } from 'vitest';
import { createRoundRobinVoicePool } from './instruments';

describe('createRoundRobinVoicePool', () => {
  it('cycles across voices so overlapping hits do not reuse the same voice immediately', () => {
    const nextVoice = createRoundRobinVoicePool(['a', 'b', 'c']);

    expect(nextVoice()).toBe('a');
    expect(nextVoice()).toBe('b');
    expect(nextVoice()).toBe('c');
    expect(nextVoice()).toBe('a');
  });

  it('rejects empty pools', () => {
    expect(() => createRoundRobinVoicePool([])).toThrow(/at least one voice/i);
  });
});
