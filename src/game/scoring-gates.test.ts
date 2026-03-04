import { describe, expect, it } from 'vitest';
import { shouldProcessPlayerFeedback } from './scoring-gates';

describe('shouldProcessPlayerFeedback', () => {
  it('rejects empty-lane events and accepts occupied live-lane hits', () => {
    expect(
      shouldProcessPlayerFeedback({
        occupied: false,
        status: 'no_player',
      }),
    ).toBe(false);

    expect(
      shouldProcessPlayerFeedback({
        occupied: true,
        status: 'get_ready',
      }),
    ).toBe(true);

    expect(
      shouldProcessPlayerFeedback({
        occupied: true,
        status: 'hit',
      }),
    ).toBe(true);
  });
});
