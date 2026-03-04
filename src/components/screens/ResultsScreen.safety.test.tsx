import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ResultsScreen } from './ResultsScreen';

describe('ResultsScreen safety', () => {
  it('renders safely with incomplete score values', () => {
    const { container } = render(
      <ResultsScreen
        score={
          {
            total: undefined,
            timing: undefined,
            consistency: undefined,
            comboBonus: undefined,
            combo: undefined,
            maxCombo: undefined,
            multiplier: undefined,
          } as never
        }
        highScore={0}
        isNewHighScore={false}
        onPlayAgain={vi.fn()}
        onChangeSetup={vi.fn()}
      />,
    );

    expect(screen.getByRole('heading', { name: /performance score/i })).toBeInTheDocument();
    expect(container.querySelector('.results-total')?.textContent).toBe('0');
  });
});
