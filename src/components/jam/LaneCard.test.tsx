import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { LaneCard } from './LaneCard';
import type { LaneState } from '../../types';

function lane(overrides: Partial<LaneState>): LaneState {
  return {
    instrument: 'bass',
    occupied: true,
    status: 'get_ready',
    activity: 0.4,
    lastGrade: null,
    hitCount: 0,
    gesturePhase: 'idle',
    ...overrides,
  };
}

describe('LaneCard', () => {
  it('shows player section roles as primary cue states', () => {
    const { rerender } = render(
      <LaneCard
        zone="left"
        lane={lane({ occupied: false, status: 'no_player' })}
        lanePlayable={true}
        roleState="play"
      />,
    );

    expect(screen.getAllByText('NO PLAYER').length).toBeGreaterThanOrEqual(2);

    rerender(
      <LaneCard
        zone="left"
        lane={lane({ status: 'get_ready', occupied: true })}
        lanePlayable={true}
        roleState="wait"
      />,
    );
    expect(screen.getByText('WAIT')).toBeInTheDocument();

    rerender(
      <LaneCard
        zone="left"
        lane={lane({ status: 'get_ready', occupied: true })}
        lanePlayable={true}
        roleState="play"
      />,
    );
    expect(screen.getByText('PLAY')).toBeInTheDocument();

    rerender(
      <LaneCard
        zone="left"
        lane={lane({ status: 'get_ready', occupied: true })}
        lanePlayable={true}
        roleState="up_next"
      />,
    );
    expect(screen.getByText('UP NEXT')).toBeInTheDocument();
  });

  it('keeps gesture status as secondary feedback', () => {
    render(
      <LaneCard
        zone="right"
        lane={lane({ status: 'sustain', gesturePhase: 'active', instrument: 'keys', occupied: true })}
        lanePlayable={true}
        roleState="play"
      />,
    );

    expect(screen.getByText('SUSTAIN')).toBeInTheDocument();
  });
});
