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
  nextSection: 'solo',
  cycleSoloZone: 'left',
  focusZone: null,
  activeZones: { left: true, middle: true, right: true },
  roleStates: { left: 'play', middle: 'play', right: 'play' },
  beatsUntilTransition: 12,
  callout: 'Harmony',
  nextFocusZone: 'middle',
};

describe('JamScreen', () => {
  it('renders the section preview banner without restoring the timeline track UI', () => {
    render(
      <JamScreen
        onToggleSession={vi.fn()}
        arrangement={arrangement}
        sectionCallout={arrangement.callout}
        nextSectionCallout="Next solo"
        countdownSecond={null}
        trackView={<div aria-label="Jam Hero Track">track</div>}
      >
        <div>stage</div>
      </JamScreen>,
    );

    expect(screen.getByLabelText('Section Preview')).toBeInTheDocument();
    expect(screen.getByLabelText('Jam Hero Track')).toBeInTheDocument();
    expect(screen.getAllByText('Harmony').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Next solo').length).toBe(2);
    expect(screen.queryByText('Loop Track')).not.toBeInTheDocument();
  });
});
