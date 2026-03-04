import { useCallback, useEffect, useRef, useState } from 'react';
import type { VerzuzPlayer, VerzuzRoundResult } from '../../game/verzuz';
import type { SpotifyConnection, SpotifyTrackSummary } from '../../spotify/client';
import { loadSpotifyWebPlaybackSdk, type SpotifyPlaybackPlayer } from '../../spotify/webPlayback';

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
  const activeConnection = spotifyConnections[currentPlayer];
  const activeTrackId = currentTrack?.id || '';
  const [deviceId, setDeviceId] = useState('');
  const [playbackState, setPlaybackState] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [playbackMessage, setPlaybackMessage] = useState('');
  const [isPaused, setIsPaused] = useState(true);
  const playerRef = useRef<SpotifyPlaybackPlayer | null>(null);
  const isPremiumConnected = activeConnection?.subscription === 'premium';
  const showEmbedFallback = !isPremiumConnected || playbackState === 'error';

  const writeSpotifyPlayerState = useCallback(
    async (path: string, body?: Record<string, unknown>) => {
      if (!activeConnection?.accessToken) {
        throw new Error('Spotify is not connected.');
      }

      const response = await fetch(`https://api.spotify.com/v1${path}`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${activeConnection.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: body ? JSON.stringify(body) : undefined,
      });

      if (!response.ok) {
        throw new Error(`Spotify playback request failed (${response.status}).`);
      }
    },
    [activeConnection],
  );

  const transferPlayback = useCallback(async () => {
    if (!deviceId) {
      return;
    }

    await writeSpotifyPlayerState('/me/player', {
      device_ids: [deviceId],
      play: false,
    });
  }, [deviceId, writeSpotifyPlayerState]);

  const playCurrentTrack = useCallback(async () => {
    if (!currentTrack || !deviceId) {
      return;
    }

    setPlaybackMessage('Starting playback on the Jambox browser player...');

    try {
      await transferPlayback();
      await writeSpotifyPlayerState(`/me/player/play?device_id=${encodeURIComponent(deviceId)}`, {
        uris: [currentTrack.uri],
      });
      setPlaybackState('ready');
      setIsPaused(false);
      setPlaybackMessage(`Now playing: ${currentTrack.name}`);
    } catch {
      setPlaybackState('error');
      setPlaybackMessage('Spotify blocked autoplay. Click Enable Audio and try Play on Jambox.');
    }
  }, [currentTrack, deviceId, transferPlayback, writeSpotifyPlayerState]);

  const togglePause = useCallback(async () => {
    if (!playerRef.current) {
      return;
    }

    try {
      if (isPaused) {
        await playerRef.current.resume();
        setPlaybackMessage('Playback resumed.');
        setIsPaused(false);
      } else {
        await playerRef.current.pause();
        setPlaybackMessage('Playback paused.');
        setIsPaused(true);
      }
    } catch {
      setPlaybackMessage('Could not change playback state. Reconnect Spotify and try again.');
    }
  }, [isPaused]);

  const enableAudio = useCallback(async () => {
    if (!playerRef.current) {
      return;
    }

    try {
      await playerRef.current.activateElement();
      setPlaybackMessage('Audio unlocked for this browser tab. Press Play on Jambox.');
    } catch {
      setPlaybackMessage('Audio unlock failed. Interact with the page and try again.');
    }
  }, []);

  useEffect(() => {
    setDeviceId('');
    setPlaybackMessage('');
    setIsPaused(true);
    playerRef.current?.disconnect();
    playerRef.current = null;

    if (!activeConnection) {
      setPlaybackState('idle');
      return;
    }

    if (!isPremiumConnected) {
      setPlaybackState('error');
      setPlaybackMessage('Spotify Premium is required for full in-app playback. Showing preview fallback.');
      return;
    }

    let disposed = false;
    setPlaybackState('loading');
    setPlaybackMessage('Connecting Spotify Web Playback SDK...');

    void loadSpotifyWebPlaybackSdk()
      .then((spotifySdk) => {
        if (disposed) {
          return;
        }

        const player = new spotifySdk.Player({
          name: 'Jambox Battle Player',
          getOAuthToken: (callback) => callback(activeConnection.accessToken),
          volume: 0.85,
        });

        player.addListener('ready', ({ device_id }) => {
          if (disposed) {
            return;
          }

          setDeviceId(device_id);
          setPlaybackState('ready');
          setPlaybackMessage('Spotify player ready. Press Play on Jambox to start full tracks.');
        });

        player.addListener('not_ready', () => {
          if (disposed) {
            return;
          }

          setDeviceId('');
          setPlaybackState('error');
          setPlaybackMessage('Spotify player went offline. Reconnect Spotify for this player.');
        });

        player.addListener('player_state_changed', (state) => {
          if (disposed || !state) {
            return;
          }

          setIsPaused(state.paused);
        });

        player.addListener('initialization_error', ({ message }) => {
          if (disposed) {
            return;
          }

          setPlaybackState('error');
          setPlaybackMessage(`Spotify player setup failed: ${message}`);
        });

        player.addListener('authentication_error', ({ message }) => {
          if (disposed) {
            return;
          }

          setPlaybackState('error');
          setPlaybackMessage(`Spotify auth expired: ${message}. Reconnect Spotify.`);
        });

        player.addListener('account_error', ({ message }) => {
          if (disposed) {
            return;
          }

          setPlaybackState('error');
          setPlaybackMessage(`Spotify account error: ${message}. Premium is required.`);
        });

        player.addListener('playback_error', ({ message }) => {
          if (disposed) {
            return;
          }

          setPlaybackState('error');
          setPlaybackMessage(`Spotify playback error: ${message}`);
        });

        playerRef.current = player;
        void player.connect().then((connected) => {
          if (disposed || connected) {
            return;
          }

          setPlaybackState('error');
          setPlaybackMessage('Could not connect Spotify player. Reconnect Spotify and try again.');
        });
      })
      .catch((error: unknown) => {
        if (disposed) {
          return;
        }

        const detail = error instanceof Error ? error.message : 'Unknown Spotify SDK error.';
        setPlaybackState('error');
        setPlaybackMessage(`Could not load Spotify SDK: ${detail}`);
      });

    return () => {
      disposed = true;
      playerRef.current?.disconnect();
      playerRef.current = null;
    };
  }, [activeConnection, isPremiumConnected]);

  useEffect(() => {
    if (!activeTrackId || !isPremiumConnected || playbackState !== 'ready') {
      return;
    }

    void playCurrentTrack();
  }, [activeTrackId, isPremiumConnected, playCurrentTrack, playbackState]);

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
                {showEmbedFallback ? (
                  <iframe
                    key={currentTrack.id}
                    title={`Spotify player for ${currentTrack.name}`}
                    src={`https://open.spotify.com/embed/track/${getSpotifyTrackId(currentTrack.uri)}?utm_source=generator`}
                    width="100%"
                    height="152"
                    allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
                    loading="lazy"
                  />
                ) : (
                  <>
                    <p className="vs-track-player__status">
                      {playbackMessage || 'Spotify player connected.'}
                    </p>
                    <div className="vs-track-player__controls">
                      <button
                        type="button"
                        className="phase-action"
                        onClick={() => void enableAudio()}
                        disabled={playbackState !== 'ready'}
                      >
                        Enable Audio
                      </button>
                      <button
                        type="button"
                        className="phase-action phase-action--primary"
                        onClick={() => void playCurrentTrack()}
                        disabled={playbackState !== 'ready'}
                      >
                        Play on Jambox
                      </button>
                      <button
                        type="button"
                        className="phase-action"
                        onClick={() => void togglePause()}
                        disabled={playbackState !== 'ready'}
                      >
                        {isPaused ? 'Resume' : 'Pause'}
                      </button>
                    </div>
                  </>
                )}
                <a
                  className="vs-track-player__link"
                  href={`https://open.spotify.com/track/${getSpotifyTrackId(currentTrack.uri)}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  Open In Spotify
                </a>
                {showEmbedFallback ? <p className="vs-track-player__status">{playbackMessage}</p> : null}
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
