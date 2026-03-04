import { useAppStore } from '../../state/store';
import type { LaneRoleState } from '../../game/arrangement';
import type { ZoneId } from '../../types';
import { LaneCard } from './LaneCard';

const ZONES: ZoneId[] = ['left', 'middle', 'right'];

interface LaneBarProps {
  lanePlayable: Record<ZoneId, boolean>;
  roleStates: Record<ZoneId, LaneRoleState>;
}

export function LaneBar({ lanePlayable, roleStates }: LaneBarProps) {
  const lanes = useAppStore((s) => s.lanes);

  return (
    <footer className="lane-bar">
      {ZONES.map((zone) => (
        <LaneCard
          key={zone}
          zone={zone}
          lane={lanes[zone]}
          lanePlayable={lanePlayable[zone]}
          roleState={roleStates[zone]}
        />
      ))}
    </footer>
  );
}
