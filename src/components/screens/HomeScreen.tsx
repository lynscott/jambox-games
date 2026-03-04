import { GAME_CATALOG } from '../../game/catalog';
import type { GameSelection } from '../../types';
interface HomeScreenProps {
  onSelectGame: (gameId: GameSelection) => void;
  onBackToLobby: () => void;
}

export function HomeScreen({ onSelectGame, onBackToLobby }: HomeScreenProps) {
  return (
    <section className="phase-screen home-screen" aria-label="Home Screen">
      <div className="home-brand">
        <div className="home-brand__logo-frame">
          <img
            className="home-brand__logo"
            src="/jambox-games-logo.png"
            alt="Jam Box Games logo"
          />
        </div>
        <p className="phase-kicker">Arcade Music Collection</p>
        <p className="phase-copy home-screen__copy">
          Pick the game flow for this room. Lobby and phone pairing now live on their own screen.
        </p>
        <button type="button" className="phase-action home-screen__back" onClick={onBackToLobby}>
          Back To Lobby
        </button>
      </div>

      <div className="home-grid">
        {GAME_CATALOG.map((game) => (
          <button
            key={game.id}
            type="button"
            className={`home-card home-card--${game.accent}`}
            onClick={() => onSelectGame(game.id)}
            aria-label={game.title}
          >
            {game.id === 'jam_hero' ? (
              <img
                className="home-card__logo-image"
                src="/jam-hero.png"
                alt="Jam Hero logo"
                aria-hidden="true"
              />
            ) : game.id === 'vs' ? (
              <img
                className="home-card__logo-image"
                src="/vs-logo.png"
                alt="Vs. logo"
                aria-hidden="true"
              />
            ) : game.id === 'on_beat' ? (
              <img
                className="home-card__logo-image"
                src="/on-beat-logo.png"
                alt="On Beat logo"
                aria-hidden="true"
              />
            ) : game.id === 'know_your_lyrics' ? (
              <img
                className="home-card__logo-image"
                src="/know-your-lyrics-logo.png"
                alt="Know Your Lyrics logo"
                aria-hidden="true"
              />
            ) : (
              <div className={`home-card__logo home-card__logo--${game.accent}`} aria-hidden="true">
                <span className="home-card__glyph" />
              </div>
            )}
            <div className="home-card__body">
              <div className="home-card__header">
                <h2 className="home-card__title">{game.title}</h2>
                <span
                  className={`home-card__status${
                    game.status === 'Available' ? ' home-card__status--live' : ''
                  }`}
                >
                  {game.status}
                </span>
              </div>
              <p className="home-card__description">{game.shortDescription}</p>
              <p className="home-card__detail">{game.detail}</p>
            </div>
          </button>
        ))}
      </div>
    </section>
  );
}
