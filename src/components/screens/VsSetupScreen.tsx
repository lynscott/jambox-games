import { VERZUZ_CATEGORIES } from '../../game/verzuz';
import type { VerzuzPlayer } from '../../game/verzuz';
import type { SpotifyConnection } from '../../spotify/client';

interface VsSetupScreenProps {
  players: VerzuzPlayer[];
  spotifyConnections: Array<SpotifyConnection | null>;
  spotifyEnabled: boolean;
  roundCount: number;
  selectedCategories: string[];
  onPlayerChange: (playerIndex: number, field: 'name', value: string) => void;
  onConnectSpotify: (playerIndex: number) => void;
  onDisconnectSpotify: (playerIndex: number) => void;
  onRoundCountChange: (roundCount: number) => void;
  onToggleCategory: (category: string) => void;
  onStartBattle: () => void;
  onBackToMenu: () => void;
}

export function VsSetupScreen({
  players,
  spotifyConnections,
  spotifyEnabled,
  roundCount,
  selectedCategories,
  onPlayerChange,
  onConnectSpotify,
  onDisconnectSpotify,
  onRoundCountChange,
  onToggleCategory,
  onStartBattle,
  onBackToMenu,
}: VsSetupScreenProps) {
  return (
    <section className="phase-screen vs-setup-screen" aria-label="Verzuz Setup Screen">
      <div className="phase-card vs-setup-card">
        <p className="phase-kicker">Jam Box Games</p>
        <h1 className="phase-title">Verzuz With Your Friends</h1>
        <p className="phase-copy">
          Inspired by the song-for-song spirit of Verzuz: build the matchup, set the battle categories,
          and go round for round to prove whose taste lands hardest.
        </p>

        <div className="vs-player-grid">
          {players.map((player, playerIndex) => (
            <section key={playerIndex} className="vs-player-card">
              <h2>{playerIndex === 0 ? 'Player One' : 'Player Two'}</h2>
              <label className="vs-field">
                <span>Name</span>
                <input
                  aria-label={`${playerIndex === 0 ? 'Player One' : 'Player Two'} Name`}
                  value={player.name}
                  onChange={(event) => onPlayerChange(playerIndex, 'name', event.currentTarget.value)}
                  placeholder={playerIndex === 0 ? 'Swizz' : 'Timbaland'}
                />
              </label>
              <div className="vs-player-auth">
                {spotifyConnections[playerIndex] ? (
                  <>
                    <p>
                      Connected as <strong>{spotifyConnections[playerIndex]?.profileName}</strong>
                    </p>
                    <button
                      type="button"
                      className="phase-action"
                      onClick={() => onDisconnectSpotify(playerIndex)}
                    >
                      Disconnect Spotify
                    </button>
                  </>
                ) : (
                  <>
                    <p>
                      {spotifyEnabled
                        ? 'Connect Spotify so this player can manage their own Jambox Verzuz queue from their phone.'
                        : 'Add `VITE_SPOTIFY_CLIENT_ID` to enable Spotify account connection.'}
                    </p>
                    <button
                      type="button"
                      className="phase-action"
                      onClick={() => onConnectSpotify(playerIndex)}
                      disabled={!spotifyEnabled}
                    >
                      Connect Spotify
                    </button>
                  </>
                )}
              </div>
            </section>
          ))}
        </div>

        <label className="vs-field vs-field--compact">
          <span>Rounds</span>
          <select
            aria-label="Verzuz Round Count"
            value={String(roundCount)}
            onChange={(event) => onRoundCountChange(Number(event.currentTarget.value))}
          >
            <option value="3">3 rounds</option>
            <option value="5">5 rounds</option>
            <option value="7">7 rounds</option>
            <option value="10">10 rounds</option>
          </select>
        </label>

        <div className="vs-category-header">
          <div>
            <h2>Battle Categories</h2>
            <p>Pick the buckets for this matchup. Minimum one.</p>
          </div>
          <span className="vs-category-count">{selectedCategories.length} selected</span>
        </div>

        <div className="vs-category-grid" aria-label="Verzuz Categories">
          {VERZUZ_CATEGORIES.map((category) => {
            const selected = selectedCategories.includes(category);
            return (
              <button
                key={category}
                type="button"
                className={`vs-category-chip${selected ? ' vs-category-chip--selected' : ''}`}
                onClick={() => onToggleCategory(category)}
                aria-pressed={selected}
              >
                {category}
              </button>
            );
          })}
        </div>

        <div className="phase-actions">
          <button type="button" className="phase-action phase-action--primary" onClick={onStartBattle}>
            Start Verzuz
          </button>
          <button type="button" className="phase-action" onClick={onBackToMenu}>
            Back To Menu
          </button>
        </div>
      </div>
    </section>
  );
}
