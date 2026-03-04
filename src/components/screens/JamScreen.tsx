import type { ReactNode } from 'react';
import type { LoopArrangement } from '../../game/arrangement';
import { TopHUD } from '../jam/TopHUD';
import { LaneBar } from '../jam/LaneBar';
import { TimingCallout } from '../jam/TimingCallout';
import { GearMenu } from '../jam/GearMenu';

interface JamScreenProps {
  onToggleSession: () => void;
  arrangement: LoopArrangement;
  countdownSecond: number | null;
  children: ReactNode; // camera + overlay
}

export function JamScreen({
  onToggleSession,
  arrangement,
  countdownSecond,
  children,
}: JamScreenProps) {
  return (
    <div className="jam-screen">
      <TopHUD sectionCallout={arrangement.callout} />

      <div className="jam-stage">
        {children}
        {countdownSecond !== null ? (
          <div
            className={`jam-countdown${countdownSecond <= 3 ? ' jam-countdown--critical' : ''}`}
            aria-label="Countdown Warning"
          >
            {countdownSecond}
          </div>
        ) : null}
        <TimingCallout />
        <GearMenu onToggleSession={onToggleSession} />
      </div>

      <LaneBar lanePlayable={arrangement.activeZones} />
    </div>
  );
}
