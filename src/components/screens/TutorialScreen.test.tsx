import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { LaneState, ZoneId } from '../../types';
import { TutorialScreen } from './TutorialScreen';

const LANES: Record<ZoneId, LaneState> = {
  left: { instrument: 'drums', occupied: true, status: 'get_ready', activity: 0.4, lastGrade: null, hitCount: 0, gesturePhase: 'idle' },
  middle: { instrument: 'bass', occupied: true, status: 'hold', activity: 0.6, lastGrade: null, hitCount: 0, gesturePhase: 'armed' },
  right: { instrument: 'keys', occupied: true, status: 'sustain', activity: 0.2, lastGrade: null, hitCount: 0, gesturePhase: 'active' },
};

describe('TutorialScreen', () => {
  it('shows beat progress, lane guidance, and start jam CTA', () => {
    const onStartJam = vi.fn();

    render(
      <TutorialScreen
        beatsCompleted={3}
        beatsTarget={8}
        laneConfirmed={{ left: true, middle: false, right: true }}
        lanes={LANES}
        onStartJam={onStartJam}
      />,
    );

    expect(screen.getByText(/3 \/ 8 beats/i)).toBeInTheDocument();
    expect(screen.getByText(/hit with quick wrist strikes/i)).toBeInTheDocument();
    expect(screen.getByText(/hold a note pose, then pulse to play/i)).toBeInTheDocument();
    expect(screen.getByText(/raise both hands and hold the chord/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /start jam now/i }));
    expect(onStartJam).toHaveBeenCalledTimes(1);
  });
});
