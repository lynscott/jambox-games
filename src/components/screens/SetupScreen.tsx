import { TRACK_PRESETS } from '../../music/tracks';
import { useAppStore } from '../../state/store';
import type { LaneInstrument, ZoneId } from '../../types';

interface SetupScreenProps {
  onStartSession: () => void;
  onBackToMenu: () => void;
}

const ZONE_LABELS: Record<ZoneId, string> = {
  left: 'Left Lane',
  middle: 'Middle Lane',
  right: 'Right Lane',
};

const INSTRUMENT_OPTIONS: Array<{ value: LaneInstrument; label: string }> = [
  { value: 'drums', label: 'Drums' },
  { value: 'bass', label: 'Bass' },
  { value: 'keys', label: 'Keys Pad' },
];

export function SetupScreen({ onStartSession, onBackToMenu }: SetupScreenProps) {
  const currentTrackId = useAppStore((state) => state.currentTrackId);
  const lanes = useAppStore((state) => state.lanes);
  const jamDurationSec = useAppStore((state) => state.jamDurationSec);
  const selectedGame = useAppStore((state) => state.selectedGame);
  const setJamDuration = useAppStore((state) => state.setJamDuration);
  const setLaneInstrument = useAppStore((state) => state.setLaneInstrument);
  const track = TRACK_PRESETS[currentTrackId];
  const isVsSetup = selectedGame === 'vs';

  return (
    <section className="phase-screen setup-screen" aria-label="Setup Screen">
      <div className="phase-card">
        <p className="phase-kicker">Jam Box Games</p>
        <h1 className="phase-title">{isVsSetup ? 'Vs. Match Setup' : 'Jam Hero Setup'}</h1>
        <p className="phase-copy">
          {isVsSetup
            ? 'Lobby is already live. Keep the same room, assign prototype lanes, and start the first head-to-head round.'
            : 'Lobby is already live. Pick instruments for each lane and lock the run format before the jam starts.'}
        </p>

        <div className="setup-track">
          <p className="setup-track__label">Featured Track</p>
          <h2 className="setup-track__title">{track.title}</h2>
          <p className="setup-track__copy">{track.description}</p>
        </div>

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
          {isVsSetup ? 'Start Match' : 'Start Session'}
        </button>
        <button type="button" className="phase-action" onClick={onBackToMenu}>
          Back to Menu
        </button>
      </div>
    </section>
  );
}
