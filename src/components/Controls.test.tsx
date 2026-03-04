import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Controls } from './Controls';
import { MIDNIGHT_SOUL_TRACK } from '../music/tracks';
import { createInitialState, useAppStore } from '../state/store';

describe('Controls', () => {
  beforeEach(() => {
    useAppStore.setState(createInitialState());
  });

  it('renders defaults and updates store values', () => {
    render(<Controls onToggleSession={vi.fn()} />);

    expect(screen.getByLabelText('BPM')).toHaveValue(MIDNIGHT_SOUL_TRACK.bpm);

    fireEvent.change(screen.getByLabelText('BPM'), { target: { value: '132' } });
    fireEvent.change(screen.getByLabelText('Quantization'), { target: { value: '16n' } });
    fireEvent.click(screen.getByLabelText('Skeleton'));

    const state = useAppStore.getState();
    expect(state.bpm).toBe(132);
    expect(state.quantization).toBe('16n');
    expect(state.showSkeleton).toBe(false);
  });
});
