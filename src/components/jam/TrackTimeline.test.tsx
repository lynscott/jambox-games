import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { createInitialState, useAppStore } from '../../state/store';
import type { LoopArrangement } from '../../game/arrangement';
import { TrackTimeline } from './TrackTimeline';

function arrangement(overrides: Partial<LoopArrangement> = {}): LoopArrangement {
  return {
    cycleIndex: 0,
    barInCycle: 4,
    beatInBar: 1,
    cycleProgress: 0.56,
    section: 'solo',
    nextSection: 'blend',
    focusZone: 'left',
    cycleSoloZone: 'left',
    roleStates: { left: 'play', middle: 'wait', right: 'wait' },
    beatsUntilTransition: 7,
    activeZones: { left: true, middle: false, right: false },
    callout: 'Solo: Left',
    nextFocusZone: 'middle',
    ...overrides,
  };
}

describe('TrackTimeline', () => {
  beforeEach(() => {
    useAppStore.setState(createInitialState());
  });

  it('renders loop section callout and per-lane play/wait statuses', () => {
    render(<TrackTimeline arrangement={arrangement()} strikeWindowActive={false} />);

    expect(screen.getByText('Loop Track')).toBeInTheDocument();
    expect(screen.getByText(/Solo:\s*Left/i)).toBeInTheDocument();
    expect(screen.getByText(/Bar 5 of 8/i)).toBeInTheDocument();

    const playChips = screen.getAllByText('PLAY');
    const waitChips = screen.getAllByText('WAIT');
    expect(playChips.length).toBe(1);
    expect(waitChips.length).toBe(2);
  });

  it('promotes active lane chip to HIT on strike windows', () => {
    render(<TrackTimeline arrangement={arrangement()} strikeWindowActive={true} />);
    expect(screen.getByText('HIT')).toBeInTheDocument();
  });
});
