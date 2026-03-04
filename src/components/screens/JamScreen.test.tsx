import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { LoopArrangement } from '../../game/arrangement';
import { JamScreen } from './JamScreen';

const arrangement: LoopArrangement = {
  cycleIndex: 0,
  barInCycle: 0,
  beatInBar: 0,
  cycleProgress: 0,
  section: 'harmony',
  cycleSoloZone: 'left',
  focusZone: null,
  activeZones: { left: true, middle: true, right: true },
  callout: 'Harmony',
};

describe('JamScreen', () => {
  it('does not render timeline track UI', () => {
    render(
      <JamScreen
        onToggleSession={vi.fn()}
        arrangement={arrangement}
        countdownSecond={null}
      >
        <div>stage</div>
      </JamScreen>,
    );

    expect(screen.queryByText('Loop Track')).not.toBeInTheDocument();
  });
});
