export const VERZUZ_CATEGORIES = [
  'Love',
  'Trap',
  'Diss / FU Songs',
  'College Anthems',
  'West Coast Anthems',
  'Down South Anthems',
  'New York Anthems',
  'Weather',
  'Freak / Freaky',
  'Money',
  'Boy Bands',
  'Girl Groups',
  "90s R&B Hits",
  'Afrobeats',
  'Reggae / Dancehall',
  'Sex',
  'Birthday',
  'Crazy',
  'Shorty',
  'Cars',
  'Best Remix Songs',
  'Best Collaboration',
  'One Hit Wonders',
  'Dance Craze Songs',
  'Sing Along',
  'Female Rappers',
  "90s Hip Hop Hits",
  'Rap Groups',
  'Best Sample / Remake',
  'Artist Catalog',
  'Pop Songs',
  'Gospel Songs',
  'Rich',
  'Christmas Songs',
  "Niggas Ain't Shit",
  'Heartbreak',
  'Go-Go Bands',
  'Color',
] as const;

export type VerzuzCategory = (typeof VERZUZ_CATEGORIES)[number];

export interface VerzuzPlayer {
  name: string;
}

export interface VerzuzRoundResult {
  round: number;
  category: string;
  winner: 'player1' | 'player2' | 'tie';
}

export function buildVerzuzRoundDeck(categories: string[], roundCount: number): string[] {
  const safeCategories = categories.length > 0 ? categories : ['Best Collaboration'];
  return Array.from({ length: roundCount }, (_, index) => safeCategories[index % safeCategories.length]);
}
