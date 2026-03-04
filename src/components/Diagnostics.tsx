import { useAppStore } from '../state/store';

function safeNumber(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

export function Diagnostics() {
  const diagnostics = useAppStore((state) => state.diagnostics);
  const lanes = useAppStore((state) => state.lanes);

  return (
    <aside className="diagnostics-panel" aria-label="Diagnostics">
      <h2>Diagnostics</h2>
      <p>FPS: {safeNumber(diagnostics.fps).toFixed(1)}</p>
      <p>Inference: {safeNumber(diagnostics.inferenceMs).toFixed(1)}ms</p>
      <p>Track: {diagnostics.trackTitle}</p>
      <p>Chord: {diagnostics.currentChord}</p>
      <p>Persons: {diagnostics.personCount}</p>
      <p>Left: {lanes.left.occupied ? 'occupied' : 'empty'} / {lanes.left.status} / {diagnostics.gesturePhase.left}</p>
      <p>Middle: {lanes.middle.occupied ? 'occupied' : 'empty'} / {lanes.middle.status} / {diagnostics.gesturePhase.middle}</p>
      <p>Right: {lanes.right.occupied ? 'occupied' : 'empty'} / {lanes.right.status} / {diagnostics.gesturePhase.right}</p>
      <p>Left energy: {safeNumber(diagnostics.zoneEnergy.left).toFixed(2)}</p>
      <p>Middle energy: {safeNumber(diagnostics.zoneEnergy.middle).toFixed(2)}</p>
      <p>Right energy: {safeNumber(diagnostics.zoneEnergy.right).toFixed(2)}</p>
      <p>Motion to audio: {safeNumber(diagnostics.movementToAudioMs).toFixed(1)}ms</p>
    </aside>
  );
}
