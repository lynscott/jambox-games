import { useMemo, useState } from 'react';
import { useLobbySession } from '../../lobby/useLobbySession';
import type { DeviceRole } from '../../network/lobbyProtocol';

function getJoinUrl(lobbyCode: string, playerSlot: 1 | 2) {
  if (typeof window === 'undefined') {
    return '';
  }

  const url = new URL(import.meta.env.VITE_SPOTIFY_REDIRECT_URI || window.location.origin);
  url.searchParams.set('mode', 'phone');
  url.searchParams.set('lobby', lobbyCode);
  url.searchParams.set('player', String(playerSlot));
  return url.toString();
}

export function LobbyPairingPanel() {
  const [role, setRole] = useState<DeviceRole>('host');
  const {
    socketStatus,
    message,
    lobbyCodeInput,
    setLobbyCodeInput,
    lobby,
    accessPoint,
    phoneName,
    setPhoneName,
    pairedRoom,
    connect,
    disconnect,
    createLobby,
    joinLobby,
    leaveLobby,
    pairPhone,
  } = useLobbySession();

  const joinLinks = useMemo(() => {
    if (!accessPoint || !lobby?.code) {
      return null;
    }

    return {
      player1Url: getJoinUrl(lobby.code, 1),
      player2Url: getJoinUrl(lobby.code, 2),
    };
  }, [accessPoint, lobby?.code]);

  return (
    <section className="lobby-panel" aria-label="Lobby and Phone Pairing">
      <div className="lobby-panel__header-row">
        <h2>Lobby + Phone Pairing</h2>
        <span className={`lobby-panel__status lobby-panel__status--${socketStatus}`}>{socketStatus}</span>
      </div>
      <p className="lobby-panel__copy">{message}</p>

      <div className="lobby-panel__actions">
        <button type="button" className="phase-action" onClick={connect} disabled={socketStatus === 'connected'}>
          Connect WS
        </button>
        <button type="button" className="phase-action" onClick={disconnect} disabled={socketStatus !== 'connected'}>
          Disconnect
        </button>
      </div>

      <div className="lobby-panel__role">
        <label>
          <span>Role</span>
          <select value={role} onChange={(event) => setRole(event.currentTarget.value as DeviceRole)}>
            <option value="host">Host / TV</option>
            <option value="phone">Phone</option>
          </select>
        </label>
      </div>

      <label className="lobby-panel__input">
        <span>Lobby Code</span>
        <input
          aria-label="Lobby Code"
          value={lobbyCodeInput}
          onChange={(event) => setLobbyCodeInput(event.currentTarget.value)}
          placeholder="e.g. AB12CD"
          maxLength={6}
        />
      </label>

      {role === 'host' ? (
        <>
          <div className="lobby-panel__actions">
            <button type="button" className="phase-action phase-action--primary" onClick={createLobby}>
              Create Lobby
            </button>
            <button type="button" className="phase-action" onClick={joinLobby}>
              Join Lobby
            </button>
            <button type="button" className="phase-action" onClick={leaveLobby}>
              Leave
            </button>
          </div>

          <div className="lobby-room-list" aria-label="Lobby Access Point">
            {accessPoint ? (
              <div className="lobby-room-item">
                <div>
                  <strong>{lobby?.code}</strong>
                  <p>Phones paired: {accessPoint.phoneCount}</p>
                  {joinLinks ? (
                    <>
                      <p>Player 1 join: {joinLinks.player1Url}</p>
                      <p>Player 2 join: {joinLinks.player2Url}</p>
                    </>
                  ) : null}
                </div>
              </div>
            ) : (
              <div className="lobby-room-list__empty">Create or join a lobby to get one pairing access point.</div>
            )}
          </div>
        </>
      ) : (
        <>
          <label className="lobby-panel__input">
            <span>Phone Name</span>
            <input
              aria-label="Phone Name"
              value={phoneName}
              onChange={(event) => setPhoneName(event.currentTarget.value)}
              placeholder="Alex's Phone"
            />
          </label>

          <div className="lobby-panel__actions">
            <button type="button" className="phase-action phase-action--primary" onClick={() => pairPhone()}>
              Pair Phone
            </button>
          </div>

          {pairedRoom ? (
            <div className="lobby-phone-paired" aria-label="Phone Pairing Result">
              Paired to {pairedRoom.name} ({pairedRoom.code})
            </div>
          ) : null}
        </>
      )}
    </section>
  );
}
