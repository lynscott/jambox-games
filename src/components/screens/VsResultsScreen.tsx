import type { VerzuzPlayer, VerzuzRoundResult } from '../../game/verzuz';
import type { SpotifyTrackSummary } from '../../spotify/client';

interface VsResultsScreenProps {
  players: VerzuzPlayer[];
  scores: [number, number];
  history: VerzuzRoundResult[];
  roundTracks: Record<number, SpotifyTrackSummary | null>;
  onPlayAgain: () => void;
  onChangeSetup: () => void;
  onBackToMenu: () => void;
}

export function VsResultsScreen({
  players,
  scores,
  history,
  roundTracks,
  onPlayAgain,
  onChangeSetup,
  onBackToMenu,
}: VsResultsScreenProps) {
  const winnerLabel =
    scores[0] === scores[1]
      ? 'Dead Heat'
      : scores[0] > scores[1]
        ? players[0].name || 'Player 1'
        : players[1].name || 'Player 2';

  return (
    <section className="phase-screen vs-results-screen" aria-label="Verzuz Results Screen">
      <div className="phase-card vs-results-card">
        <p className="phase-kicker">Battle Locked</p>
        <h1 className="phase-title">Verzuz Scoreboard</h1>
        <p className="results-badge">{winnerLabel}</p>

        <div className="results-breakdown">
          {players.map((player, index) => (
            <div key={index} className="results-row">
              <span>{player.name || `Player ${index + 1}`}</span>
              <strong>{scores[index]}</strong>
            </div>
          ))}
        </div>

        <div className="vs-history">
          <h2>Round Log</h2>
          <ul>
            {history.map((entry) => (
            <li key={`${entry.round}-${entry.category}`}>
              Round {entry.round}: {entry.category} -{' '}
              {entry.winner === 'tie'
                ? 'Tie'
                : players[entry.winner === 'player1' ? 0 : 1].name || entry.winner}
              {roundTracks[entry.round]
                ? ` | ${roundTracks[entry.round]?.name} - ${roundTracks[entry.round]?.artistNames}`
                : ''}
            </li>
          ))}
        </ul>
        </div>

        <div className="phase-actions">
          <button type="button" className="phase-action phase-action--primary" onClick={onPlayAgain}>
            Run It Back
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
