import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { HomeScreen } from './HomeScreen';

describe('HomeScreen', () => {
  it('renders the Jam Box Games launcher and routes selections', () => {
    const onSelectGame = vi.fn();
    const onBackToLobby = vi.fn();

    render(
      <HomeScreen onSelectGame={onSelectGame} onBackToLobby={onBackToLobby} />,
    );

    expect(screen.getByRole('img', { name: /jam box games logo/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /jam hero/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^vs\.$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /on beat/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /know your lyrics/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /back to lobby/i })).toBeInTheDocument();
    expect(screen.getAllByText(/available/i).length).toBe(4);

    fireEvent.click(screen.getByRole('button', { name: /back to lobby/i }));
    fireEvent.click(screen.getByRole('button', { name: /jam hero/i }));
    fireEvent.click(screen.getByRole('button', { name: /^vs\.$/i }));
    fireEvent.click(screen.getByRole('button', { name: /on beat/i }));
    fireEvent.click(screen.getByRole('button', { name: /know your lyrics/i }));

    expect(onBackToLobby).toHaveBeenCalledTimes(1);
    expect(onSelectGame).toHaveBeenNthCalledWith(1, 'jam_hero');
    expect(onSelectGame).toHaveBeenNthCalledWith(2, 'vs');
    expect(onSelectGame).toHaveBeenNthCalledWith(3, 'on_beat');
    expect(onSelectGame).toHaveBeenNthCalledWith(4, 'know_your_lyrics');
  });
});
