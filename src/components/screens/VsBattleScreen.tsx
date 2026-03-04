import type { VerzuzPlayer, VerzuzRoundResult } from '../../game/verzuz';
import type { SpotifyConnection, SpotifyTrackSummary } from '../../spotify/client';

function getSpotifyTrackId(uri: string) {
  const parts = uri.split(':');
  return parts[2] || '';
}

interface VsBattleScreenProps {
  players: VerzuzPlayer[];
  spotifyConnections: Array<SpotifyConnection | null>;
  scores: [number, number];
  roundIndex: number;
  roundCount: number;
  currentCategory: string;
  history: VerzuzRoundResult[];
  currentTrack: SpotifyTrackSummary | null;
  onAwardRound: (winner: 'player1' | 'player2' | 'tie') => void;
  onBackToSetup: () => void;
}

export function VsBattleScreen({
  players,
  spotifyConnections,
  scores,
  roundIndex,
  roundCount,
  currentCategory,
  history,
  currentTrack,
  onAwardRound,
  onBackToSetup,
}: VsBattleScreenProps) {
  const currentPlayer = roundIndex % 2 === 0 ? 0 : 1;

  return (
    <section className="phase-screen vs-battle-screen" aria-label="Verzuz Battle Screen">
      <div className="phase-card vs-battle-card">
        <p className="phase-kicker">Verzuz Battle</p>
        <div className="vs-battle-header">
          <div>
            <h1 className="phase-title">Round {roundIndex + 1}</h1>
            <p className="phase-copy">
              Category: <strong>{currentCategory}</strong>
            </p>
          </div>
          <p className="vs-round-meter">
            {roundIndex + 1} / {roundCount}
          </p>
        </div>

        <div className="vs-scoreboard">
          {players.map((player, index) => (
            <section
              key={index}
              className={`vs-score-card${currentPlayer === index ? ' vs-score-card--active' : ''}`}
            >
              <p>{player.name || `Player ${index + 1}`}</p>
              <strong>{scores[index]}</strong>
              <span>
                {spotifyConnections[index]?.profileName || 'Spotify not connected'}
              </span>
            </section>
          ))}
        </div>

        <div className="vs-battle-prompt">
          <h2>Now Up</h2>
          <p>
            {players[currentPlayer].name || `Player ${currentPlayer + 1}`} throws the next song pick for{' '}
            <strong>{currentCategory}</strong>. Sell it like charades, let the room react, then lock the round winner.
          </p>
        </div>

        <div className="vs-battle-prompt">
          <h2>Round Song</h2>
          {currentTrack ? (
            <>
              <p className="vs-track-status vs-track-status--received">
                Received: <strong>{currentTrack.name}</strong>
              </p>
              <p>
                Queued from phone: <strong>{currentTrack.name}</strong> by {currentTrack.artistNames}
              </p>
              <div className="vs-track-player">
                <iframe
                  key={currentTrack.id}
                  title={`Spotify player for ${currentTrack.name}`}
                  src={`https://open.spotify.com/embed/track/${getSpotifyTrackId(currentTrack.uri)}?utm_source=generator`}
                  width="100%"
                  height="152"
                  allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
                  loading="lazy"
                />
                <a
                  className="vs-track-player__link"
                  href={`https://open.spotify.com/track/${getSpotifyTrackId(currentTrack.uri)}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  Open In Spotify
                </a>
              </div>
            </>
          ) : (
            <>
              <p className="vs-track-status">
                Waiting for Player {currentPlayer + 1} to send a song.
              </p>
              <p>
              The active player should use their phone to manage the <strong>Jambox Verzuz</strong> playlist and send the
              first song in that queue for this round.
              </p>
            </>
          )}
        </div>

        <div className="phase-actions">
          <button type="button" className="phase-action phase-action--primary" onClick={() => onAwardRound('player1')}>
            {players[0].name || 'Player 1'} wins
          </button>
          <button type="button" className="phase-action phase-action--primary" onClick={() => onAwardRound('player2')}>
            {players[1].name || 'Player 2'} wins
          </button>
          <button type="button" className="phase-action" onClick={() => onAwardRound('tie')}>
            Tie Round
          </button>
        </div>

        <button type="button" className="phase-action" onClick={onBackToSetup}>
          Change Setup
        </button>

        {history.length > 0 ? (
          <div className="vs-history">
            <h2>Battle So Far</h2>
            <ul>
              {history.map((entry) => (
                <li key={`${entry.round}-${entry.category}`}>
                  Round {entry.round}: {entry.category} -{' '}
                  {entry.winner === 'tie'
                    ? 'Tie'
                    : players[entry.winner === 'player1' ? 0 : 1].name || entry.winner}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </section>
  );
}
