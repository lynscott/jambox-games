import { GAME_CATALOG } from '../../game/catalog';
import type { GameSelection } from '../../types';

interface HomeScreenProps {
  onSelectGame: (gameId: GameSelection) => void;
}

export function HomeScreen({ onSelectGame }: HomeScreenProps) {
  return (
    <section className="phase-screen home-screen" aria-label="Home Screen">
      <div className="home-brand">
        <div className="home-brand__logo-wrap">
          <img
            className="home-brand__logo"
            src="/jambox-games-logo.png"
            alt="Jam Box Games logo"
          />
        </div>
        <p className="phase-kicker">Arcade Music Collection</p>
        <h1 className="phase-title home-screen__title">Jam Box Games</h1>
        <p className="phase-copy home-screen__copy">
          Pick a mode, step into the lights, and let the room become the controller.
        </p>
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
            <div className={`home-card__logo home-card__logo--${game.accent}`} aria-hidden="true">
              <span className="home-card__glyph" />
            </div>
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
