import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import App from './App';
import { createInitialState, useAppStore } from './state/store';

describe('App home flow', () => {
  beforeEach(() => {
    useAppStore.setState(createInitialState());
    window.localStorage.clear();
  });

  it('starts on the game launcher and routes playable and placeholder entries', () => {
    render(<App />);

    expect(screen.getByRole('heading', { name: /jam box games/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /^vs\.$/i }));
    expect(screen.getByRole('heading', { name: /^vs\.$/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /back to menu/i }));
    expect(screen.getByRole('heading', { name: /jam box games/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /jam hero/i }));
    expect(screen.getByRole('heading', { name: /session setup/i })).toBeInTheDocument();
  });
});
