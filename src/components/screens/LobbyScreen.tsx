import { LobbyPairingPanel } from '../lobby/LobbyPairingPanel';
import type { GameSelection } from '../../types';

interface LobbyScreenProps {
  onOpenGame: (gameId: GameSelection) => void;
  onBackToMainMenu: () => void;
}

export function LobbyScreen({ onOpenGame, onBackToMainMenu }: LobbyScreenProps) {
  return (
    <section className="phase-screen lobby-screen" aria-label="Lobby Screen">
      <div className="lobby-screen__hero">
        <p className="phase-kicker">Room First</p>
        <h1 className="phase-title">Lobby + Phone Pairing</h1>
        <p className="phase-copy">
          Build the room first, pair player phones, then jump straight into the game flow you want to run.
        </p>
      </div>

      <div className="lobby-screen__panel">
        <LobbyPairingPanel />
      </div>

      <div className="phase-actions lobby-screen__actions">
        <button type="button" className="phase-action" onClick={onBackToMainMenu}>
          Back To Main Menu
        </button>
        <button type="button" className="phase-action phase-action--primary" onClick={() => onOpenGame('vs')}>
          Go To Verzuz
        </button>
      </div>
    </section>
  );
}
