import type { LaneState, ZoneId } from '../../types';

const INSTRUMENT_CONFIG = {
  rhythm: { icon: '\uD83E\uDD41', name: 'Rhythm', hint: 'Quick wrist strikes', cssClass: 'drums' },
  bass: { icon: '\uD83C\uDFB8', name: 'Bass', hint: 'Move & shift angle', cssClass: 'bass' },
  pad: { icon: '\uD83C\uDFB9', name: 'Pad', hint: 'Raise arms, sway', cssClass: 'pad' },
};

interface LaneCardProps {
  zone: ZoneId;
  lane: LaneState;
  lanePlayable: boolean;
  strikeWindowActive: boolean;
}

export function LaneCard({ zone, lane, lanePlayable, strikeWindowActive }: LaneCardProps) {
  const config = INSTRUMENT_CONFIG[lane.instrument];
  const activityPct = Math.min(100, Math.round(lane.activity * 100));
  const hitActive = lanePlayable && strikeWindowActive;

  return (
    <div className={`lane-card lane-card--${config.cssClass}`}>
      <div className="lane-card__header">
        <span className="lane-card__icon">{config.icon}</span>
        <span className="lane-card__name">{zone.toUpperCase()}: {config.name}</span>
        <span
          className={`lane-card__cue${lanePlayable ? ' lane-card__cue--active' : ''}${
            hitActive ? ' lane-card__cue--hit' : ''
          }`}
        >
          {lanePlayable ? (hitActive ? 'HIT' : 'PLAY') : 'WAIT'}
        </span>
      </div>

      <div className="lane-card__meter">
        <div
          className="lane-card__meter-fill"
          style={{ width: `${activityPct}%` }}
        />
      </div>

      <div className="lane-card__hint">{config.hint}</div>

      {lane.lastGrade && (
        <div className={`lane-card__grade lane-card__grade--${lane.lastGrade}`}>
          {lane.lastGrade}
        </div>
      )}
    </div>
  );
}
