import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { HomeScreen } from './HomeScreen';

describe('HomeScreen', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders the Jam Box Games launcher and routes selections', () => {
    const onSelectGame = vi.fn();
    const onOpenLobby = vi.fn();

    render(<HomeScreen onSelectGame={onSelectGame} onOpenLobby={onOpenLobby} connectedPlayerCount={0} />);

    expect(screen.getByRole('img', { name: /jam box games logo/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /jam hero/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^vs\.$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /on beat/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /know your lyrics/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /go to lobby/i })).toBeInTheDocument();
    expect(screen.queryByText(/connected players/i)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /jam hero/i }));
    fireEvent.click(screen.getByRole('button', { name: /^vs\.$/i }));
    fireEvent.click(screen.getByRole('button', { name: /on beat/i }));
    fireEvent.click(screen.getByRole('button', { name: /know your lyrics/i }));

    expect(onSelectGame).toHaveBeenNthCalledWith(1, 'jam_hero');
    expect(onSelectGame).toHaveBeenNthCalledWith(2, 'vs');
    expect(onSelectGame).toHaveBeenNthCalledWith(3, 'on_beat');
    expect(onSelectGame).toHaveBeenNthCalledWith(4, 'know_your_lyrics');
  });

  it('shows connected player count when players are paired', () => {
    const onSelectGame = vi.fn();
    const onOpenLobby = vi.fn();

    render(
      <HomeScreen
        onSelectGame={onSelectGame}
        onOpenLobby={onOpenLobby}
        connectedPlayerCount={2}
      />,
    );

    expect(screen.getByText(/connected players: 2/i)).toBeInTheDocument();
  });
});
