import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from './App';
import { createInitialState, useAppStore } from './state/store';

describe('App home flow', () => {
  beforeEach(() => {
    useAppStore.setState(createInitialState());
    window.localStorage.clear();
    window.history.replaceState({}, '', '/');
  });

  afterEach(() => {
    cleanup();
  });

  it('starts on the lobby screen and routes through launcher into playable games', () => {
    render(<App />);

    expect(screen.getByRole('heading', { level: 1, name: /lobby \+ phone pairing/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /choose game/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /choose game/i }));
    expect(screen.getByRole('img', { name: /jam box games logo/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /^vs\.$/i }));
    expect(screen.getByRole('heading', { name: /verzuz with your friends/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /back to menu/i }));
    expect(screen.getByRole('img', { name: /jam box games logo/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /jam hero/i }));
    expect(screen.getByRole('heading', { name: /jam hero setup/i })).toBeInTheDocument();
  });

  it('runs a short Verzuz battle from setup through results', () => {
    render(<App />);

    fireEvent.click(screen.getByRole('button', { name: /go to verzuz/i }));
    expect(screen.getByRole('heading', { name: /verzuz with your friends/i })).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/verzuz round count/i), { target: { value: '3' } });
    fireEvent.click(screen.getByRole('button', { name: /start verzuz/i }));

    expect(screen.getByRole('heading', { name: /round 1/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /player 1 wins/i }));

    expect(screen.getByRole('heading', { name: /round 2/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /tie round/i }));

    expect(screen.getByRole('heading', { name: /round 3/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /player 2 wins/i }));

    expect(screen.getByRole('heading', { name: /verzuz scoreboard/i })).toBeInTheDocument();
    expect(screen.getByText(/dead heat/i)).toBeInTheDocument();
  });

  it('can deep-link directly into Verzuz setup from the URL', () => {
    window.history.replaceState({}, '', '/?phase=vs_setup&game=vs');

    render(<App />);

    expect(screen.getByRole('heading', { name: /verzuz with your friends/i })).toBeInTheDocument();
  });

  it('does not start the beat animation loop before a session is running', () => {
    const rafSpy = vi.spyOn(window, 'requestAnimationFrame');

    render(<App />);

    expect(rafSpy).not.toHaveBeenCalled();
  });

  it('routes On Beat into its setup screen', () => {
    render(<App />);

    fireEvent.click(screen.getByRole('button', { name: /choose game/i }));
    fireEvent.click(screen.getByRole('button', { name: /on beat/i }));

    expect(screen.getByRole('heading', { name: /on beat challenge/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /start on beat/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /start on beat/i }));
    expect(screen.getByRole('button', { name: /start challenge/i })).toBeInTheDocument();
  });

  it('routes Know Your Lyrics into its setup screen', () => {
    render(<App />);

    fireEvent.click(screen.getByRole('button', { name: /choose game/i }));
    fireEvent.click(screen.getByRole('button', { name: /know your lyrics/i }));

    expect(screen.getByRole('heading', { name: /lyrics challenge setup/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /start lyrics mode/i })).toBeInTheDocument();
  });
});
