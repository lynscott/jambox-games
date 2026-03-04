import { useAppStore } from '../state/store';
import type { Quantization } from '../types';

interface ControlsProps {
  onToggleSession: () => void;
}

const QUANTIZATION_OPTIONS: Array<{ label: string; value: Quantization }> = [
  { label: '1/4', value: '4n' },
  { label: '1/8', value: '8n' },
  { label: '1/16', value: '16n' },
];

export function Controls({ onToggleSession }: ControlsProps) {
  const isSessionRunning = useAppStore((state) => state.isSessionRunning);
  const bpm = useAppStore((state) => state.bpm);
  const quantization = useAppStore((state) => state.quantization);
  const showSkeleton = useAppStore((state) => state.showSkeleton);
  const conductorEnabled = useAppStore((state) => state.conductorEnabled);
  const isCalibrating = useAppStore((state) => state.isCalibrating);
  const setBpm = useAppStore((state) => state.setBpm);
  const setQuantization = useAppStore((state) => state.setQuantization);
  const setShowSkeleton = useAppStore((state) => state.setShowSkeleton);
  const setConductorEnabled = useAppStore((state) => state.setConductorEnabled);
  const requestCalibration = useAppStore((state) => state.requestCalibration);

  return (
    <section className="controls-panel" aria-label="Controls">
      <button type="button" onClick={onToggleSession}>
        {isSessionRunning ? 'Stop' : 'Start'}
      </button>

      <label>
        BPM
        <input
          aria-label="BPM"
          type="number"
          min={80}
          max={140}
          value={bpm}
          onChange={(event) => setBpm(Number(event.currentTarget.value))}
        />
      </label>

      <label>
        Quantization
        <select
          aria-label="Quantization"
          value={quantization}
          onChange={(event) => setQuantization(event.currentTarget.value as Quantization)}
        >
          {QUANTIZATION_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>

      <label>
        Skeleton
        <input
          aria-label="Skeleton"
          type="checkbox"
          checked={showSkeleton}
          onChange={(event) => setShowSkeleton(event.currentTarget.checked)}
        />
      </label>

      <label>
        Guide Beat
        <input
          aria-label="Guide Beat"
          type="checkbox"
          checked={conductorEnabled}
          onChange={(event) => setConductorEnabled(event.currentTarget.checked)}
        />
      </label>

      <button type="button" onClick={requestCalibration} disabled={isCalibrating}>
        {isCalibrating ? 'Calibrating...' : 'Calibrate'}
      </button>
    </section>
  );
}
