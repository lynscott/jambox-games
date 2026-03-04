import type { ScoreSnapshot, TimingGrade, ZoneId } from '../types';

// --- Timing windows (ms from nearest grid line) ---

const PERFECT_WINDOW_MS = 35;
const GOOD_WINDOW_MS = 80;
const LATE_WINDOW_MS = 150;

const GRADE_POINTS: Record<TimingGrade, number> = {
  perfect: 100,
  good: 60,
  late: 25,
  miss: 0,
};

// Combo: +0.5x every 5 streak, caps at 3x
const COMBO_TIER_SIZE = 5;
const COMBO_TIER_BONUS = 0.5;
const MAX_MULTIPLIER = 3;

// Consistency weights
const REGULARITY_WEIGHT = 0.5;
const BALANCE_WEIGHT = 0.25;
const COVERAGE_WEIGHT = 0.25;
const MAX_CONSISTENCY_BONUS = 500;

// Jitter rejection threshold
const JITTER_THRESHOLD_MS = 100;

// --- Scoring state (mutable, held by caller via ref) ---

export interface ScoringState {
  timingPoints: number;
  combo: number;
  maxCombo: number;
  hitTimestamps: number[];
  laneHits: Record<ZoneId, number>;
  jitterCount: number;
  lastHitAt: Record<ZoneId, number>;
  sessionStartMs: number;
  sessionEndMs: number;
}

export function createInitialScoringState(sessionStartMs: number = 0): ScoringState {
  return {
    timingPoints: 0,
    combo: 0,
    maxCombo: 0,
    hitTimestamps: [],
    laneHits: { left: 0, middle: 0, right: 0 },
    jitterCount: 0,
    lastHitAt: { left: -Infinity, middle: -Infinity, right: -Infinity },
    sessionStartMs,
    sessionEndMs: 0,
  };
}

// --- Grade a timing offset ---

export function gradeTimingMs(offsetMs: number): TimingGrade {
  const abs = Math.abs(offsetMs);
  if (abs <= PERFECT_WINDOW_MS) return 'perfect';
  if (abs <= GOOD_WINDOW_MS) return 'good';
  if (abs <= LATE_WINDOW_MS) return 'late';
  return 'miss';
}

// --- Compute multiplier from combo ---

function multiplierForCombo(combo: number): number {
  const tier = Math.floor(combo / COMBO_TIER_SIZE);
  return Math.min(1 + tier * COMBO_TIER_BONUS, MAX_MULTIPLIER);
}

// --- Apply a single event ---

export interface ScoringEvent {
  timestamp: number;
  zone: ZoneId;
  offsetMs: number; // ms from nearest grid line
}

export interface ApplyEventResult {
  grade: TimingGrade;
  points: number;
  multiplier: number;
  combo: number;
  jitterRejected: boolean;
}

export function applyEvent(
  state: ScoringState,
  event: ScoringEvent,
): ApplyEventResult {
  // Jitter check
  const timeSinceLast = event.timestamp - state.lastHitAt[event.zone];
  if (timeSinceLast < JITTER_THRESHOLD_MS) {
    state.jitterCount += 1;
    return {
      grade: 'miss',
      points: 0,
      multiplier: multiplierForCombo(state.combo),
      combo: state.combo,
      jitterRejected: true,
    };
  }

  state.lastHitAt[event.zone] = event.timestamp;

  const grade = gradeTimingMs(event.offsetMs);
  const basePoints = GRADE_POINTS[grade];

  // Combo logic
  if (grade === 'perfect' || grade === 'good') {
    state.combo += 1;
  } else if (grade === 'miss') {
    state.combo = 0;
  }
  // 'late' holds combo (no increment, no reset)

  state.maxCombo = Math.max(state.maxCombo, state.combo);

  const multiplier = multiplierForCombo(state.combo);
  const points = Math.round(basePoints * multiplier);

  state.timingPoints += points;
  state.hitTimestamps.push(event.timestamp);
  state.laneHits[event.zone] += 1;

  return { grade, points, multiplier, combo: state.combo, jitterRejected: false };
}

// --- Consistency calculation ---

export function computeConsistency(state: ScoringState, sessionDurationMs: number): number {
  const { hitTimestamps, laneHits, jitterCount } = state;
  const totalHits = hitTimestamps.length;

  if (totalHits < 2) return 0;

  // Regularity: stddev of inter-hit intervals (lower is better)
  const intervals: number[] = [];
  for (let i = 1; i < hitTimestamps.length; i++) {
    intervals.push(hitTimestamps[i] - hitTimestamps[i - 1]);
  }
  const meanInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
  const variance =
    intervals.reduce((sum, interval) => sum + (interval - meanInterval) ** 2, 0) / intervals.length;
  const stddev = Math.sqrt(variance);
  // Normalize: perfect regularity = 1.0, high variance = 0.0
  // Scale so stddev of 500ms maps to ~0, stddev of 0 maps to 1
  const regularity = Math.max(0, 1 - stddev / 500);

  // Balance: how evenly distributed hits are across lanes
  const laneValues = Object.values(laneHits) as number[];
  const activeLanes = laneValues.filter((v) => v > 0).length;
  let balance = 0;
  if (activeLanes >= 2) {
    const maxLane = Math.max(...laneValues);
    const minLane = Math.min(...laneValues.filter((v) => v > 0));
    balance = maxLane > 0 ? minLane / maxLane : 0;
  }

  // Coverage: hits spread across session timeline
  const sessionDuration = sessionDurationMs > 0 ? sessionDurationMs : 1;
  const bucketCount = 10;
  const bucketSize = sessionDuration / bucketCount;
  const buckets = new Set<number>();
  for (const ts of hitTimestamps) {
    const elapsed = ts - state.sessionStartMs;
    buckets.add(Math.min(Math.floor(elapsed / bucketSize), bucketCount - 1));
  }
  const coverage = buckets.size / bucketCount;

  // Jitter penalty: reduce score by proportion of rejected hits
  const jitterPenalty = totalHits > 0 ? Math.max(0, 1 - jitterCount / totalHits) : 1;

  const raw =
    regularity * REGULARITY_WEIGHT +
    balance * BALANCE_WEIGHT +
    coverage * COVERAGE_WEIGHT;

  return Math.round(raw * jitterPenalty * MAX_CONSISTENCY_BONUS);
}

// --- Final score computation ---

export function computeFinalScore(
  state: ScoringState,
  sessionDurationMs: number,
): ScoreSnapshot {
  const consistency = computeConsistency(state, sessionDurationMs);
  const comboBonus = state.maxCombo * 10;
  const total = state.timingPoints + consistency + comboBonus;

  return {
    total,
    timing: state.timingPoints,
    consistency,
    comboBonus,
    combo: state.combo,
    maxCombo: state.maxCombo,
    multiplier: multiplierForCombo(state.combo),
  };
}

// --- Compute offset from nearest grid line ---

export function computeOffsetMs(
  timestampMs: number,
  gridIntervalMs: number,
  sessionStartMs: number,
): number {
  const elapsed = timestampMs - sessionStartMs;
  const nearestGrid = Math.round(elapsed / gridIntervalMs) * gridIntervalMs;
  return elapsed - nearestGrid;
}
