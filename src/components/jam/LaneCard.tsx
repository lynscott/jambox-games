import type { LaneState, ZoneId } from '../../types';

const INSTRUMENT_CONFIG = {
  drums: { icon: '\uD83E\uDD41', name: 'Drums', hint: 'Quick wrist strikes', cssClass: 'drums' },
  bass: { icon: '\uD83C\uDFB8', name: 'Bass', hint: 'Hold, then pulse', cssClass: 'bass' },
  keys: { icon: '\uD83C\uDFB9', name: 'Keys Pad', hint: 'Hold both hands up', cssClass: 'pad' },
};

interface LaneCardProps {
  zone: ZoneId;
  lane: LaneState;
  lanePlayable: boolean;
}

const STATUS_LABELS = {
  no_player: 'NO PLAYER',
  get_ready: 'GET READY',
  hold: 'HOLD',
  hit: 'HIT',
  sustain: 'SUSTAIN',
} as const;

export function LaneCard({ zone, lane, lanePlayable }: LaneCardProps) {
  const config = INSTRUMENT_CONFIG[lane.instrument];
  const activityPct = Math.min(100, Math.round(lane.activity * 100));
  const cue = STATUS_LABELS[lane.status];
  const hitActive = lane.status === 'hit';
  const cueActive = lane.status !== 'no_player';

  return (
    <div
      className={`lane-card lane-card--${config.cssClass}${
        lane.occupied ? '' : ' lane-card--empty'
      }${lanePlayable ? '' : ' lane-card--inactive'}`}
    >
      <div className="lane-card__header">
        <span className="lane-card__icon">{config.icon}</span>
        <span className="lane-card__name">{zone.toUpperCase()}: {config.name}</span>
        <span
          className={`lane-card__cue${cueActive ? ' lane-card__cue--active' : ''}${
            hitActive ? ' lane-card__cue--hit' : ''
          }`}
        >
          {cue}
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
