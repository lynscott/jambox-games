import type { LoopArrangement } from '../../game/arrangement';
import { useAppStore } from '../../state/store';
import type { LaneInstrument, ZoneId } from '../../types';

const ZONES: ZoneId[] = ['left', 'middle', 'right'];
const BAR_COUNT = 8;

const INSTRUMENT_LABEL: Record<LaneInstrument, string> = {
  drums: 'Drums',
  bass: 'Bass',
  keys: 'Keys',
};

interface TrackTimelineProps {
  arrangement: LoopArrangement;
  strikeWindowActive: boolean;
}

function barActiveForZone(barIndex: number, zone: ZoneId, soloZone: ZoneId): boolean {
  if (barIndex < 4) {
    return true;
  }

  if (barIndex < 6) {
    return zone === soloZone;
  }

  return true;
}

export function TrackTimeline({ arrangement, strikeWindowActive }: TrackTimelineProps) {
  const lanes = useAppStore((state) => state.lanes);

  return (
    <section className="track-timeline" aria-label="Loop Track">
      <div className="track-timeline__header">
        <h2>Loop Track</h2>
        <p>
          {arrangement.callout} • Bar {arrangement.barInCycle + 1} of {BAR_COUNT}
        </p>
      </div>

      {ZONES.map((zone) => {
        const lane = lanes[zone];
        const laneActive = arrangement.activeZones[zone];

        return (
          <div key={zone} className="track-row">
            <div className="track-row__label">
              <span className="track-row__zone">{zone.toUpperCase()}</span>
              <span className="track-row__instrument">{INSTRUMENT_LABEL[lane.instrument]}</span>
            </div>

            <div className="track-row__bars">
              {Array.from({ length: BAR_COUNT }).map((_, barIndex) => {
                const activeInBar = barActiveForZone(barIndex, zone, arrangement.cycleSoloZone);
                const isCurrentBar = barIndex === arrangement.barInCycle;

                return (
                  <span
                    key={barIndex}
                    className={`track-row__bar${
                      activeInBar ? ' track-row__bar--active' : ''
                    }${isCurrentBar ? ' track-row__bar--current' : ''}`}
                    aria-hidden="true"
                  />
                );
              })}

              <span
                className="track-row__playhead"
                style={{ left: `${Math.min(99.5, arrangement.cycleProgress * 100)}%` }}
                aria-hidden="true"
              />
            </div>

            <div
              className={`track-row__status${laneActive ? ' track-row__status--play' : ''}${
                laneActive && strikeWindowActive ? ' track-row__status--hit' : ''
              }`}
            >
              {laneActive ? (strikeWindowActive ? 'HIT' : 'PLAY') : 'WAIT'}
            </div>
          </div>
        );
      })}
    </section>
  );
}
