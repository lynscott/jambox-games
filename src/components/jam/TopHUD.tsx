import { useAppStore } from '../../state/store';

function formatTime(ms: number): string {
  const safeMs = Number.isFinite(ms) ? ms : 0;
  const totalSec = Math.max(0, Math.ceil(safeMs / 1000));
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${min}:${sec.toString().padStart(2, '0')}`;
}

function safeNumber(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

interface TopHUDProps {
  sectionCallout: string;
  strikeWindowActive: boolean;
}

export function TopHUD({ sectionCallout, strikeWindowActive }: TopHUDProps) {
  const timeRemaining = useAppStore((s) => s.jamTimeRemainingMs);
  const score = useAppStore((s) => s.score);
  const chord = useAppStore((s) => s.diagnostics.currentChord);
  const scoreTotal = safeNumber(score.total);
  const combo = safeNumber(score.combo);
  const multiplier = safeNumber(score.multiplier, 1);

  const isUrgent = timeRemaining <= 10_000 && timeRemaining > 0;

  return (
    <header className="top-hud">
      <div className={`hud-timer${isUrgent ? ' hud-timer--urgent' : ''}`}>
        {formatTime(timeRemaining)}
      </div>

      <div className="hud-score">{scoreTotal.toLocaleString()}</div>

      <div className={`hud-combo${combo > 0 ? ' hud-combo--active' : ''}`}>
        {combo > 0 ? (
          <>
            {combo}x
            {multiplier > 1 && (
              <span className="hud-multiplier">{multiplier.toFixed(1)}x</span>
            )}
          </>
        ) : (
          <span>-</span>
        )}
      </div>

      <div className="hud-chord">{chord}</div>

      <div className="hud-cue">{sectionCallout}</div>

      <div className={`hud-strike${strikeWindowActive ? ' hud-strike--active' : ''}`}>
        {strikeWindowActive ? 'HIT' : 'READY'}
      </div>
    </header>
  );
}
