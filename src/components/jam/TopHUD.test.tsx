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

    render(<TopHUD sectionCallout="Harmony" nextSectionCallout="Next solo" />);

    expect(screen.getByText('0')).toBeInTheDocument();
    expect(screen.getByText('-')).toBeInTheDocument();
    expect(screen.getByText('Harmony')).toBeInTheDocument();
    expect(screen.getByText('Next solo')).toBeInTheDocument();
  });

  it('does not render the metronome strike indicator', () => {
    render(<TopHUD sectionCallout="Harmony" nextSectionCallout={null} />);

    expect(screen.queryByText('HIT')).not.toBeInTheDocument();
    expect(screen.queryByText('READY')).not.toBeInTheDocument();
  });
});
