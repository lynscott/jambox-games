import type { OnBeatResultSummary } from '../../game/onBeat';

interface OnBeatResultsScreenProps {
  result: OnBeatResultSummary;
  onPlayAgain: () => void;
  onChangeSetup: () => void;
  onBackToMenu: () => void;
}

export function OnBeatResultsScreen({
  result,
  onPlayAgain,
  onChangeSetup,
  onBackToMenu,
}: OnBeatResultsScreenProps) {
  return (
    <section className="phase-screen on-beat-results-screen" aria-label="On Beat Results Screen">
      <div className="phase-card on-beat-card">
        <p className="phase-kicker">Say The Word On Beat</p>
        <h1 className="phase-title">On Beat Scoreboard</h1>
        <p className="phase-copy">
          Difficulty: <strong>{result.difficulty.toUpperCase()}</strong> • {result.roundCount} continuous rounds •{' '}
          {result.promptsPerRound} beats each
        </p>

        <div className="on-beat-results-grid">
          <section className="on-beat-result-card">
            <span>Total Score</span>
            <strong>{result.score}</strong>
          </section>
          <section className="on-beat-result-card">
            <span>Perfect</span>
            <strong>{result.perfectHits}</strong>
          </section>
          <section className="on-beat-result-card">
            <span>Good</span>
            <strong>{result.goodHits}</strong>
          </section>
          <section className="on-beat-result-card">
            <span>Misses</span>
            <strong>{result.misses}</strong>
          </section>
        </div>

        <div className="vs-history">
          <h2>Beat Breakdown</h2>
          <ul>
            {result.judgements.map((entry, index) => (
              <li key={`${entry.prompt.word}-${index}`}>
                Round {Math.floor(index / result.promptsPerRound) + 1} Beat {(index % result.promptsPerRound) + 1}:{' '}
                {entry.prompt.emoji} {entry.prompt.word} - {entry.grade}
                {entry.offsetMs !== null ? ` (${entry.offsetMs > 0 ? '+' : ''}${entry.offsetMs}ms)` : ''}
              </li>
            ))}
          </ul>
        </div>

        <div className="phase-actions">
          <button type="button" className="phase-action phase-action--primary" onClick={onPlayAgain}>
            Play Again
          </button>
          <button type="button" className="phase-action" onClick={onChangeSetup}>
            Change Level
          </button>
          <button type="button" className="phase-action" onClick={onBackToMenu}>
            Back To Menu
          </button>
        </div>
      </div>
    </section>
  );
}
