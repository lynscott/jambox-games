import { useAppStore } from '../state/store';

export function Diagnostics() {
  const diagnostics = useAppStore((state) => state.diagnostics);

  return (
    <aside className="diagnostics-panel" aria-label="Diagnostics">
      <h2>Diagnostics</h2>
      <p>FPS: {diagnostics.fps.toFixed(1)}</p>
      <p>Inference: {diagnostics.inferenceMs.toFixed(1)}ms</p>
      <p>Chord: {diagnostics.currentChord}</p>
      <p>Persons: {diagnostics.personCount}</p>
      <p>Left energy: {diagnostics.zoneEnergy.left.toFixed(2)}</p>
      <p>Middle energy: {diagnostics.zoneEnergy.middle.toFixed(2)}</p>
      <p>Right energy: {diagnostics.zoneEnergy.right.toFixed(2)}</p>
      <p>Motion to audio: {diagnostics.movementToAudioMs.toFixed(1)}ms</p>
    </aside>
  );
}
