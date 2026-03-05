import type { ReactNode } from 'react';
import type { LoopArrangement } from '../../game/arrangement';
import { TopHUD } from '../jam/TopHUD';
import { LaneBar } from '../jam/LaneBar';
import { GearMenu } from '../jam/GearMenu';

interface JamScreenProps {
  onToggleSession: () => void;
  arrangement: LoopArrangement;
  sectionCallout: string;
  nextSectionCallout: string | null;
  countdownSecond: number | null;
  trackView?: ReactNode;
  children: ReactNode; // camera + overlay
}

export function JamScreen({
  onToggleSession,
  arrangement,
  sectionCallout,
  nextSectionCallout,
  countdownSecond,
  trackView,
  children,
}: JamScreenProps) {
  const sectionPreview = nextSectionCallout ? (
    <div className="section-banner" aria-label="Section Preview">
      <span className="section-banner__current">{sectionCallout}</span>
      <span className="section-banner__next">{nextSectionCallout}</span>
    </div>
  ) : null;

  return (
    <section className="phase-screen jam-screen" aria-label="Jam Screen">
      <TopHUD sectionCallout={sectionCallout} nextSectionCallout={nextSectionCallout} />

      {sectionPreview}

      <div className="jam-stage">
        {children}
        {trackView}
        {countdownSecond !== null ? (
          <div
            className={`jam-countdown${countdownSecond <= 3 ? ' jam-countdown--critical' : ''}`}
            aria-label="Countdown Warning"
          >
            {countdownSecond}
          </div>
        ) : null}
        <GearMenu onToggleSession={onToggleSession} />
      </div>

      <LaneBar lanePlayable={arrangement.activeZones} roleStates={arrangement.roleStates} />
    </section>
  );
}
