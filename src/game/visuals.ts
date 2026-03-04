import type { GamePhase } from '../types';

export function shouldShowSkeletonOverlay(gamePhase: GamePhase, showSkeleton: boolean): boolean {
  return gamePhase === 'calibration' && showSkeleton;
}
