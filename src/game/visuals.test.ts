import { describe, expect, it } from 'vitest';
import { shouldShowSkeletonOverlay } from './visuals';

describe('shouldShowSkeletonOverlay', () => {
  it('only allows the skeleton overlay during calibration', () => {
    expect(shouldShowSkeletonOverlay('calibration', true)).toBe(true);
    expect(shouldShowSkeletonOverlay('calibration', false)).toBe(false);
    expect(shouldShowSkeletonOverlay('tutorial', true)).toBe(false);
    expect(shouldShowSkeletonOverlay('jam', true)).toBe(false);
    expect(shouldShowSkeletonOverlay('permissions', true)).toBe(false);
  });
});
