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

const CAT: OnBeatPrompt = { emoji: '🐱', word: 'Cat', category: 'animal' };
const HAT: OnBeatPrompt = { emoji: '🎩', word: 'Hat', category: 'object' };
const BAT: OnBeatPrompt = { emoji: '🦇', word: 'Bat', category: 'animal' };
const STAR: OnBeatPrompt = { emoji: '⭐', word: 'Star', category: 'shape' };
const CAR: OnBeatPrompt = { emoji: '🚗', word: 'Car', category: 'object' };
const JAR: OnBeatPrompt = { emoji: '🫙', word: 'Jar', category: 'object' };
const BEE: OnBeatPrompt = { emoji: '🐝', word: 'Bee', category: 'animal' };
const TREE: OnBeatPrompt = { emoji: '🌳', word: 'Tree', category: 'object' };
const KEY: OnBeatPrompt = { emoji: '🔑', word: 'Key', category: 'object' };
const CLOCK: OnBeatPrompt = { emoji: '🕒', word: 'Clock', category: 'object' };
const ROCK: OnBeatPrompt = { emoji: '🪨', word: 'Rock', category: 'object' };
const SOCK: OnBeatPrompt = { emoji: '🧦', word: 'Sock', category: 'object' };
const MOON: OnBeatPrompt = { emoji: '🌙', word: 'Moon', category: 'object' };
const SPOON: OnBeatPrompt = { emoji: '🥄', word: 'Spoon', category: 'object' };
const BALLOON: OnBeatPrompt = { emoji: '🎈', word: 'Balloon', category: 'object' };
const PHONE: OnBeatPrompt = { emoji: '📱', word: 'Phone', category: 'object' };
const CONE: OnBeatPrompt = { emoji: '🍦', word: 'Cone', category: 'food' };
const BONE: OnBeatPrompt = { emoji: '🦴', word: 'Bone', category: 'object' };
const TRAIN: OnBeatPrompt = { emoji: '🚂', word: 'Train', category: 'object' };
const CHAIN: OnBeatPrompt = { emoji: '⛓️', word: 'Chain', category: 'object' };
const RAIN: OnBeatPrompt = { emoji: '🌧️', word: 'Rain', category: 'object' };
const BOAT: OnBeatPrompt = { emoji: '⛵', word: 'Boat', category: 'object' };
const GOAT: OnBeatPrompt = { emoji: '🐐', word: 'Goat', category: 'animal' };
const COAT: OnBeatPrompt = { emoji: '🧥', word: 'Coat', category: 'object' };

const LEVEL_ONE_ROUNDS: OnBeatPrompt[][] = [
  [CAT, HAT, BAT, CAT, STAR, CAR, JAR, STAR],
  [CAT, HAT, BAT, HAT, STAR, CAR, JAR, CAR],
  [CAT, BAT, HAT, CAT, STAR, JAR, CAR, JAR],
  [CAT, HAT, BAT, CAT, STAR, CAR, JAR, STAR],
];

const LEVEL_TWO_ROUNDS: OnBeatPrompt[][] = [
  [BEE, TREE, KEY, BEE, CLOCK, ROCK, SOCK, CLOCK],
  [BEE, KEY, TREE, BEE, CLOCK, SOCK, ROCK, CLOCK],
  [MOON, SPOON, BALLOON, MOON, PHONE, CONE, BONE, PHONE],
  [MOON, BALLOON, SPOON, MOON, PHONE, BONE, CONE, PHONE],
];

const LEVEL_THREE_ROUNDS: OnBeatPrompt[][] = [
  [MOON, SPOON, BALLOON, MOON, TRAIN, CHAIN, RAIN, TRAIN],
  [PHONE, CONE, BONE, PHONE, CLOCK, ROCK, SOCK, CLOCK],
  [BEE, TREE, KEY, BEE, CAT, HAT, BAT, CAT],
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
