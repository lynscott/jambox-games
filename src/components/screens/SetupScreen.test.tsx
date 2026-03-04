import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createInitialState, useAppStore } from '../../state/store';
import { SetupScreen } from './SetupScreen';

describe('SetupScreen', () => {
  beforeEach(() => {
    useAppStore.setState(createInitialState());
  });
  afterEach(() => {
    cleanup();
  });

  it('lets users choose lane instruments and jam duration before starting', () => {
    const onStartSession = vi.fn();
    const onBackToMenu = vi.fn();

    render(<SetupScreen onStartSession={onStartSession} onBackToMenu={onBackToMenu} />);

    expect(screen.getByText(/midnight soul/i)).toBeInTheDocument();
    expect(
      screen.getByText(/jazz-soul pocket with warm keys, grounded bass, and crisp player cues/i),
    ).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Left Lane'), { target: { value: 'keys' } });
    fireEvent.change(screen.getByLabelText('Middle Lane'), { target: { value: 'drums' } });
    fireEvent.change(screen.getByLabelText('Jam Duration'), { target: { value: '90' } });
    fireEvent.click(screen.getByRole('button', { name: /start session/i }));

    const state = useAppStore.getState();
    expect(state.lanes.left.instrument).toBe('keys');
    expect(state.lanes.middle.instrument).toBe('drums');
    expect(state.jamDurationSec).toBe(90);
    expect(onStartSession).toHaveBeenCalledTimes(1);
    expect(onBackToMenu).not.toHaveBeenCalled();
  });

  it('supports going back to the home menu from setup', () => {
    const onStartSession = vi.fn();
    const onBackToMenu = vi.fn();

    render(<SetupScreen onStartSession={onStartSession} onBackToMenu={onBackToMenu} />);

    fireEvent.click(screen.getByRole('button', { name: /back to menu/i }));

    expect(onBackToMenu).toHaveBeenCalledTimes(1);
    expect(onStartSession).not.toHaveBeenCalled();
  });
});
