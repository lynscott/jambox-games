import type { ScoreSnapshot } from '../../types';

interface ResultsScreenProps {
  score: ScoreSnapshot;
  highScore: number;
  isNewHighScore: boolean;
  onPlayAgain: () => void;
  onChangeSetup: () => void;
  onBackToMenu: () => void;
}

function safeNumber(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

export function ResultsScreen({
  score,
  highScore,
  isNewHighScore,
  onPlayAgain,
  onChangeSetup,
  onBackToMenu,
}: ResultsScreenProps) {
  const total = safeNumber(score.total);
  const timing = safeNumber(score.timing);
  const consistency = safeNumber(score.consistency);
  const comboBonus = safeNumber(score.comboBonus);
  const maxCombo = safeNumber(score.maxCombo);
  const displayHighScore = Math.max(safeNumber(highScore), total);

  return (
    <section className="phase-screen results-screen" aria-label="Results Screen">
      <div className="phase-card results-card">
        <p className="phase-kicker">Run Complete</p>
        <h1 className="phase-title">Performance Score</h1>
        <p className="results-total">{total.toLocaleString()}</p>
        <p className="results-high-score">
          High Score: <strong>{displayHighScore.toLocaleString()}</strong>
        </p>
        {isNewHighScore ? <p className="results-badge">New High Score</p> : null}

        <div className="results-breakdown">
          <div className="results-row">
            <span>Timing</span>
            <strong>{timing.toLocaleString()}</strong>
          </div>
          <div className="results-row">
            <span>Consistency</span>
            <strong>{consistency.toLocaleString()}</strong>
          </div>
          <div className="results-row">
            <span>Combo Bonus</span>
            <strong>{comboBonus.toLocaleString()}</strong>
          </div>
          <div className="results-row">
            <span>Max Combo</span>
            <strong>{maxCombo}x</strong>
          </div>
        </div>

        <div className="phase-actions">
          <button type="button" className="phase-action phase-action--primary" onClick={onPlayAgain}>
            Play Again
          </button>
          <button type="button" className="phase-action" onClick={onChangeSetup}>
            Change Setup
          </button>
          <button type="button" className="phase-action" onClick={onBackToMenu}>
            Back To Menu
          </button>
        </div>
      </div>
    </section>
  );
}
