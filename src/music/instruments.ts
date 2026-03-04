export interface GarageBandInstruments {
  triggerKick: (time: number, velocity?: number) => void;
  triggerSnare: (time: number, velocity?: number) => void;
  triggerHat: (time: number, velocity?: number) => void;
  triggerBass: (note: string, time: number, velocity?: number) => void;
  triggerPad: (notes: string[], time: number, velocity?: number, filterCutoff?: number) => void;
  triggerWrong: (time: number, velocity?: number) => void;
  dispose: () => void;
}

export const MIDNIGHT_SOUL_PATCHES = {
  kick: {
    pitchDecay: 0.02,
    octaves: 2.6,
    envelope: { attack: 0.001, decay: 0.32, sustain: 0, release: 0.18 },
  },
  snare: {
    noise: { type: 'pink' as const },
    envelope: { attack: 0.001, decay: 0.13, sustain: 0, release: 0.08 },
  },
  hat: {
    oscillator: { type: 'triangle' as const },
    envelope: { attack: 0.001, decay: 0.035, sustain: 0, release: 0.03 },
  },
  bass: {
    oscillator: { type: 'triangle' as const },
    filter: { Q: 1.2, type: 'lowpass' as const, rolloff: -24 as const },
    envelope: { attack: 0.02, decay: 0.18, sustain: 0.25, release: 0.35 },
  },
  keys: {
    filterFrequency: 1400,
    oscillator: { type: 'triangle' as const },
    envelope: { attack: 0.08, decay: 0.45, sustain: 0.48, release: 1.4 },
  },
};

export function createRoundRobinVoicePool<T>(voices: T[]): () => T {
  if (voices.length === 0) {
    throw new Error('Voice pool must contain at least one voice');
  }

  let index = 0;
  return () => {
    const voice = voices[index];
    index = (index + 1) % voices.length;
    return voice;
  };
}

export async function createInstruments(): Promise<GarageBandInstruments> {
  const Tone = await import('tone');

  const kickVoices = Array.from({ length: 3 }, () =>
    new Tone.MembraneSynth(MIDNIGHT_SOUL_PATCHES.kick).toDestination(),
  );
  const nextKick = createRoundRobinVoicePool(kickVoices);

  const snareVoices = Array.from({ length: 3 }, () =>
    new Tone.NoiseSynth(MIDNIGHT_SOUL_PATCHES.snare).toDestination(),
  );
  const nextSnare = createRoundRobinVoicePool(snareVoices);

  const hatVoices = Array.from({ length: 4 }, () =>
    new Tone.Synth(MIDNIGHT_SOUL_PATCHES.hat).toDestination(),
  );
  const nextHat = createRoundRobinVoicePool(hatVoices);

  const wrongVoices = Array.from({ length: 2 }, () =>
    new Tone.Synth({
      oscillator: { type: 'triangle' as const },
      envelope: { attack: 0.001, decay: 0.08, sustain: 0, release: 0.05 },
    }).toDestination(),
  );
  const nextWrong = createRoundRobinVoicePool(wrongVoices);

  const bassVoices = Array.from({ length: 2 }, () =>
    new Tone.MonoSynth(MIDNIGHT_SOUL_PATCHES.bass).toDestination(),
  );
  const nextBass = createRoundRobinVoicePool(bassVoices);

  const padFilter = new Tone.Filter(MIDNIGHT_SOUL_PATCHES.keys.filterFrequency, 'lowpass').toDestination();
  const pad = new Tone.PolySynth(Tone.Synth, {
    oscillator: MIDNIGHT_SOUL_PATCHES.keys.oscillator,
    envelope: MIDNIGHT_SOUL_PATCHES.keys.envelope,
  }).connect(padFilter);

  return {
    triggerKick: (time, velocity = 0.85) =>
      nextKick().triggerAttackRelease('C1', '8n', time, velocity),
    triggerSnare: (time, velocity = 0.5) =>
      nextSnare().triggerAttackRelease('16n', time, velocity),
    triggerHat: (time, velocity = 0.3) =>
      nextHat().triggerAttackRelease('C6', '16n', time, velocity),
    triggerBass: (note, time, velocity = 0.55) =>
      nextBass().triggerAttackRelease(note, '8n', time, velocity),
    triggerPad: (notes, time, velocity = 0.3, filterCutoff = MIDNIGHT_SOUL_PATCHES.keys.filterFrequency) => {
      padFilter.frequency.rampTo(filterCutoff, 0.05, time);
      pad.triggerAttackRelease(notes, '1n', time, velocity);
    },
    triggerWrong: (time, velocity = 0.5) => nextWrong().triggerAttackRelease('A1', '16n', time, velocity),
    dispose: () => {
      kickVoices.forEach((voice) => voice.dispose());
      snareVoices.forEach((voice) => voice.dispose());
      hatVoices.forEach((voice) => voice.dispose());
      wrongVoices.forEach((voice) => voice.dispose());
      bassVoices.forEach((voice) => voice.dispose());
      pad.dispose();
      padFilter.dispose();
    },
  };
}
