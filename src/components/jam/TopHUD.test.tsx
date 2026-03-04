import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { createInitialState, useAppStore } from '../../state/store';
import { TopHUD } from './TopHUD';

describe('TopHUD', () => {
  beforeEach(() => {
    useAppStore.setState(createInitialState());
  });

  it('renders score safely when score snapshot has missing numeric fields', () => {
    useAppStore.setState({
      score: {
        total: undefined,
        timing: undefined,
        consistency: undefined,
        comboBonus: undefined,
        combo: undefined,
        maxCombo: undefined,
        multiplier: undefined,
      } as never,
    });

    render(<TopHUD sectionCallout="Harmony" strikeWindowActive={false} />);

    expect(screen.getByText('0')).toBeInTheDocument();
    expect(screen.getByText('-')).toBeInTheDocument();
  });
});
