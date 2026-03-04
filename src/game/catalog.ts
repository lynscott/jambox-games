import type { GamePhase, GameSelection } from '../types';

export interface GameCatalogEntry {
  id: GameSelection;
  title: string;
  shortDescription: string;
  detail: string;
  status: 'Available' | 'Coming Soon';
  accent: 'jam-hero' | 'vs' | 'on-beat' | 'lyrics';
  phase: Extract<GamePhase, 'setup' | 'vs_setup' | 'on_beat_setup' | 'lyrics_setup' | 'vs_placeholder'>;
}

export const GAME_CATALOG: GameCatalogEntry[] = [
  {
    id: 'jam_hero',
    title: 'Jam Hero',
    shortDescription: 'Move to the groove. Build score with rhythm and consistency.',
    detail: 'Full-body rhythm performance for 2-3 players in one frame.',
    status: 'Available',
    accent: 'jam-hero',
    phase: 'setup',
  },
  {
    id: 'vs',
    title: 'Vs.',
    shortDescription: 'Face off in a fast musical showdown.',
    detail: 'Song-for-song battle cards across genres, words, eras, and regional pride.',
    status: 'Available',
    accent: 'vs',
    phase: 'vs_setup',
  },
  {
    id: 'on_beat',
    title: 'On Beat',
    shortDescription: 'Lock into timing challenges and survive the tempo.',
    detail: 'Say the prompt exactly on beat against the Moo Ma Ga Gai challenge loop.',
    status: 'Available',
    accent: 'on-beat',
    phase: 'on_beat_setup',
  },
  {
    id: 'know_your_lyrics',
    title: 'Know Your Lyrics',
    shortDescription: 'Finish the line and prove your music memory.',
    detail: 'Sing, guess, and complete famous lyrics under pressure.',
    status: 'Available',
    accent: 'lyrics',
    phase: 'lyrics_setup',
  },
];

export function getGameById(gameId: GameSelection): GameCatalogEntry {
  const match = GAME_CATALOG.find((game) => game.id === gameId);
  if (!match) {
    throw new Error(`Unknown game selection: ${gameId}`);
  }
  return match;
}
