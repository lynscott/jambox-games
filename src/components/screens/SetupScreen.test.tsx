import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createInitialState, useAppStore } from '../../state/store';
import { SetupScreen } from './SetupScreen';

describe('SetupScreen', () => {
  beforeEach(() => {
    useAppStore.setState(createInitialState());
  });

  it('lets users choose lane instruments and jam duration before starting', () => {
    const onStartSession = vi.fn();

    render(<SetupScreen onStartSession={onStartSession} />);

    fireEvent.change(screen.getByLabelText('Left Lane'), { target: { value: 'pad' } });
    fireEvent.change(screen.getByLabelText('Middle Lane'), { target: { value: 'rhythm' } });
    fireEvent.change(screen.getByLabelText('Jam Duration'), { target: { value: '90' } });
    fireEvent.click(screen.getByRole('button', { name: /start session/i }));

    const state = useAppStore.getState();
    expect(state.lanes.left.instrument).toBe('pad');
    expect(state.lanes.middle.instrument).toBe('rhythm');
    expect(state.jamDurationSec).toBe(90);
    expect(onStartSession).toHaveBeenCalledTimes(1);
  });
});
