import type { ReactNode } from 'react';

interface PermissionsScreenProps {
  cameraReady: boolean;
  audioReady: boolean;
  isBusy: boolean;
  onRequestPermissions: () => void;
  children?: ReactNode;
}

export function PermissionsScreen({
  cameraReady,
  audioReady,
  isBusy,
  onRequestPermissions,
  children,
}: PermissionsScreenProps) {
  return (
    <section className="phase-screen permissions-screen" aria-label="Permissions Screen">
      {children ? <div className="permissions-preview">{children}</div> : null}

      <div className="phase-card permissions-card">
        <p className="phase-kicker">Before You Perform</p>
        <h1 className="phase-title">Enable Live Inputs</h1>
        <p className="phase-copy">
          Camera tracks body movement. Audio unlocks synth playback. Both are required before calibration.
        </p>

        <div className="permission-checklist">
          <div className="permission-row">
            <span className="permission-name">Camera</span>
            <span className={`permission-state${cameraReady ? ' permission-state--ready' : ''}`}>
              {cameraReady ? 'Ready' : 'Pending'}
            </span>
          </div>
          <div className="permission-row">
            <span className="permission-name">Audio</span>
            <span className={`permission-state${audioReady ? ' permission-state--ready' : ''}`}>
              {audioReady ? 'Ready' : 'Pending'}
            </span>
          </div>
        </div>

        <button
          type="button"
          className="phase-cta"
          onClick={onRequestPermissions}
          disabled={isBusy}
        >
          {isBusy ? 'Enabling...' : 'Enable Camera + Audio'}
        </button>
      </div>
    </section>
  );
}
