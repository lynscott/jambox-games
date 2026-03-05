import type { ZoneId } from '../../types';

interface StageLaneOverlayProps {
  activeZones: Record<ZoneId, boolean>;
}

const ZONES: ZoneId[] = ['left', 'middle', 'right'];

export function StageLaneOverlay({ activeZones }: StageLaneOverlayProps) {
  return (
    <div className="stage-lane-overlay" aria-hidden="true">
      {ZONES.map((zone) => (
        <div
          key={zone}
          className={`stage-lane-overlay__lane stage-lane-overlay__lane--${zone}${
            activeZones[zone] ? '' : ' stage-lane-overlay__lane--inactive'
          }`}
        />
      ))}
    </div>
  );
}
