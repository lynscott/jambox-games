import type { LyricsResultSummary } from '../../game/lyrics';

interface LyricsResultsScreenProps {
  result: LyricsResultSummary;
  onPlayAgain: () => void;
  onChangeSetup: () => void;
  onBackToMenu: () => void;
}

export function LyricsResultsScreen({
  result,
  onPlayAgain,
  onChangeSetup,
  onBackToMenu,
}: LyricsResultsScreenProps) {
  const playerOne = result.players[1];
  const playerTwo = result.players[2];
  const winnerLabel =
    playerOne.score === playerTwo.score
      ? 'Tie'
      : playerOne.score > playerTwo.score
        ? 'Player 1 Wins'
        : 'Player 2 Wins';

  return (
    <section className="phase-screen lyrics-results-screen" aria-label="Lyrics Results Screen">
      <div className="phase-card lyrics-card">
        <p className="phase-kicker">Know Your Lyrics</p>
        <h1 className="phase-title">Lyrics Scoreboard</h1>
        <p className="phase-copy">
          Track: <strong>{result.trackTitle}</strong>
        </p>
        <p className="phase-copy">
          Result: <strong>{winnerLabel}</strong>
        </p>

        <div className="on-beat-results-grid">
          <section className="on-beat-result-card">
            <span>Player 1</span>
            <strong>{playerOne.score}</strong>
          </section>
          <section className="on-beat-result-card">
            <span>Player 2</span>
            <strong>{playerTwo.score}</strong>
          </section>
          <section className="on-beat-result-card">
            <span>P1 Perfect</span>
            <strong>{playerOne.perfectHits}</strong>
          </section>
          <section className="on-beat-result-card">
            <span>P2 Perfect</span>
            <strong>{playerTwo.perfectHits}</strong>
          </section>
        </div>

        <div className="vs-history">
          <h2>Round Breakdown</h2>
          <ul>
            {result.rounds.map((round) => (
              <li key={`round-${round.round}`}>
                Round {round.round}: P1 {round.playerOne.grade} ({round.playerOne.totalScore}) | P2 {round.playerTwo.grade}{' '}
                ({round.playerTwo.totalScore})
              </li>
            ))}
          </ul>
        </div>

        <div className="phase-actions">
          <button type="button" className="phase-action phase-action--primary" onClick={onPlayAgain}>
            Play Again
          </button>
          <button type="button" className="phase-action" onClick={onChangeSetup}>
            Change Track
          </button>
          <button type="button" className="phase-action" onClick={onBackToMenu}>
            Back To Menu
          </button>
        </div>
      </div>
    </section>
  );
}
