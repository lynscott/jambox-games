const NOTE_TO_SEMITONE: Record<string, number> = {
  C: 0,
  'C#': 1,
  D: 2,
  'D#': 3,
  E: 4,
  F: 5,
  'F#': 6,
  G: 7,
  'G#': 8,
  A: 9,
  'A#': 10,
  B: 11,
};

const SEMITONE_TO_NOTE = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

const CHORD_TONES: Record<string, string[]> = {
  Am: ['A', 'C', 'E'],
  F: ['F', 'A', 'C'],
  C: ['C', 'E', 'G'],
  G: ['G', 'B', 'D'],
};

const PROGRESSION = ['Am', 'F', 'C', 'G'];

function parseNote(note: string): { pitchClass: string; octave: number } {
  const match = note.match(/^([A-G]#?)(-?\d)$/);
  if (!match) {
    throw new Error(`Invalid note format: ${note}`);
  }
  return { pitchClass: match[1], octave: Number(match[2]) };
}

function toMidi(note: string): number {
  const { pitchClass, octave } = parseNote(note);
  return (octave + 1) * 12 + NOTE_TO_SEMITONE[pitchClass];
}

function fromMidi(midi: number): string {
  const semitone = midi % 12;
  const octave = Math.floor(midi / 12) - 1;
  return `${SEMITONE_TO_NOTE[semitone]}${octave}`;
}

function nearestMidi(target: number, candidates: number[]): number {
  return candidates
    .slice()
    .sort((a, b) => {
      const diff = Math.abs(a - target) - Math.abs(b - target);
      if (diff === 0) {
        return a - b;
      }
      return diff;
    })[0];
}

export interface Conductor {
  currentChord: () => string;
  advanceChord: () => string;
  constrainNoteToChord: (note: string) => string;
  getChordVoicing: (octave?: number) => string[];
  shouldAddFill: (globalEnergy: number, previousEnergy: number) => boolean;
  shouldSupportIdle: (zoneEnergy: number) => boolean;
}

export function createConductor(): Conductor {
  let chordIndex = 0;
  let fillCooldown = 0;

  return {
    currentChord: () => PROGRESSION[chordIndex],
    advanceChord: () => {
      chordIndex = (chordIndex + 1) % PROGRESSION.length;
      if (fillCooldown > 0) {
        fillCooldown -= 1;
      }
      return PROGRESSION[chordIndex];
    },
    constrainNoteToChord: (note: string) => {
      const baseMidi = toMidi(note);
      const tones = CHORD_TONES[PROGRESSION[chordIndex]];
      const octave = parseNote(note).octave;

      const candidates = tones.flatMap((tone) => {
        return [octave - 1, octave, octave + 1].map(
          (candidateOctave) => (candidateOctave + 1) * 12 + NOTE_TO_SEMITONE[tone],
        );
      });

      const midi = nearestMidi(baseMidi, candidates);
      return fromMidi(midi);
    },
    getChordVoicing: (octave = 4) => CHORD_TONES[PROGRESSION[chordIndex]].map((tone) => `${tone}${octave}`),
    shouldAddFill: (globalEnergy: number, previousEnergy: number) => {
      if (fillCooldown > 0) {
        return false;
      }
      const shouldFill = globalEnergy > 0.75 && globalEnergy - previousEnergy > 0.2;
      if (shouldFill) {
        fillCooldown = 2;
      }
      return shouldFill;
    },
    shouldSupportIdle: (zoneEnergy: number) => zoneEnergy < 0.08,
  };
}
