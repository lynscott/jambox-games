import type { ReactNode } from 'react';
import { TRACK_PRESETS } from '../../music/tracks';
import { useAppStore } from '../../state/store';
import type { LaneState, ZoneId } from '../../types';

interface TutorialScreenProps {
  beatsCompleted: number;
  beatsTarget: number;
  laneConfirmed: Record<ZoneId, boolean>;
  lanes: Record<ZoneId, LaneState>;
  onStartJam: () => void;
  children?: ReactNode;
}

export function TutorialScreen({
  beatsCompleted,
  beatsTarget,
  laneConfirmed,
  lanes,
  onStartJam,
  children,
}: TutorialScreenProps) {
  const currentTrackId = useAppStore((state) => state.currentTrackId);
  const track = TRACK_PRESETS[currentTrackId];

  return (
    <section className="phase-screen tutorial-screen" aria-label="Tutorial Screen">
      {children ? <div className="phase-live-preview">{children}</div> : null}
      <div className="phase-card tutorial-card">
        <p className="phase-kicker">Tutorial</p>
        <h1 className="phase-title">Hit The Groove</h1>
        <p className="phase-copy">
          Trigger all lanes at least once while the 8-beat coach runs.
        </p>

        <div className="tutorial-progress">{beatsCompleted} / {beatsTarget} Beats</div>

        <div className="tutorial-lanes">
          {(['left', 'middle', 'right'] as ZoneId[]).map((zone) => {
            const instrument = lanes[zone].instrument;
            const confirmed = laneConfirmed[zone];
            return (
              <div key={zone} className={`tutorial-lane${confirmed ? ' tutorial-lane--confirmed' : ''}`}>
                <p className="tutorial-lane__title">{zone.toUpperCase()}</p>
                <p className="tutorial-lane__instrument">{track.laneInstruments[zone]}</p>
                <p className="tutorial-lane__hint">{track.tutorialHints[instrument]}</p>
                <p className="tutorial-lane__status">{confirmed ? 'Confirmed' : 'Waiting'}</p>
              </div>
            );
          })}
        </div>

        <button type="button" className="phase-cta" onClick={onStartJam}>
          Start Jam Now
        </button>
      </div>
    </section>
  );
}
