import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { ZoneId } from '../../types';
import { CalibrationScreen } from './CalibrationScreen';

const LOCKS: Record<ZoneId, number | null> = {
  left: 100,
  middle: null,
  right: 520,
};

describe('CalibrationScreen', () => {
  it('shows per-lane lock status and controls', () => {
    const onRecalibrate = vi.fn();
    const onContinue = vi.fn();
    const onSkip = vi.fn();

    render(
      <CalibrationScreen
        locks={LOCKS}
        isCalibrating={false}
        onRecalibrate={onRecalibrate}
        onContinue={onContinue}
        onSkip={onSkip}
      />,
    );

    expect(screen.getByText(/left/i)).toBeInTheDocument();
    expect(screen.getAllByText(/locked/i).length).toBe(2);
    expect(screen.getAllByText(/searching/i).length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole('button', { name: /retry calibration/i }));
    fireEvent.click(screen.getByRole('button', { name: /continue/i }));
    fireEvent.click(screen.getByRole('button', { name: /skip/i }));

    expect(onRecalibrate).toHaveBeenCalledTimes(1);
    expect(onContinue).toHaveBeenCalledTimes(1);
    expect(onSkip).toHaveBeenCalledTimes(1);
  });
});
