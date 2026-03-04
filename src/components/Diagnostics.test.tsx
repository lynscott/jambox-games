import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { Diagnostics } from './Diagnostics';
import { createInitialState, useAppStore } from '../state/store';

describe('Diagnostics', () => {
  beforeEach(() => {
    useAppStore.setState(createInitialState());
    useAppStore.getState().setDiagnostics({
      fps: 28.4,
      inferenceMs: 21.2,
      trackTitle: 'Midnight Soul',
      currentChord: 'F',
      personCount: 2,
      gesturePhase: { left: 'idle', middle: 'armed', right: 'active' },
      zoneEnergy: { left: 0.8, middle: 0.2, right: 0.5 },
    } as never);
    useAppStore.getState().updateLane('left', { occupied: true, status: 'get_ready' });
    useAppStore.getState().updateLane('middle', { occupied: true, status: 'hold' });
    useAppStore.getState().updateLane('right', { occupied: false, status: 'no_player' });
  });

  it('renders key runtime metrics', () => {
    render(<Diagnostics />);

    expect(screen.getByText(/FPS: 28.4/i)).toBeInTheDocument();
    expect(screen.getByText(/Inference: 21.2ms/i)).toBeInTheDocument();
    expect(screen.getByText(/Track: Midnight Soul/i)).toBeInTheDocument();
    expect(screen.getByText(/Chord: F/i)).toBeInTheDocument();
    expect(screen.getByText(/Persons: 2/i)).toBeInTheDocument();
    expect(screen.getByText(/Left: occupied \/ get_ready \/ idle/i)).toBeInTheDocument();
    expect(screen.getByText(/Middle: occupied \/ hold \/ armed/i)).toBeInTheDocument();
    expect(screen.getByText(/Right: empty \/ no_player \/ active/i)).toBeInTheDocument();
    expect(screen.getByText(/Left energy: 0.80/i)).toBeInTheDocument();
  });
});
