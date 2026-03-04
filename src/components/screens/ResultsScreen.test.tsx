import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { ScoreSnapshot } from '../../types';
import { ResultsScreen } from './ResultsScreen';

const SCORE: ScoreSnapshot = {
  total: 4120,
  timing: 3100,
  consistency: 780,
  comboBonus: 240,
  combo: 0,
  maxCombo: 12,
  multiplier: 1,
};

describe('ResultsScreen', () => {
  it('renders score breakdown and result actions', () => {
    const onPlayAgain = vi.fn();
    const onChangeSetup = vi.fn();
    const onBackToMenu = vi.fn();

    render(
      <ResultsScreen
        score={SCORE}
        highScore={5200}
        isNewHighScore={false}
        onPlayAgain={onPlayAgain}
        onChangeSetup={onChangeSetup}
        onBackToMenu={onBackToMenu}
      />,
    );

    expect(screen.getByText(/4,120/i)).toBeInTheDocument();
    expect(screen.getByText(/5,200/i)).toBeInTheDocument();
    expect(screen.getByText(/timing/i)).toBeInTheDocument();
    expect(screen.getByText(/consistency/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /play again/i }));
    fireEvent.click(screen.getByRole('button', { name: /change setup/i }));
    fireEvent.click(screen.getByRole('button', { name: /back to menu/i }));

    expect(onPlayAgain).toHaveBeenCalledTimes(1);
    expect(onChangeSetup).toHaveBeenCalledTimes(1);
    expect(onBackToMenu).toHaveBeenCalledTimes(1);
  });
});
