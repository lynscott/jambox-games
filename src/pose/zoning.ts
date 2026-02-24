import type { ZoneId } from '../types';

export interface ZonePoseCandidate {
  score: number;
  centerX: number;
  centerY?: number;
  poseIndex?: number;
}

export interface ZoneOccupant extends ZonePoseCandidate {
  lastSeenAt: number;
  missingSince: number | null;
  pendingSwitchFrames: number;
}

export interface ZoningState {
  occupants: Record<ZoneId, ZoneOccupant | null>;
}

export interface ZoningParams {
  poses: ZonePoseCandidate[];
  width: number;
  now: number;
  state: ZoningState;
  anchorX?: Record<ZoneId, number | null>;
  holdFrames?: number;
  switchMargin?: number;
  missingTimeoutMs?: number;
}

const ZONES: ZoneId[] = ['left', 'middle', 'right'];

export function createInitialZoningState(): ZoningState {
  return {
    occupants: {
      left: null,
      middle: null,
      right: null,
    },
  };
}

function zoneForX(x: number, width: number): ZoneId {
  if (x < width / 3) {
    return 'left';
  }
  if (x < (width * 2) / 3) {
    return 'middle';
  }
  return 'right';
}

function isSameOccupant(a: ZoneOccupant, b: ZonePoseCandidate, width: number): boolean {
  const zoneWidth = width / 3;
  return Math.abs(a.centerX - b.centerX) <= zoneWidth * 0.2;
}

export function assignZones({
  poses,
  width,
  now,
  state,
  anchorX,
  holdFrames = 3,
  switchMargin = 0.12,
  missingTimeoutMs = 2000,
}: ZoningParams): ZoningState {
  const grouped: Record<ZoneId, ZonePoseCandidate[]> = {
    left: [],
    middle: [],
    right: [],
  };

  poses.forEach((pose) => {
    grouped[zoneForX(pose.centerX, width)].push(pose);
  });

  const next: ZoningState = {
    occupants: {
      left: null,
      middle: null,
      right: null,
    },
  };

  for (const zone of ZONES) {
    const candidates = grouped[zone];
    const best =
      candidates.length === 0
        ? null
        : anchorX?.[zone] !== null && anchorX?.[zone] !== undefined
          ? candidates
              .slice()
              .sort((a, b) => {
                const distDiff = Math.abs(a.centerX - (anchorX?.[zone] ?? 0)) - Math.abs(b.centerX - (anchorX?.[zone] ?? 0));
                if (distDiff === 0) {
                  return b.score - a.score;
                }
                return distDiff;
              })[0]
          : candidates.slice().sort((a, b) => b.score - a.score)[0];
    const current = state.occupants[zone];

    if (!best) {
      if (!current) {
        next.occupants[zone] = null;
        continue;
      }

      const missingSince = current.missingSince ?? now;
      if (now - missingSince <= missingTimeoutMs) {
        next.occupants[zone] = {
          ...current,
          missingSince,
        };
      } else {
        next.occupants[zone] = null;
      }
      continue;
    }

    if (!current) {
      next.occupants[zone] = {
        ...best,
        lastSeenAt: now,
        missingSince: null,
        pendingSwitchFrames: 0,
      };
      continue;
    }

    if (current.missingSince && now - current.missingSince > missingTimeoutMs) {
      next.occupants[zone] = {
        ...best,
        lastSeenAt: now,
        missingSince: null,
        pendingSwitchFrames: 0,
      };
      continue;
    }

    if (isSameOccupant(current, best, width)) {
      next.occupants[zone] = {
        ...current,
        ...best,
        lastSeenAt: now,
        missingSince: null,
        pendingSwitchFrames: 0,
      };
      continue;
    }

    if (best.score >= current.score + switchMargin) {
      const pendingSwitchFrames = current.pendingSwitchFrames + 1;
      if (pendingSwitchFrames >= holdFrames) {
        next.occupants[zone] = {
          ...best,
          lastSeenAt: now,
          missingSince: null,
          pendingSwitchFrames: 0,
        };
      } else {
        next.occupants[zone] = {
          ...current,
          pendingSwitchFrames,
          missingSince: null,
        };
      }
      continue;
    }

    next.occupants[zone] = {
      ...current,
      missingSince: null,
      pendingSwitchFrames: 0,
      lastSeenAt: now,
    };
  }

  return next;
}
