import { useAppStore } from '../../state/store';
import type { LaneInstrument, ZoneId } from '../../types';

interface SetupScreenProps {
  onStartSession: () => void;
}

const ZONE_LABELS: Record<ZoneId, string> = {
  left: 'Left Lane',
  middle: 'Middle Lane',
  right: 'Right Lane',
};

const INSTRUMENT_OPTIONS: Array<{ value: LaneInstrument; label: string }> = [
  { value: 'rhythm', label: 'Rhythm' },
  { value: 'bass', label: 'Bass' },
  { value: 'pad', label: 'Pad / Chords' },
];

export function SetupScreen({ onStartSession }: SetupScreenProps) {
  const lanes = useAppStore((state) => state.lanes);
  const jamDurationSec = useAppStore((state) => state.jamDurationSec);
  const setJamDuration = useAppStore((state) => state.setJamDuration);
  const setLaneInstrument = useAppStore((state) => state.setLaneInstrument);

  return (
    <section className="phase-screen setup-screen" aria-label="Setup Screen">
      <div className="phase-card">
        <p className="phase-kicker">AI Garage Band</p>
        <h1 className="phase-title">Session Setup</h1>
        <p className="phase-copy">
          Pick instruments for each lane and lock the run format. Selections stay fixed once session starts.
        </p>

        <div className="setup-lane-grid">
          {(['left', 'middle', 'right'] as ZoneId[]).map((zone) => (
            <label key={zone} className={`setup-lane-card setup-lane-card--${zone}`}>
              <span className="setup-lane-label">{ZONE_LABELS[zone]}</span>
              <select
                aria-label={ZONE_LABELS[zone]}
                value={lanes[zone].instrument}
                onChange={(event) => setLaneInstrument(zone, event.currentTarget.value as LaneInstrument)}
              >
                {INSTRUMENT_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          ))}
        </div>

        <label className="setup-duration">
          <span>Jam Duration</span>
          <select
            aria-label="Jam Duration"
            value={String(jamDurationSec)}
            onChange={(event) => setJamDuration(Number(event.currentTarget.value) as 60 | 90)}
          >
            <option value="60">60 seconds</option>
            <option value="90">90 seconds</option>
          </select>
        </label>

        <button type="button" className="phase-cta" onClick={onStartSession}>
          Start Session
        </button>
      </div>
    </section>
  );
}
