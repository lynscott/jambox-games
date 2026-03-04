import type { LaneStatus } from '../types';

export function shouldProcessPlayerFeedback({
  occupied,
  status,
}: {
  occupied: boolean;
  status: LaneStatus;
}): boolean {
  return occupied && status !== 'no_player';
}
