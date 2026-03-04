import type { LaneRoleState } from '../../game/arrangement';
import type { LaneState, ZoneId } from '../../types';

const INSTRUMENT_CONFIG = {
  drums: { icon: '🥁', name: 'Drums', hint: 'Quick wrist strikes', cssClass: 'drums' },
  bass: { icon: '🎸', name: 'Bass', hint: 'Hold, then pulse', cssClass: 'bass' },
  keys: { icon: '🎹', name: 'Keys Pad', hint: 'Hold both hands up', cssClass: 'pad' },
};

interface LaneCardProps {
  zone: ZoneId;
  lane: LaneState;
  lanePlayable: boolean;
  roleState: LaneRoleState;
}

const STATUS_LABELS = {
  no_player: 'NO PLAYER',
  get_ready: 'GET READY',
  hold: 'HOLD',
  hit: 'HIT',
  sustain: 'SUSTAIN',
} as const;

const ROLE_LABELS = {
  play: 'PLAY',
  wait: 'WAIT',
  up_next: 'UP NEXT',
} as const;

export function LaneCard({ zone, lane, lanePlayable, roleState }: LaneCardProps) {
  const config = INSTRUMENT_CONFIG[lane.instrument];
  const activityPct = Math.min(100, Math.round(lane.activity * 100));
  const cue = STATUS_LABELS[lane.status];
  const hitActive = lane.status === 'hit';
  const cueActive = lane.status !== 'no_player';
  const laneRole = lane.status === 'no_player' ? 'NO PLAYER' : ROLE_LABELS[roleState];

  return (
    <div
      className={`lane-card lane-card--${config.cssClass}${
        lane.occupied ? '' : ' lane-card--empty'
      }${lanePlayable ? '' : ' lane-card--inactive'} lane-card--role-${roleState}`}
    >
      <div className="lane-card__header">
        <span className="lane-card__icon">{config.icon}</span>
        <span className="lane-card__name">
          {zone.toUpperCase()}: {config.name}
        </span>
        <span
          className={`lane-card__cue${cueActive ? ' lane-card__cue--active' : ''}${
            hitActive ? ' lane-card__cue--hit' : ''
          }`}
        >
          {laneRole}
        </span>
      </div>

      <div className="lane-card__meter">
        <div className="lane-card__meter-fill" style={{ width: `${activityPct}%` }} />
      </div>

      <div className="lane-card__hint">{config.hint}</div>
      <div className="lane-card__substatus">{cue}</div>

      {lane.lastGrade && lane.status !== 'no_player' && (
        <div className={`lane-card__grade lane-card__grade--${lane.lastGrade}`}>
          {lane.lastGrade}
        </div>
      )}
    </div>
  );
}
