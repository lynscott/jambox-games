import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { HomeScreen } from './HomeScreen';

describe('HomeScreen', () => {
  it('renders the Jam Box Games launcher and routes selections', () => {
    const onSelectGame = vi.fn();

    render(<HomeScreen onSelectGame={onSelectGame} />);

    expect(screen.getByRole('img', { name: /jam box games logo/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /jam hero/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^vs\.$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /on beat/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /know your lyrics/i })).toBeInTheDocument();
    expect(screen.getByText(/available/i)).toBeInTheDocument();
    expect(screen.getAllByText(/coming soon/i).length).toBe(3);

    fireEvent.click(screen.getByRole('button', { name: /jam hero/i }));
    fireEvent.click(screen.getByRole('button', { name: /^vs\.$/i }));

    expect(onSelectGame).toHaveBeenNthCalledWith(1, 'jam_hero');
    expect(onSelectGame).toHaveBeenNthCalledWith(2, 'vs');
  });
});
