export interface GarageBandInstruments {
  triggerKick: (time: number, velocity?: number) => void;
  triggerSnare: (time: number, velocity?: number) => void;
  triggerHat: (time: number, velocity?: number) => void;
  triggerBass: (note: string, time: number, velocity?: number) => void;
  triggerPad: (notes: string[], time: number, velocity?: number, filterCutoff?: number) => void;
  dispose: () => void;
}

export async function createInstruments(): Promise<GarageBandInstruments> {
  const Tone = await import('tone');

  const kick = new Tone.MembraneSynth({
    pitchDecay: 0.03,
    octaves: 4,
    envelope: { attack: 0.001, decay: 0.45, sustain: 0, release: 0.25 },
  }).toDestination();

  const snare = new Tone.NoiseSynth({
    noise: { type: 'white' },
    envelope: { attack: 0.001, decay: 0.18, sustain: 0 },
  }).toDestination();

  const hat = new Tone.MetalSynth({
    frequency: 220,
    envelope: { attack: 0.001, decay: 0.08, release: 0.01 },
    harmonicity: 5.1,
    modulationIndex: 32,
    resonance: 1000,
    octaves: 1.5,
  }).toDestination();

  const bass = new Tone.MonoSynth({
    oscillator: { type: 'square' },
    filter: { Q: 2, type: 'lowpass', rolloff: -24 },
    envelope: { attack: 0.01, decay: 0.2, sustain: 0.2, release: 0.3 },
  }).toDestination();

  const padFilter = new Tone.Filter(1200, 'lowpass').toDestination();
  const pad = new Tone.PolySynth(Tone.Synth, {
    oscillator: { type: 'triangle' },
    envelope: { attack: 0.2, decay: 0.4, sustain: 0.4, release: 0.8 },
  }).connect(padFilter);

  return {
    triggerKick: (time, velocity = 0.85) => kick.triggerAttackRelease('C1', '8n', time, velocity),
    triggerSnare: (time, velocity = 0.5) => snare.triggerAttackRelease('16n', time, velocity),
    triggerHat: (time, velocity = 0.3) => hat.triggerAttackRelease('16n', time, velocity),
    triggerBass: (note, time, velocity = 0.55) => bass.triggerAttackRelease(note, '8n', time, velocity),
    triggerPad: (notes, time, velocity = 0.3, filterCutoff = 1200) => {
      padFilter.frequency.rampTo(filterCutoff, 0.05, time);
      pad.triggerAttackRelease(notes, '2n', time, velocity);
    },
    dispose: () => {
      kick.dispose();
      snare.dispose();
      hat.dispose();
      bass.dispose();
      pad.dispose();
      padFilter.dispose();
    },
  };
}
