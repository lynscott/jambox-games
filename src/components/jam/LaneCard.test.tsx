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
  it('renders stable gameplay statuses instead of flashing beat cues', () => {
    const { rerender } = render(
      <LaneCard
        zone="left"
        lane={lane({ occupied: false, status: 'no_player' })}
        lanePlayable={true}
      />,
    );

    expect(screen.getByText('NO PLAYER')).toBeInTheDocument();

    rerender(
      <LaneCard
        zone="left"
        lane={lane({ status: 'get_ready' })}
        lanePlayable={true}
      />,
    );
    expect(screen.getByText('GET READY')).toBeInTheDocument();

    rerender(
      <LaneCard
        zone="left"
        lane={lane({ status: 'hold', gesturePhase: 'armed' })}
        lanePlayable={true}
      />,
    );
    expect(screen.getByText('HOLD')).toBeInTheDocument();

    rerender(
      <LaneCard
        zone="left"
        lane={lane({ status: 'hit', gesturePhase: 'cooldown' })}
        lanePlayable={true}
      />,
    );
    expect(screen.getByText('HIT')).toBeInTheDocument();

    rerender(
      <LaneCard
        zone="right"
        lane={lane({ instrument: 'keys', status: 'sustain', gesturePhase: 'active' })}
        lanePlayable={true}
      />,
    );
    expect(screen.getByText('SUSTAIN')).toBeInTheDocument();
  });
});
