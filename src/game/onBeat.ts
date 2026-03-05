export type OnBeatDifficulty = 'level1' | 'level2' | 'level3';

export interface OnBeatPrompt {
  emoji: string;
  word: string;
  category: 'animal' | 'shape' | 'food' | 'color' | 'object';
}

export interface OnBeatDifficultyConfig {
  id: OnBeatDifficulty;
  label: string;
  bpm: number;
  perfectWindowMs: number;
  okayWindowMs: number;
  rounds: OnBeatPrompt[][];
}

export interface OnBeatJudgement {
  prompt: OnBeatPrompt;
  grade: 'perfect' | 'good' | 'miss';
  offsetMs: number | null;
}

export interface OnBeatResultSummary {
  difficulty: OnBeatDifficulty;
  score: number;
  perfectHits: number;
  goodHits: number;
  misses: number;
  roundCount: number;
  promptsPerRound: number;
  totalPrompts: number;
  judgements: OnBeatJudgement[];
}

export const ON_BEAT_FIXED_BPM = 91.5;
export const ON_BEAT_BREAK_START_MS = 2_000;
export const ON_BEAT_FIRST_ROUND_START_MS = 2_800;
export const ON_BEAT_ROUNDS_PER_DIFFICULTY = 4;
export const ON_BEAT_ACTIVE_ROUND_COUNT = 3;

const CAT: OnBeatPrompt = { emoji: '🐱', word: 'Cat', category: 'animal' };
const HAT: OnBeatPrompt = { emoji: '🎩', word: 'Hat', category: 'object' };
const BAT: OnBeatPrompt = { emoji: '🦇', word: 'Bat', category: 'animal' };
const STAR: OnBeatPrompt = { emoji: '⭐', word: 'Star', category: 'shape' };
const CAR: OnBeatPrompt = { emoji: '🚗', word: 'Car', category: 'object' };
const JAR: OnBeatPrompt = { emoji: '🫙', word: 'Jar', category: 'object' };
const DOG: OnBeatPrompt = { emoji: '🐶', word: 'Dog', category: 'animal' };
const FROG: OnBeatPrompt = { emoji: '🐸', word: 'Frog', category: 'animal' };
const LOG: OnBeatPrompt = { emoji: '🪵', word: 'Log', category: 'object' };
const MOON: OnBeatPrompt = { emoji: '🌙', word: 'Moon', category: 'object' };
const SPOON: OnBeatPrompt = { emoji: '🥄', word: 'Spoon', category: 'object' };
const BALLOON: OnBeatPrompt = { emoji: '🎈', word: 'Balloon', category: 'object' };
const BOAT: OnBeatPrompt = { emoji: '⛵', word: 'Boat', category: 'object' };
const GOAT: OnBeatPrompt = { emoji: '🐐', word: 'Goat', category: 'animal' };
const COAT: OnBeatPrompt = { emoji: '🧥', word: 'Coat', category: 'object' };
const SUN: OnBeatPrompt = { emoji: '☀️', word: 'Sun', category: 'object' };
const BUN: OnBeatPrompt = { emoji: '🍔', word: 'Bun', category: 'food' };
const DRUM: OnBeatPrompt = { emoji: '🥁', word: 'Drum', category: 'object' };

const LEVEL_ONE_ROUNDS: OnBeatPrompt[][] = [
  [CAT, HAT, BAT, CAT, STAR, CAR, JAR, STAR],
  [DOG, FROG, LOG, DOG, BOAT, GOAT, COAT, BOAT],
  [MOON, SPOON, BALLOON, MOON, SUN, BUN, DRUM, SUN],
  [CAT, HAT, BAT, CAT, STAR, CAR, JAR, STAR],
];

const LEVEL_TWO_ROUNDS: OnBeatPrompt[][] = [
  [DOG, FROG, LOG, DOG, BOAT, GOAT, COAT, BOAT],
  [SUN, BUN, DRUM, SUN, STAR, CAR, JAR, STAR],
  [MOON, SPOON, BALLOON, MOON, CAT, HAT, BAT, CAT],
  [BOAT, GOAT, COAT, BOAT, DOG, FROG, LOG, DOG],
];

const LEVEL_THREE_ROUNDS: OnBeatPrompt[][] = [
  [MOON, SPOON, BALLOON, MOON, BOAT, GOAT, COAT, BOAT],
  [CAT, HAT, BAT, CAT, DOG, FROG, LOG, DOG],
  [SUN, BUN, DRUM, SUN, STAR, CAR, JAR, STAR],
  [STAR, CAR, JAR, STAR, BOAT, GOAT, COAT, BOAT],
];

export const ON_BEAT_DIFFICULTIES: OnBeatDifficultyConfig[] = [
  {
    id: 'level1',
    label: 'Level 1',
    bpm: ON_BEAT_FIXED_BPM,
    perfectWindowMs: 100,
    okayWindowMs: 250,
    rounds: LEVEL_ONE_ROUNDS,
  },
  {
    id: 'level2',
    label: 'Level 2',
    bpm: ON_BEAT_FIXED_BPM,
    perfectWindowMs: 90,
    okayWindowMs: 225,
    rounds: LEVEL_TWO_ROUNDS,
  },
  {
    id: 'level3',
    label: 'Level 3',
    bpm: ON_BEAT_FIXED_BPM,
    perfectWindowMs: 75,
    okayWindowMs: 200,
    rounds: LEVEL_THREE_ROUNDS,
  },
];

export function getOnBeatDifficulty(id: OnBeatDifficulty) {
  return ON_BEAT_DIFFICULTIES.find((difficulty) => difficulty.id === id) || ON_BEAT_DIFFICULTIES[0];
}

export function computeOnBeatScore(grade: OnBeatJudgement['grade']) {
  if (grade === 'perfect') {
    return 2;
  }

  if (grade === 'good') {
    return 1;
  }

  return 0;
}
