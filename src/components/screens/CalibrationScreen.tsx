import type { ReactNode } from 'react';
import type { ZoneId } from '../../types';

interface CalibrationScreenProps {
  locks: Record<ZoneId, number | null>;
  isCalibrating: boolean;
  onRecalibrate: () => void;
  onContinue: () => void;
  onSkip: () => void;
  children?: ReactNode;
}

const ZONE_LABELS: Record<ZoneId, string> = {
  left: 'Left',
  middle: 'Middle',
  right: 'Right',
};

export function CalibrationScreen({
  locks,
  isCalibrating,
  onRecalibrate,
  onContinue,
  onSkip,
  children,
}: CalibrationScreenProps) {
  const allLocked = (['left', 'middle', 'right'] as ZoneId[]).every((zone) => locks[zone] !== null);

  return (
    <section className="phase-screen calibration-screen" aria-label="Calibration Screen">
      {children ? <div className="phase-live-preview">{children}</div> : null}
      <div className="phase-card calibration-card">
        <p className="phase-kicker">Calibration</p>
        <h1 className="phase-title">Stand In Your Lane</h1>
        <p className="phase-copy">
          Raise both hands for 2 seconds in each lane. Keep bodies separated until all lanes lock.
        </p>

        <div className="calibration-grid">
          {(['left', 'middle', 'right'] as ZoneId[]).map((zone) => {
            const locked = locks[zone] !== null;
            return (
              <div key={zone} className={`calibration-lane${locked ? ' calibration-lane--locked' : ''}`}>
                <span className="calibration-lane__name">{ZONE_LABELS[zone]}</span>
                <span className={`calibration-lane__state${locked ? ' calibration-lane__state--locked' : ''}`}>
                  {locked ? 'Locked' : 'Searching'}
                </span>
              </div>
            );
          })}
        </div>

        <div className="phase-actions">
          <button type="button" className="phase-action" onClick={onRecalibrate}>
            {isCalibrating ? 'Calibrating...' : 'Retry Calibration'}
          </button>
          <button type="button" className="phase-action phase-action--primary" onClick={onContinue}>
            {allLocked ? 'Continue' : 'Continue (Unverified)'}
          </button>
          <button type="button" className="phase-action" onClick={onSkip}>
            Skip
          </button>
        </div>
      </div>
    </section>
  );
}
