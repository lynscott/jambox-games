import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import App from './App';
import { createInitialState, useAppStore } from './state/store';

describe('App home flow', () => {
  beforeEach(() => {
    useAppStore.setState(createInitialState());
    window.localStorage.clear();
  });

  it('starts on the game launcher and routes playable and placeholder entries', () => {
    render(<App />);

    expect(screen.getByRole('img', { name: /jam box games logo/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /^vs\.$/i }));
    expect(screen.getByRole('heading', { name: /^vs\.$/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /back to menu/i }));
    expect(screen.getByRole('img', { name: /jam box games logo/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /jam hero/i }));
    expect(screen.getByRole('heading', { name: /session setup/i })).toBeInTheDocument();
  });

  it('does not start the beat animation loop before a session is running', () => {
    const rafSpy = vi.spyOn(window, 'requestAnimationFrame');

    render(<App />);

    expect(rafSpy).not.toHaveBeenCalled();
  });
});
